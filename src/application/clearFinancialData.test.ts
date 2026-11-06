/**
 * Clean-start use case: every financial row is wiped atomically, while the
 * household, its members and the category dictionary survive — so the app is
 * still usable afterwards and the demo seed never re-runs.
 *
 * Every test reseeds from scratch, so no test depends on another's leftovers.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../infrastructure/db";
import * as uc from "./useCases";

/** Identity and configuration, not history — deliberately kept by a wipe. */
const KEPT = new Set(["households", "members", "categories"]);

/**
 * Derived from the live schema rather than a hand-kept list, so a financial
 * table added later cannot be silently left behind by "Clear all data".
 */
const wipedTables = (): string[] =>
  db.tables
    .map((t) => t.name)
    .filter((name) => !KEPT.has(name))
    .sort();

beforeEach(async () => {
  await db.delete();
  await db.open(); // re-creates and re-seeds: each test starts from the demo ledger
});

describe("clearFinancialData", () => {
  it("empties every table except the household, its members and the categories", async () => {
    expect(wipedTables()).toEqual([
      "accounts",
      "cardPurchases",
      "cards",
      "contacts",
      "loanPayments",
      "loans",
      "pixKeys",
      "recurrings",
      "transactions",
    ]);
    // Guard against a vacuous test: the seed must actually have filled them.
    expect(await db.transactions.count()).toBeGreaterThan(0);
    expect((await db.households.toCollection().first())?.demo).toBe(true);

    const removed = await uc.clearFinancialData();
    expect(removed).toBeGreaterThan(0);

    for (const name of wipedTables()) {
      expect(await db.table(name).count(), name).toBe(0);
    }
    expect(await db.households.count()).toBe(1);
    expect(await db.members.count()).toBe(2);
    expect(await db.categories.count()).toBeGreaterThanOrEqual(8);
    // The ledger is no longer the fictional seed, so the shell stops saying so.
    expect((await db.households.toCollection().first())?.demo).toBe(false);
  });

  it("keeps the database open, so the populate seed does not re-run", async () => {
    await uc.clearFinancialData();

    expect(db.isOpen()).toBe(true);
    expect(await db.households.get("h-demo")).toBeTruthy();
    expect(await db.members.count()).toBe(2);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it("is idempotent — a second call removes nothing", async () => {
    expect(await uc.clearFinancialData()).toBeGreaterThan(0);
    expect(await uc.clearFinancialData()).toBe(0);
  });

  it("leaves the app usable: a new account and entry can be recorded", async () => {
    await uc.clearFinancialData();

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

describe("saveHouseholdProfile", () => {
  const profile = (name: string, ana: string, bruno: string) => ({
    name,
    members: [
      { id: "m-ana", name: ana },
      { id: "m-bruno", name: bruno },
    ],
  });

  it("trims and persists the household and member names", async () => {
    await uc.saveHouseholdProfile(profile("  Our place  ", "  Alex ", "Bruno"));

    expect((await db.households.toCollection().first())?.name).toBe("Our place");
    expect((await db.members.get("m-ana"))?.name).toBe("Alex");
    // Untouched fields survive.
    expect((await db.members.get("m-ana"))?.color).toBe("#1D6B41");
    expect((await db.members.get("m-bruno"))?.name).toBe("Bruno");
  });

  it("writes nothing at all when one member name is invalid", async () => {
    await expect(uc.saveHouseholdProfile(profile("Our place", "", "Bruno"))).rejects.toThrow();

    // The household rename must not have landed on its own.
    expect((await db.households.toCollection().first())?.name).toBe("Demo Household");
    expect((await db.members.get("m-ana"))?.name).toBe("Ana");
  });

  it("rolls back the household rename when a member id is unknown", async () => {
    await expect(
      uc.saveHouseholdProfile({
        name: "Our place",
        members: [
          { id: "m-ana", name: "Alex" },
          { id: "m-missing", name: "Ghost" },
        ],
      })
    ).rejects.toThrow("Member not found.");

    expect((await db.households.toCollection().first())?.name).toBe("Demo Household");
    expect((await db.members.get("m-ana"))?.name).toBe("Ana");
  });

  it("rejects empty and oversized names", async () => {
    await expect(uc.saveHouseholdProfile(profile("   ", "Alex", "Bruno"))).rejects.toThrow();
    await expect(
      uc.saveHouseholdProfile(profile("x".repeat(41), "Alex", "Bruno"))
    ).rejects.toThrow();
    await expect(
      uc.saveHouseholdProfile(profile("Our place", "y".repeat(31), "Bruno"))
    ).rejects.toThrow();
  });
});
