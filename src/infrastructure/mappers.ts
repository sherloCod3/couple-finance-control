/**
 * Persistence rows (integer cents, plain strings) ↔ domain entities
 * (Money value objects, branded ids). Mapping happens only at this edge.
 */
import type {
  Account,
  Card,
  CardPurchase,
  Category,
  Contact,
  Household,
  Loan,
  LoanPayment,
  Member,
  PixKey,
  Recurring,
  Transaction,
  TransactionType,
  AccountType,
  Frequency,
  LoanDirection,
  PixKeyType,
} from "../domain/models/entities";
import { Money } from "../domain/models/money";
import { idOf } from "../domain/types";
import type {
  AccountId,
  CardId,
  CategoryId,
  ContactId,
  MemberId,
  RecurringId,
  TransactionId,
  TransferGroupId,
} from "../domain/types";

export interface HouseholdRow {
  id: string;
  name: string;
  createdAt: number;
  /**
   * `true` while the household is the untouched fictional seed, `false` once
   * the user cleared the ledger. Absent on rows written before the flag
   * existed — readers must treat `undefined` as still demo (no silent relabel).
   */
  demo?: boolean;
}

export interface MemberRow {
  id: string;
  householdId: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface AccountRow {
  id: string;
  householdId: string;
  institution: string;
  nickname: string;
  type: AccountType;
  last4: string | null;
  openingBalanceCents: number;
  openingDate: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CategoryRow {
  id: string;
  householdId: string;
  name: string;
  kind: "expense" | "income";
  color: string;
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CardRow {
  id: string;
  householdId: string;
  issuer: string;
  nickname: string;
  last4: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
  createdAt: number;
  updatedAt: number;
}

export interface CardPurchaseRow {
  id: string;
  cardId: string;
  amountCents: number;
  date: string;
  description: string;
  categoryId: string | null;
  period: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface RecurringRow {
  id: string;
  householdId: string;
  description: string;
  categoryId: string | null;
  frequency: Frequency;
  expectedDay: number;
  expectedMonth: number | null;
  amountCents: number | null;
  minCents: number | null;
  maxCents: number | null;
  active: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface LoanScheduleItemRow {
  dueDate: string;
  amountCents: number;
}

export interface LoanRow {
  id: string;
  householdId: string;
  direction: LoanDirection;
  counterparty: string;
  description: string | null;
  principalCents: number;
  startDate: string;
  schedule: LoanScheduleItemRow[];
  note: string | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface LoanPaymentRow {
  id: string;
  loanId: string;
  date: string;
  amountCents: number;
  note: string | null;
  transactionId: string | null;
  createdAt: number;
}

export interface ContactRow {
  id: string;
  householdId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface PixKeyRow {
  id: string;
  householdId: string;
  accountId: string | null;
  contactId: string | null;
  type: PixKeyType;
  value: string;
  createdAt: number;
}

export interface TransactionRow {
  id: string;
  householdId: string;
  accountId: string;
  type: TransactionType;
  amountCents: number;
  date: string;
  description: string;
  categoryId: string | null;
  note: string | null;
  createdBy: string;
  transferGroupId: string | null;
  recurringId: string | null;
  cardId: string | null;
  statementPeriod: string | null;
  createdAt: number;
  updatedAt: number;
}

const money = (cents: number): Money => Money.fromCents(cents);
const moneyOrNull = (cents: number | null): Money | null =>
  cents === null ? null : Money.fromCents(cents);
const strOrNull = (v: string | null): string | null => v;
const idOrNull = <T extends string>(v: string | null): T | null =>
  v === null ? null : idOf<T>(v);

export const toTransaction = (r: TransactionRow): Transaction => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  accountId: idOf(r.accountId),
  type: r.type,
  amount: money(r.amountCents),
  date: r.date,
  description: r.description,
  categoryId: idOrNull<CategoryId>(r.categoryId),
  note: strOrNull(r.note),
  createdBy: idOf<MemberId>(r.createdBy),
  transferGroupId: idOrNull<TransferGroupId>(r.transferGroupId),
  recurringId: idOrNull<RecurringId>(r.recurringId),
  cardId: idOrNull<CardId>(r.cardId),
  statementPeriod: strOrNull(r.statementPeriod),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const toAccount = (r: AccountRow): Account => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  institution: r.institution,
  nickname: r.nickname,
  type: r.type,
  last4: strOrNull(r.last4),
  openingBalance: money(r.openingBalanceCents),
  openingDate: r.openingDate,
  archived: r.archived,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const toCard = (r: CardRow): Card => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  issuer: r.issuer,
  nickname: r.nickname,
  last4: r.last4,
  limit: money(r.limitCents),
  closingDay: r.closingDay,
  dueDay: r.dueDay,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const toPurchase = (r: CardPurchaseRow): CardPurchase => ({
  id: idOf(r.id),
  cardId: idOf(r.cardId),
  amount: money(r.amountCents),
  date: r.date,
  description: r.description,
  categoryId: idOrNull<CategoryId>(r.categoryId),
  period: r.period,
  createdBy: idOf(r.createdBy),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const toRecurring = (r: RecurringRow): Recurring => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  description: r.description,
  categoryId: idOrNull<CategoryId>(r.categoryId),
  frequency: r.frequency,
  expectedDay: r.expectedDay,
  expectedMonth: r.expectedMonth,
  amount: moneyOrNull(r.amountCents),
  minAmount: moneyOrNull(r.minCents),
  maxAmount: moneyOrNull(r.maxCents),
  active: r.active,
  createdBy: idOf(r.createdBy),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const toLoan = (r: LoanRow): Loan => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  direction: r.direction,
  counterparty: r.counterparty,
  description: strOrNull(r.description),
  principal: money(r.principalCents),
  startDate: r.startDate,
  schedule: r.schedule.map((s) => ({ dueDate: s.dueDate, amount: money(s.amountCents) })),
  note: strOrNull(r.note),
  createdBy: idOf(r.createdBy),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const toLoanPayment = (r: LoanPaymentRow): LoanPayment => ({
  id: idOf(r.id),
  loanId: idOf(r.loanId),
  date: r.date,
  amount: money(r.amountCents),
  note: strOrNull(r.note),
  transactionId: idOrNull<TransactionId>(r.transactionId),
  createdAt: r.createdAt,
});

export const toCategory = (r: CategoryRow): Category => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  name: r.name,
  kind: r.kind,
  color: r.color,
  builtin: r.builtin,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const toMember = (r: MemberRow): Member => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  name: r.name,
  color: r.color,
  createdAt: r.createdAt,
});

export const toContact = (r: ContactRow): Contact => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  name: r.name,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export const toPixKey = (r: PixKeyRow): PixKey => ({
  id: idOf(r.id),
  householdId: idOf(r.householdId),
  accountId: idOrNull<AccountId>(r.accountId),
  contactId: idOrNull<ContactId>(r.contactId),
  type: r.type,
  value: r.value,
  createdAt: r.createdAt,
});

export const toHousehold = (r: HouseholdRow): Household => ({
  id: idOf(r.id),
  name: r.name,
  createdAt: r.createdAt,
});
