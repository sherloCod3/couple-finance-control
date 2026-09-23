import { describe, expect, it } from "vitest";
import type { CardPurchase, Transaction } from "../models/entities";
import { Money } from "../models/money";
import { idOf } from "../types";
import type {
  AccountId,
  CardId,
  CategoryId,
  PurchaseId,
  TransactionId,
  TransferGroupId,
} from "../types";
import {
  accountBalance,
  countsAsExpense,
  countsAsIncome,
  expensesByCategory,
  monthTotals,
} from "./finance";

const A = (s: string): AccountId => idOf<AccountId>(s);
const C = (s: string): CategoryId => idOf<CategoryId>(s);
const G = (s: string): TransferGroupId => idOf<TransferGroupId>(s);
const K = (s: string): CardId => idOf<CardId>(s);

let seq = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: idOf<TransactionId>(`t${++seq}`),
  householdId: idOf("h1"),
  accountId: A("a1"),
  type: "EXPENSE",
  amount: Money.fromCents(1000),
  date: "2025-06-15",
  description: "fixture",
  categoryId: null,
  note: null,
  createdBy: idOf("m1"),
  transferGroupId: null,
  recurringId: null,
  cardId: null,
  statementPeriod: null,
  createdAt: seq,
  updatedAt: seq,
  ...over,
});

let pseq = 0;
const purchase = (over: Partial<CardPurchase>): CardPurchase => ({
  id: idOf<PurchaseId>(`p${++pseq}`),
  cardId: K("c1"),
  amount: Money.fromCents(1000),
  date: "2025-06-15",
  description: "fixture",
  categoryId: null,
  period: "2025-06",
  createdBy: idOf("m1"),
  createdAt: pseq,
  updatedAt: pseq,
  ...over,
});

describe("transaction classification & balances", () => {
  it("INCOME adds, EXPENSE subtracts, ADJUSTMENT corrects (signed)", () => {
    const opening = Money.fromCents(100_00);
    const txs = [
      tx({ type: "INCOME", amount: Money.fromCents(50_00) }),
      tx({ type: "EXPENSE", amount: Money.fromCents(30_00) }),
      tx({ type: "ADJUSTMENT", amount: Money.fromCents(-1_00) }),
    ];
    expect(accountBalance(opening, txs).cents).toBe(119_00);
  });

  it("the two legs of a transfer net to zero — household wealth is unchanged", () => {
    const group = G("g1");
    const legs = [
      tx({ accountId: A("a1"), type: "EXPENSE", transferGroupId: group, amount: Money.fromCents(200_00) }),
      tx({ accountId: A("a2"), type: "INCOME", transferGroupId: group, amount: Money.fromCents(200_00) }),
    ];
    const a1 = accountBalance(Money.fromCents(500_00), legs.filter((t) => t.accountId === "a1"));
    const a2 = accountBalance(Money.fromCents(100_00), legs.filter((t) => t.accountId === "a2"));
    expect(a1.add(a2).cents).toBe(600_00); // 500 + 100, unchanged
  });

  it("transfer legs and card payments are not income/expense analytics events", () => {
    const transferLeg = tx({ type: "EXPENSE", transferGroupId: G("g2") });
    const cardPayment = tx({ type: "EXPENSE", cardId: K("c1"), statementPeriod: "2025-06" });
    const realExpense = tx({ type: "EXPENSE" });
    expect(countsAsExpense(transferLeg)).toBe(false);
    expect(countsAsExpense(cardPayment)).toBe(false);
    expect(countsAsExpense(realExpense)).toBe(true);
    expect(countsAsIncome(tx({ type: "INCOME", transferGroupId: G("g3") }))).toBe(false);
    expect(countsAsIncome(tx({ type: "INCOME" }))).toBe(true);
  });

  it("month totals count only real income and expenses of that month", () => {
    const txs = [
      tx({ type: "INCOME", amount: Money.fromCents(1000), date: "2025-06-01" }),
      tx({ type: "EXPENSE", amount: Money.fromCents(400), date: "2025-06-20" }),
      tx({ type: "EXPENSE", amount: Money.fromCents(999), date: "2025-07-01" }), // other month
      tx({ type: "EXPENSE", amount: Money.fromCents(777), transferGroupId: G("g4") }), // transfer leg
    ];
    const totals = monthTotals(txs, "2025-06");
    expect(totals.income.cents).toBe(1000);
    expect(totals.expenses.cents).toBe(400);
    expect(totals.net.cents).toBe(600);
  });

  it("month net includes signed adjustments (decision A/A/A)", () => {
    const txs = [
      tx({ type: "INCOME", amount: Money.fromCents(1000), date: "2025-06-01" }),
      tx({ type: "EXPENSE", amount: Money.fromCents(400), date: "2025-06-20" }),
      tx({ type: "ADJUSTMENT", amount: Money.fromCents(50), date: "2025-06-15" }),
      tx({ type: "ADJUSTMENT", amount: Money.fromCents(-20), date: "2025-06-18" }),
      tx({ type: "ADJUSTMENT", amount: Money.fromCents(999), date: "2025-07-01" }), // other month
    ];
    const totals = monthTotals(txs, "2025-06");
    expect(totals.income.cents).toBe(1000);
    expect(totals.expenses.cents).toBe(400);
    expect(totals.net.cents).toBe(630); // 1000 − 400 + 50 − 20
  });

  it("category analytics are based on actual expense transactions only", () => {
    const txs = [
      tx({ categoryId: C("groceries"), amount: Money.fromCents(200) }),
      tx({ categoryId: C("groceries"), amount: Money.fromCents(300) }),
      tx({ categoryId: C("fun"), amount: Money.fromCents(100) }),
      tx({ categoryId: C("groceries"), amount: Money.fromCents(50), transferGroupId: G("g5") }),
      tx({ type: "INCOME", categoryId: C("groceries"), amount: Money.fromCents(5000) }),
    ];
    const map = expensesByCategory(txs, "2025-06");
    expect(map.get("groceries")?.cents).toBe(500);
    expect(map.get("fun")?.cents).toBe(100);
    expect(map.size).toBe(2);
  });
});

