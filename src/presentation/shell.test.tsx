/**
 * Shell integration: the sidebar labels a cleared ledger as local instead of
 * demo, the Accounts page offers a first-account CTA at zero, the clear action
 * actually wipes through its dialog, the entry form only disappears when there
 * is no account, and the household/member names are editable from the sidebar.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { db } from "../infrastructure/db";
import * as uc from "../application/useCases";
import { TOUR_KEY } from "./tour";

const TABLES = [
  "households",
  "members",
  "accounts",
  "categories",
  "contacts",
  "pixKeys",
  "transactions",
  "cards",
  "cardPurchases",
  "recurrings",
  "loans",
  "loanPayments",
] as const;

const reload = vi.fn();

beforeEach(async () => {
  localStorage.setItem(TOUR_KEY, "1"); // keep the tour overlay out of the way
  localStorage.setItem("cfc-lang", "en");
  // The shell reloads after a destructive action; jsdom cannot navigate.
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { reload },
  });
  reload.mockClear();

  await db.open();
  await db.transaction(
    "rw",
    TABLES.map((n) => db.table(n)),
    async () => {
      for (const n of TABLES) await db.table(n).clear();
    }
  );
  await db.households.add({ id: "h-demo", name: "Demo Household", createdAt: 1, demo: true });
  await db.members.bulkAdd([
    { id: "m-ana", householdId: "h-demo", name: "Ana", color: "#1D6B41", createdAt: 1 },
    { id: "m-bruno", householdId: "h-demo", name: "Bruno", color: "#B77F22", createdAt: 1 },
  ]);
  await db.categories.add({
    id: "c-housing",
    householdId: "h-demo",
    name: "Housing",
    kind: "expense",
    color: "#9C6B3F",
    builtin: true,
    createdAt: 1,
    updatedAt: 1,
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const addAccount = (): Promise<string> =>
  uc.saveAccount({
    institution: "Banco Demo",
    nickname: "Checking",
    type: "checking",
    last4: null,
    openingCents: 0,
    openingDate: "2026-01-01",
  });

describe("shell after a clean start", () => {
  it("stops calling the ledger fictional once the data is cleared", async () => {
    await uc.clearFinancialData();
    render(<App />);

    expect(await screen.findByText("Stored on this device")).toBeTruthy();
    expect(screen.queryByText("Demo data · fictional")).toBeNull();
  });

  it("offers a first-account CTA on an empty Accounts page", async () => {
    await uc.clearFinancialData();
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: "Accounts" })[0]);
    const title = await screen.findByText("No accounts yet");
    // The CTA lives inside the empty state, not only in the page header.
    const emptySection = title.closest("section");
    expect(emptySection).toBeTruthy();
    expect(within(emptySection as HTMLElement).getByRole("button", { name: "Account" })).toBeTruthy();
  });

  it("wipes through the confirm dialog, keeping the household, members and categories", async () => {
    await addAccount();
    render(<App />);
    await screen.findByText("Demo Household");

    fireEvent.click(screen.getByRole("button", { name: "Clear all data" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete everything" }));

    await waitFor(async () => {
      expect(await db.accounts.count()).toBe(0);
    });
    expect(await db.households.count()).toBe(1);
    expect(await db.members.count()).toBe(2);
    expect(await db.categories.count()).toBe(1);
    expect((await db.households.toCollection().first())?.demo).toBe(false);
  });

  it("explains that an account is required before the first entry", async () => {
    await uc.clearFinancialData();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /new entry/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Add an account first")).toBeTruthy();
    // The dead-end form (amount, account select) must not be offered.
    expect(within(dialog).queryByText("Amount")).toBeNull();
  });

  it("still offers the entry form once an account exists", async () => {
    await addAccount();
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /new entry/i }));
    const dialog = await screen.findByRole("dialog");

    expect(await within(dialog).findByText("Amount")).toBeTruthy();
    expect(within(dialog).queryByText("Add an account first")).toBeNull();
    // A transfer needs two accounts, so the segment is not offered with one.
    expect(within(dialog).queryByRole("button", { name: "Transfer" })).toBeNull();
  });

  it("renames the household and a member from the sidebar card", async () => {
    render(<App />);
    await screen.findByText("Demo Household");

    fireEvent.click(screen.getByRole("button", { name: "Edit household" }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Household name"), {
      target: { value: "  Our place  " },
    });
    fireEvent.change(within(dialog).getByLabelText("Member 1"), { target: { value: "Alex" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(async () => {
      expect((await db.households.toCollection().first())?.name).toBe("Our place");
    });
    expect((await db.members.get("m-ana"))?.name).toBe("Alex");
    // Untouched member keeps its name.
    expect((await db.members.get("m-bruno"))?.name).toBe("Bruno");
    // The sidebar reflects the new name through the live query.
    expect(await screen.findByText("Our place")).toBeTruthy();
  });

  it("leaves the household unchanged when a member name is rejected", async () => {
    render(<App />);
    await screen.findByText("Demo Household");

    fireEvent.click(screen.getByRole("button", { name: "Edit household" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Household name"), {
      target: { value: "Our place" },
    });
    fireEvent.change(within(dialog).getByLabelText("Member 1"), { target: { value: "   " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    // The save is rejected and surfaced; nothing was written.
    expect(await screen.findByText("Member name is required.")).toBeTruthy();
    expect((await db.households.toCollection().first())?.name).toBe("Demo Household");
    expect((await db.members.get("m-ana"))?.name).toBe("Ana");
  });
});
