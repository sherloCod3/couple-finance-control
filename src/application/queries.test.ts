/**
 * The Activity-page ledger summary must apply the domain classification rule
 * exactly once, in the application layer (ADR-001). These tests pin the rule so
 * a card payment or transfer leg can never re-appear inside an income/expense
 * total (the regression this file exists to prevent).
 */
import { describe, expect, it } from "vitest";
import { summarizeTxViews, type TxView } from "./queries";

let seq = 0;
const view = (over: Partial<TxView>): TxView => ({
  id: `v${++seq}`,
  kind: "EXPENSE",
  amountCents: 1000,
  signedCents: -1000,
  date: "2025-06-15",
  description: "fixture",
  note: null,
  accountId: "a1",
  accountName: "Checking",
  categoryId: null,
  categoryName: null,
  categoryColor: null,
  memberName: "Ana",
  transferGroupId: null,
  recurringId: null,
  recurringDesc: null,
  cardId: null,
  cardLast4: null,
  statementPeriod: null,
  createdAt: seq,
  ...over,
});

describe("summarizeTxViews (Activity page ledger summary)", () => {
  it("counts income and real expenses, and nets signed adjustments", () => {
    const s = summarizeTxViews([
      view({ kind: "INCOME", amountCents: 10_000, signedCents: 10_000 }),
      view({ kind: "EXPENSE", amountCents: 4_000, signedCents: -4_000 }),
      view({ kind: "ADJUSTMENT", amountCents: 250, signedCents: 250 }),
      view({ kind: "ADJUSTMENT", amountCents: 120, signedCents: -120 }),
    ]);
    expect(s.incomeCents).toBe(10_000);
    expect(s.expenseCents).toBe(4_000);
    expect(s.adjustmentCents).toBe(130);
    expect(s.netCents).toBe(10_000 - 4_000 + 130);
  });

  it("excludes card payments from expenses (already counted at purchase time)", () => {
    const s = summarizeTxViews([
      view({ kind: "EXPENSE", amountCents: 4_000, signedCents: -4_000 }),
      view({
        kind: "CARD_PAYMENT",
        amountCents: 2_500,
        signedCents: -2_500,
        cardId: "c1",
        statementPeriod: "2025-05",
      }),
    ]);
    expect(s.expenseCents).toBe(4_000);
    expect(s.netCents).toBe(-4_000);
  });

  it("excludes both legs of a transfer from every total", () => {
    const s = summarizeTxViews([
      view({ kind: "TRANSFER", amountCents: 1_500, signedCents: 1_500, transferGroupId: "g1" }),
      view({ kind: "EXPENSE", amountCents: 900, signedCents: -900 }),
    ]);
    expect(s.incomeCents).toBe(0);
    expect(s.expenseCents).toBe(900);
    expect(s.netCents).toBe(-900);
  });

  it("is all zeros for an empty ledger", () => {
    expect(summarizeTxViews([])).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      adjustmentCents: 0,
      netCents: 0,
    });
  });
});
