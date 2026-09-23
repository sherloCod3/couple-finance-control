# Couple Finance Control

A local-first, household-oriented finance application. When either partner opens the app they
should answer — within seconds and without spreadsheets:

- How much money do we have?
- How much can we safely consider available?
- What do we need to pay soon? What is already overdue?
- How much did we spend this month, and where did the money go?
- Are we spending more or less than we received?

## Principles

1. **Visibility over enforcement** — understand finances, never block spending.
2. **Simple manual control first** — manual entry before integrations.
3. **Financial correctness over visual complexity** — invariants before polish.
4. **Local-first** — useful with intermittent connectivity; data never leaves the device.
5. **Household-oriented** — the household, not the individual, is the unit of organization.
6. **Privacy by design** — no banking credentials, no real data in a public repository.

## Stack (ADR-007 / ADR-008)

- **Vite + React + TypeScript** — single-language stack across all layers.
- **Dexie.js (IndexedDB)** — the single source of truth; the UI subscribes through live queries.
  No Redux/Zustand, no duplicated state.
- **PWA** — installable, offline app shell via a small service worker.

## Architecture (ADR-009)

```
src/
├── domain/          # Pure TS. No React. No Dexie.
│   ├── models/entities.ts + money.ts  # Entities + Money value object (integer cents, ADR-010)
│   ├── services/    # Financial rules: position, statements, forecasts, loans
│   ├── types.ts     # Branded ids (ULID) — AccountId ≠ CardId at compile time
│   └── utils/dates.ts  # Pure date helpers
├── application/     # Use cases (writes) and view-model queries (reads)
├── infrastructure/  # Dexie schema, row ↔ domain mappers, fictional demo seed
└── presentation/    # React pages, shared kit, charts, action dialogs
```

All financial math lives in `domain/services` and is consumed by `application/`
(ADR-001). Notable domain decisions:

- **Money** is a value object over integer cents; floating-point math is forbidden.
- **Transfers are two linked legs** (EXPENSE + INCOME sharing a `transferGroupId`),
  so household wealth is unchanged by construction — see `docs/domain/02-transfer-two-leg-modeling.md`.
- **Recurring expenses are forecasts**, never transactions; a linked transaction settles an occurrence.
- **Card purchases** count as spending and reduce available credit, but never touch bank cash;
  paying a statement reduces cash and settles the obligation.

## Documentation

- `docs/requirements.md` — **requirements baseline**: FIN-01…FIN-11 acceptance criteria,
  each traced to its implementation and its test.
- `docs/domain/01-invariants.md` — the "cannot be broken" rules quick-reference.
- `docs/domain/02-transfer-two-leg-modeling.md` — transfer semantics decision.
- `docs/domain/03-migrations-and-backup.md` — schema migration & backup strategy.
- `docs/security.md` — security review & public-repository sanitization checklist.
- `docs/adr/README.md` — index of ADR-001…010 (one architectural decision each).

Older comments in `src/` cite a "Section NN" from a baseline document that is not in the
repository. Those citations still resolve — see the legacy section map at the end of
`docs/requirements.md`.

## Tests

Vitest suites live next to the code (`npm test`):

- **Domain** — `Money` integer math, transaction classification, transfer neutrality,
  forecasts, card statement booking, loan schedules, `FinancialPosition`.
- **Persistence** — demo seed integrity (integer cents at rest, last-four-only cards),
  two-leg transfers at the storage level, integrity guards (no overpayment, no deleting
  history), backup export/import round-trip.
- **Presentation** — Dashboard renders the exact ledger-derived position; offline
  detection tracks connectivity.
- **PWA** — service-worker and manifest contract checks.

## Two languages (pt-BR / en)

The app ships fully bilingual for Brazilian households. Language is auto-detected from
the browser (`pt*` → Português), can be switched with the **EN / PT** toggle in the
header, and is persisted locally. All user-facing strings live in
`src/presentation/i18n.tsx`; the domain/application layers contain **zero** UI strings,
so translation can never regress financial logic. Dates and currency format themselves
per locale via `Intl`.

## Backup & notifications

- **Export / Import backup** (sidebar): a versioned JSON envelope of every table,
  restored atomically after validation — see `docs/domain/03-migrations-and-backup.md`.
