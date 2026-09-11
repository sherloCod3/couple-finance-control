# ADR-010 — Value Objects and Branded Types for Domain Safety

## Status
Accepted

## Context
Raw primitives (`amount: number`, `id: string`) allow identifiers of different entities
to be interchanged by mistake and invite floating-point monetary math — both unsafe for
financial calculations.

## Decision
- Entity identifiers use **branded (nominal) TypeScript types** (`AccountId`,
  `TransactionId`, `HouseholdId`, …). Passing the wrong id type is a compile-time error
  even though every id is a ULID string at runtime.
- Monetary values use a **`Money` value object** over integer cents. A custom lightweight
  implementation was chosen over dinero.js/currency.js: `Number.MAX_SAFE_INTEGER` covers
  ~90 trillion reais in cents, dependencies stay minimal, and the "no floating-point math"
  rule is enforced at the type level.

## Consequences
- Prevents an entire class of runtime bugs (id mix-ups, float rounding) at compile time.
- Constraint: all domain code constructs/consumes amounts through `Money`, never raw numbers.
