# ADR-003 — Future Synchronization

## Status
Accepted

## Context
Multi-device sync is not required for the first release, but retrofitting it later must
not require rewriting the data model.

## Decision
Design for sync now, implement it later:
- Globally unique, client-generated ids (monotonic ULIDs).
- `createdAt` / `updatedAt` on every entity.
- No database-generated identity assumptions.
- Non-destructive updates where history matters; consider tombstones when sync lands.

## Consequences
- Conflict resolution must be explicitly designed before multi-device sync ships.
- Historical records (e.g. loan payments) are append-only, which keeps future merges sane.
