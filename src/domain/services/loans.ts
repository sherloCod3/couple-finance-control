/**
 * FIN-10 — Loans. Distinguishes "money we owe" from "money owed to us".
 * Payments are immutable audit records; the outstanding balance is derived,
 * never stored, so history can never drift.
 */
import type { Loan, LoanPayment, LoanScheduleItem } from "../models/entities";
import { Money } from "../models/money";

export const paidTotal = (payments: LoanPayment[]): Money =>
  Money.sum(payments.map((p) => p.amount));

export const outstanding = (loan: Loan, payments: LoanPayment[]): Money =>
  loan.principal.sub(paidTotal(payments));

/**
 * Greedy allocation: schedule items are marked settled in due-date order as
 * cumulative payments cover cumulative scheduled amounts.
 */
export const allocateSchedule = (loan: Loan, payments: LoanPayment[]): boolean[] => {
  const order = loan.schedule
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.dueDate < b.item.dueDate ? -1 : 1));
  const flags = new Array<boolean>(loan.schedule.length).fill(false);
  let paidCents = paidTotal(payments).cents;
  let scheduledCents = 0;
  for (const { item, index } of order) {
    scheduledCents += item.amount.cents;
    if (paidCents >= scheduledCents) flags[index] = true;
    else break;
  }
  return flags;
};

export interface NextDue {
  item: LoanScheduleItem;
  index: number;
}

export const nextUnpaidItem = (loan: Loan, payments: LoanPayment[]): NextDue | null => {
  if (loan.schedule.length === 0) return null;
  const flags = allocateSchedule(loan, payments);
  const order = loan.schedule
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.dueDate < b.item.dueDate ? -1 : 1));
  for (const { item, index } of order) {
    if (!flags[index]) return { item, index };
  }
  return null;
};

/** 0–100, principal repaid. */
export const progressPct = (loan: Loan, payments: LoanPayment[]): number => {
  if (loan.principal.isZero()) return 100;
  const pct = (paidTotal(payments).cents / loan.principal.cents) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};
