# Couple Finance Control — Reverse-Engineered Specification & Gap Analysis

**Method:** spec-miner (Arch Hat + QA Hat) — all statements grounded in source evidence.
**Date:** 2026-09-23
**Scope:** full repository (`src/`, `test/`, `docs/`, build & repo config).
**Commit analysed:** `95c8c0c` (`docs: add MIT license`), working tree clean at start.

---

## 1. Verified baseline (what was actually executed)

Dependencies were absent (`node_modules/` missing), so they were installed first, then all
three quality gates were run:

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | **PASS** (exit 0, no diagnostics) |
| Tests | `npx vitest run` | **PASS** — 10 files, **57 tests**, 0 failures |
| Build | `npx vite build` | **PASS** — 57 modules, `dist/` 411 kB JS / 38 kB CSS |

Test distribution: domain 35 (money 8, loans 4, forecast 6, finance 6, cards 6, position 5),
persistence 16, presentation 3 (dashboard 2, offline 1), PWA contract 3.

**Conclusion:** the project is in a healthy, coherent state. Nothing is broken. The findings
below are *unfinished edges*, not failures — and one of them (finding **B1**) will produce a
blank page on the most likely hosting target.

---

## 2. Technology stack & architecture (observed)

- **Vite 6 + React 18 + TypeScript 5.7** (`package.json:10-31`, `vite.config.js`).
- **Dexie 4 / IndexedDB as the single source of truth**; UI subscribes via
  `dexie-react-hooks` live queries — no Redux/Zustand (`src/infrastructure/db.ts:23-59`).
- **Tailwind v4** via `@tailwindcss/vite`.
- **PWA**: hand-written `public/sw.js` + `public/manifest.webmanifest` (no Workbox).
- **Testing**: Vitest 4 + jsdom + `fake-indexeddb` + Testing Library.

### Layering (strict, verified)

```
presentation/  React pages, kit, charts, dialogs
      ↓ (imports application only)
application/   useCases.ts (writes) · queries.ts (reads) · backup.ts
      ↓ (imports domain only)
domain/        models (entities, Money) · services (finance, position, forecast, cards, loans)
infrastructure/ db.ts (Dexie) · mappers.ts (row ↔ domain) · seed.ts
```

Verified by import inspection: `domain/**` imports **no** React and **no** Dexie; only
`application/**` and `infrastructure/**` touch `db`. This honours ADR-001 / ADR-009.

---

## 3. Observed requirements (EARS)

### Money & arithmetic

- The system **shall** represent every monetary value as integer cents inside the `Money`
  value object (`src/domain/models/money.ts:14-103`).
- When a non-integer value reaches `Money.fromCents`, the system **shall** throw
  `DomainError` (`money.ts:24-29`).
- When decimal input arrives from a boundary (UI, seed), the system **shall** round it into
  integer space immediately via `Money.fromDecimal` (`money.ts:36-39`).
- If a non-integer factor is used for an estimate, the system **shall** round the product back
  into cents (`money.ts:65-67`).

### Accounts & transactions

- The system **shall** derive every account balance as
  `openingBalance + Σ transaction impact`, never storing a mutable balance
  (`finance.ts:26-27`, `entities.ts:64`).
- When a transaction is `INCOME`, the system **shall** add it; when `EXPENSE`, subtract it;
  when `ADJUSTMENT`, apply its signed value (`finance.ts:23-24`).
- While a transaction carries a `transferGroupId`, the system **shall** exclude it from
  income and expense analytics (`finance.ts:11,16-20`).
- While a transaction carries both `cardId` and `statementPeriod`, the system **shall**
  exclude it from expense analytics (`finance.ts:13-14,19-20`).
- The system **shall** compute month net as
  `income − expenses + Σ signed adjustments` (`finance.ts:41-42`).
- When a transfer is created, the system **shall** write exactly two legs — one `EXPENSE`,
  one `INCOME` — sharing one `TransferGroupId`, inside a single Dexie transaction
  (`useCases.ts:140-172`).
- If both legs of a transfer would land on the same account, the system **shall** reject the
  operation (`useCases.ts:143-144`).
