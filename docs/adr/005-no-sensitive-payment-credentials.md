# ADR-005 — No Sensitive Payment Credentials

## Status
Accepted

## Context
The app organizes finances; it is not a financial institution and must never become a
credential vault.

## Decision
Never store or transmit: banking passwords, authentication tokens, CVVs, complete card
numbers, complete account numbers, or any banking-system credentials. Persist only what
financial organization needs: institution, nickname, type, **last four digits**, balances.

## Consequences
- The UI enforces last-four-only inputs for cards and accounts.
- Public fixtures/documentation use fictional data only (Section 07).
