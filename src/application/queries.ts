/**
 * Read-side view models. The presentation layer subscribes to these through
 * Dexie live queries (ADR-008); all math stays in domain services (ADR-001).
 */
import { db } from "../infrastructure/db";
import {
  toAccount,
  toCard,
  toCategory,
  toLoan,
  toLoanPayment,
  toMember,
  toPixKey,
  toPurchase,
  toRecurring,
  toTransaction,
} from "../infrastructure/mappers";
import type {
  Account,
  Card,
  CardPurchase,
  Category,
  Loan,
  LoanPayment,
  Member,
  PixKey,
  Recurring,
  Transaction,
} from "../domain/models/entities";
import {
  accountBalance,
  expensesByCategory,
  isCardPayment,
  seriesForMonths,
  txImpact,
  UNCATEGORIZED,
  type MonthPoint,
} from "../domain/services/finance";
import {
  availableLimit,
  buildStatements,
  cardOutstanding,
  type Statement,
} from "../domain/services/cards";
import {
  allocateSchedule,
  nextUnpaidItem,
  outstanding as loanOutstanding,
  paidTotal,
  progressPct,
} from "../domain/services/loans";
import { expectedAmount, firstFutureOccurrence, occurrencesBetween, occurrencePaid } from "../domain/services/forecast";
import { computePosition, type FinancialPosition } from "../domain/services/position";
import { addMonthsKey, daysInMonthKey, isoWithDay, monthKey, todayISO } from "../domain/utils/dates";

export interface MemberLite {
  id: string;
  name: string;
  color: string;
}

export interface PixKeyView {
  id: string;
  type: string;
  value: string;
}

export interface AccountView {
  id: string;
  institution: string;
  nickname: string;
  type: string;
  last4: string | null;
  openingCents: number;
  openingDate: string;
  balanceCents: number;
  txCount: number;
  pixKeys: PixKeyView[];
}

export interface CategoryView {
  id: string;
  name: string;
  kind: string;
  color: string;
  builtin: boolean;
}

export type TxKind = "INCOME" | "EXPENSE" | "ADJUSTMENT" | "TRANSFER" | "CARD_PAYMENT";

export interface TxView {
  id: string;
  kind: TxKind;
  amountCents: number;
  signedCents: number;
  date: string;
  description: string;
  note: string | null;
  accountId: string;
  accountName: string;
  fromAccountName?: string;
  toAccountId?: string;
  toAccountName?: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  memberName: string;
  transferGroupId: string | null;
  recurringId: string | null;
  recurringDesc: string | null;
  cardId: string | null;
  cardLast4: string | null;
  statementPeriod: string | null;
  createdAt: number;
}

export interface PurchaseView {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  categoryName: string | null;
  categoryColor: string | null;
}

export interface TxSummary {
  incomeCents: number;
  expenseCents: number;
  adjustmentCents: number;
  netCents: number;
}

/**
 * Ledger summary for a set of transaction rows, applying the domain rule once
 * (ADR-001 — the view layer must not re-implement financial rules):
 *
 *   income      += INCOME
 *   expense     += EXPENSE   (card payments are NOT expenses — already counted
 *                             at purchase time; transfers are not either)
 *   adjustment  += signed ADJUSTMENT
 *   net          = income − expense + adjustment   (cash reconciliation)
 *
 * Because card payments and transfers contribute to nothing here, the per-day
 * and overall summaries on the Activity page stay mutually consistent.
 */
export const summarizeTxViews = (views: TxView[]): TxSummary => {
  let incomeCents = 0;
  let expenseCents = 0;
  let adjustmentCents = 0;
  for (const v of views) {
    if (v.kind === "INCOME") incomeCents += v.amountCents;
    else if (v.kind === "EXPENSE") expenseCents += v.amountCents;
    else if (v.kind === "ADJUSTMENT") adjustmentCents += v.signedCents;
  }
  return {
    incomeCents,
    expenseCents,
    adjustmentCents,
    netCents: incomeCents - expenseCents + adjustmentCents,
  };
};

export interface StatementView {
  period: string;
  closeDate: string;
  dueDate: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  status: Statement["status"];
  purchases: PurchaseView[];
}

export interface CardView {
  id: string;
  issuer: string;
  nickname: string;
  last4: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  outstandingCents: number;
  availableCents: number;
  usedPct: number;
  statements: StatementView[];
}

export interface RecurringView {
  id: string;
  description: string;
  frequency: string;
  expectedDay: number;
  expectedMonth: number | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  fixedCents: number | null;
  minCents: number | null;
  maxCents: number | null;
  expectedCents: number;
  active: boolean;
  currentDue: string | null;
  paidThisPeriod: boolean;
  nextDue: string | null;
}

