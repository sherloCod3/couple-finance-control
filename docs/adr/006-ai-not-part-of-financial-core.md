# ADR-006 — AI Is Not Part of the Financial Core

## Status
Accepted

## Context
AI-assisted PDF parsing may arrive later, but the financial core must remain exact and
auditable.

## Decision
The financial domain never depends on AI. AI may only produce **candidate** transactions
that a user reviews and confirms before they become actual financial records.

## Consequences
- The ledger contains only human-confirmed entries.
- AI features are additive and removable without touching domain logic.
