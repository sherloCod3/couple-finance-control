/**
 * FIN-05 / Section 05 — FinancialPosition.
 * currentCash  → money held in accounts right now
 * committedCash → obligations already owed but not yet paid (due by month end)
 * projectedCash → current cash after every known obligation in the horizon
 * availableCash → currentCash − committedCash (the household's safety rule)
 *
 * Obligations are *derived* from recurrings, card statements and loan
 * schedules — never stored separately (FIN-11).
 */
import type {
  Account,
  Card,
  CardPurchase,
  Loan,
  LoanPayment,
  Recurring,
  Transaction,
} from "../models/entities";
import type { CardId, LoanId, RecurringId, StatementPeriod } from "../types";
import { Money } from "../models/money";
import { accountBalance, monthTotals } from "./finance";
import { expectedAmount, occurrencesBetween, occurrencePaid } from "./forecast";
import { buildStatements } from "./cards";
import { nextUnpaidItem } from "./loans";
import {
  addDaysISO,
  daysInMonthKey,
  isoWithDay,
  monthKey,
  todayISO,
} from "../utils/dates";

export type ObligationRef =
  | { kind: "recurring"; recurringId: RecurringId; dueDate: string }
  | { kind: "card-statement"; cardId: CardId; period: StatementPeriod }
  | { kind: "loan"; loanId: LoanId; dueDate: string };

export interface Obligation {
  key: string;
  source: "recurring" | "card-statement" | "loan";
  title: string;
  detail: string;
  dueDate: string;
  amount: Money;
  status: "overdue" | "upcoming";
  ref: ObligationRef;
}

export interface PositionInput {
  accounts: Account[];
  transactions: Transaction[];
  recurrings: Recurring[];
  cards: Card[];
  purchases: CardPurchase[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  today?: string;
  horizonDays?: number;
}

export interface FinancialPosition {
  currentCash: Money;
  cashAtMonthStart: Money;
  monthDelta: Money;
  committedCash: Money;
  projectedCash: Money;
  availableCash: Money;
  monthIncome: Money;
  monthExpenses: Money;
  monthNet: Money;
  overdue: Obligation[];
  upcoming: Obligation[];
}

export const computeObligations = (input: PositionInput): Obligation[] => {
  const today = input.today ?? todayISO();
  const horizon = addDaysISO(today, input.horizonDays ?? 30);
  const out: Obligation[] = [];
  const status = (dueDate: string): Obligation["status"] =>
    dueDate < today ? "overdue" : "upcoming";

  // Recurring forecasts without a linked actual transaction. Stale missed
  // occurrences collapse into the most recent one — a household acts on the
  // latest miss, not on an unbounded backlog.
  for (const r of input.recurrings) {
    if (!r.active) continue;
    const unpaid = occurrencesBetween(r, addDaysISO(today, -45), horizon).filter(
      (due) => !occurrencePaid(r, due, input.transactions)
    );
    const lastOverdue = unpaid.filter((d) => d < today).pop() ?? null;
    const keep = unpaid.filter((d) => d >= today);
    if (lastOverdue) keep.unshift(lastOverdue);
    for (const due of keep) {
      out.push({
        key: `rec:${r.id}:${due}`,
        source: "recurring",
        title: r.description,
        detail: `${r.frequency} plan`,
        dueDate: due,
        amount: expectedAmount(r),
        status: status(due),
        ref: { kind: "recurring", recurringId: r.id, dueDate: due },
      });
    }
  }

  // Unpaid card statement balances.
  for (const card of input.cards) {
    for (const s of buildStatements(card, input.purchases, input.transactions, today)) {
      if (s.remaining.isZero() || s.dueDate > horizon) continue;
      out.push({
        key: `card:${card.id}:${s.period}`,
        source: "card-statement",
        title: `${card.nickname} ••${card.last4} statement`,
        detail: `Card statement`,
        dueDate: s.dueDate,
        amount: s.remaining,
        status: status(s.dueDate),
        ref: { kind: "card-statement", cardId: card.id, period: s.period },
      });
    }
  }

  // Next unpaid loan installment (money we owe).
  for (const loan of input.loans) {
    if (loan.direction !== "owed") continue;
    const next = nextUnpaidItem(loan, input.loanPayments.filter((p) => p.loanId === loan.id));
    if (!next || next.item.dueDate > horizon) continue;
    out.push({
      key: `loan:${loan.id}:${next.item.dueDate}`,
      source: "loan",
      title: `${loan.counterparty} installment`,
      detail: `Loan payment`,
      dueDate: next.item.dueDate,
      amount: next.item.amount,
      status: status(next.item.dueDate),
      ref: { kind: "loan", loanId: loan.id, dueDate: next.item.dueDate },
    });
  }

  return out.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
};

export const computePosition = (input: PositionInput): FinancialPosition => {
  const today = input.today ?? todayISO();
  const obligations = computeObligations({ ...input, today });

  const currentCash = Money.sum(
    input.accounts.map((a) =>
      accountBalance(
        a.openingBalance,
        input.transactions.filter((t) => t.accountId === a.id)
      )
    )
  );

  // Decision A/A/A: every month-derived figure (buckets, cash-at-month-start,
  // committed window, totals) uses the injected `today`, so the position is a
  // pure function of its input and tests can time-travel. Production passes no
  // `today` and defaults to the real wall clock.
  const ym = monthKey(today);
  const monthStart = isoWithDay(ym, 1);
  const cashAtMonthStart = Money.sum(
    input.accounts.map((a) =>
      accountBalance(
        a.openingBalance,
        input.transactions.filter((t) => t.accountId === a.id && t.date < monthStart)
      )
    )
  );

  const overdue = obligations.filter((o) => o.status === "overdue");
  const upcoming = obligations.filter((o) => o.status === "upcoming");

  const monthEnd = isoWithDay(ym, daysInMonthKey(ym));
  const committedCash = Money.sum(
    [...overdue, ...upcoming.filter((o) => o.dueDate <= monthEnd)].map((o) => o.amount)
  );
  const projectedCash = currentCash.sub(Money.sum(obligations.map((o) => o.amount)));
  const availableCash = currentCash.sub(committedCash);

  const totals = monthTotals(input.transactions, ym);

  return {
    currentCash,
    cashAtMonthStart,
    monthDelta: currentCash.sub(cashAtMonthStart),
    committedCash,
    projectedCash,
    availableCash,
    monthIncome: totals.income,
    monthExpenses: totals.expenses,
    monthNet: totals.net,
    overdue,
    upcoming,
  };
};
