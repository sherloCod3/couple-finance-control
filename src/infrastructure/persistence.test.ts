/**
 * Persistence + use-case tests (fake-indexeddb). Verifies the demo seed,
 * the two-leg transfer invariant at the storage level, and the domain
 * guards that protect data integrity (Section 04).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "./db";
import * as uc from "../application/useCases";
import { exportBackup, importBackup } from "../application/backup";
import { getHousehold } from "../application/queries";
import { FINANCIAL_TABLES } from "../application/useCases";

beforeAll(async () => {
  await db.open(); // triggers the fictional demo seed on first open
});

describe("demo seed (Section 07 — fictional data)", () => {
  it("seeds accounts, categories, cards, loans and recurrings", async () => {
    expect(await db.accounts.count()).toBeGreaterThanOrEqual(3);
    expect(await db.categories.count()).toBeGreaterThanOrEqual(8);
    expect(await db.cards.count()).toBeGreaterThanOrEqual(1);
    expect(await db.loans.count()).toBeGreaterThanOrEqual(2);
    expect(await db.recurrings.count()).toBeGreaterThanOrEqual(4);
    expect(await db.transactions.count()).toBeGreaterThan(20);
  });

  it("persists every amount as integer cents (no floats at rest)", async () => {
    const rows = await db.transactions.toArray();
    for (const r of rows) {
      expect(Number.isSafeInteger(r.amountCents)).toBe(true);
    }
    const purchases = await db.cardPurchases.toArray();
    for (const p of purchases) {
      expect(Number.isSafeInteger(p.amountCents)).toBe(true);
    }
  });

  it("never stores more than the last four digits of a card", async () => {
    const cards = await db.cards.toArray();
    for (const c of cards) {
      expect(c.last4).toMatch(/^\d{4}$/);
    }
  });
});

describe("two-leg transfer invariant at storage level", () => {
  it("createTransfer writes exactly two legs sharing one ULID group", async () => {
    const groupId = await uc.createTransfer({
      fromAccountId: "a-checking",
      toAccountId: "a-savings",
      amountCents: 123_45,
      date: "2025-06-15",
      description: "Test transfer",
      note: null,
      createdBy: "m-ana",
    });
    const legs = await db.transactions.where("transferGroupId").equals(groupId).toArray();
    expect(legs.length).toBe(2);
    const types = legs.map((l) => l.type).sort();
    expect(types).toEqual(["EXPENSE", "INCOME"]);
    const accounts = new Set(legs.map((l) => l.accountId));
    expect(accounts.size).toBe(2);
    const net = legs.reduce((acc, l) => acc + (l.type === "EXPENSE" ? -l.amountCents : l.amountCents), 0);
    expect(net).toBe(0); // household wealth unchanged
  });

  it("rejects a transfer between the same account", async () => {
    await expect(
      uc.createTransfer({
        fromAccountId: "a-checking",
        toAccountId: "a-checking",
        amountCents: 1000,
        date: "2025-06-15",
        description: "Bad transfer",
        note: null,
        createdBy: "m-ana",
      })
    ).rejects.toThrow();
  });

  it("deletes both legs atomically", async () => {
    const groupId = await uc.createTransfer({
      fromAccountId: "a-checking",
      toAccountId: "a-wallet",
      amountCents: 5000,
      date: "2025-06-16",
      description: "Temp transfer",
      note: null,
      createdBy: "m-bruno",
    });
    await uc.deleteTransfer(groupId);
    const legs = await db.transactions.where("transferGroupId").equals(groupId).toArray();
    expect(legs.length).toBe(0);
  });
});

describe("data integrity guards", () => {
  it("an account with history cannot be deleted", async () => {
    await expect(uc.deleteAccount("a-checking")).rejects.toThrow();
  });

  it("a card with purchases cannot be deleted", async () => {
    const cards = await db.cards.toArray();
    await expect(uc.deleteCard(cards[0].id)).rejects.toThrow();
  });

  it("a loan payment cannot exceed the outstanding balance", async () => {
    const loanId = await uc.saveLoan({
      direction: "owed",
      counterparty: "Test creditor",
      description: null,
      principalCents: 5000_00,
      startDate: "2025-06-01",
      schedule: [],
      note: null,
      createdBy: "m-ana",
    });
    await expect(
      uc.addLoanPayment({
        loanId,
        amountCents: 6000_00,
        date: "2025-06-15",
        note: null,
        createdBy: "m-ana",
        accountId: null,
      })
    ).rejects.toThrow();
  });

  it("a loan with payment history cannot be deleted (payments are auditable)", async () => {
    const loanId = await uc.saveLoan({
      direction: "owed",
      counterparty: "Test creditor 2",
      description: null,
      principalCents: 5000_00,
      startDate: "2025-06-01",
      schedule: [],
      note: null,
      createdBy: "m-ana",
    });
    await uc.addLoanPayment({
      loanId,
      amountCents: 1000_00,
      date: "2025-06-15",
      note: null,
      createdBy: "m-ana",
      accountId: null,
    });
    await expect(uc.deleteLoan(loanId)).rejects.toThrow();
  });
});

describe("backup / export strategy", () => {
  it("exports a versioned envelope and restores it atomically", async () => {
    const before = await db.transactions.count();
    const json = await exportBackup();
    const envelope = JSON.parse(json) as { app: string; version: number };
    expect(envelope.app).toBe("couple-finance-control");
    expect(envelope.version).toBe(1);

    const restored = await importBackup(json);
    expect(restored).toBeGreaterThan(0);
    expect(await db.transactions.count()).toBe(before);
  });

  it("rejects malformed or foreign backups without touching the store", async () => {
    const before = await db.transactions.count();
    await expect(importBackup("not json")).rejects.toThrow();
    await expect(importBackup(JSON.stringify({ app: "other", version: 1, tables: {} }))).rejects.toThrow();
    await expect(importBackup(JSON.stringify({ app: "couple-finance-control", version: 99, tables: {} }))).rejects.toThrow();
    expect(await db.transactions.count()).toBe(before);
  });

  it("rejects a well-formed envelope with corrupt rows without touching the store", async () => {
    const before = await db.transactions.count();
    const json = await exportBackup();
    const envelope = JSON.parse(json) as { tables: Record<string, Record<string, unknown>[]> };
    const corruptTx = { ...envelope.tables.transactions[0], amountCents: 12.5 };
    const corrupt = JSON.stringify({
      app: "couple-finance-control",
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: { ...envelope.tables, transactions: [corruptTx] },
    });
    await expect(importBackup(corrupt)).rejects.toThrow(/Invalid row/);
    expect(await db.transactions.count()).toBe(before);
  });

  it("a card statement payment cannot exceed the remaining balance", async () => {
    const cardId = await uc.saveCard({
      issuer: "Banco Test",
      nickname: "Test Card",
      last4: "9999",
      limitCents: 5000_00,
      closingDay: 5,
      dueDay: 12,
    });
    await uc.addPurchase({
      cardId,
      amountCents: 1000_00,
      date: "2025-05-20", // after day 5 → period 2025-06
      description: "Test purchase",
      categoryId: null,
      createdBy: "m-ana",
    });
    await expect(
      uc.payCardStatement({
        cardId,
        period: "2025-06",
        accountId: "a-checking",
        amountCents: 1000_01,
        date: "2025-07-12",
        createdBy: "m-ana",
      })
    ).rejects.toThrow(/exceeds the remaining/);
  });

  it("transfer creation is atomic — both legs share one group id", async () => {
    const before = await db.transactions.count();
    const groupId = await uc.createTransfer({
      fromAccountId: "a-checking",
      toAccountId: "a-savings",
      amountCents: 7777,
      date: "2025-06-15",
      description: "Atomic transfer",
      note: null,
      createdBy: "m-ana",
    });
    const legs = await db.transactions.where("transferGroupId").equals(groupId).toArray();
    expect(legs.length).toBe(2);
    expect(await db.transactions.count()).toBe(before + 2);
  });

  it("rejects impossible calendar dates (e.g. 2025-02-30)", async () => {
    await expect(
      uc.createTransaction({
        type: "EXPENSE",
        amountCents: 1000,
        accountId: "a-checking",
        date: "2025-02-30",
        description: "Bad date",
        categoryId: null,
        note: null,
        createdBy: "m-ana",
        recurringId: null,
      })
    ).rejects.toThrow(/valid .*date/i);
  });
});

describe("categories, PIX keys and contacts (FIN-03)", () => {
  it("adds a category, then refuses to delete one that is in use", async () => {
    const id = await uc.addCategory({ name: "Pets", kind: "expense", color: "#123456" });
    const created = await db.categories.get(id);
    expect(created?.name).toBe("Pets");
    expect(created?.builtin).toBe(false);

    await uc.createTransaction({
      type: "EXPENSE",
      amountCents: 4200,
      accountId: "a-checking",
      date: "2025-06-10",
      description: "Vet",
      categoryId: id,
      note: null,
      createdBy: "m-ana",
      recurringId: null,
    });
    await expect(uc.deleteCategory(id)).rejects.toThrow(/in use/i);

    // "Education" ships with the demo seed but nothing references it.
    await uc.deleteCategory("c-education");
    expect(await db.categories.get("c-education")).toBeUndefined();
  });

  it("rejects a duplicate category name, case-insensitively", async () => {
    await expect(uc.addCategory({ name: "housing", kind: "expense", color: "#000000" })).rejects.toThrow(
      /already exists/i
    );
  });

  it("removes a PIX key without touching the account", async () => {
    const before = await db.accounts.get("a-checking");
    await uc.deletePixKey("pix-2");
    expect(await db.pixKeys.get("pix-2")).toBeUndefined();
    // A key is metadata: removing it must never move money.
    expect((await db.accounts.get("a-checking"))?.openingBalanceCents).toBe(
      before?.openingBalanceCents
    );
  });

  it("refuses to delete a contact that still has PIX keys", async () => {
    await expect(uc.deleteContact("ct-rafa")).rejects.toThrow(/PIX keys/i);
    await uc.deletePixKey("pix-3");
    await uc.deleteContact("ct-rafa");
    expect(await db.contacts.get("ct-rafa")).toBeUndefined();
  });
});

describe("schema migrations (docs/domain/03-migrations-and-backup.md)", () => {
  it("declares version 2 and indexes cardPurchases.categoryId", () => {
    expect(db.verno).toBe(2);
    // deleteCategory guards on "is this category used by a card purchase?", which
    // is only queryable when the key path is indexed. Without it the guard threw
    // and no category could ever be deleted.
    const indexed = db.cardPurchases.schema.indexes.some((i) => i.keyPath === "categoryId");
    expect(indexed).toBe(true);
  });

  it("keeps every queried key path indexed", () => {
    // Mirrors the .where(...) calls in application/useCases.ts — a key path used
    // in a query but absent from the schema throws at runtime, not compile time.
    const queried: Record<string, string[]> = {
      transactions: ["accountId", "categoryId", "transferGroupId", "cardId"],
      cardPurchases: ["cardId", "categoryId"],
      pixKeys: ["accountId", "contactId"],
      loanPayments: ["loanId"],
    };
    for (const [table, paths] of Object.entries(queried)) {
      const indexes = db.table(table).schema.indexes.map((i) => i.keyPath);
      for (const p of paths) expect(indexes, `${table}.${p}`).toContain(p);
    }
  });
});

describe("clear / reset demo data (Section 07)", () => {
  // Runs last in this file: it mutates the seeded state, then restores it via
  // db.delete() + db.open() so nothing after it depends on a wiped ledger.
  // FINANCIAL_TABLES is imported from useCases so the wipe test can never
  // drift from the list clearFinancialData actually clears.
  it("clearFinancialData wipes every financial table and keeps household, members and categories", async () => {
    const removed = await uc.clearFinancialData();
    expect(removed).toBeGreaterThan(0);
    for (const name of FINANCIAL_TABLES) {
      expect(await db.table(name).count(), name).toBe(0);
    }
    expect(await db.households.get("h-demo")).toMatchObject({ demo: false });
    expect(await db.categories.count()).toBeGreaterThanOrEqual(9);
    const hh = await getHousehold();
    expect(hh.name).toBe("Demo Household");
    expect(hh.members).toHaveLength(2);
    expect(hh.demo).toBe(false);
  });

  it("clearing an already-clean ledger is a harmless no-op", async () => {
    expect(await uc.clearFinancialData()).toBe(0);
  });

  it("the household stays usable right after a clear (a new account can be created)", async () => {
    const id = await uc.saveAccount({
      institution: "Banco Teste",
      nickname: "New account",
      type: "checking",
      last4: null,
      openingCents: 1000,
      openingDate: "2025-01-01",
    });
    expect(await db.accounts.get(id)).toMatchObject({ householdId: "h-demo", archived: false });
    await uc.deleteAccount(id); // no history → deletable again
  });

  it("resetDemoData (db.delete) reseeds the fictional ledger on reopen", async () => {
    await db.delete();
    await db.open(); // reload → fresh database → the populate hook fires again
    expect(await db.transactions.count()).toBeGreaterThan(20);
    expect(await db.households.get("h-demo")).toMatchObject({ demo: true });
    expect((await getHousehold()).demo).toBe(true);
  });

  it("a renamed household is restored by the reseed", async () => {
    await uc.saveHouseholdProfile({
      name: "Renamed",
      members: [
        { id: "m-ana", name: "X" },
        { id: "m-bruno", name: "Y" },
      ],
    });
    await db.delete();
    await db.open();
    expect(await db.households.get("h-demo")).toMatchObject({ name: "Demo Household" });
    expect(await db.members.get("m-ana")).toMatchObject({ name: "Ana" });
  });

  it("seed invariant: the car loan's schedule totals its principal (installments are payable)", async () => {
    const loan = await db.loans.get("l-car");
    const scheduleTotal = (loan?.schedule ?? []).reduce((a, s) => a + s.amountCents, 0);
    expect(scheduleTotal).toBe(loan?.principalCents);
  });

  it("seed invariant: every seeded transaction sits on or after its account's opening date", async () => {
    for (const account of await db.accounts.toArray()) {
      const txs = await db.transactions.where("accountId").equals(account.id).toArray();
      for (const tx of txs) {
        expect(
          tx.date >= account.openingDate,
          `${account.id}: tx ${tx.date} predates opening ${account.openingDate}`
        ).toBe(true);
      }
    }
  });
});
