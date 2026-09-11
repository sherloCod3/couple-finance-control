/**
 * FIN-08 — A recurring expense is a forecast/template, never an actual
 * transaction. This service materializes expected occurrences inside a
 * window and checks whether real transactions (linked via recurringId)
 * already cover them.
 */
import type { Recurring, Transaction } from "../models/entities";
import type { RecurringId, TransactionId } from "../types";
import { Money } from "../models/money";
import {
  addDaysISO,
  addMonthsKey,
  daysBetween,
  daysInMonthKey,
  isoWithDay,
  monthKey,
  parseISO,
  toISO,
  weekdayOf,
} from "../utils/dates";

export interface RecurringOccurrence {
  recurringId: RecurringId;
  dueDate: string;
  expected: Money;
  min: Money | null;
  max: Money | null;
}

/** Best single-number estimate for commitment math. */
export const expectedAmount = (r: Recurring): Money => {
  if (r.amount) return r.amount;
  if (r.minAmount && r.maxAmount) return r.minAmount.add(r.maxAmount).mulRound(0.5);
  return r.maxAmount ?? r.minAmount ?? Money.ZERO;
};

const pad = (n: number): string => String(n).padStart(2, "0");

/** All expected occurrence dates of `r` inside [fromISO, toISO]. */
export const occurrencesBetween = (r: Recurring, fromISO: string, toISODate: string): string[] => {
  const out: string[] = [];

  if (r.frequency === "monthly") {
    let ym = addMonthsKey(monthKey(fromISO), -1);
    const end = addMonthsKey(monthKey(toISODate), 1);
    while (ym <= end) {
      const due = isoWithDay(ym, r.expectedDay);
      if (due >= fromISO && due <= toISODate) out.push(due);
      ym = addMonthsKey(ym, 1);
    }
    return out;
  }

  if (r.frequency === "yearly") {
    const month = r.expectedMonth ?? Number(monthKey(fromISO).slice(5, 7));
    const firstYear = parseISO(fromISO).getFullYear() - 1;
    const lastYear = parseISO(toISODate).getFullYear() + 1;
    for (let y = firstYear; y <= lastYear; y++) {
      const dim = daysInMonthKey(`${y}-${pad(month)}`);
      const due = `${y}-${pad(month)}-${pad(Math.min(r.expectedDay, dim))}`;
      if (due >= fromISO && due <= toISODate) out.push(due);
    }
    return out;
  }

  // weekly — expectedDay is an ISO weekday (1 = Mon … 7 = Sun)
  let cursor = fromISO;
  while (weekdayOf(cursor) !== r.expectedDay) cursor = addDaysISO(cursor, 1);
  while (cursor <= toISODate) {
    out.push(cursor);
    cursor = addDaysISO(cursor, 7);
  }
  return out;
};

/**
 * An occurrence is considered settled when a transaction linked to the
 * recurring template falls in the same month (monthly/yearly) or within
 * ±3 days (weekly). Returns the settling transaction id, if any.
 */
export const occurrencePaid = (
  r: Recurring,
  dueDate: string,
  txs: Transaction[]
): TransactionId | null => {
  const linked = txs.filter((t) => t.recurringId === r.id);
  const match = linked.find((t) =>
    r.frequency === "weekly"
      ? Math.abs(daysBetween(t.date, dueDate)) <= 3
      : monthKey(t.date) === monthKey(dueDate)
  );
  return match ? match.id : null;
};

export const buildOccurrences = (
  r: Recurring,
  fromISO: string,
  toISODate: string
): RecurringOccurrence[] =>
  occurrencesBetween(r, fromISO, toISODate).map((dueDate) => ({
    recurringId: r.id,
    dueDate,
    expected: expectedAmount(r),
    min: r.minAmount,
    max: r.maxAmount,
  }));

export const firstFutureOccurrence = (r: Recurring, today: string): string | null => {
  const dates = occurrencesBetween(r, today, addDaysISO(today, 400));
  return dates.length > 0 ? dates[0] : null;
};

export const isoOf = toISO;
