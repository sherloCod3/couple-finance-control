# Requirements Baseline

**Status:** Authoritative. This is the requirements baseline that the source comments
and the other docs cite as `FIN-01 … FIN-11`.

Every requirement below is traced to the code that implements it and to the automated
test that proves it. If you add a requirement, append a new ID — **never renumber**.

## How to read this document

- **FIN-xx** — functional requirement (something the household can do).
- **NFR-xx** — non-functional requirement (a property the system must hold).
- Acceptance criteria are written so each one can be falsified by a test.
- Requirements marked **Reconstructed** had no recoverable original wording; they were
  written from the implementation and should be confirmed if the original baseline
  document is ever found.
- Bare `Section NN` citations scattered through `docs/` and `src/` are resolved by the
  [Legacy section map](#legacy-section-map) at the end of this document.

---

## Functional requirements

### FIN-01 — Installable, offline-capable PWA

The household must be able to open the app and read its own data with no network
connectivity, and install it to the home screen.

- A web app manifest declares the name, icons, theme colour and `standalone` display.
- Icons ship as raster PNGs at 192 and 512, plus a `maskable` variant whose artwork stays
  inside the safe zone. A 180×180 `apple-touch-icon` PNG is served too, because iOS does
  not support SVG touch icons.
- A service worker is registered in production builds only.
- The precache list is derived from the **actual build output**, not hand-maintained.
- The cache name is versioned by a hash of that list, so a new deploy can never serve a
  stale shell.
- Every asset the initial document loads is precached, so a cold offline start renders.
- The UI reflects connectivity changes live.

**Implementation:** `public/sw.js`, `public/manifest.webmanifest`, `public/icons/`,
`index.html`, `src/main.tsx`, `vite.config.js` (`cfc-pwa-precache` plugin),
`scripts/make-icons.mjs`.
**Tests:** `test/pwa-assets.test.ts` › *PWA assets*, *built shell is complete enough for a
cold offline start*; `src/presentation/offline.test.tsx` › *offline detection*.
**End-to-end:** `npm run verify:offline` (headless Chrome; not in CI).
**Decisions:** ADR-002, ADR-007.

### FIN-02 — Accounts

The household can record bank accounts and see each account's current balance.

- An account carries institution, nickname, type, **last four digits only**, an opening
  balance and an opening date.
- The balance is **derived** (`openingBalance + Σ transaction impact`) and never stored.
- An account can be archived without deleting its history.

**Implementation:** `src/domain/models/entities.ts` (`Account`),
`src/domain/services/finance.ts` (`accountBalance`), `src/presentation/pages/Accounts.tsx`,
`src/application/queries.ts` (`getAccounts`).
**Tests:** `src/domain/services/finance.test.ts` › *transaction classification & balances*;
`src/infrastructure/persistence.test.ts` › *data integrity guards*.

### FIN-03 — PIX keys (accounts and contacts)

The household can store the PIX keys that belong to its own accounts, and the keys of
external contacts it pays.

- A key belongs either to one of the household's accounts or to a contact.
- Keys can be added and removed from the Accounts page.
- Only fictional keys may appear in the repository (see NFR-03).

**Implementation:** `src/domain/models/entities.ts` (`PixKey`, `Contact`),
`src/presentation/pages/Accounts.tsx`, `src/application/useCases.ts`
(`savePixKey`, `deletePixKey`, `deleteContact`), `src/application/queries.ts`
(`getContacts`).
**Tests:** `src/infrastructure/persistence.test.ts` › *categories, PIX keys and contacts
(FIN-03)*.

### FIN-04 — Transfers between accounts

Moving money between the household's own accounts must never change total household
wealth.

- A transfer is modelled as **two legs** — one `EXPENSE` and one `INCOME` — sharing a
  `transferGroupId`. `TRANSFER` is deliberately *not* a transaction type, so the core
  rule stays pure: `INCOME` adds, `EXPENSE` subtracts.
- Net wealth is unchanged by construction, not by arithmetic correction.
- Both legs are excluded from income/expense analytics and from the Activity summary.
- Editing or cancelling a transfer updates both legs atomically.

**Implementation:** `src/domain/services/finance.ts` (`isTransferLeg`),
`src/application/useCases.ts` (`createTransfer`, `updateTransfer`).
**Tests:** `src/domain/services/finance.test.ts`;
`src/infrastructure/persistence.test.ts` › *two-leg transfer invariant at storage level*;
`src/application/queries.test.ts` › *summarizeTxViews*.
**Decisions:** `docs/domain/02-transfer-two-leg-modeling.md`.

### FIN-05 — FinancialPosition

The household's four cash answers, derived from the ledger.

- `currentCash` — money held in accounts right now.
- `committedCash` — obligations already owed but not yet paid, due by month end.
- `projectedCash` — current cash after every known obligation in the horizon.
- `availableCash` — `currentCash − committedCash` (the household's safety rule).
- Obligations are **derived** from recurrings, card statements and loan schedules —
  never stored separately (see FIN-11).

**Implementation:** `src/domain/services/position.ts`, `src/application/queries.ts`
(`getDashboard`).
**Tests:** `src/domain/services/position.test.ts` › *FinancialPosition*;
`src/presentation/dashboard.test.tsx` › *Dashboard component*.

### FIN-06 — What is due and what is overdue

The household can see upcoming and overdue obligations without opening each page.

- Every obligation exposes a due date, an amount, its source (`recurring`,
  `card-statement`, `loan`) and a status of `overdue` or `upcoming`.
- Overdue obligations are visually distinguishable from upcoming ones.
- Obligations are derived live; nothing is written to storage to track them.

**Implementation:** `src/domain/services/position.ts` (`Obligation`, `ObligationRef`),
`src/App.tsx` (`RemindersBell`).
**Tests:** `src/domain/services/position.test.ts`; `src/domain/services/forecast.test.ts`.
**Reconstructed** — the original wording of FIN-06 could not be recovered.

### FIN-07 — Attribution and breakdown

Every transaction records who created it, and the household can see where the money went.

- `createdBy` is required on every transaction and is **traceability only** — never a
  financial ownership metric, never used to split balances between members.
- Category analytics group the month's spending by category, with an explicit
  *uncategorized* bucket.

**Implementation:** `src/domain/models/entities.ts` (`Transaction.createdBy`),
`src/domain/services/finance.ts` (`expensesByCategory`, `UNCATEGORIZED`),
`src/application/queries.ts` (`getDashboard` category slices),
`src/presentation/charts.tsx` (`Donut`).
**Tests:** `src/domain/services/finance.test.ts`; `src/application/queries.test.ts`.
**Reconstructed** — the original wording of FIN-07 could not be recovered.

### FIN-08 — Recurring expenses are forecasts, not actuals

A recurring expense is a template. It never creates a real transaction by itself.

- Occurrences are materialised inside a window and marked settled when a real
  transaction links to them via `recurringId`.
- A linked transaction is not double-counted against its forecast.
- Removing a template never deletes historical transactions.

**Implementation:** `src/domain/services/forecast.ts`,
`src/presentation/pages/Recurring.tsx`, `src/application/useCases.ts`.
**Tests:** `src/domain/services/forecast.test.ts` › *recurring forecasts (FIN-08)*.

### FIN-09 — Credit cards

Statements, purchases, available limit and statement payments.

- A **purchase** counts as spending and reduces available credit, but never touches bank
  cash. It is dated by *purchase date*, so it lands in the month it was made.
- Paying a statement reduces bank cash — recorded as an `EXPENSE` flagged with
  `cardId` + `statementPeriod` — and settles the obligation.
- Flagged payments are **excluded** from spending analytics: they only settle spending
  already counted, so including them would double-count.
- Overpayment of a statement is rejected.

**Implementation:** `src/domain/services/cards.ts`,
`src/presentation/pages/Cards.tsx`, `src/domain/services/finance.ts`
(`cardPurchasesInMonth`).
**Tests:** `src/domain/services/cards.test.ts` › *credit card domain rules (FIN-09)*;
`src/domain/services/finance.test.ts` › *spending vs cash net*.

### FIN-10 — Loans

Distinguish "money we owe" from "money owed to us".

- A loan carries a direction (`payable` / `receivable`), a principal and a schedule.
- Payments are **immutable audit records**; the outstanding balance is derived, never
  stored, so history cannot drift.
- Schedule items settle greedily in due-date order as cumulative payments cover
  cumulative scheduled amounts.
- Overpayment beyond the principal is rejected.

**Implementation:** `src/domain/services/loans.ts`, `src/presentation/pages/Loans.tsx`,
`src/application/useCases.ts` (`addLoanPayment`).
**Tests:** `src/domain/services/loans.test.ts` › *loan domain rules (FIN-10)*.

### FIN-11 — Reminders derived from obligations

Reminders are derived from obligations — never duplicated data.

- The reminder list is computed live from recurring forecasts, statement due dates and
  loan installments.
- Nothing is persisted to represent a reminder.
- True push notifications are out of scope until the sync layer lands (ADR-003).

**Implementation:** `src/domain/services/position.ts`, `src/App.tsx` (`RemindersBell`).
**Tests:** `src/domain/services/position.test.ts`; `src/domain/services/forecast.test.ts`.

---

## Non-functional requirements

### NFR-01 — Money and math

- Floating-point arithmetic is **forbidden** for financial calculations.
- Every monetary value is an integer number of cents wrapped in the `Money` value
  object.
- `Money.fromCents` throws on a non-integer; `Money.fromDecimal` is **boundary-only**
  (user input, seed constants) and rounds into integer space immediately.
- Financial rules live **only** in `domain/services`. The UI never re-derives them
  (ADR-001).

**Tests:** `src/domain/models/money.test.ts` › *Money value object*;
`src/application/queries.test.ts`. **Decisions:** ADR-001, ADR-010.

### NFR-02 — Local-first, no network

- All data lives in IndexedDB (Dexie). There are no network calls at runtime and no
  banking integrations.
- Third-party requests are prohibited: fonts are vendored as self-hosted `woff2` and
  served from the app's own origin.

**Tests:** `test/pwa-assets.test.ts` › *fonts are vendored, not fetched*.
**Decisions:** ADR-002, ADR-004.

### NFR-03 — Security and privacy

- **No credentials are ever persisted.** No field anywhere in `src/` holds a password,
  token, CVV, full card number or full account number; only last four digits are stored.
- No secrets in the repository; agent/workspace artifacts are gitignored.
- Public fixtures and documentation use fictional data only.

**Tests:** `src/infrastructure/persistence.test.ts` › *demo seed*.
**Checklist:** `docs/security.md`. **Decisions:** ADR-005.

### NFR-04 — Bilingual UI (pt-BR / en)

- Every user-facing string lives in `src/presentation/i18n.tsx`.
- The domain and application layers contain **zero** UI strings, so translation can
  never regress financial logic.
- Language is auto-detected from the browser, switchable, and persisted locally.
- Dates and currency format themselves per locale via `Intl`.

**Tests:** `src/presentation/dashboard.test.tsx` renders under `LangProvider`.

### NFR-05 — Data integrity and migrations

- Schema changes are **additive, versioned Dexie blocks**; existing `version(n)` blocks
  are never edited.
- Every key path used in a query must be indexed (a missing index is a runtime crash,
  not a slow query).
- Backup export/import is a versioned JSON envelope, validated then restored atomically.
- Balances, statements and outstanding amounts are always derived, never stored.

**Tests:** `src/infrastructure/persistence.test.ts` › *schema migrations*,
*backup / export strategy*, *data integrity guards*.
**Decisions:** `docs/domain/03-migrations-and-backup.md`.

### NFR-06 — Forward-compatible identity

- Records use globally unique, monotonic ULIDs, so IDs minted offline on two devices
  cannot collide.
- Every record carries `createdAt` / `updatedAt`.
- Updates are non-destructive so a future sync layer can merge without losing history.

**Decisions:** ADR-003.

---

## Legacy section map

Earlier revisions of these docs and the source comments cite a "baseline Section NN".
That numbering came from a baseline document that is not in the repository. The
citations still resolve — to the content below.

| Legacy citation | Content now lives in |
| --- | --- |
| Section 03 — domain model | `src/domain/models/entities.ts`; FIN-02 … FIN-10 |
| Section 04 — money, math and invariants | NFR-01, NFR-05; `docs/domain/01-invariants.md` |
| Section 05 — position | FIN-05 |
| Section 07 — security, privacy, fictional data | NFR-02, NFR-03; `docs/security.md` |

## Traceability matrix

| ID | Requirement | Implementation | Tests |
| --- | --- | --- | --- |
| FIN-01 | Offline PWA shell | `public/sw.js`, `vite.config.js` | `test/pwa-assets.test.ts`, `offline.test.tsx` |
| FIN-02 | Accounts | `services/finance.ts`, `pages/Accounts.tsx` | `finance.test.ts`, `persistence.test.ts` |
| FIN-03 | PIX keys | `pages/Accounts.tsx`, `useCases.ts` | `persistence.test.ts` |
| FIN-04 | Transfers | `services/finance.ts`, `useCases.ts` | `finance.test.ts`, `persistence.test.ts`, `queries.test.ts` |
| FIN-05 | FinancialPosition | `services/position.ts` | `position.test.ts`, `dashboard.test.tsx` |
| FIN-06 | Due / overdue | `services/position.ts`, `App.tsx` | `position.test.ts`, `forecast.test.ts` |
| FIN-07 | Attribution & breakdown | `services/finance.ts`, `charts.tsx` | `finance.test.ts`, `queries.test.ts` |
| FIN-08 | Recurring forecasts | `services/forecast.ts` | `forecast.test.ts` |
| FIN-09 | Credit cards | `services/cards.ts` | `cards.test.ts`, `finance.test.ts` |
| FIN-10 | Loans | `services/loans.ts` | `loans.test.ts` |
| FIN-11 | Derived reminders | `services/position.ts`, `App.tsx` | `position.test.ts` |
| NFR-01 | Money & math | `models/money.ts` | `money.test.ts` |
| NFR-02 | Local-first | `infrastructure/db.ts` | `pwa-assets.test.ts` |
| NFR-03 | Security & privacy | whole tree | `persistence.test.ts` |
| NFR-04 | Bilingual UI | `presentation/i18n.tsx` | `dashboard.test.tsx` |
| NFR-05 | Integrity & migrations | `infrastructure/db.ts` | `persistence.test.ts` |
| NFR-06 | Identity / sync-ready | `domain/types.ts` | `persistence.test.ts` |

## Open items

- **FIN-06 and FIN-07 are reconstructed.** Their wording was written from in-code
  comments (`src/presentation/pages/Dashboard.tsx`, `src/domain/models/entities.ts`)
  because no baseline document survives in the repository. Confirm or correct them if
  the original baseline is recovered.
- No requirement currently covers **accessibility** or **performance budgets**. If the
  household needs either, add `NFR-07` / `NFR-08` rather than folding them into an
  existing ID.
