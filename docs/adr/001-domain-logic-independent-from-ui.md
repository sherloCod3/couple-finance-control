# ADR-001 — Domain Logic Independent from UI

## Status
Accepted

## Context
Financial rules embedded in React components become untestable and drift between screens.

## Decision
Financial calculations live in `src/domain` (pure TypeScript) and are orchestrated by
`src/application`. The UI only renders pre-computed view models and collects input.

```
UI → Application / Use Cases → Domain → Persistence
```

## Consequences
- Domain services are independently testable and portable to a backend or another client.
- Components that reconstruct financial math are a review blocker.
