/**
 * Application use cases — the only writers in the system.
 * Per the "no ports on day 1" decision, these import the concrete Dexie
 * database directly; a sync layer (ADR-003) can wrap them later.
 * Domain rules are enforced here and in domain/services — never in the UI.
 */
import { db } from "../infrastructure/db";
import type { CardPurchaseRow, TransactionRow } from "../infrastructure/mappers";
import { toCard, toLoan, toLoanPayment, toPurchase, toTransaction } from "../infrastructure/mappers";
import { newId } from "../domain/types";
import type { TransactionId, TransferGroupId } from "../domain/types";
import { Money } from "../domain/models/money";
import { buildStatements, periodOf } from "../domain/services/cards";
import { outstanding as loanOutstanding } from "../domain/services/loans";

const H = "h-demo";
const now = (): number => Date.now();
function fail(message: string): never {
  throw new Error(message);
}

const requirePositiveCents = (cents: number, label = "amount"): void => {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    fail(`Enter a valid ${label} greater than zero.`);
  }
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const requireIsoDate = (date: string, label = "date"): void => {
  if (!ISO_DATE.test(date)) fail(`Choose a valid ${label} (YYYY-MM-DD).`);
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d)
    fail(`Choose a valid ${label} (YYYY-MM-DD).`);
};

const requireText = (value: string, label: string, max: number): string => {
  const text = value.trim();
  if (!text) fail(`${label} is required.`);
  if (text.length > max) fail(`${label} must be at most ${max} characters.`);
  return text;
};

const optionalText = (value: string | null | undefined, max: number, label: string): string | null => {
  if (value === null || value === undefined) return null;
  const text = value.trim() || null;
  if (text && text.length > max) fail(`${label} must be at most ${max} characters.`);
  return text;
};

export interface SingleTxInput {
  type: "INCOME" | "EXPENSE" | "ADJUSTMENT";
  /** Absolute cents; ADJUSTMENT sign comes from `adjustmentPositive`. */
  amountCents: number;
  adjustmentPositive?: boolean;
  accountId: string;
  date: string;
  description: string;
  categoryId: string | null;
  note: string | null;
  createdBy: string;
  recurringId: string | null;
}

const validateSingle = (i: SingleTxInput): void => {
  requirePositiveCents(i.amountCents);
  if (!i.accountId) fail("Choose an account.");
  requireIsoDate(i.date);
  requireText(i.description, "Description", 140);
  if (i.note !== null && i.note !== undefined) optionalText(i.note, 500, "Note");
};

const singleRow = (i: SingleTxInput, id: string): TransactionRow => {
  const signed =
    i.type === "ADJUSTMENT" && i.adjustmentPositive === false ? -i.amountCents : i.amountCents;
  return {
    id,
    householdId: H,
    accountId: i.accountId,
    type: i.type,
    amountCents: signed,
    date: i.date,
    description: i.description.trim(),
    categoryId: i.categoryId,
    note: i.note?.trim() || null,
    createdBy: i.createdBy,
    transferGroupId: null,
    recurringId: i.recurringId,
    cardId: null,
    statementPeriod: null,
    createdAt: now(),
    updatedAt: now(),
  };
};

export async function createTransaction(input: SingleTxInput): Promise<string> {
  validateSingle(input);
  const row = singleRow(input, newId<TransactionId>());
  await db.transactions.add(row);
  return row.id;
}

export async function updateTransaction(id: string, input: SingleTxInput): Promise<void> {
  validateSingle(input);
  const prev = await db.transactions.get(id);
  if (!prev) fail("Transaction not found.");
  const next = singleRow(input, id);
  await db.transactions.put({ ...next, createdAt: prev.createdAt, updatedAt: now() });
}

export async function deleteTransaction(id: string): Promise<void> {
  const t = await db.transactions.get(id);
  if (!t) return;
  if (t.transferGroupId) {
    await deleteTransfer(t.transferGroupId);
    return;
  }
  await db.transactions.delete(id);
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  date: string;
  description: string;
  note: string | null;
  createdBy: string;
}

/**
 * A transfer is two linked legs — one EXPENSE, one INCOME — sharing a
 * transferGroupId. Household wealth is unchanged by construction.
 */
