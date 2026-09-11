/**
 * ADR-010 — Branded (nominal) identifier types.
 * At runtime every ID is a ULID string; at compile time the brands make it
 * impossible to pass, e.g., an AccountId where a CardId is expected.
 */
import { monotonicFactory } from "ulid";

const ulid = monotonicFactory();

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type HouseholdId = Brand<string, "HouseholdId">;
export type MemberId = Brand<string, "MemberId">;
export type AccountId = Brand<string, "AccountId">;
export type TransactionId = Brand<string, "TransactionId">;
export type CategoryId = Brand<string, "CategoryId">;
export type CardId = Brand<string, "CardId">;
export type PurchaseId = Brand<string, "PurchaseId">;
export type RecurringId = Brand<string, "RecurringId">;
export type LoanId = Brand<string, "LoanId">;
export type LoanPaymentId = Brand<string, "LoanPaymentId">;
export type PixKeyId = Brand<string, "PixKeyId">;
export type ContactId = Brand<string, "ContactId">;

/** Shared by the two legs of a transfer (see docs/domain/01-invariants.md). */
export type TransferGroupId = Brand<string, "TransferGroupId">;

/** Billing cycle key, formatted `YYYY-MM`. */
export type StatementPeriod = string;

/** Generate a globally unique, time-sortable identifier (ADR-003, ADR-010). */
export function newId<T extends string>(): T {
  return ulid() as T;
}

/** Rebrand a raw string at persistence boundaries (mappers only). */
export function idOf<T extends string>(raw: string): T {
  return raw as T;
}
