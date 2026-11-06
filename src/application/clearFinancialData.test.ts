/**
 * Clean-start use case: every financial row is wiped atomically, while the
 * household, its members and the category dictionary survive — so the app is
 * still usable afterwards and the demo seed never re-runs.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../infrastructure/db";
import * as uc from "./useCases";

const WIPED = [
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

beforeAll(async () => {
  await db.open(); // triggers the fictional demo seed on first open
});

describe("clearFinancialData", () => {
  it("wipes every financial table and keeps household, members and categories", async () => {
    const households = await db.households.count();
    const members = await db.members.count();
    const categories = await db.categories.count();
    expect(await db.transactions.count()).toBeGreaterThan(0);
    expect((await db.households.toCollection().first())?.demo).toBe(true);

    const removed = await uc.clearFinancialData();
    expect(removed).toBeGreaterThan(0);

    for (const name of WIPED) {
      expect(await db.table(name).count(), name).toBe(0);
    }
    expect(await db.households.count()).toBe(households);
    expect(await db.members.count()).toBe(members);
    expect(await db.categories.count()).toBe(categories);
    expect(members).toBe(2);
    // The ledger is no longer the fictional seed, so the shell stops saying so.
    expect((await db.households.toCollection().first())?.demo).toBe(false);
  });

  it("keeps the database open, so the populate seed does not re-run", async () => {
    expect(db.isOpen()).toBe(true);
    expect(await db.households.get("h-demo")).toBeTruthy();
    expect(await db.members.count()).toBe(2);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it("is idempotent — a second call removes nothing", async () => {
    expect(await uc.clearFinancialData()).toBe(0);
  });

  it("leaves the app usable: a new account and entry can be recorded", async () => {
    const accountId = await uc.saveAccount({
      institution: "Banco Novo",
      nickname: "Checking",
      type: "checking",
      last4: null,
      openingCents: 0,
      openingDate: "2026-01-01",
    });
    await uc.createTransaction({
      type: "EXPENSE",
      amountCents: 1234,
      accountId,
      date: "2026-01-02",
      description: "First real entry",
      categoryId: null,
      note: null,
      createdBy: "m-ana",
      recurringId: null,
    });
    expect(await db.accounts.count()).toBe(1);
    expect(await db.transactions.count()).toBe(1);
  });
});

describe("household rename", () => {
  it("trims and persists the household and member names", async () => {
    await uc.saveHousehold("  Our place  ");
    await uc.saveMember("m-ana", "  Alex ");

    expect((await db.households.toCollection().first())?.name).toBe("Our place");
    expect((await db.members.get("m-ana"))?.name).toBe("Alex");
    // Untouched fields and the other member survive.
    expect((await db.members.get("m-ana"))?.color).toBe("#1D6B41");
    expect((await db.members.get("m-bruno"))?.name).toBe("Bruno");
  });

  it("rejects empty and oversized names", async () => {
    await expect(uc.saveHousehold("   ")).rejects.toThrow();
    await expect(uc.saveHousehold("x".repeat(41))).rejects.toThrow();
    await expect(uc.saveMember("m-ana", "")).rejects.toThrow();
    await expect(uc.saveMember("m-ana", "y".repeat(31))).rejects.toThrow();
    // Rejections must not have written anything.
    expect((await db.households.toCollection().first())?.name).toBe("Our place");
    expect((await db.members.get("m-ana"))?.name).toBe("Alex");
  });

  it("fails on an unknown member instead of silently succeeding", async () => {
    await expect(uc.saveMember("m-missing", "Ghost")).rejects.toThrow("Member not found.");
  });
});