- When a transfer leg is deleted, the system **shall** delete both legs atomically
  (`useCases.ts:116-124,199-201`).

### Credit cards

- The system **shall** fix a purchase's statement period at write time from the card's
  closing day (`cards.ts:31-36`, `useCases.ts:435`).
- When a purchase is recorded, the system **shall** reduce available credit without touching
  bank cash (`cards.ts:92-98`).
- When a statement is paid, the system **shall** reduce bank cash and settle the obligation,
  excluding the payment from spending analytics (`useCases.ts:203-246`, `cards.ts:64-69`).
- If a payment exceeds the remaining statement balance, the system **shall** reject it
  (`useCases.ts:224-225`; test `persistence.test.ts:187-214`).
- The system **shall** mark a statement `overdue` when unpaid past its due date
  (`cards.ts:71-75`).

### Recurring expenses (forecasts)

- The system **shall** treat a recurring expense as a forecast only; it **shall never** move
  money (`forecast.ts`, `docs/domain/01-invariants.md:38-45`).
- When a transaction linked by `recurringId` falls in the occurrence's month (or ±3 days for
  weekly), the system **shall** consider the occurrence settled (`forecast.ts:81-93`).
- When a template is deleted, the system **shall** preserve all historical transactions
  (`useCases.ts:508-511`).
- While stale occurrences exist, the system **shall** collapse them into the single most
  recent miss (`position.ts:83-93`).

### Loans

- The system **shall** derive the outstanding balance from immutable payments, never storing
  it (`loans.ts:12-13`).
- If a payment exceeds the outstanding balance, the system **shall** reject it
  (`useCases.ts:266`).
- When a loan has recorded payments, the system **shall** refuse deletion
  (`useCases.ts:555-558`).
- The system **shall** distinguish money owed (`owed`) from money owed to us (`receivable`)
  (`entities.ts:131`).

### Financial position

- The system **shall** expose `currentCash`, `committedCash`, `projectedCash` and
  `availableCash = currentCash − committedCash` (`position.ts:62-74,177-181`).
- The system **shall** derive obligations from recurrings, card statements and loan schedules,
  never storing them separately (`position.ts:76-143`).
- Where a `today` value is injected, the system **shall** compute every month-derived figure
  from it, making the position a pure function of its input (`position.ts:158-161`).

### Persistence, backup, integrity

- The system **shall** store all amounts as integer cents at rest (`mappers.ts:186-188`).
- The system **shall** persist at most the last four digits of any card or account
  (`useCases.ts:323-324,377`; test `persistence.test.ts:36-41`).
- When a backup is imported, the system **shall** validate envelope and row shape **before**
  any destructive clear, then restore atomically (`backup.ts:46-121`).
- The system **shall** reject backups whose `app` or `version` does not match
  (`backup.ts:54-62`).
- The system **shall** reject impossible calendar dates (`useCases.ts:34-40`; test
  `persistence.test.ts:232-246`).

### Presentation

- The system **shall** render the dashboard's cash figure directly from the domain-computed
  position (`dashboard.test.tsx:63-80`).
- The system **shall** surface connectivity changes live (`ui.tsx:58-71`;
  test `offline.test.tsx`).
- The system **shall** keep all user-facing strings in `presentation/i18n.tsx` with
  `en` and `pt-BR` dictionaries (`i18n.tsx:12-370`).

---

## 4. Non-functional observations

- **Locale**: language auto-detected from `navigator.language`, persisted in `localStorage`
  under `cfc-lang` (`i18n.tsx:436-460`). Currency is **hardcoded BRL** regardless of language
  (`i18n.tsx:388`) and `fmtCompact` hardcodes `R$` (`ui.tsx:27`) — correct for the stated
  Brazilian-household target, but not currency-portable.
- **Accessibility**: icons are `aria-hidden`, dialogs carry `role="dialog"` +
  `aria-modal`, toggles use `role="switch"`/`aria-checked`, buttons carry `aria-label`.
  Reasonable coverage.
