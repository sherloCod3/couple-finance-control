/**
 * FIN-09 — Credit card domain rules.
 * A purchase counts as spending and reduces available credit, but never
 * touches bank cash. Paying a statement reduces bank cash (recorded as an
 * EXPENSE transaction flagged with cardId + statementPeriod) and settles
 * the obligation; flagged payments are excluded from spending analytics.
 */
import type { Card, CardPurchase, Transaction } from "../models/entities";
import type { CardId, StatementPeriod } from "../types";
import { Money } from "../models/money";
import { addMonthsKey, dayOfMonth, daysInMonthKey, isoWithDay, monthKey, todayISO } from "../utils/dates";

export type StatementStatus = "paid" | "open" | "overdue";

export interface Statement {
  cardId: CardId;
  period: StatementPeriod;
  closeDate: string;
  dueDate: string;
  total: Money;
  paid: Money;
  remaining: Money;
  status: StatementStatus;
  purchases: CardPurchase[];
}

const effectiveClosingDay = (card: Card, ym: string): number =>
  Math.min(card.closingDay, daysInMonthKey(ym));

/** The billing cycle a purchase lands in: closes on the closing day of the period month. */
export const periodOf = (card: Card, purchaseDateISO: string): StatementPeriod => {
  const ym = monthKey(purchaseDateISO);
  return dayOfMonth(purchaseDateISO) <= effectiveClosingDay(card, ym)
    ? ym
    : addMonthsKey(ym, 1);
};

export const closeDateOf = (card: Card, period: StatementPeriod): string =>
  isoWithDay(period, effectiveClosingDay(card, period));

/** Statement for `period` is due on the due day of the following month. */
export const dueDateOf = (card: Card, period: StatementPeriod): string => {
  const ym = addMonthsKey(period, 1);
  return isoWithDay(ym, Math.min(card.dueDay, daysInMonthKey(ym)));
};

export const buildStatements = (
  card: Card,
  purchases: CardPurchase[],
  txs: Transaction[],
  today: string = todayISO()
): Statement[] => {
  const byPeriod = new Map<StatementPeriod, CardPurchase[]>();
  for (const p of purchases) {
    if (p.cardId !== card.id) continue;
    const list = byPeriod.get(p.period) ?? [];
    list.push(p);
    byPeriod.set(p.period, list);
  }

  const statements: Statement[] = [];
  for (const [period, list] of byPeriod) {
    const total = Money.sum(list.map((p) => p.amount));
    const paid = Money.sum(
      txs
        .filter((t) => t.cardId === card.id && t.statementPeriod === period && t.type === "EXPENSE")
        .map((t) => t.amount)
    );
    const remaining = total.sub(paid).lt(Money.ZERO) ? Money.ZERO : total.sub(paid);
    const dueDate = dueDateOf(card, period);
    const status: StatementStatus = remaining.isZero()
      ? "paid"
      : dueDate < today
        ? "overdue"
        : "open";
    statements.push({
      cardId: card.id,
      period,
      closeDate: closeDateOf(card, period),
      dueDate,
      total,
      paid,
      remaining,
      status,
      purchases: list.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    });
  }
  return statements.sort((a, b) => (a.period < b.period ? 1 : -1));
};

/** Money still owed on the card (unpaid purchases). */
export const cardOutstanding = (statements: Statement[]): Money =>
  Money.sum(statements.map((s) => s.remaining));

export const availableLimit = (card: Card, statements: Statement[]): Money => {
  const available = card.limit.sub(cardOutstanding(statements));
  return available.isNegative() ? Money.ZERO : available;
};
