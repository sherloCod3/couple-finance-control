# ADR-004 — No Banking Integrations in Initial Releases

## Status
Accepted

## Context
Connecting to Brazilian banks implies integration complexity, authentication/security
exposure, ongoing maintenance cost, and no suitable free path for this project.

## Decision
The app does not connect to bank APIs. Manual entry is intentionally preferred.

## Consequences
- Simpler security surface and zero credential handling.
- Users enter transactions manually; import features (PDF/AI-assisted) may come later
  as *candidate* records requiring confirmation (ADR-006).