export interface LoanView {
  id: string;
  direction: string;
  counterparty: string;
  description: string | null;
  principalCents: number;
  paidCents: number;
  outstandingCents: number;
  progressPct: number;
  startDate: string;
  schedule: { dueDate: string; amountCents: number; settled: boolean }[];
  nextDue: { dueDate: string; amountCents: number } | null;
  payments: { id: string; date: string; amountCents: number; note: string | null; hasTransaction: boolean }[];
}

export interface CategorySlice {
  id: string | null;
  name: string;
  color: string;
  cents: number;
  sharePct: number;
  prevCents: number;
}

export interface LoansSummary {
  owedCents: number;
  owedCount: number;
  receivableCents: number;
  receivableCount: number;
}

export interface DashboardVM {
  position: FinancialPosition;
  series: MonthPoint[];
  slices: CategorySlice[];
  recent: TxView[];
  cards: CardView[];
  accounts: AccountView[];
  loans: LoansSummary;
}

export interface FormMeta {
  members: MemberLite[];
  accounts: { id: string; nickname: string; institution: string; last4: string | null }[];
  categories: CategoryView[];
  cards: { id: string; nickname: string; last4: string }[];
  recurrings: { id: string; description: string; expectedCents: number }[];
}

interface Base {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  members: Member[];
  cards: Card[];
  purchases: CardPurchase[];
  recurrings: Recurring[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  pixKeys: PixKey[];
}

const loadBase = async (): Promise<Base> => {
  const [a, t, c, m, ca, p, r, l, lp, pk] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.categories.toArray(),
    db.members.toArray(),
    db.cards.toArray(),
    db.cardPurchases.toArray(),
    db.recurrings.toArray(),
    db.loans.toArray(),
    db.loanPayments.toArray(),
    db.pixKeys.toArray(),
  ]);
  return {
    accounts: a.map(toAccount),
    transactions: t.map(toTransaction),
    categories: c.map(toCategory),
    members: m.map(toMember),
    cards: ca.map(toCard),
    purchases: p.map(toPurchase),
    recurrings: r.map(toRecurring),
    loans: l.map(toLoan),
    loanPayments: lp.map(toLoanPayment),
    pixKeys: pk.map(toPixKey),
  };
};

const accountViews = (base: Base): AccountView[] =>
  base.accounts.map((a) => {
    const txs = base.transactions.filter((t) => t.accountId === a.id);
    return {
      id: a.id,
      institution: a.institution,
      nickname: a.nickname,
      type: a.type,
      last4: a.last4,
      openingCents: a.openingBalance.cents,
      openingDate: a.openingDate,
      balanceCents: accountBalance(a.openingBalance, txs).cents,
      txCount: txs.length,
      pixKeys: base.pixKeys
        .filter((k) => k.accountId === a.id)
        .map((k) => ({ id: k.id, type: k.type, value: k.value })),
    };
  });

const cardViews = (base: Base, today: string = todayISO()): CardView[] =>
  base.cards.map((card) => {
    const statements = buildStatements(card, base.purchases, base.transactions, today);
    const outstanding = cardOutstanding(statements);
    const available = availableLimit(card, statements);
    return {
      id: card.id,
      issuer: card.issuer,
      nickname: card.nickname,
      last4: card.last4,
      limitCents: card.limit.cents,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      outstandingCents: outstanding.cents,
      availableCents: available.cents,
      usedPct: card.limit.isZero() ? 0 : Math.round((outstanding.cents / card.limit.cents) * 100),
      statements: statements.map((s) => ({
        period: s.period,
        closeDate: s.closeDate,
        dueDate: s.dueDate,
        totalCents: s.total.cents,
        paidCents: s.paid.cents,
        remainingCents: s.remaining.cents,
        status: s.status,
        purchases: s.purchases.map((p) => {
          const cat = p.categoryId ? base.categories.find((c) => c.id === p.categoryId) : null;
          return {
            id: p.id,
            date: p.date,
            description: p.description,
            amountCents: p.amount.cents,
            categoryName: cat?.name ?? null,
            categoryColor: cat?.color ?? null,
          };
        }),
      })),
    };
  });

