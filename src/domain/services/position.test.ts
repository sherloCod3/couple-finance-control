import { describe, expect, it } from "vitest";
import type { Account, Recurring, Transaction } from "../models/entities";
import { Money } from "../models/money";
import { idOf } from "../types";
import type { AccountId, RecurringId, TransactionId, TransferGroupId } from "../types";
import { computePosition, type PositionInput } from "./position";

const A = (s: string): AccountId => idOf<AccountId>(s);

const account = (id: string, openingCents: number): Account => ({
  id: A(id),
  householdId: idOf("h1"),
  institution: "Banco Demo",
  nickname: id,
  type: "checking",
  last4: null,
  openingBalance: Money.fromCents(openingCents),
  openingDate: "2025-01-01",
  archived: false,
  createdAt: 0,
  updatedAt: 0,
});

let tseq = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: idOf<TransactionId>(`pt${++tseq}`),
  householdId: idOf("h1"),
  accountId: A("a1"),
  type: "EXPENSE",
  amount: Money.fromCents(1000),
  date: "2025-06-12",
  description: "fixture",
  categoryId: null,
  note: null,
  createdBy: idOf("m1"),
  transferGroupId: null,
  recurringId: null,
  cardId: null,
  statementPeriod: null,
  createdAt: tseq,
  updatedAt: tseq,
  ...over,
});

const recurring = (over: Partial<Recurring>): Recurring => ({
  id: idOf<RecurringId>("r-rent"),
  householdId: idOf("h1"),
  description: "Rent",
  categoryId: null,
  frequency: "monthly",
  expectedDay: 20,
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

const base: PositionInput = {
  accounts: [account("a1", 5000_00)],
  transactions: [
    tx({ type: "INCOME", amount: Money.fromCents(7000_00), date: "2025-06-05" }),
    tx({ type: "EXPENSE", amount: Money.fromCents(2000_00), date: "2025-06-08" }),
  ],
  recurrings: [],
  cards: [],
  purchases: [],
  loans: [],
  loanPayments: [],
  today: "2025-06-15",
  horizonDays: 30,
};

describe("FinancialPosition (FIN-05 / Section 05)", () => {
  it("current cash is opening balance plus every account's net impact", () => {
    const p = computePosition(base);
    expect(p.currentCash.cents).toBe(10000_00); // 5000 + 7000 − 2000
    expect(p.monthIncome.cents).toBe(7000_00);
    expect(p.monthExpenses.cents).toBe(2000_00);
    // Decision A/A/A: net counts signed adjustments (none here) and the bucket
    // follows injected today (2025-06-15 → 2025-06).
    expect(p.monthNet.cents).toBe(5000_00);
    expect(p.monthDelta.cents).toBe(5000_00);
  });

  it("a transfer between accounts never changes household cash", () => {
    const group = idOf<TransferGroupId>("g1");
    const withTransfer: PositionInput = {
      ...base,
      accounts: [account("a1", 5000_00), account("a2", 0)],
      transactions: [
        ...base.transactions,
        tx({ accountId: A("a1"), type: "EXPENSE", amount: Money.fromCents(1500_00), transferGroupId: group }),
        tx({ accountId: A("a2"), type: "INCOME", amount: Money.fromCents(1500_00), transferGroupId: group }),
      ],
    };
    expect(computePosition(withTransfer).currentCash.cents).toBe(10000_00);
  });

  it("available cash = current cash − committed (unpaid obligations due this month)", () => {
    // Decision A/A/A: committed keeps the collapsed stale overdue. The monthly
    // rent template (due day 20) has an unpaid May occurrence (horizon opens at
    // today − 45d) plus the June occurrence → 2 × 1850 committed.
    const p = computePosition({ ...base, recurrings: [recurring({})] });
    expect(p.committedCash.cents).toBe(3700_00);
    expect(p.availableCash.cents).toBe(10000_00 - 3700_00);
    expect(p.projectedCash.cents).toBe(10000_00 - 3700_00);
  });

  it("a linked transaction settles the forecast and releases the commitment", () => {
    // Decision A/A/A: the June 12 payment settles only the June occurrence; the
    // collapsed May miss stays committed until a May-linked payment exists.
    const settled: PositionInput = {
      ...base,
      recurrings: [recurring({})],
      transactions: [
        ...base.transactions,
        tx({
          type: "EXPENSE",
          amount: Money.fromCents(1850_00),
          date: "2025-06-12",
          recurringId: idOf<RecurringId>("r-rent"),
        }),
      ],
    };
    const p = computePosition(settled);
    expect(p.committedCash.cents).toBe(1850_00); // May miss still owed
    expect(p.availableCash.cents).toBe(10000_00 - 1850_00 - 1850_00); // cash already moved
  });

  it("an unpaid occurrence before today is overdue; after today is upcoming", () => {
    // Decision A/A/A: stale misses collapse into the latest one. Day-10 template
    // vs today June 15: latest miss is June 10 (overdue); July 10 falls inside
    // the 30-day horizon (upcoming).
    const past = computePosition({ ...base, recurrings: [recurring({ expectedDay: 10 })] });
    expect(past.overdue.map((o) => o.dueDate)).toEqual(["2025-06-10"]);
    expect(past.upcoming.map((o) => o.dueDate)).toEqual(["2025-07-10"]);
    // Day-20 template: latest miss is May 20 (overdue), June 20 upcoming.
    const future = computePosition({ ...base, recurrings: [recurring({ expectedDay: 20 })] });
    expect(future.overdue.map((o) => o.dueDate)).toEqual(["2025-05-20"]);
    expect(future.upcoming.map((o) => o.dueDate)).toEqual(["2025-06-20"]);
  });
});
