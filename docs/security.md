# Security Review & Repository Sanitization

Performed against baseline Section 07 and ADR-005. Re-run this checklist before
every public release.

## What was reviewed

- [x] **No credentials persisted.** The schema stores institution, nickname,
      account type, **last four digits** and balances only. There is no field —
      anywhere in `src/` — for passwords, tokens, CVVs, full card numbers or
      full account numbers. UI inputs enforce 4-digit limits for cards/accounts.
- [x] **No secrets in the repository.** `.gitignore` excludes `.env*`, keys,
      database files and backup exports. No API keys, connection strings or
      tokens exist in source (there are no network calls at all — the app is
      local-first, ADR-002/004).
- [x] **No internal tooling committed.** Agent/workspace artifacts — `.agents/`,
      `.cline/`, `.clinerules/`, `AGENTS.md`, `SOUL.md`, `skills-lock.json`,
      `tasks/` and the `.codegraph/` index — are gitignored and excluded from the
      repository. Commitment: only product source, tests, docs, PWA shell and
      repo configs are tracked.
      History is a single clean commit (`Initial public release`, authored
      `Alexandre Cavalari <alexandre.cavalari@outlook.com>`); the full
      pre-release history is preserved only in the local backup
      (`../.sanitize-backup/couple-finance-pre-public.git`).
- [x] **Fictional demo data only.** The seed (`src/infrastructure/seed.ts`)
      uses "Demo Household", "Ana"/"Bruno", `demo@example.com`, fictional PIX
      keys and card `••4321`, generated relative to today's date. No real
      names, CPF/CNPJ, or financial values.
- [x] **No data leaves the device.** Everything lives in IndexedDB. The service
      worker only caches the app shell (same-origin); no analytics, no
      telemetry, no third-party requests.
- [x] **Input boundaries.** Amounts enter the domain exclusively through
      `Money.fromDecimal` (rounded to integer cents) or integer-cent fields;
      float math is impossible inside the domain (ADR-010).
- [x] **Backup files are validated** (`app`, `version`, table shapes) before an
      atomic restore, so malformed files cannot corrupt the store.

## Known accepted risks

- IndexedDB is not encrypted at rest (browser storage model). Acceptable for
  v1 because the data contains no credentials and never leaves the device;
  encryption-at-rest is a candidate for the hardening phase if the threat
  model changes.
- Web Push notifications would require a server; reminders are therefore
  in-app and derived from obligations (FIN-11) until sync lands (ADR-003).
