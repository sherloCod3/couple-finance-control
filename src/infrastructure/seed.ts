/**
 * Sanitized demo data (Section 07). Every name, key and value here is
 * fictional and generated relative to "today" so the demo always looks live.
 */
import type { Table } from "dexie";
import type {
  AccountRow,
  CardPurchaseRow,
  CardRow,
  CategoryRow,
  ContactRow,
  HouseholdRow,
  LoanPaymentRow,
  LoanRow,
  MemberRow,
  PixKeyRow,
  RecurringRow,
  TransactionRow,
} from "./mappers";
import { newId } from "../domain/types";
import type { TransactionId } from "../domain/types";
import {
  addDaysISO,
  addMonthsKey,
  currentMonthKey,
  isoWithDay,
  monthKey,
  todayISO,
  weekdayOf,
} from "../domain/utils/dates";

interface DB {
  households: Table<HouseholdRow, string>;
  members: Table<MemberRow, string>;
  accounts: Table<AccountRow, string>;
  categories: Table<CategoryRow, string>;
  contacts: Table<ContactRow, string>;
  pixKeys: Table<PixKeyRow, string>;
  transactions: Table<TransactionRow, string>;
  cards: Table<CardRow, string>;
  cardPurchases: Table<CardPurchaseRow, string>;
  recurrings: Table<RecurringRow, string>;
  loans: Table<LoanRow, string>;
  loanPayments: Table<LoanPaymentRow, string>;
}

/** Seed constants only — converted to integer cents at the boundary. */
const R = (v: number): number => Math.round(v * 100);

const H = "h-demo";
const ANA = "m-ana";
const BRUNO = "m-bruno";
const CHECKING = "a-checking";
const SAVINGS = "a-savings";
const WALLET = "a-wallet";
const CARD = "card-demo";

