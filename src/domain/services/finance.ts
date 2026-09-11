/**
 * Transaction classification and balance math (Section 04 invariants).
 * The core rule stays pure: INCOME adds, EXPENSE subtracts, ADJUSTMENT is a
 * signed balance correction. Transfer legs and card payments move cash but
 * are excluded from income/expense analytics.
 */
import type { Account, Transaction } from "../models/entities";
import { Money } from "../models/money";
import { monthKey } from "../utils/dates";

export const isTransferLeg = (t: Transaction): boolean => t.transferGroupId !== null;

export const isCardPayment = (t: Transaction): boolean =>
  t.cardId !== null && t.statementPeriod !== null;

export const countsAsIncome = (t: Transaction): boolean =>
  t.type === "INCOME" && !isTransferLeg(t);

export const countsAsExpense = (t: Transaction): boolean =>
  t.type === "EXPENSE" && !isTransferLeg(t) && !isCardPayment(t);

/** Signed cash impact on the account that holds the transaction. */
export const txImpact = (t: Transaction): Money =>
  t.type === "EXPENSE" ? t.amount.neg() : t.amount;

export const accountBalance = (opening: Money, accountTxs: Transaction[]): Money =>
  Money.sum([opening, ...accountTxs.map(txImpact)]);

export interface MonthTotals {
  income: Money;
  expenses: Money;
  net: Money;
}

export const monthTotals = (txs: Transaction[], ym: string): MonthTotals => {
  const inMonth = txs.filter((t) => monthKey(t.date) === ym);
  const income = Money.sum(inMonth.filter(countsAsIncome).map((t) => t.amount));
  const expenses = Money.sum(inMonth.filter(countsAsExpense).map((t) => t.amount));
  // Decision A/A/A: month net counts signed balance corrections, so monthNet
  // reconciles with the derived account balance. Income/expenses stay pure.
  const adjustments = Money.sum(inMonth.filter((t) => t.type === "ADJUSTMENT").map((t) => t.amount));
  return { income, expenses, net: income.sub(expenses).add(adjustments) };
};

export interface MonthPoint {
  ym: string;
  income: Money;
  expenses: Money;
  net: Money;
}

export const seriesForMonths = (txs: Transaction[], yms: string[]): MonthPoint[] =>
  yms.map((ym) => ({ ym, ...monthTotals(txs, ym) }));

export const UNCATEGORIZED = "__uncategorized__";

/** Category analytics are based on actual expense transactions only (Section 04 — Categories). */
export const expensesByCategory = (txs: Transaction[], ym: string): Map<string, Money> => {
  const map = new Map<string, Money>();
  for (const t of txs) {
    if (!countsAsExpense(t) || monthKey(t.date) !== ym) continue;
    const key = t.categoryId ?? UNCATEGORIZED;
    map.set(key, (map.get(key) ?? Money.ZERO).add(t.amount));
  }
  return map;
};

/** Household cash as of a given date (inclusive). */
export const cashAtDate = (accounts: Account[], txs: Transaction[], iso: string): Money =>
  Money.sum(
    accounts.map((a) =>
      accountBalance(
        a.openingBalance,
        txs.filter((t) => t.accountId === a.id && t.date <= iso)
      )
    )
  );