export async function createTransfer(input: TransferInput): Promise<string> {
  requirePositiveCents(input.amountCents);
  if (!input.fromAccountId || !input.toAccountId) fail("Choose both accounts.");
  if (input.fromAccountId === input.toAccountId)
    fail("A transfer needs two different accounts.");
  requireIsoDate(input.date);
  requireText(input.description, "Description", 140);
  optionalText(input.note, 500, "Note");

  const groupId = newId<TransferGroupId>();
  const base = {
    householdId: H,
    amountCents: input.amountCents,
    date: input.date,
    description: input.description.trim(),
    categoryId: null,
    note: input.note?.trim() || null,
    createdBy: input.createdBy,
    transferGroupId: groupId as string,
    recurringId: null,
    cardId: null,
    statementPeriod: null,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.transaction("rw", db.transactions, async () => {
    await db.transactions.bulkAdd([
      { ...base, id: newId<TransactionId>(), accountId: input.fromAccountId, type: "EXPENSE" },
      { ...base, id: newId<TransactionId>(), accountId: input.toAccountId, type: "INCOME" },
    ]);
  });
  return groupId as string;
}

export async function updateTransfer(groupId: string, input: TransferInput): Promise<void> {
  requirePositiveCents(input.amountCents);
  if (input.fromAccountId === input.toAccountId)
    fail("A transfer needs two different accounts.");
  requireIsoDate(input.date);
  requireText(input.description, "Description", 140);
  optionalText(input.note, 500, "Note");

  const legs = await db.transactions.where("transferGroupId").equals(groupId).toArray();
  if (legs.length !== 2) fail("Transfer not found.");
  await db.transaction("rw", db.transactions, async () => {
    for (const leg of legs) {
      const out = leg.type === "EXPENSE";
      await db.transactions.update(leg.id, {
        accountId: out ? input.fromAccountId : input.toAccountId,
        amountCents: input.amountCents,
        date: input.date,
        description: input.description.trim(),
        note: input.note?.trim() || null,
        updatedAt: now(),
      });
    }
  });
}

export async function deleteTransfer(groupId: string): Promise<void> {
  await db.transactions.where("transferGroupId").equals(groupId).delete();
}

export async function payCardStatement(input: {
  cardId: string;
  period: string;
  accountId: string;
  amountCents: number;
  date: string;
  createdBy: string;
}): Promise<string> {
  requirePositiveCents(input.amountCents);
  if (!input.accountId) fail("Choose the account paying the statement.");
  requireIsoDate(input.date);
  const cardRow = await db.cards.get(input.cardId);
  if (!cardRow) fail("Card not found.");
  const purchaseRows = await db.cardPurchases.where("cardId").equals(input.cardId).toArray();
  const paymentRows = await db.transactions.where("cardId").equals(input.cardId).toArray();
  const statement = buildStatements(
    toCard(cardRow),
    purchaseRows.map(toPurchase),
    paymentRows.map(toTransaction)
  ).find((s) => s.period === input.period);
  if (!statement || statement.total.isZero()) fail("Statement not found or has no purchases.");
  if (Money.fromCents(input.amountCents).gt(statement.remaining))
    fail("Payment exceeds the remaining statement balance.");
  const row: TransactionRow = {
    id: newId<TransactionId>(),
    householdId: H,
    accountId: input.accountId,
    type: "EXPENSE",
    amountCents: input.amountCents,
    date: input.date,
    description: `Card payment ••${cardRow.last4}`,
    categoryId: null,
    note: `Statement ${input.period}`,
    createdBy: input.createdBy,
    transferGroupId: null,
    recurringId: null,
    cardId: input.cardId,
    statementPeriod: input.period,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.transactions.add(row);
  return row.id;
}

export async function addLoanPayment(input: {
  loanId: string;
  amountCents: number;
  date: string;
  note: string | null;
  createdBy: string;
  /** When set, also records a signed ADJUSTMENT so account cash stays truthful. */
  accountId: string | null;
}): Promise<void> {
  requirePositiveCents(input.amountCents);
  requireIsoDate(input.date);
  optionalText(input.note, 500, "Note");
  const loanRow = await db.loans.get(input.loanId);
  if (!loanRow) fail("Loan not found.");
  const loan = toLoan(loanRow);
  const paymentRows = await db.loanPayments.where("loanId").equals(input.loanId).toArray();
  const outstanding = loanOutstanding(loan, paymentRows.map(toLoanPayment));
  const amount = Money.fromCents(input.amountCents);
  if (amount.gt(outstanding)) fail("Payment exceeds the outstanding balance.");

  await db.transaction("rw", db.loanPayments, db.transactions, async () => {
    let transactionId: string | null = null;
    if (input.accountId) {
      const direction = loan.direction === "owed" ? -1 : 1;
      const txRow: TransactionRow = {
        id: newId<TransactionId>(),
        householdId: H,
        accountId: input.accountId,
        type: "ADJUSTMENT",
        amountCents: direction * input.amountCents,
        date: input.date,
        description:
          loan.direction === "owed"
            ? `Loan payment — ${loanRow.counterparty}`
            : `Loan received — ${loanRow.counterparty}`,
        categoryId: null,
        note: input.note?.trim() || null,
        createdBy: input.createdBy,
        transferGroupId: null,
        recurringId: null,
        cardId: null,
        statementPeriod: null,
        createdAt: now(),
        updatedAt: now(),
      };
      await db.transactions.add(txRow);
      transactionId = txRow.id;
    }
    await db.loanPayments.add({
      id: newId<string>(),
      loanId: input.loanId,
      date: input.date,
      amountCents: input.amountCents,
      note: input.note?.trim() || null,
      transactionId,
      createdAt: now(),
    });
  });
}

// ---- entity CRUD ---------------------------------------------------------

export interface AccountInput {
  id?: string;
  institution: string;
  nickname: string;
  type: "checking" | "savings" | "wallet" | "other";
  last4: string | null;
  openingCents: number;
  openingDate: string;
}

export async function saveAccount(input: AccountInput): Promise<string> {
  const institution = requireText(input.institution, "Institution", 80);
  const nickname = requireText(input.nickname, "Nickname", 60);
  if (input.last4 && !/^\d{4}$/.test(input.last4))
    fail("Store only the last four digits (ADR-005).");
  if (!Number.isSafeInteger(input.openingCents)) fail("Enter a valid opening balance.");
  requireIsoDate(input.openingDate, "opening date");
  if (input.id) {
    await db.accounts.update(input.id, {
      institution,
      nickname,
      type: input.type,
      last4: input.last4 || null,
      openingBalanceCents: input.openingCents,
      openingDate: input.openingDate,
      updatedAt: now(),
    });
    return input.id;
  }
  const id = newId<string>();
  await db.accounts.add({
    id,
    householdId: H,
    institution,
    nickname,
    type: input.type,
    last4: input.last4 || null,
    openingBalanceCents: input.openingCents,
    openingDate: input.openingDate,
    archived: false,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

export async function deleteAccount(id: string): Promise<void> {
  const txCount = await db.transactions.where("accountId").equals(id).count();
  if (txCount > 0) fail("Accounts with transaction history cannot be deleted.");
  const keyCount = await db.pixKeys.where("accountId").equals(id).count();
  if (keyCount > 0) fail("Remove the PIX keys linked to this account first.");
  await db.accounts.delete(id);
}

export interface CardInput {
  id?: string;
  issuer: string;
  nickname: string;
  last4: string;
  limitCents: number;
  closingDay: number;
  dueDay: number;
}

export async function saveCard(input: CardInput): Promise<string> {
  const issuer = requireText(input.issuer, "Issuer", 80);
  const nickname = requireText(input.nickname, "Nickname", 60);
  if (!/^\d{4}$/.test(input.last4)) fail("Store only the last four digits (ADR-005).");
  requirePositiveCents(input.limitCents, "limit");
  if (input.closingDay < 1 || input.closingDay > 31) fail("Closing day must be 1–31.");
  if (input.dueDay < 1 || input.dueDay > 31) fail("Due day must be 1–31.");
  if (input.id) {
    await db.cards.update(input.id, {
      issuer,
      nickname,
      last4: input.last4,
      limitCents: input.limitCents,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
      updatedAt: now(),
    });
    return input.id;
  }
  const id = newId<string>();
  await db.cards.add({
    id,
    householdId: H,
    issuer,
    nickname,
    last4: input.last4,
    limitCents: input.limitCents,
    closingDay: input.closingDay,
    dueDay: input.dueDay,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

export async function deleteCard(id: string): Promise<void> {
  const purchases = await db.cardPurchases.where("cardId").equals(id).count();
  if (purchases > 0) fail("Cards with purchase history cannot be deleted.");
  await db.cards.delete(id);
}

export async function addPurchase(input: {
  cardId: string;
  amountCents: number;
  date: string;
  description: string;
  categoryId: string | null;
  createdBy: string;
}): Promise<string> {
  requirePositiveCents(input.amountCents);
  requireIsoDate(input.date, "purchase date");
  requireText(input.description, "Description", 140);
  const cardRow = await db.cards.get(input.cardId);
  if (!cardRow) fail("Card not found.");
  const row: CardPurchaseRow = {
    id: newId<string>(),
    cardId: input.cardId,
    amountCents: input.amountCents,
    date: input.date,
    description: input.description.trim(),
    categoryId: input.categoryId,
    period: periodOf(toCard(cardRow), input.date),
    createdBy: input.createdBy,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.cardPurchases.add(row);
  return row.id;
}

export async function deletePurchase(id: string): Promise<void> {
  await db.cardPurchases.delete(id);
}

export interface RecurringInput {
  id?: string;
  description: string;
  categoryId: string | null;
  frequency: "monthly" | "weekly" | "yearly";
  expectedDay: number;
  expectedMonth: number | null;
  fixedCents: number | null;
  minCents: number | null;
  maxCents: number | null;
  active: boolean;
  createdBy: string;
}

export async function saveRecurring(input: RecurringInput): Promise<string> {
  requireText(input.description, "Description", 140);
  if (input.fixedCents === null) {
    if (input.minCents === null || input.maxCents === null)
      fail("Set an amount or an estimated range.");
    if (input.minCents > input.maxCents) fail("Range minimum exceeds maximum.");
    requirePositiveCents(input.minCents, "minimum");
    requirePositiveCents(input.maxCents, "maximum");
  } else {
    requirePositiveCents(input.fixedCents);
  }
  if (input.frequency === "weekly") {
    if (input.expectedDay < 1 || input.expectedDay > 7) fail("Pick a weekday.");
  } else if (input.expectedDay < 1 || input.expectedDay > 28) {
    fail("Day must be 1–28 (kept safe for short months).");
  }
  if (input.frequency === "yearly" && (input.expectedMonth === null || input.expectedMonth < 1 || input.expectedMonth > 12)) {
    fail("Pick the month for a yearly plan.");
  }
  const data = {
    description: input.description.trim(),
    categoryId: input.categoryId,
    frequency: input.frequency,
    expectedDay: input.expectedDay,
    expectedMonth: input.frequency === "yearly" ? input.expectedMonth : null,
    amountCents: input.fixedCents,
    minCents: input.fixedCents === null ? input.minCents : null,
    maxCents: input.fixedCents === null ? input.maxCents : null,
    active: input.active,
    updatedAt: now(),
  };
  if (input.id) {
    await db.recurrings.update(input.id, data);
    return input.id;
  }
  const id = newId<string>();
  await db.recurrings.add({ id, householdId: H, createdBy: input.createdBy, createdAt: now(), ...data });
  return id;
}

export async function toggleRecurring(id: string): Promise<void> {
  const r = await db.recurrings.get(id);
  if (!r) fail("Recurring expense not found.");
  await db.recurrings.update(id, { active: !r.active, updatedAt: now() });
}

/** Cancelling/removing a template never deletes historical transactions (FIN-08). */
export async function deleteRecurring(id: string): Promise<void> {
  await db.recurrings.delete(id);
}

export interface LoanInput {
  id?: string;
  direction: "owed" | "receivable";
  counterparty: string;
  description: string | null;
  principalCents: number;
  startDate: string;
  schedule: { dueDate: string; amountCents: number }[];
  note: string | null;
  createdBy: string;
}

export async function saveLoan(input: LoanInput): Promise<string> {
  requireText(input.counterparty, "Counterparty", 120);
  requirePositiveCents(input.principalCents, "principal");
  requireIsoDate(input.startDate, "start date");
  optionalText(input.description, 500, "Description");
  optionalText(input.note, 500, "Note");
  for (const item of input.schedule) {
    requireIsoDate(item.dueDate, "installment due date");
    requirePositiveCents(item.amountCents, "installment amount");
  }
  const data = {
    direction: input.direction,
    counterparty: input.counterparty.trim(),
    description: input.description?.trim() || null,
    principalCents: input.principalCents,
    startDate: input.startDate,
    schedule: input.schedule,
    note: input.note?.trim() || null,
    updatedAt: now(),
  };
  if (input.id) {
    await db.loans.update(input.id, data);
    return input.id;
  }
  const id = newId<string>();
  await db.loans.add({ id, householdId: H, createdBy: input.createdBy, createdAt: now(), ...data });
  return id;
}

/** Payments are the audit trail — a loan with payments cannot be deleted. */
export async function deleteLoan(id: string): Promise<void> {
  const count = await db.loanPayments.where("loanId").equals(id).count();
  if (count > 0) fail("Loans with recorded payments cannot be deleted.");
  await db.loans.delete(id);
}

export async function addCategory(input: {
  name: string;
  kind: "expense" | "income";
  color: string;
}): Promise<string> {
  const name = requireText(input.name, "Category name", 60);
  const existing = await db.categories.toArray();
  if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase()))
    fail("A category with this name already exists.");
  const id = newId<string>();
  await db.categories.add({
    id,
    householdId: H,
    name,
    kind: input.kind,
    color: input.color,
    builtin: false,
    createdAt: now(),
    updatedAt: now(),
  });
  return id;
}

export async function deleteCategory(id: string): Promise<void> {
  const used =
    (await db.transactions.where("categoryId").equals(id).count()) +
    (await db.cardPurchases.where("categoryId").equals(id).count());
  if (used > 0) fail("Category is in use by transactions and cannot be deleted.");
  await db.categories.delete(id);
}

export async function savePixKey(input: {
  id?: string;
  type: "cpf" | "cnpj" | "email" | "phone" | "random";
  value: string;
  accountId: string | null;
  contactId: string | null;
}): Promise<string> {
  const value = requireText(input.value, "Key value", 140);
  if (!input.accountId && !input.contactId)
    fail("Link the key to an account or a contact.");
  if (input.id) {
    await db.pixKeys.update(input.id, {
      type: input.type,
      value,
      accountId: input.accountId,
      contactId: input.contactId,
    });
    return input.id;
  }
  const id = newId<string>();
  await db.pixKeys.add({
    id,
    householdId: H,
    accountId: input.accountId,
    contactId: input.contactId,
    type: input.type,
    value,
    createdAt: now(),
  });
  return id;
}

export async function deletePixKey(id: string): Promise<void> {
  await db.pixKeys.delete(id);
}

export async function saveContact(input: { id?: string; name: string }): Promise<string> {
  const name = requireText(input.name, "Contact name", 120);
  if (input.id) {
    await db.contacts.update(input.id, { name, updatedAt: now() });
    return input.id;
  }
  const id = newId<string>();
  await db.contacts.add({ id, householdId: H, name, createdAt: now(), updatedAt: now() });
  return id;
}

export async function deleteContact(id: string): Promise<void> {
  const keys = await db.pixKeys.where("contactId").equals(id).count();
  if (keys > 0) fail("Remove this contact's PIX keys first.");
  await db.contacts.delete(id);
}

/** Wipes local data; the DB reseeds fictional demo data on next load. */
export async function resetDemoData(): Promise<void> {
  await db.delete();
}

/**
 * Renames the household. The app models exactly one household per install
 * (the row is created by the seed), so this targets the single existing row
 * instead of taking an id.
 */
export async function saveHousehold(name: string): Promise<void> {
  const clean = requireText(name, "Household name", 40);
  const household = await db.households.toCollection().first();
  if (!household) fail("Household not found.");
  await db.households.update(household.id, { name: clean });
}

/** Renames a member. The avatar colour is derived at seed time and stays put. */
export async function saveMember(id: string, name: string): Promise<void> {
  const clean = requireText(name, "Member name", 30);
  const member = await db.members.get(id);
  if (!member) fail("Member not found.");
  await db.members.update(id, { name: clean });
}

/**
 * Financial rows only. `households`, `members` and `categories` are identity
 * and configuration, not history — keeping them means the app is usable right
 * after a wipe, with no onboarding step.
 */
const FINANCIAL_TABLES = [
  "accounts",
  "contacts",
  "pixKeys",
  "transactions",
  "cards",
  "cardPurchases",
  "recurrings",
  "loans",
  "loanPayments",
] as const;

/**
 * Clean start: wipes every financial row in a single atomic transaction and
 * keeps the household, its members and the category dictionary.
 *
 * Deliberately never calls `db.delete()` — that fires the `populate` hook
 * (infrastructure/db.ts) and would reseed the demo household instead of
 * emptying the ledger. Returns the number of rows removed, so calling it on an
 * already-clean ledger is a harmless no-op (0).
 */
export async function clearFinancialData(): Promise<number> {
  let removed = 0;
  await db.transaction(
    "rw",
    [...FINANCIAL_TABLES.map((name) => db.table(name)), db.households],
    async () => {
      for (const name of FINANCIAL_TABLES) {
        const table = db.table(name);
        removed += await table.count();
        await table.clear();
      }
      // The ledger is no longer the fictional seed — the sidebar label follows.
      await db.households.toCollection().modify({ demo: false });
    }
  );
  return removed;
}
