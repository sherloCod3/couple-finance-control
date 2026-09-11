# ADR-008 — Local Database as the Reactive Store (No Redux/Zustand)

## Status
Accepted

## Context
Fetching IndexedDB data into a global store duplicates state and is a common source of
store/database desynchronization bugs.

## Decision
Dexie is the single source of truth. The presentation layer subscribes directly through
Dexie's live-query mechanism (`dexie-react-hooks`), so the UI updates automatically when
underlying data changes. Writes go through application use cases.

## Consequences
- Positive: no reducers/actions/selectors boilerplate; eliminates a class of desync bugs.
- Constraint: live-query subscription is confined to the presentation layer; the domain
  remains unaware of Dexie, keeping ADR-001 intact.
