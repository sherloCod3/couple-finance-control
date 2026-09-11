/**
 * ADR-002 / ADR-007 / ADR-008 — Dexie is the single source of truth.
 * The presentation layer subscribes with live queries; the domain layer
 * never imports this module.
 */
import Dexie, { type Table } from "dexie";
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
import { seedDemoData } from "./seed";

class FinanceDB extends Dexie {
  households!: Table<HouseholdRow, string>;
  members!: Table<MemberRow, string>;
  accounts!: Table<AccountRow, string>;
  categories!: Table<CategoryRow, string>;
  contacts!: Table<ContactRow, string>;
  pixKeys!: Table<PixKeyRow, string>;
  transactions!: Table<TransactionRow, string>;
  cards!: Table<CardRow, string>;
  cardPurchases!: Table<CardPurchaseRow, string>;
  recurrings!: Table<RecurringRow, string>;
  loans!: Table<LoanRow, string>;
  loanPayments!: Table<LoanPaymentRow, string>;

  constructor() {
    super("couple-finance-control");
    this.version(1).stores({
      households: "id",
      members: "id, householdId",
      accounts: "id, householdId",
      categories: "id, householdId, kind",
      contacts: "id, householdId",
      pixKeys: "id, accountId, contactId",
      transactions:
        "id, accountId, date, categoryId, type, transferGroupId, recurringId, cardId, statementPeriod",
      cards: "id, householdId",
      cardPurchases: "id, cardId, period, date",
      recurrings: "id, householdId",
      loans: "id, householdId",
      loanPayments: "id, loanId, date",
    });
    // First run only: load clearly-fictional demo data (Section 07).
    this.on("populate", () => seedDemoData(this));
  }
}

export const db = new FinanceDB();