const txViews = (base: Base): TxView[] => {
  const accountName = (id: string): string =>
    base.accounts.find((a) => a.id === id)?.nickname ?? "Account";
  const memberName = (id: string): string =>
    base.members.find((m) => m.id === id)?.name ?? "—";

  const single = (t: Transaction): TxView => {
    const cat = t.categoryId ? base.categories.find((c) => c.id === t.categoryId) : null;
    const rec = t.recurringId ? base.recurrings.find((r) => r.id === t.recurringId) : null;
    const card = t.cardId ? base.cards.find((c) => c.id === t.cardId) : null;
    const signed = txImpact(t).cents;
    return {
      id: t.id,
      kind: isCardPayment(t) ? "CARD_PAYMENT" : t.type,
      amountCents: Math.abs(signed),
      signedCents: signed,
      date: t.date,
      description: t.description,
      note: t.note,
      accountId: t.accountId,
      accountName: accountName(t.accountId),
      categoryId: t.categoryId,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      memberName: memberName(t.createdBy),
      transferGroupId: null,
      recurringId: t.recurringId,
      recurringDesc: rec?.description ?? null,
      cardId: t.cardId,
      cardLast4: card?.last4 ?? null,
      statementPeriod: t.statementPeriod,
      createdAt: t.createdAt,
    };
  };

  const sorted = base.transactions
    .slice()
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

  const out: TxView[] = [];
  const seenGroups = new Set<string>();
  for (const t of sorted) {
    if (t.transferGroupId) {
      if (seenGroups.has(t.transferGroupId)) continue;
      seenGroups.add(t.transferGroupId);
      const legs = base.transactions.filter((x) => x.transferGroupId === t.transferGroupId);
      const outLeg = legs.find((x) => x.type === "EXPENSE") ?? legs[0];
      const inLeg = legs.find((x) => x.type === "INCOME") ?? legs[0];
      out.push({
        id: outLeg.id,
        kind: "TRANSFER",
        amountCents: outLeg.amount.abs().cents,
        signedCents: outLeg.amount.abs().cents,
        date: outLeg.date,
        description: outLeg.description,
        note: outLeg.note,
        accountId: outLeg.accountId,
        accountName: accountName(outLeg.accountId),
        fromAccountName: accountName(outLeg.accountId),
        toAccountId: inLeg.accountId,
        toAccountName: accountName(inLeg.accountId),
        categoryId: null,
        categoryName: null,
        categoryColor: null,
        memberName: memberName(outLeg.createdBy),
        transferGroupId: t.transferGroupId,
        recurringId: null,
        recurringDesc: null,
        cardId: null,
        cardLast4: null,
        statementPeriod: null,
        createdAt: outLeg.createdAt,
      });
      continue;
    }
    out.push(single(t));
  }
  return out;
};

const recurringViews = (base: Base, today: string = todayISO()): RecurringView[] => {
  const ym = monthKey(today);
  const monthStart = isoWithDay(ym, 1);
  const monthEnd = isoWithDay(ym, daysInMonthKey(ym));
  return base.recurrings.map((r) => {
    const cat = r.categoryId ? base.categories.find((c) => c.id === r.categoryId) : null;
    const currentDue = occurrencesBetween(r, monthStart, monthEnd)[0] ?? null;
    return {
      id: r.id,
      description: r.description,
      frequency: r.frequency,
      expectedDay: r.expectedDay,
      expectedMonth: r.expectedMonth,
      categoryId: r.categoryId,
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      fixedCents: r.amount?.cents ?? null,
      minCents: r.minAmount?.cents ?? null,
      maxCents: r.maxAmount?.cents ?? null,
      expectedCents: expectedAmount(r).cents,
      active: r.active,
      currentDue,
      paidThisPeriod: currentDue ? occurrencePaid(r, currentDue, base.transactions) !== null : false,
      nextDue: r.active ? firstFutureOccurrence(r, today) : null,
    };
  });
};

