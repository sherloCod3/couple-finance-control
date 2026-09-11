import { describe, expect, it } from "vitest";
import type { Card, CardPurchase, Transaction } from "../models/entities";
import { Money } from "../models/money";
import { idOf } from "../types";
import type { AccountId, CardId, CategoryId, PurchaseId, TransactionId } from "../types";
import { availableLimit, buildStatements, cardOutstanding, dueDateOf, periodOf } from "./cards";

const card: Card = {
  id: idOf<CardId>("c1"),
  householdId: idOf("h1"),
  issuer: "Banco Demo",
  nickname: "Demo Card",
  last4: "4321",
  limit: Money.fromCents(3500_00),
  closingDay: 5,
  dueDay: 12,
  createdAt: 0,
  updatedAt: 0,
};

let pseq = 0;
const purchase = (date: string, cents: number, period: string): CardPurchase => ({
  id: idOf<PurchaseId>(`p${++pseq}`),
  cardId: card.id,
  amount: Money.fromCents(cents),
  date,
  description: "fixture",
  categoryId: idOf<CategoryId>("fun"),
  period,
  createdBy: idOf("m1"),
  createdAt: pseq,
  updatedAt: pseq,
});

describe("credit card domain rules (FIN-09)", () => {
  it("a purchase on the closing day stays in the current cycle; one day later rolls over", () => {
    expect(periodOf(card, "2025-06-05")).toBe("2025-06");
    expect(periodOf(card, "2025-06-06")).toBe("2025-07");
  });

  it("the statement is due on the due day of the following month", () => {
    expect(dueDateOf(card, "2025-06")).toBe("2025-07-12");
  });

  it("purchases reduce available credit but never bank cash", () => {
    const purchases = [purchase("2025-06-10", 100_00, "2025-06")];
    const statements = buildStatements(card, purchases, [], "2025-06-20");
    expect(cardOutstanding(statements).cents).toBe(100_00);
    expect(availableLimit(card, statements).cents).toBe(3400_00);
    // no account transaction exists — bank cash is untouched by design
    expect(statements[0].status).toBe("open");
  });

  it("a purchase belongs to exactly one statement", () => {
    const purchases = [purchase("2025-06-10", 100_00, periodOf(card, "2025-06-10"))];
    const statements = buildStatements(card, purchases, [], "2025-06-20");
    const containing = statements.filter((s) => s.purchases.some((p) => p.id === purchases[0].id));
    expect(containing.length).toBe(1);
  });

  it("paying the statement settles the obligation and restores the limit", () => {
    const purchases = [purchase("2025-06-10", 100_00, "2025-06")];
    const payment: Transaction = {
      id: idOf<TransactionId>("t-pay"),
      householdId: idOf("h1"),
      accountId: idOf<AccountId>("a1"),
      type: "EXPENSE",
      amount: Money.fromCents(100_00),
      date: "2025-07-12",
      description: "Card payment ••4321",
      categoryId: null,
      note: null,
      createdBy: idOf("m1"),
      transferGroupId: null,
      recurringId: null,
      cardId: card.id,
      statementPeriod: "2025-06",
      createdAt: 0,
      updatedAt: 0,
    };
    const statements = buildStatements(card, purchases, [payment], "2025-07-15");
    expect(statements[0].status).toBe("paid");
    expect(statements[0].remaining.cents).toBe(0);
    expect(availableLimit(card, statements).cents).toBe(3500_00);
  });

  it("an unpaid statement past its due date is overdue", () => {
    const purchases = [purchase("2025-06-10", 50_00, "2025-06")];
    const statements = buildStatements(card, purchases, [], "2025-07-20");
    expect(statements[0].status).toBe("overdue");
  });
});