- **Reminders** (bell icon): derived live from obligations (recurring forecasts,
  statement due dates, loan installments) per FIN-11 — never duplicated data. True
  push notifications belong to the future sync layer (ADR-003).

## Running

```bash
npm install
npm run dev             # local development
npm run build           # production PWA build (dist/)
npm run preview         # serve dist/ locally to check the built PWA
npm test                # full test suite (domain, finance, persistence, offline, PWA)
npm run typecheck       # tsc --noEmit over src/ and test/
npm run lint            # ESLint (React hooks + TypeScript rules)
npm run verify:offline  # end-to-end: cold offline start in headless Chrome
```

CI (`.github/workflows/ci.yml`) runs typecheck → lint → test → build on every push to
`main` and every pull request, and fails if the build leaves an unresolved service-worker
placeholder in `dist/sw.js`.

`npm run verify:offline` is the strongest check of the app's core promise: it serves
`dist/`, waits for the service worker to install, cuts the network, reloads, and asserts
the shell still renders from cache. It needs a local Chrome/Chromium (override with
`CHROME_PATH`) so it is **not** in CI — the static equivalents live in
`test/pwa-assets.test.ts`.

Prettier is configured (`.prettierrc.json`, `npm run format`) but is **not** enforced in
CI: the codebase predates the config and has not been bulk-reformatted, so running it
produces a repo-wide whitespace diff. Apply it to files you are already touching.

## Generated assets

Two committed asset sets are produced by scripts rather than by hand. Both are
deterministic and need no dependencies; regenerate only when the source artwork or the
font families change.

```bash
npm run icons   # public/icons/*.png from public/icons/icon.svg
npm run fonts   # src/assets/fonts/*.woff2 + public/fonts/licenses/*.txt (needs network)
```

- **Icons** — `scripts/make-icons.mjs` rasterises the SVG into the 192/512 icons, a
  `maskable` variant with the artwork scaled inside the safe zone, and a 180×180
  `apple-touch-icon` (iOS ignores SVG touch icons). See `public/icons/README.md`.
- **Fonts** — `scripts/fetch-fonts.mjs` vendors the three UI families as `woff2` so the
  app makes no third-party request. See `public/fonts/README.md`.

## Deploying

`npm run build` produces a self-contained static site in `dist/` — no server, no API, no
environment variables. Any static host works.

`vite.config.js` sets `base: "./"`, so the **same build** runs either at a domain root or
under a sub-path. Nothing has to change between the two — upload `dist/` as-is:

- **Domain root** (Netlify, Vercel, Cloudflare Pages, nginx): publish `dist/`.
- **Sub-path** (a GitHub Pages project site such as
  `https://<user>.github.io/couple-finance-control/`): publish `dist/` at that path. The
  manifest (`start_url: "./"`, `scope: "./"`) and the service worker (registered as
  `./sw.js`) both resolve relatively, so the app stays installable and offline-capable.

Two hosting notes:

- Serve over **HTTPS** (or `localhost`). Service workers need a secure context, so the
  offline shell and installability only activate there.
- Do **not** add a catch-all SPA rewrite. Navigation is in-app state rather than URL
  routing, so there are no deep links to fall back to.

Because the app is local-first, the host only ever serves static files. It never sees
household data, which stays in the browser's IndexedDB.

On first run the app seeds a **clearly fictional** demo household ("Demo Household",
Ana & Bruno, `demo@example.com`, card `••4321`) generated relative to today's date, so the
dashboard is always alive. Use **Reset demo data** in the sidebar to reseed.

## Security & public repository rules

This repository is public. It never contains: real names tied to real finances, CPF/CNPJ,
real PIX keys, complete account/card numbers, CVVs, passwords, tokens, `.env` secrets,
database backups or production exports. The app itself stores only what financial
organization needs (ADR-005): institution, nickname, last four digits, balances.

## Non-goals

No bank APIs, no payment execution, no investment management, no ML predictions, no
automatic reconciliation. Multi-device sync is designed for (globally unique ULIDs,
`createdAt`/`updatedAt`, non-destructive updates — ADR-003) but intentionally not built yet.