describe("spending vs cash net (Section 04 — two month figures)", () => {
  it("spending includes card purchases; net stays a cash reconciliation", () => {
    const txs = [
      tx({ type: "INCOME", amount: Money.fromCents(10_000), date: "2025-06-01" }),
      tx({ type: "EXPENSE", amount: Money.fromCents(4_000), date: "2025-06-20" }),
      // A statement payment moves cash but is NOT new spending.
      tx({
        type: "EXPENSE",
        amount: Money.fromCents(2_500),
        date: "2025-06-25",
        cardId: K("c1"),
        statementPeriod: "2025-05",
      }),
    ];
    const purchases = [
      // Purchased in May → June card spending stays zero.
      purchase({ amount: Money.fromCents(2_500), date: "2025-05-20", period: "2025-06" }),
    ];
    const totals = monthTotals(txs, "2025-06", purchases);
    expect(totals.income.cents).toBe(10_000);
    expect(totals.expenses.cents).toBe(4_000); // cash expenses only
    expect(totals.cardSpending.cents).toBe(0);
    expect(totals.spending.cents).toBe(4_000);
    expect(totals.net.cents).toBe(6_000); // income − cash expenses
  });

  it("a card purchase is spending in the month it was made, not the statement period", () => {
    const purchases = [
      purchase({ amount: Money.fromCents(1_500), date: "2025-06-28", period: "2025-07" }),
    ];
    const totals = monthTotals([], "2025-06", purchases);
    expect(totals.cardSpending.cents).toBe(1_500);
    expect(totals.spending.cents).toBe(1_500);
    expect(totals.expenses.cents).toBe(0);
    expect(totals.net.cents).toBe(0); // no cash moved yet
  });

  it("settling a purchase is never double-counted as spending", () => {
    const junePurchase = purchase({
      amount: Money.fromCents(1_000),
      date: "2025-06-10",
      period: "2025-06",
    });
    const julyPayment = tx({
      type: "EXPENSE",
      amount: Money.fromCents(1_000),
      date: "2025-07-12",
      cardId: K("c1"),
      statementPeriod: "2025-06",
    });
    expect(monthTotals([], "2025-06", [junePurchase]).spending.cents).toBe(1_000);
    expect(monthTotals([julyPayment], "2025-07", []).spending.cents).toBe(0);
  });

  it("category analytics include card purchases, dated by purchase", () => {
    const txs = [tx({ categoryId: C("groceries"), amount: Money.fromCents(200), date: "2025-06-05" })];
    const purchases = [
      purchase({ categoryId: C("groceries"), amount: Money.fromCents(300), date: "2025-06-20" }),
      purchase({ categoryId: C("fun"), amount: Money.fromCents(900), date: "2025-07-02" }),
    ];
    const map = expensesByCategory(txs, "2025-06", purchases);
    expect(map.get("groceries")?.cents).toBe(500);
    expect(map.get("fun")).toBeUndefined(); // different month
  });

  it("an uncategorized card purchase lands in the uncategorized bucket", () => {
    const purchases = [purchase({ amount: Money.fromCents(700), date: "2025-06-03" })];
    const map = expensesByCategory([], "2025-06", purchases);
    expect(map.get("__uncategorized__")?.cents).toBe(700);
  });
});
