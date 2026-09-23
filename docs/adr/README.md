# Architecture Decision Records

Every architectural decision in this project is recorded here, one file per decision.
Each ADR follows the same shape: **Status → Context → Decision → Consequences**.

An ADR is **immutable history**. When a decision changes, add a new ADR that supersedes
the old one and mark the old one `Superseded by ADR-0NN` — never rewrite the original.

| ADR | Decision | Status |
| --- | --- | --- |
| [001](001-domain-logic-independent-from-ui.md) | Domain logic independent from the UI — all financial math lives in `domain/services`, the UI never re-derives it | Accepted |
| [002](002-local-first-data-model.md) | Local-first data model — IndexedDB is the source of truth and the app works offline | Accepted |
| [003](003-future-synchronization.md) | Future synchronization — ULIDs, `createdAt`/`updatedAt`, non-destructive updates and additive migrations so a sync layer can merge later | Accepted |
| [004](004-no-banking-integrations-initial-releases.md) | No banking integrations in initial releases — no network calls at runtime | Accepted |
| [005](005-no-sensitive-payment-credentials.md) | No sensitive payment credentials — never store passwords, tokens, CVVs or full card/account numbers; last four digits only | Accepted |
| [006](006-ai-not-part-of-financial-core.md) | AI is not part of the financial core — no model ever computes or mutates a balance | Accepted |
| [007](007-use-vite-react-dexie-instead-of-tauri.md) | Frontend stack: Vite + React + TypeScript + Dexie.js, instead of Tauri | Accepted |
| [008](008-local-database-as-reactive-store.md) | Local database as the reactive store — live Dexie queries instead of Redux/Zustand | Accepted |
| [009](009-frontend-hexagonal-architecture.md) | Frontend hexagonal architecture — `domain` → `application` → `infrastructure` → `presentation`, with ports added only when a second implementation exists | Accepted |
| [010](010-value-objects-and-branded-types.md) | Value objects and branded types — `Money` over integer cents, and branded IDs that cannot be mixed up at compile time | Accepted |

## Related documents

- [`../requirements.md`](../requirements.md) — the requirements baseline (FIN-01…FIN-11),
  with the ADRs each requirement depends on.
- [`../domain/01-invariants.md`](../domain/01-invariants.md) — the "cannot be broken"
  rules that fall out of ADR-001, ADR-002 and ADR-010.
- [`../security.md`](../security.md) — the checklist that operationalises ADR-005.