export async function seedDemoData(db: DB): Promise<void> {
  const now = Date.now();
  const today = todayISO();
  const cur = currentMonthKey();
  const day = (d: number, mOff = 0): string => isoWithDay(addMonthsKey(cur, mOff), d);
  const past = (iso: string): boolean => iso <= today;

  let stamp = now - 40_000_000;
  const tick = (): number => (stamp += 60_000);

  await db.households.add({ id: H, name: "Demo Household", createdAt: now });

  const members: MemberRow[] = [
    { id: ANA, householdId: H, name: "Ana", color: "#1D6B41", createdAt: now },
    { id: BRUNO, householdId: H, name: "Bruno", color: "#B77F22", createdAt: now },
  ];
  await db.members.bulkAdd(members);

  const categories: CategoryRow[] = [
    { id: "c-housing", householdId: H, name: "Housing", kind: "expense", color: "#9C6B3F", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-utilities", householdId: H, name: "Utilities", kind: "expense", color: "#B77F22", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-groceries", householdId: H, name: "Groceries", kind: "expense", color: "#2C7D4F", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-transport", householdId: H, name: "Transportation", kind: "expense", color: "#38658F", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-subs", householdId: H, name: "Subscriptions", kind: "expense", color: "#7B5EA7", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-health", householdId: H, name: "Health", kind: "expense", color: "#BC4331", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-fun", householdId: H, name: "Entertainment", kind: "expense", color: "#3E8E85", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-education", householdId: H, name: "Education", kind: "expense", color: "#5B7DB1", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-income", householdId: H, name: "Income", kind: "income", color: "#175734", builtin: true, createdAt: now, updatedAt: now },
    { id: "c-other", householdId: H, name: "Other", kind: "expense", color: "#6E7B70", builtin: true, createdAt: now, updatedAt: now },
  ];
  await db.categories.bulkAdd(categories);

  const accounts: AccountRow[] = [
    { id: CHECKING, householdId: H, institution: "Banco Demo", nickname: "Checking", type: "checking", last4: "1234", openingBalanceCents: R(4200), openingDate: addDaysISO(today, -95), archived: false, createdAt: now, updatedAt: now },
    { id: SAVINGS, householdId: H, institution: "Banco Demo", nickname: "Emergency fund", type: "savings", last4: "5678", openingBalanceCents: R(8500), openingDate: addDaysISO(today, -95), archived: false, createdAt: now, updatedAt: now },
    { id: WALLET, householdId: H, institution: "DemoPay", nickname: "Wallet", type: "wallet", last4: null, openingBalanceCents: R(150), openingDate: addDaysISO(today, -60), archived: false, createdAt: now, updatedAt: now },
  ];
  await db.accounts.bulkAdd(accounts);

  await db.pixKeys.bulkAdd([
    { id: "pix-1", householdId: H, accountId: CHECKING, contactId: null, type: "email", value: "demo@example.com", createdAt: now },
    { id: "pix-2", householdId: H, accountId: CHECKING, contactId: null, type: "random", value: "b7f3a91e-demo-4c2f-9e01-cfc0demo0001", createdAt: now },
    { id: "pix-3", householdId: H, accountId: null, contactId: "ct-rafa", type: "phone", value: "+55 00 00000-0000", createdAt: now },
  ] satisfies PixKeyRow[]);

  await db.contacts.add({ id: "ct-rafa", householdId: H, name: "Rafa (demo friend)", createdAt: now, updatedAt: now });

  const card: CardRow = {
    id: CARD,
    householdId: H,
    issuer: "Banco Demo",
    nickname: "Demo Card",
    last4: "4321",
    limitCents: R(3500),
    closingDay: 5,
    dueDay: 12,
    createdAt: now,
    updatedAt: now,
  };
  await db.cards.add(card);

  const recurrings: RecurringRow[] = [
    { id: "r-rent", householdId: H, description: "Rent", categoryId: "c-housing", frequency: "monthly", expectedDay: 5, expectedMonth: null, amountCents: R(1850), minCents: null, maxCents: null, active: true, createdBy: ANA, createdAt: now, updatedAt: now },
    { id: "r-internet", householdId: H, description: "Internet", categoryId: "c-utilities", frequency: "monthly", expectedDay: 10, expectedMonth: null, amountCents: R(119.9), minCents: null, maxCents: null, active: true, createdBy: BRUNO, createdAt: now, updatedAt: now },
    { id: "r-gym", householdId: H, description: "Gym membership", categoryId: "c-health", frequency: "monthly", expectedDay: 8, expectedMonth: null, amountCents: R(89.9), minCents: null, maxCents: null, active: true, createdBy: ANA, createdAt: now, updatedAt: now },
    { id: "r-streaming", householdId: H, description: "Streaming bundle", categoryId: "c-subs", frequency: "monthly", expectedDay: 15, expectedMonth: null, amountCents: R(55.9), minCents: null, maxCents: null, active: true, createdBy: BRUNO, createdAt: now, updatedAt: now },
    { id: "r-groceries", householdId: H, description: "Groceries (estimate)", categoryId: "c-groceries", frequency: "monthly", expectedDay: 28, expectedMonth: null, amountCents: null, minCents: R(800), maxCents: R(1200), active: true, createdBy: ANA, createdAt: now, updatedAt: now },
    { id: "r-market", householdId: H, description: "Farmers market", categoryId: "c-groceries", frequency: "weekly", expectedDay: 6, expectedMonth: null, amountCents: R(60), minCents: null, maxCents: null, active: true, createdBy: BRUNO, createdAt: now, updatedAt: now },
  ];
  await db.recurrings.bulkAdd(recurrings);

  // ---- loans ------------------------------------------------------------
  const carStart = addDaysISO(today, -280);
  const firstDueYm = monthKey(addDaysISO(carStart, 30));
  const schedule = Array.from({ length: 36 }, (_, i) => ({
    dueDate: isoWithDay(addMonthsKey(firstDueYm, i), 20),
    amountCents: R(642.85),
  }));
  const carPayments: LoanPaymentRow[] = schedule
    .filter((s) => s.dueDate <= addDaysISO(today, -7))
    .map((s) => ({
      id: newId<string>(),
      loanId: "l-car",
      date: s.dueDate,
      amountCents: s.amountCents,
      note: null,
      transactionId: null,
      createdAt: tick(),
    }));
  const loans: LoanRow[] = [
    { id: "l-car", householdId: H, direction: "owed", counterparty: "Banco Demo — auto financing", description: "36 installments", principalCents: R(18000), startDate: carStart, schedule, note: null, createdBy: ANA, createdAt: now, updatedAt: now },
    { id: "l-rafa", householdId: H, direction: "receivable", counterparty: "Rafa (demo friend)", description: "Concert tickets fronted", principalCents: R(300), startDate: addDaysISO(today, -20), schedule: [{ dueDate: addDaysISO(today, 25), amountCents: R(300) }], note: "PIX to pix-1 when repaid", createdBy: BRUNO, createdAt: now, updatedAt: now },
  ];
  await db.loans.bulkAdd(loans);
  await db.loanPayments.bulkAdd(carPayments);

  // ---- transactions -----------------------------------------------------
  const txs: TransactionRow[] = [];
  const tx = (
    partial: Pick<TransactionRow, "accountId" | "type" | "amountCents" | "date" | "description" | "createdBy"> &
      Partial<TransactionRow>
  ): void => {
    txs.push({
      id: newId<TransactionId>(),
      householdId: H,
      categoryId: null,
      note: null,
      transferGroupId: null,
      recurringId: null,
      cardId: null,
      statementPeriod: null,
      createdAt: tick(),
      updatedAt: now,
      ...partial,
    });
  };

  for (const mOff of [-3, -2, -1, 0]) {
    const sal = day(5, mOff);
    if (past(sal)) {
      tx({ accountId: CHECKING, type: "INCOME", amountCents: R(4200), date: sal, description: "Salary — Ana", createdBy: ANA, categoryId: "c-income" });
      tx({ accountId: CHECKING, type: "INCOME", amountCents: R(3100), date: sal, description: "Salary — Bruno", createdBy: BRUNO, categoryId: "c-income" });
      const transferDate = day(6, mOff);
      if (past(transferDate)) {
        const groupId = newId<string>();
        tx({ accountId: CHECKING, type: "EXPENSE", amountCents: R(1500), date: transferDate, description: "Transfer → Emergency fund", createdBy: ANA, transferGroupId: groupId });
        tx({ accountId: SAVINGS, type: "INCOME", amountCents: R(1500), date: transferDate, description: "Transfer ← Checking", createdBy: ANA, transferGroupId: groupId });
      }
    }
    const rent = day(5, mOff);
    if (past(rent)) tx({ accountId: CHECKING, type: "EXPENSE", amountCents: R(1850), date: rent, description: "Rent", createdBy: ANA, categoryId: "c-housing", recurringId: "r-rent" });
    const gym = day(8, mOff);
    if (past(gym)) tx({ accountId: CHECKING, type: "EXPENSE", amountCents: R(89.9), date: gym, description: "Gym membership", createdBy: ANA, categoryId: "c-health", recurringId: "r-gym" });
    const net = day(10, mOff);
    if (past(net)) tx({ accountId: CHECKING, type: "EXPENSE", amountCents: R(119.9), date: net, description: "Internet", createdBy: BRUNO, categoryId: "c-utilities", recurringId: "r-internet" });
    const fuel = day(14, mOff);
    if (past(fuel)) tx({ accountId: CHECKING, type: "EXPENSE", amountCents: R(165), date: fuel, description: "Fuel", createdBy: BRUNO, categoryId: "c-transport" });
    const stream = day(15, mOff);
    if (past(stream)) tx({ accountId: CHECKING, type: "EXPENSE", amountCents: R(55.9), date: stream, description: "Streaming bundle", createdBy: BRUNO, categoryId: "c-subs", recurringId: "r-streaming" });
    const g1 = day(9, mOff);
    if (past(g1)) tx({ accountId: WALLET, type: "EXPENSE", amountCents: R(250 + ((mOff + 3) % 3) * 37.4), date: g1, description: "Groceries run", createdBy: ANA, categoryId: "c-groceries", recurringId: "r-groceries" });
    const g2 = day(22, mOff);
    if (past(g2)) tx({ accountId: CHECKING, type: "EXPENSE", amountCents: R(280 + ((mOff + 3) % 2) * 61.3), date: g2, description: "Supermarket", createdBy: BRUNO, categoryId: "c-groceries", recurringId: "r-groceries" });
    if (mOff === -1) {
      tx({ accountId: CHECKING, type: "ADJUSTMENT", amountCents: -R(12.9), date: day(28, mOff), description: "Monthly account fee", createdBy: ANA, categoryId: "c-other" });
    }
  }

  // Coffee two days ago, from the wallet.
  tx({ accountId: WALLET, type: "EXPENSE", amountCents: R(18.5), date: addDaysISO(today, -2), description: "Coffee", createdBy: BRUNO, categoryId: "c-fun" });

  // Link a few recent Saturday runs to the weekly farmers-market plan so its
  // recent occurrences read as settled.
  let marketCount = 0;
  for (let back = 2; back <= 21 && marketCount < 3; back++) {
    const d = addDaysISO(today, -back);
    if (weekdayOf(d) === 6) {
      tx({ accountId: WALLET, type: "EXPENSE", amountCents: R(52 + marketCount * 9.5), date: d, description: "Farmers market", createdBy: BRUNO, categoryId: "c-groceries", recurringId: "r-market" });
      marketCount++;
    }
  }

  // ---- card purchases + statement payments -------------------------------
  // Demo Card closes on day 5, so purchases after day 5 roll into next month.
  const purchases: CardPurchaseRow[] = [];
  const periodFor = (date: string): string =>
    Number(date.slice(8, 10)) <= 5 ? monthKey(date) : addMonthsKey(monthKey(date), 1);
  const addPurchase = (date: string, amountCents: number, description: string, categoryId: string, by: string): void => {
    purchases.push({
      id: newId<string>(),
      cardId: CARD,
      amountCents,
      date,
      description,
      categoryId,
      period: periodFor(date),
      createdBy: by,
      createdAt: tick(),
      updatedAt: now,
    });
  };

  addPurchase(day(12, -2), R(289.9), "Restaurant anniversary", "c-fun", ANA);
  addPurchase(day(18, -2), R(149.99), "Pharmacy", "c-health", BRUNO);
  addPurchase(day(24, -2), R(96.4), "Rideshare", "c-transport", BRUNO);
  addPurchase(day(11, -1), R(432.1), "Home improvement", "c-housing", ANA);
  addPurchase(day(17, -1), R(189.9), "Restaurant", "c-fun", BRUNO);
  addPurchase(day(23, -1), R(129.9), "Game + season pass", "c-fun", BRUNO);
  if (past(day(8, 0))) addPurchase(day(8, 0), R(218.6), "Big grocery run", "c-groceries", ANA);
  addPurchase(addDaysISO(today, -1), R(84.9), "Streaming annual add-on", "c-subs", ANA);
  addPurchase(addDaysISO(today, -3), R(56.3), "Rideshare", "c-transport", BRUNO);
  await db.cardPurchases.bulkAdd(purchases);

  // Pay each closed statement in full on its due date (when already past).
  const periodTotals = new Map<string, number>();
  for (const p of purchases) {
    periodTotals.set(p.period, (periodTotals.get(p.period) ?? 0) + p.amountCents);
  }
  for (const [period, total] of periodTotals) {
    if (period >= cur) continue; // current cycle is still open
    const due = isoWithDay(addMonthsKey(period, 1), 12);
    if (!past(due)) continue;
    tx({
      accountId: CHECKING,
      type: "EXPENSE",
      amountCents: total,
      date: due,
      description: "Card payment ••4321",
      createdBy: ANA,
      cardId: CARD,
      statementPeriod: period,
      note: "Statement settled in full",
    });
  }

  txs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  await db.transactions.bulkAdd(txs);
}
