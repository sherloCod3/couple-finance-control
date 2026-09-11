import { describe, expect, it } from "vitest";
import type { Recurring, Transaction } from "../models/entities";
import { Money } from "../models/money";
import { idOf } from "../types";
import type { RecurringId, TransactionId } from "../types";
import { expectedAmount, occurrencesBetween, occurrencePaid } from "./forecast";

const rec = (over: Partial<Recurring>): Recurring => ({
  id: idOf<RecurringId>("r1"),
  householdId: idOf("h1"),
  description: "Rent",
  categoryId: null,
  frequency: "monthly",
  expectedDay: 5,
  expectedMonth: null,
  amount: Money.fromCents(1850_00),
  minAmount: null,
  maxAmount: null,
  active: true,
  createdBy: idOf("m1"),
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe("recurring forecasts (FIN-08)", () => {
  it("materializes one occurrence per month inside a window", () => {
    const dates = occurrencesBetween(rec({ expectedDay: 10 }), "2025-06-01", "2025-08-31");
    expect(dates).toEqual(["2025-06-10", "2025-07-10", "2025-08-10"]);
  });

  it("clamps expected days to the month length (day 31 → Feb 28)", () => {
    const dates = occurrencesBetween(rec({ expectedDay: 31 }), "2025-02-01", "2025-02-28");
    expect(dates).toEqual(["2025-02-28"]);
  });

  it("weekly plans occur every 7 days on the chosen weekday", () => {
    // 2025-06-07 is a Saturday (ISO weekday 6)
    const dates = occurrencesBetween(
      rec({ frequency: "weekly", expectedDay: 6 }),
      "2025-06-01",
      "2025-06-30"
    );
    expect(dates).toEqual(["2025-06-07", "2025-06-14", "2025-06-21", "2025-06-28"]);
  });

  it("yearly plans occur once a year in the chosen month", () => {
    const dates = occurrencesBetween(
      rec({ frequency: "yearly", expectedDay: 15, expectedMonth: 11 }),
      "2025-01-01",
      "2025-12-31"
    );
    expect(dates).toEqual(["2025-11-15"]);
  });

  it("a range plan estimates its commitment at the midpoint", () => {
    const r = rec({ amount: null, minAmount: Money.fromCents(800_00), maxAmount: Money.fromCents(1200_00) });
    expect(expectedAmount(r).cents).toBe(1000_00);
  });

  it("an occurrence is settled by a linked transaction in the same month", () => {
    const r = rec({ expectedDay: 5 });
    const linked: Transaction = {
      id: idOf<TransactionId>("t1"),
      householdId: idOf("h1"),
      accountId: idOf("a1"),
      type: "EXPENSE",
      amount: Money.fromCents(1850_00),
      date: "2025-06-07",
      description: "Rent",
      categoryId: null,
      note: null,
      createdBy: idOf("m1"),
      transferGroupId: null,
      recurringId: r.id,
      cardId: null,
      statementPeriod: null,
      createdAt: 0,
      updatedAt: 0,
    };
    expect(occurrencePaid(r, "2025-06-05", [linked])).toBe(linked.id);
    expect(occurrencePaid(r, "2025-07-05", [linked])).toBeNull();
  });
});
