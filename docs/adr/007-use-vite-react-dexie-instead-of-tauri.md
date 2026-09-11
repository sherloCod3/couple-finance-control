# ADR-007 — Frontend Stack: Vite + React + TypeScript + Dexie.js (instead of Tauri)

## Status
Accepted

## Context
FIN-01 requires an installable, offline-capable PWA. ADR-002 requires local-first
persistence. Tauri was considered and rejected: the primary requirement is a
browser-installable PWA (not a native desktop/mobile shell), and Rust would add
context-switching overhead without being required by any functional requirement.

## Decision
- **Vite** for build tooling and PWA builds.
- **React + TypeScript** for the UI layer.
- **Dexie.js** as the IndexedDB wrapper providing local-first, reactive storage
  (satisfies FIN-01 and ADR-002).

## Consequences
- Positive: single TypeScript stack across domain, application and UI; PWA requirement
  met directly; Dexie live queries remove the need for a separate state manager (ADR-008).
- Risks: IndexedDB storage ceilings (acceptable for financial text data) and more
  constrained background sync than a native shell — already anticipated by ADR-003.
