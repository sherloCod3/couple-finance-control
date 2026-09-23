# App icons

Every file here except this README is **generated — do not edit by hand**.
Regenerate with `npm run icons` after changing `icon.svg`.

| File | Size | Purpose | Notes |
| --- | --- | --- | --- |
| `icon.svg` | — | `any` (source) | The hand-authored master artwork. |
| `icon-192.png` | 192×192 | `any` | Android home screen. |
| `icon-512.png` | 512×512 | `any` | Splash screen and store listings. |
| `maskable-512.png` | 512×512 | `maskable` | Artwork scaled to 80% so it survives a circular mask. |
| `apple-touch-icon.png` | 180×180 | iOS | iOS ignores SVG touch icons, so this one must be a raster PNG. |

## Why the sizes differ

Android crops `maskable` icons to a shape chosen by the launcher. Only the centre circle
of radius 40% is guaranteed visible, and the outermost ring of the artwork sits at 44.5%
— so the maskable variant pulls the art in to 80% to keep it inside the safe zone. iOS
rounds its corners aggressively for the same reason, hence 86% for the touch icon.

The `any` icons are full-bleed and are **not** the same bytes as the maskable variant;
`test/pwa-assets.test.ts` asserts that, so a copy-paste mistake can't slip through.

## How they are generated

`scripts/make-icons.mjs` rasterises the SVG analytically — the artwork is four concentric
circles on a solid background — with 4×4 supersampling for smooth edges, then encodes PNG
directly with Node's built-in `zlib`. No `sharp`, no `resvg`, no network, and byte-identical
output on every platform.

If the artwork becomes more complex than circles and rectangles, swap the rasteriser for a
real one rather than growing this one.
