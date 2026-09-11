/**
 * Component test: with a controlled ledger in fake-indexeddb, the Overview
 * page must render the exact cash position computed by the domain services.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { db } from "../infrastructure/db";
import Dashboard from "./pages/Dashboard";
import { LangProvider } from "./i18n";
import { fmtCents, ToastProvider } from "./ui";

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

beforeEach(async () => {
  await db.open();
  await db.transaction(
    "rw",
    [
      db.households, db.members, db.accounts, db.transactions, db.recurrings,
      db.cards, db.cardPurchases, db.loans, db.loanPayments, db.categories,
      db.contacts, db.pixKeys,
    ],
    async () => {
      await db.households.clear();
      await db.members.clear();
      await db.accounts.clear();
      await db.transactions.clear();
      await db.recurrings.clear();
      await db.cards.clear();
      await db.cardPurchases.clear();
      await db.loans.clear();
      await db.loanPayments.clear();
      await db.categories.clear();
      await db.contacts.clear();
      await db.pixKeys.clear();
    }
  );

  await db.households.add({ id: "h1", name: "Test Household", createdAt: 1 });
  await db.members.add({ id: "m1", householdId: "h1", name: "Ana", color: "#1D6B41", createdAt: 1 });
  await db.accounts.add({
    id: "a1", householdId: "h1", institution: "Banco Demo", nickname: "Checking",
    type: "checking", last4: null, openingBalanceCents: 100_000, openingDate: "2025-01-01",
    archived: false, createdAt: 1, updatedAt: 1,
  });
  await db.transactions.bulkAdd([
    {
      id: "t1", householdId: "h1", accountId: "a1", type: "INCOME", amountCents: 50_000,
      date: "2025-06-05", description: "Salary", categoryId: null, note: null, createdBy: "m1",
      transferGroupId: null, recurringId: null, cardId: null, statementPeriod: null,
      createdAt: 1, updatedAt: 1,
    },
    {
      id: "t2", householdId: "h1", accountId: "a1", type: "EXPENSE", amountCents: 20_000,
      date: "2025-06-08", description: "Rent", categoryId: null, note: null, createdBy: "m1",
      transferGroupId: null, recurringId: null, cardId: null, statementPeriod: null,
      createdAt: 2, updatedAt: 2,
    },
  ]);
});

describe("Dashboard component", () => {
  it("renders the cash position derived from the ledger (1000 + 500 − 200)", async () => {
    render(
      <LangProvider>
        <ToastProvider>
          <Dashboard onNavigate={() => undefined} />
        </ToastProvider>
      </LangProvider>
    );
    // Locale-proof + count-up-proof: the exact string renders either immediately
    // (reduced-motion shim in test/setup.ts) or once the 750ms animation ends.
    const expected = fmtCents(130_000);
    await waitFor(
      () => {
        expect(screen.getAllByText(new RegExp(escapeRegExp(expected))).length).toBeGreaterThan(0);
      },
      { timeout: 5000 }
    );
  });

  it("shows the derived reminders section", async () => {
    render(
      <LangProvider>
        <ToastProvider>
          <Dashboard onNavigate={() => undefined} />
        </ToastProvider>
      </LangProvider>
    );
    await waitFor(() => expect(screen.getAllByText(/Needs attention|Precisa de atenção/).length).toBeGreaterThan(0), {
      timeout: 5000,
    });
  });
});
