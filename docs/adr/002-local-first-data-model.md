# ADR-002 — Local-First Data Model

## Status
Accepted

## Context
The household needs the app to work with intermittent connectivity (FIN-01).

## Decision
Local persistence (IndexedDB via Dexie) is a first-class part of the architecture:
`UI → Application → Local Database`. A future sync layer extends this to
`Local Database ↔ Sync Layer ↔ Remote Database` without touching the domain.

## Consequences
- The app is fully functional offline from day one.
- The domain never depends on a synchronization mechanism (see ADR-003).
