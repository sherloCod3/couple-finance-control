/**
 * Transaction classification and balance math (Section 04 invariants).
 * The core rule stays pure: INCOME adds, EXPENSE subtracts, ADJUSTMENT is a
 * signed balance correction. Transfer legs and card payments move cash but
 * are excluded from income/expense analytics.
 *
 * Two distinct month figures are derived here, and they are deliberately NOT
 * the same number (see docs/domain/01-invariants.md):
 *
 *   spending  = cash expenses + card purchases  → "how much did we spend?"
 *   net       = income − cash expenses + signed adjustments
 *                                              → reconciles with account cash
 *
 * Card *purchases* are spending (invariant: a purchase counts as spending).
 * Card *payments* are neither — they only settle spending already counted, so
 * counting them too would double-count.
 */
import type { Account, CardPurchase, Transaction } from "../models/entities";
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
  /** Real income. Transfer legs and card payments are excluded. */
  income: Money;
  /** Cash expenses: real EXPENSE transactions only. Feeds `net`. */
  expenses: Money;
  /** Credit-card purchases dated in the month — spending not yet settled in cash. */
  cardSpending: Money;
  /** The "how much did we spend" answer: `expenses + cardSpending`. */
  spending: Money;
  /** Cash reconciliation: `income − expenses + signed adjustments`. */
  net: Money;
}

/** Card purchases dated inside `ym` (by purchase date, not statement period). */
export const cardPurchasesInMonth = (purchases: CardPurchase[], ym: string): Money =>
  Money.sum(purchases.filter((p) => monthKey(p.date) === ym).map((p) => p.amount));

export const monthTotals = (
  txs: Transaction[],
  ym: string,
  purchases: CardPurchase[] = []
): MonthTotals => {
  const inMonth = txs.filter((t) => monthKey(t.date) === ym);
  const income = Money.sum(inMonth.filter(countsAsIncome).map((t) => t.amount));
  const expenses = Money.sum(inMonth.filter(countsAsExpense).map((t) => t.amount));
  // Decision A/A/A: month net counts signed balance corrections, so monthNet
  // reconciles with the derived account balance. Income/expenses stay pure.
  const adjustments = Money.sum(inMonth.filter((t) => t.type === "ADJUSTMENT").map((t) => t.amount));
  const cardSpending = cardPurchasesInMonth(purchases, ym);
  return {
    income,
    expenses,
    cardSpending,
    spending: expenses.add(cardSpending),
    net: income.sub(expenses).add(adjustments),
  };
};

export interface MonthPoint {
  ym: string;
  income: Money;
  expenses: Money;
  cardSpending: Money;
  spending: Money;
  net: Money;
}

export const seriesForMonths = (
  txs: Transaction[],
  yms: string[],
  purchases: CardPurchase[] = []
): MonthPoint[] => yms.map((ym) => ({ ym, ...monthTotals(txs, ym, purchases) }));

export const UNCATEGORIZED = "__uncategorized__";

/**
 * Category analytics are the "where did the money go" answer, so they follow
 * `spending`: real expense transactions plus card purchases. Transfers and card
 * payments contribute nothing (a payment only settles spending already counted).
 */
export const expensesByCategory = (
  txs: Transaction[],
  ym: string,
  purchases: CardPurchase[] = []
): Map<string, Money> => {
  const map = new Map<string, Money>();
  for (const t of txs) {
    if (!countsAsExpense(t) || monthKey(t.date) !== ym) continue;
    const key = t.categoryId ?? UNCATEGORIZED;
    map.set(key, (map.get(key) ?? Money.ZERO).add(t.amount));
  }
  for (const p of purchases) {
    if (monthKey(p.date) !== ym) continue;
    const key = p.categoryId ?? UNCATEGORIZED;
    map.set(key, (map.get(key) ?? Money.ZERO).add(p.amount));
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
