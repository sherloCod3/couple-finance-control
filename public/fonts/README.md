# Vendored fonts

The three UI families are committed so the app makes **no third-party requests**
and its typography survives offline (ADR-002 / ADR-004, `docs/security.md`).

| Family | Role | Source |
|---|---|---|
| Bricolage Grotesque | `--font-display` | [ateliertriay/bricolage](https://github.com/ateliertriay/bricolage) |
| Instrument Sans | `--font-sans` | [Instrument/instrument-sans](https://github.com/Instrument/instrument-sans) |
| Spline Sans Mono | `--font-mono` | [SorkinType/SplineSansMono](https://github.com/SorkinType/SplineSansMono) |

All three are licensed under the **SIL Open Font License 1.1**; the full licence
text and copyright notice for each family is in `licenses/`.

## Where things live

- `src/assets/fonts/*.woff2` — the binaries. Imported from `src/main.tsx`, so Vite
  bundles and content-hashes them and the service worker precaches them.
- `src/assets/fonts/fonts.css` — the `@font-face` declarations.
- `public/fonts/licenses/` — the OFL texts, copied verbatim into
  `dist/fonts/licenses` so the licence ships with the deployed app.
- `licenses/` is the only part of this directory that is served statically.

Everything except this README is **generated — do not edit by hand**. Regenerate
with `node scripts/fetch-fonts.mjs` (needs network access); only run it when the
upstream families or weights change.

Only the `latin` and `latin-ext` subsets are vendored, which is what a pt-BR / en
household needs. `vietnamese` and the other subsets are deliberately skipped.
