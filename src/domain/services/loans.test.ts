import { describe, expect, it } from "vitest";
import type { Loan, LoanPayment } from "../models/entities";
import { Money } from "../models/money";
import { idOf } from "../types";
import type { LoanId, LoanPaymentId } from "../types";
import { allocateSchedule, nextUnpaidItem, outstanding, paidTotal, progressPct } from "./loans";

const loan: Loan = {
  id: idOf<LoanId>("l1"),
  householdId: idOf("h1"),
  direction: "owed",
  counterparty: "Banco Demo",
  description: null,
  principal: Money.fromCents(10000_00),
  startDate: "2025-05-01",
  schedule: [
    { dueDate: "2025-06-10", amount: Money.fromCents(5000_00) },
    { dueDate: "2025-07-10", amount: Money.fromCents(5000_00) },
  ],
  note: null,
  createdBy: idOf("m1"),
  createdAt: 0,
  updatedAt: 0,
};

const pay = (cents: number, date: string): LoanPayment => ({
  id: idOf<LoanPaymentId>(`lp-${date}`),
  loanId: loan.id,
  date,
  amount: Money.fromCents(cents),
  note: null,
  transactionId: null,
  createdAt: 0,
});

describe("loan domain rules (FIN-10 / Section 04)", () => {
  it("the outstanding balance is derived from immutable payments", () => {
    expect(outstanding(loan, []).cents).toBe(10000_00);
    expect(outstanding(loan, [pay(3000_00, "2025-06-10")]).cents).toBe(7000_00);
    expect(paidTotal([pay(3000_00, "2025-06-10"), pay(1000_00, "2025-06-20")]).cents).toBe(4000_00);
  });

  it("installments are settled in due-date order as payments accumulate", () => {
    const flags = allocateSchedule(loan, [pay(5000_00, "2025-06-10")]);
    expect(flags).toEqual([true, false]);
    const all = allocateSchedule(loan, [pay(5000_00, "2025-06-10"), pay(5000_00, "2025-07-10")]);
    expect(all).toEqual([true, true]);
  });

  it("the next unpaid item follows the schedule", () => {
    const next = nextUnpaidItem(loan, [pay(5000_00, "2025-06-10")]);
    expect(next?.item.dueDate).toBe("2025-07-10");
    expect(nextUnpaidItem(loan, [pay(10000_00, "2025-06-10")])).toBeNull();
  });

  it("reports principal repaid as a percentage", () => {
    expect(progressPct(loan, [pay(5000_00, "2025-06-10")])).toBe(50);
    expect(progressPct(loan, [])).toBe(0);
  });
});