const loanViews = (base: Base): LoanView[] =>
  base.loans.map((loan) => {
    const payments = base.loanPayments
      .filter((p) => p.loanId === loan.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const flags = allocateSchedule(loan, payments);
    const next = nextUnpaidItem(loan, payments);
    return {
      id: loan.id,
      direction: loan.direction,
      counterparty: loan.counterparty,
      description: loan.description,
      principalCents: loan.principal.cents,
      paidCents: paidTotal(payments).cents,
      outstandingCents: loanOutstanding(loan, payments).cents,
      progressPct: progressPct(loan, payments),
      startDate: loan.startDate,
      schedule: loan.schedule.map((s, i) => ({
        dueDate: s.dueDate,
        amountCents: s.amount.cents,
        settled: flags[i] ?? false,
      })),
      nextDue: next ? { dueDate: next.item.dueDate, amountCents: next.item.amount.cents } : null,
      payments: payments.map((p) => ({
        id: p.id,
        date: p.date,
        amountCents: p.amount.cents,
        note: p.note,
        hasTransaction: p.transactionId !== null,
      })),
    };
  });

const loansSummary = (base: Base): LoansSummary => {
  const owed = base.loans.filter((l) => l.direction === "owed");
  const recv = base.loans.filter((l) => l.direction === "receivable");
  const sum = (list: Loan[]): number =>
    list.reduce(
      (acc, l) => acc + loanOutstanding(l, base.loanPayments.filter((p) => p.loanId === l.id)).cents,
      0
    );
  return {
    owedCents: sum(owed),
    owedCount: owed.length,
    receivableCents: sum(recv),
    receivableCount: recv.length,
  };
};

const categorySlices = (base: Base, today: string = todayISO()): CategorySlice[] => {
  const ym = monthKey(today);
  const prev = addMonthsKey(ym, -1);
  const current = expensesByCategory(base.transactions, ym, base.purchases);
  const previous = expensesByCategory(base.transactions, prev, base.purchases);
  const totalCents = [...current.values()].reduce((a, m) => a + m.cents, 0);
  const slices: CategorySlice[] = [];
  for (const [key, money] of current) {
    const cat = key === UNCATEGORIZED ? null : base.categories.find((c) => c.id === key);
    slices.push({
      id: key === UNCATEGORIZED ? null : key,
      name: cat?.name ?? "Uncategorized",
      color: cat?.color ?? "#8B968C",
      cents: money.cents,
      sharePct: totalCents === 0 ? 0 : Math.round((money.cents / totalCents) * 100),
      prevCents: (previous.get(key) ?? { cents: 0 }).cents,
    });
  }
  return slices.sort((a, b) => b.cents - a.cents);
};

// ---- public queries -------------------------------------------------------

export async function getDashboard(today?: string): Promise<DashboardVM> {
  const base = await loadBase();
  const at = today ?? todayISO();
  const position = computePosition({
    accounts: base.accounts,
    transactions: base.transactions,
    recurrings: base.recurrings,
    cards: base.cards,
    purchases: base.purchases,
    loans: base.loans,
    loanPayments: base.loanPayments,
    today: at,
  });
  const cur = monthKey(at);
  const yms = Array.from({ length: 6 }, (_, i) => addMonthsKey(cur, i - 5));
  return {
    position,
    series: seriesForMonths(base.transactions, yms, base.purchases),
    slices: categorySlices(base, at),
    recent: txViews(base).slice(0, 8),
    cards: cardViews(base, at),
    accounts: accountViews(base),
    loans: loansSummary(base),
  };
}

export async function getTransactions(): Promise<TxView[]> {
  return txViews(await loadBase());
}

export async function getAccounts(): Promise<AccountView[]> {
  return accountViews(await loadBase());
}

export async function getCards(today?: string): Promise<CardView[]> {
  return cardViews(await loadBase(), today ?? todayISO());
}

export async function getRecurrings(today?: string): Promise<RecurringView[]> {
  return recurringViews(await loadBase(), today ?? todayISO());
}

export async function getLoans(): Promise<LoanView[]> {
  return loanViews(await loadBase());
}

export async function getFormMeta(): Promise<FormMeta> {
  const base = await loadBase();
  return {
    members: base.members.map((m) => ({ id: m.id, name: m.name, color: m.color })),
    accounts: base.accounts.map((a) => ({
      id: a.id,
      nickname: a.nickname,
      institution: a.institution,
      last4: a.last4,
    })),
    categories: base.categories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      color: c.color,
      builtin: c.builtin,
    })),
    cards: base.cards.map((c) => ({ id: c.id, nickname: c.nickname, last4: c.last4 })),
    recurrings: base.recurrings.map((r) => ({
      id: r.id,
      description: r.description,
      expectedCents: expectedAmount(r).cents,
    })),
  };
}

export interface ContactView {
  id: string;
  name: string;
  keys: PixKeyView[];
}

export async function getContacts(): Promise<ContactView[]> {
  const [contacts, keys] = await Promise.all([db.contacts.toArray(), db.pixKeys.toArray()]);
  return contacts.map((c) => ({
    id: c.id,
    name: c.name,
    keys: keys.filter((k) => k.contactId === c.id).map((k) => ({ id: k.id, type: k.type, value: k.value })),
  }));
}

export async function getHousehold(): Promise<{ name: string; members: MemberLite[] }> {
  const [h, m] = await Promise.all([db.households.toCollection().first(), db.members.toArray()]);
  return { name: h?.name ?? "Household", members: m.map(toMember).map((x) => ({ id: x.id, name: x.name, color: x.color })) };
}