- **Performance**: single 411 kB JS bundle (122 kB gzip); no code-splitting, no route-level
  lazy loading. Acceptable for a local-first single-page app.
- **Error handling**: use cases throw human-readable `Error`/`DomainError`; the UI catches at
  dialog boundaries and surfaces a toast. Consistent.
- **Security posture**: no credentials, no full numbers, no CVV, no `.env`, no network layer
  at all. `.gitignore` covers `.env*`, keys, DB files and backup exports.

---

## 5. Missing development steps (primary answer)

Ordered by impact. Each finding cites the evidence that establishes it.

### B1 — Build emits absolute asset paths; the PWA is authored for relative paths

- `dist/index.html` (produced by `vite build`) references
  `src="/assets/index-CU8C5Jil.js"` and `href="/assets/index-CGjNLsGR.css"` — **absolute**.
- Every other reference is **relative**: `manifest.webmanifest` has `"start_url": "./"` and
  `"scope": "./"`; `index.html:9-11` uses `./manifest.webmanifest` and `./icons/icon.svg`;
  `main.tsx:10` registers `"./sw.js"`.
- `vite.config.js` sets **no `base`**, so Vite defaults to `/`.
- **Impact:** deployed under a sub-path (e.g. a GitHub Pages project site
  `https://user.github.io/couple-finance-control/`), the JS and CSS 404 and the app renders a
  blank page. The relative PWA references show sub-path hosting was the intent.
- **Also missing:** no hosting/deployment section anywhere in `README.md` — the deploy step is
  undefined.
- **Fix:** set `base: "./"` in `vite.config.js` (or deploy at a domain root and document that
  constraint), then document the hosting target in the README.

### B2 — Activity page counts card payments as expenses, contradicting the invariant

- `src/presentation/pages/Transactions.tsx:83`:
  `else if (t2.kind === "EXPENSE" || t2.kind === "CARD_PAYMENT") expenses += t2.amountCents;`
- The domain says otherwise: `countsAsExpense` excludes card payments
  (`finance.ts:19-20`), `docs/domain/01-invariants.md:24-26` states card payments "are
  excluded from spending analytics (spending was counted at purchase time)", and
  `finance.test.ts:68-77` asserts `countsAsExpense(cardPayment) === false`.
