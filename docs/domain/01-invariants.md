# Domain Invariants — quick reference

The "cannot be broken" list while writing domain code (`docs/requirements.md` NFR-01,
NFR-05). Every rule below should also exist as an automated test.

## Money & math

- Floating-point arithmetic is **forbidden** for financial calculations.
- All monetary values are integers (cents) wrapped in the `Money` value object.
- `Money.fromDecimal` is a **boundary-only** conversion (user input, seed constants);
  it rounds into integer space immediately and no float escapes into calculations.

## Accounts & transactions

- `INCOME` adds to the account, `EXPENSE` subtracts, `ADJUSTMENT` is a signed correction.
- **Two month figures are derived, and they are deliberately not the same number:**
  - **`spending`** = `expenses + cardSpending`. This is the "how much did we spend"
    answer, and the single basis for category analytics, the dashboard *Spending*
    figure, the 6-month series and the savings sentence. It **includes credit-card
    purchases** (a purchase counts as spending), dated by *purchase date*, not by
    statement period.
  - **`net`** = `income − expenses + Σ signed ADJUSTMENTs` for the month. This is
    the **cash reconciliation** figure: `income` and `expenses` stay pure analytics
    (transfers and card payments excluded), so `net` reconciles with the derived
    account balance. The dashboard labels it **cash net** so the two bases are
    never confused.
  - `monthTotals` / `seriesForMonths` return `income`, `expenses`, `cardSpending`,
    `spending` and `net` together; `FinancialPosition` exposes the month as
    `monthIncome`, `monthExpenses`, `monthCardSpending`, `monthSpending`, `monthNet`.
- A **transfer is two linked legs** — one `EXPENSE`, one `INCOME` — sharing a
  `transferGroupId` (ULID). Net household impact is zero by construction.
- Transfer legs are excluded from income/expense analytics (a transfer is neither).
- Card statement payments are `EXPENSE` transactions flagged with `cardId` +
  `statementPeriod`; they reduce bank cash, settle the card obligation, and are
  excluded from **both** `expenses` and `spending` (spending was counted at purchase
  time, so counting the payment too would double-count it).
- Account balance is **derived**: `openingBalance + Σ transaction impact`. It is never
  mutated directly, so it cannot drift from history.
- The Activity page summary and per-day totals **shall** be produced by
  `summarizeTxViews` (`application/queries.ts`) — never re-derived in a component
  (ADR-001).

## Credit cards

- A purchase counts as spending and reduces available credit.
- Card purchases are therefore **included** in `spending` and in category
  analytics, dated by purchase date (`expensesByCategory` takes `purchases`).
- A purchase **never** reduces bank account cash.
- Paying a statement reduces bank cash and settles the corresponding obligation,
  but the payment is **excluded** from `expenses` and `spending` — the purchase was
  already counted, so this is what prevents double-counting.
- A purchase belongs to exactly one statement (its period is fixed at write time from
  the card's closing day).

## Recurring expenses

- A recurring expense is a **forecast/template**, never an actual transaction.
- Forecasts generate expected occurrences; they never move money.
- Actual transactions may link back via `recurringId`; a linked transaction in the
  occurrence's period marks it settled.
- Deleting/cancelling a template **never** deletes historical transactions.
- Category analytics use actual transactions only; forecasts are displayed separately.

## Loans

- A loan has a principal; payments decrease the outstanding balance.
- The outstanding balance is **derived** from immutable payments — it is never stored.
- A payment may not exceed the outstanding balance (no silent overpayment).
- Payment history is append-only/auditable; a loan with payments cannot be deleted.
- The domain distinguishes *money we owe* from *money owed to us*.

## Data integrity

- Every persistent entity has `id` (ULID, generated independently of any database
  sequence), `createdAt` and `updatedAt`.
- Identifiers are branded types (`AccountId`, `CardId`, …) — mixing them is a
  compile-time error (ADR-010).
- No banking credentials, full account/card numbers, CVVs, passwords or tokens are
  ever persisted or committed (ADR-005, Section 07).
