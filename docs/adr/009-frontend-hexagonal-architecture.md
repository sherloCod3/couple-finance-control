# ADR-009 — Frontend Hexagonal Architecture (Ports & Adapters)

## Status
Accepted

## Context
Business logic scattered across `components/`, `pages/` and `utils/` makes the financial
domain hard to isolate, test and reason about, working against ADR-001.

## Decision
Organize `src/` by architectural responsibility:

```
src/
├── domain/           # Pure TS. No React. No Dexie.
│   ├── models/       # Entities + Money value object
│   ├── services/     # Financial rules & calculations
│   ├── utils/        # Date helpers (pure)
│   └── types.ts      # Branded id types
├── application/      # Use cases and read-side view-model queries
├── infrastructure/   # Dexie setup, row↔domain mappers, demo seed
└── presentation/     # React components, pages, UI hooks
```

Interfaces (ports) are introduced only when more than one implementation actually exists
(e.g. a remote sync repository later) — never speculatively. Until then, use cases import
the concrete Dexie database directly and tests mock modules.

## Consequences
- Positive: `domain/` is independently testable and portable to a Node backend or another
  client without modification.
- Risk mitigation: no premature abstraction layers.