- **Impact:** the Activity page's "Expenses" total will not equal the Dashboard's "Spending",
  and the aggregation is re-implemented in the view layer — against ADR-001 ("all financial
  math lives in `domain/services`").
- **Fix:** compute the summary in `application/queries.ts` from `monthTotals`/`countsAsExpense`
  and have the page consume it. Add a test pinning Activity summary == `monthTotals`.

### B3 — Credit-card spending is invisible in spending analytics

- The invariant says "A purchase counts as spending and reduces available credit"
  (`docs/domain/01-invariants.md:32`).
- But `monthTotals` and `expensesByCategory` take only `transactions` (`finance.ts:35,58`),
  and `cardPurchases` never enter either — `categorySlices` passes only
  `base.transactions` (`queries.ts:479`).
- Because card **payments** are also excluded (B2's rule), a card purchase reaches **no**
  spending figure: not the Dashboard "Spending" bar, not the "Where the money went" donut.
- **Impact:** a household paying by card sees spending understated on the dashboard.
- **This is a product decision, not obviously a bug:** the app may deliberately be
  cash-basis. Either (a) include `cardPurchases` in the analytics, or (b) document the
  cash-basis choice and correct the invariant wording. Currently the docs and the code
  disagree — that is the defect.
- **Fix:** decide, then make docs + code + a test agree.

### B4 — Offline shell does not precache build assets

- `public/sw.js:5`: `const SHELL = ["./", "./index.html", "./manifest.webmanifest"]` — the
  hashed JS/CSS are absent.
- `src/main.tsx:8-14` registers the worker only in production and only on `load`, i.e. after
  the initial asset fetches have already completed.
- `sw.js:44-59` caches same-origin assets only on a subsequent fetch
  (stale-while-revalidate).
- **Inference (read from source, not browser-verified):** on a first visit the JS/CSS are
  fetched before the worker controls the page, so they are never cached. A later cold offline
  start serves the cached `index.html`, which then requests an uncached `/assets/*.js` →
  blank app until one online reload has occurred.
- **Impact:** weakens principle 4 ("local-first, useful with intermittent connectivity") and
  FIN-01. There is no build-time asset manifest and no cache-version-to-build link.
- **Fix:** adopt `vite-plugin-pwa`/Workbox (inject the precache manifest), or generate the
  shell list at build time and version `CACHE` from the build hash.

### B5 — Google Fonts is a third-party request; the security doc says there are none

- `index.html:15-20` adds `preconnect` to `fonts.googleapis.com` / `fonts.gstatic.com` and a
  Google Fonts stylesheet.
- `docs/security.md:29-31` asserts "no analytics, no telemetry, **no third-party requests**"
  and "No data leaves the device."
- `sw.js:45` restricts caching to same-origin, so fonts are never cached → offline the app
  silently falls back to system fonts.
- **Impact:** the stated privacy guarantee is inaccurate (Google receives IP/UA), and the
  offline shell is less faithful than documented.
- **Fix:** self-host the three families (or drop them) and update `docs/security.md`.

### B6 — Three use cases are implemented but unreachable from the UI

| Orphaned use case | Location | Consequence |
|---|---|---|
| `addCategory` / `deleteCategory` | `useCases.ts:561`, `:584` | **No category management UI exists** — categories are seed-only. Users cannot add or remove a category. |
| `deletePixKey` | `useCases.ts:624` | A PIX key can be added but **never removed** (`Accounts.tsx:171` only adds). |
| `deleteContact` | `useCases.ts:639` | A contact can be added (`Accounts.tsx:261`) but **never removed**. |

Verified by exhaustive cross-reference of every `uc.*` call in `src/presentation` against the
26 exported use cases. All others are wired.
- **Fix:** add the missing affordances (a small "Categories" section/settings page, and delete
  actions on PIX keys and contacts), reusing the existing `Confirm` primitive.

### B7 — Tooling gaps: no `test` script, no linter, dangling lint suppressions

- `package.json:5-9` defines only `dev`, `build`, `typecheck`. There is **no `test` script**
  (the README tells users to run `npx vitest run`), no `preview`, no `lint`.
- **No ESLint/Prettier configuration exists anywhere** — yet `actions.tsx:84` and
  `actions.tsx:309` carry `// eslint-disable-line react-hooks/exhaustive-deps`, suppressing a
  linter that is not installed. `Transactions.tsx` and `Accounts.tsx` also have hook
  dependency arrays that a linter would flag (`useEffect(..., [open])` ignoring `preset`,
  `meta`, `loan`, `statement`).
- **Fix:** add ESLint (`eslint-plugin-react-hooks`) + Prettier, add `"test": "vitest run"`,
  then resolve or justify the suppressions.

### B8 — `tsconfig.json` does not typecheck the test tree

- `tsconfig.json:15` — `"include": ["src"]`. Therefore `test/setup.ts` and
  `test/pwa-assets.test.ts` are **never** typechecked by `npm run typecheck`, and neither are
  `vite.config.js` / `vitest.config.ts`.
- **Fix:** add `test` (and the config files) to `include`, or introduce
  `tsconfig.test.json` referenced from a `typecheck` script that covers both.

### B9 — No CI

- `.github/` does not exist. All three gates are green locally and none is enforced on push.
- **Fix:** add a workflow running `npm ci` → `npm run typecheck` → `npx vitest run` →
  `npm run build` on push/PR. This is the single highest-leverage addition, and it is what
  would have caught B1 and B2 automatically.

### B10 — Package identity mismatch

- `package.json:2` — `"name": "sandbox-workspace"`, and `package-lock.json` mirrors it.
- The product identity `couple-finance-control` is used by the Dexie database
  (`db.ts:38`), the backup envelope `app` field (`backup.ts:10,37`), the manifest and the docs.
- **Impact:** confusing in a public repository; the lockfile also carries the wrong name.
- **Fix:** rename the package to `couple-finance-control` and regenerate the lockfile.

### B11 — `.gitignore` does not exclude `.workbuddy-ai/`

- `docs/security.md:16-20` commits to excluding "Agent/workspace artifacts" from the public
  repository and enumerates `.agents/`, `.cline/`, `.clinerules/`, `AGENTS.md`, `SOUL.md`,
  `skills-lock.json`, `tasks/`, `.codegraph/`.
- `.workbuddy-ai/` — the agent workspace directory (which will hold local session memory) — is
  **not** listed, and `git check-ignore .workbuddy-ai` confirms it is not ignored.
- **Impact:** local agent notes and absolute machine paths could be committed to a public
  repository, defeating the stated sanitisation policy.
- **Fix:** add `.workbuddy-ai/` to `.gitignore`.

### B12 — Documentation drift

- `docs/security.md:21-24` claims history is "a single clean commit"; `git log` shows **two**
  (`95c8c0c`, `ccc08d2`).
- `docs/adr/009-...md:18` shows `domain/types/` as a directory; the implementation is
  `src/domain/types.ts` (a file). The README correctly says `types.ts`.
- No `docs/adr/README.md` index exists for the ten ADRs.
- **Fix:** refresh the two stale statements; add an ADR index.

### B13 — Requirements baseline is referenced but absent

- Docs cite "baseline Section 04" (`01-invariants.md:3`) and "baseline Section 07"
  (`security.md:3`), and the code cites requirement IDs **FIN-01 … FIN-11** across
  `forecast.ts`, `cards.ts`, `loans.ts`, `position.ts`, `seed.ts`, `App.tsx` and the pages.
- No baseline/requirements document exists in the repository (`find . -iname "*baseline*"` →
  nothing).
- **Impact:** every requirement ID and section reference is untraceable — a reader cannot
  verify that FIN-11 is satisfied. This is the one structural documentation gap.
- **Fix:** commit the baseline (or a `docs/requirements.md` mapping FIN-01…FIN-11 to
  acceptance criteria and the tests that cover them).

### B14 — Statement "today" is injected in one path but not the other

- `computePosition` carefully accepts and threads `today` for testability
  (`position.ts:158-161`), and `computeObligations` passes it to `buildStatements`
  (`position.ts:110`).
- But `queries.ts:281` calls `buildStatements(card, base.purchases, base.transactions)`
  **without** `today`, and `queries.ts:399` hardcodes `todayISO()`.
- **Impact:** two code paths can disagree about a statement's status across a midnight
  boundary, and the read-side view models are not time-injectable the way the domain is.
- **Fix:** thread `today` through `queries.ts` (or accept it as a parameter defaulting to
  `todayISO()`), matching the domain's testability contract.

---

## 6. Uncertainties & questions

1. **B3** — Is the app intentionally cash-basis (card purchases never counted as spending), or
   is the invariant wording authoritative? The docs and code currently disagree.
2. **B1** — What is the intended hosting target? Relative PWA metadata implies a sub-path;
   absolute build output implies a domain root. The README is silent.
3. **B4** — Has a cold offline start ever been tested in a real browser? The precache gap is
   invisible to the current jsdom test suite, which asserts only that `sw.js` *contains*
   certain strings (`pwa-assets.test.ts:10-17`).
4. **B5** — Are the Google Fonts intentional, or leftovers from design iteration?
5. **B11** — Is `.workbuddy-ai/` deliberately unignored (e.g. the repo owner wants it
   versioned)? Unlikely, given `docs/security.md`, but worth confirming.
6. Are PNG icons required? `manifest.webmanifest` ships **SVG only**, declaring
   `"sizes": "512x512"` on an SVG, and `index.html:11` uses an SVG `apple-touch-icon`. iOS
   does not support SVG touch icons, so the home-screen icon will be a screenshot; some
   installability audits also want raster 192/512. Not verified on-device.
7. `Money.fromDecimal` uses `Math.round(decimal * 100)` — correct for two-decimal input, but
   the boundary behaviour for pathological inputs (e.g. `1e21`) relies on
   `Number.isSafeInteger` throwing downstream. No test covers this explicitly.

---

## 7. Recommended next steps (sequenced)

**Now — correctness & trust (small, high value)**
1. **B2** — fix the Activity summary to use the domain rule; add a test asserting
   Activity summary == `monthTotals`. — **DONE**
2. **B3** — make the card-spending decision explicit; align docs, code and a test. — **DONE**
3. **B11** — add `.workbuddy-ai/` to `.gitignore` (one line, closes a public-repo leak). — **DONE**

**Next — ship readiness**
4. **B1** — set `base: "./"` (or document a root-only deploy) and add a README hosting section. — **DONE**
5. **B9** — add the CI workflow; it locks in everything above. — **DONE**
6. **B5** — self-host the fonts (or remove them) and correct `docs/security.md`. — **DONE**
7. **B4** — precache build assets (`vite-plugin-pwa`/Workbox) and version the cache from the
   build; verify a cold offline start in a real browser. — **DONE** (hand-rolled
   `cfc-pwa-precache` plugin instead of Workbox; cold offline start verified in headless
   Chrome via `npm run verify:offline`)

**Then — completeness & hygiene**
8. **B6** — add the missing category-management UI and the PIX-key / contact delete actions. — **DONE**
9. **B7 / B8** — add ESLint + Prettier, a `test` script, and typecheck the `test/` tree. — **DONE**
10. **B13** — commit the requirements baseline and map FIN-01…FIN-11 to tests. — **DONE**
    (`docs/requirements.md`)
11. **B10 / B12 / B14** — rename the package, refresh the drifted docs, add the ADR index,
    thread `today` through the read side. — **DONE**
12. Add raster PWA icons (192/512) for reliable iOS/Android installability. — **DONE**
    (plus a `maskable` variant and a 180×180 `apple-touch-icon`)

---

## 7b. Post-fix verification

Re-run after all findings were closed:

| Gate | Result |
| --- | --- |
| `npm run typecheck` (now covering `test/`) | pass |
| `npm run lint` (ESLint + React hooks + TS) | 0 errors, 6 warnings |
| `npm test` | **81 tests / 11 files** pass (was 57) |
| `npm run build` | pass — 419 kB JS (124 kB gzip), 43 kB CSS, 8 hashed woff2 |
| `npm run verify:offline` | **pass** — cold offline start renders the identical shell |

Two findings surfaced *only* because the new tooling was added, and were fixed:

- **`deleteCategory` always threw.** `useCases.ts` queries `cardPurchases.where("categoryId")`
  but the v1 Dexie schema never indexed that key path, so no category could be deleted and the
  orphaned use case hid the crash. Fixed with an additive `version(2)` block; two contract tests
  now assert the schema version and that every queried key path is indexed.
- **ESLint's React-Compiler rules** flagged a component created during render (`LangBtn` in
  `App.tsx`), a render-time module mutation (`uiLocale` in `i18n.tsx`) and a render-phase
  accumulator (`Donut` in `charts.tsx`). All three were genuine and are now fixed; the
  remaining six `set-state-in-effect` hits are the "reset the form when the modal opens"
  pattern and are kept as documented warnings.

**Prettier is deliberately not enforced.** The config is committed so the convention is
recorded, but the codebase predates it and a bulk reformat would touch all 67 files and bury
every real change in whitespace. `npm run format` remains available for files you are already
editing.

---

## 8. Overall assessment

The architecture is genuinely sound and unusually well documented for its size: the domain is
pure and independently testable, invariants are written down *and* tested, transfers are
correct by construction, and all 81 tests pass with a clean typecheck and build. The layering
(ADR-009) holds under inspection.

What was missing was not design — it was **the last mile of delivery**: a deploy target and
correct build base (B1), CI to enforce the green gates (B9), a truthful privacy/offline story
(B4, B5), and the finishing UI surfaces whose use cases were already written (B6). Findings B2
and B3 were the only places where the code contradicted the project's own written invariants,
and both are now resolved. All 14 findings are closed.
