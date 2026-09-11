/**
 * Domain entities (Section 03). Pure TypeScript — no React, no Dexie.
 * Persistence rows mirror these shapes with `number` cents and live in
 * infrastructure/mappers.ts.
 */
import type { Money } from "./money";
import type {
  AccountId,
  CardId,
  CategoryId,
  ContactId,
  HouseholdId,
  LoanId,
  LoanPaymentId,
  MemberId,
  PixKeyId,
  PurchaseId,
  RecurringId,
  StatementPeriod,
  TransactionId,
  TransferGroupId,
} from "../types";

/**
 * TRANSFER is intentionally not a type: a transfer is modeled as two linked
 * legs — one EXPENSE and one INCOME — sharing a transferGroupId. This keeps
 * the core invariant pure: INCOME adds, EXPENSE subtracts.
 */
export type TransactionType = "INCOME" | "EXPENSE" | "ADJUSTMENT";

export interface Transaction {
  id: TransactionId;
  householdId: HouseholdId;
  accountId: AccountId;
  type: TransactionType;
  /** Positive for INCOME/EXPENSE; signed for ADJUSTMENT. */
  amount: Money;
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  description: string;
  categoryId: CategoryId | null;
  note: string | null;
  /** Traceability only — never a financial ownership metric (FIN-07). */
  createdBy: MemberId;
  transferGroupId: TransferGroupId | null;
  /** Links an actual transaction back to its forecast source (FIN-08). */
  recurringId: RecurringId | null;
  /** Set only for credit-card statement payments (paired with statementPeriod). */
  cardId: CardId | null;
  statementPeriod: StatementPeriod | null;
  createdAt: number;
  updatedAt: number;
}

export type AccountType = "checking" | "savings" | "wallet" | "other";

export interface Account {
  id: AccountId;
  householdId: HouseholdId;
  institution: string;
  nickname: string;
  type: AccountType;
  last4: string | null;
  /** Balance is derived: openingBalance + net transaction impact. */
  openingBalance: Money;
  openingDate: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: CategoryId;
  householdId: HouseholdId;
  name: string;
  kind: "expense" | "income";
  color: string;
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: CardId;
  householdId: HouseholdId;
  issuer: string;
  nickname: string;
  last4: string;
  limit: Money;
  closingDay: number;
  dueDay: number;
  createdAt: number;
  updatedAt: number;
}

export interface CardPurchase {
  id: PurchaseId;
  cardId: CardId;
  amount: Money;
  date: string;
  description: string;
  categoryId: CategoryId | null;
  /** Billing cycle this purchase was booked into (computed at write time). */
  period: StatementPeriod;
  createdBy: MemberId;
  createdAt: number;
  updatedAt: number;
}

export type Frequency = "monthly" | "weekly" | "yearly";

export interface Recurring {
  id: RecurringId;
  householdId: HouseholdId;
  description: string;
  categoryId: CategoryId | null;
  frequency: Frequency;
  /** Day of month (monthly/yearly) or weekday 1=Mon..7=Sun (weekly). */
  expectedDay: number;
  /** Month 1..12 — yearly only. */
  expectedMonth: number | null;
  amount: Money | null;
  minAmount: Money | null;
  maxAmount: Money | null;
  active: boolean;
  createdBy: MemberId;
  createdAt: number;
  updatedAt: number;
}

export type LoanDirection = "owed" | "receivable";

export interface LoanScheduleItem {
  dueDate: string;
  amount: Money;
}

export interface Loan {
  id: LoanId;
  householdId: HouseholdId;
  direction: LoanDirection;
  counterparty: string;
  description: string | null;
  principal: Money;
  startDate: string;
  schedule: LoanScheduleItem[];
  note: string | null;
  createdBy: MemberId;
  createdAt: number;
  updatedAt: number;
}

/** Immutable once written (Section 04 — Loans). */
export interface LoanPayment {
  id: LoanPaymentId;
  loanId: LoanId;
  date: string;
  amount: Money;
  note: string | null;
  /** Optional linked account transaction, when cash actually moved. */
  transactionId: TransactionId | null;
  createdAt: number;
}

export interface Member {
  id: MemberId;
  householdId: HouseholdId;
  name: string;
  color: string;
  createdAt: number;
}

export interface Contact {
  id: ContactId;
  householdId: HouseholdId;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";

export interface PixKey {
  id: PixKeyId;
  householdId: HouseholdId;
  accountId: AccountId | null;
  contactId: ContactId | null;
  type: PixKeyType;
  value: string;
  createdAt: number;
}

export interface Household {
  id: HouseholdId;
  name: string;
  createdAt: number;
}
