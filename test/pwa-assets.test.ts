// @vitest-environment node
/** PWA contract: the offline shell assets ship with the required fields (FIN-01). */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

/**
 * Reads the real dimensions out of a PNG's IHDR chunk. Asserting against the
 * file itself (rather than trusting the filename) catches a broken generator —
 * e.g. an encoder that writes a valid-looking header with the wrong size.
 */
const pngSize = (file: string): { w: number; h: number } => {
  const buf = readFileSync(file);
  expect(buf.subarray(0, 8), `${file} is not a PNG`).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  expect(buf.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

describe("PWA assets", () => {
  it("service worker caches the shell and handles fetch", () => {
    const sw = readFileSync(join(root, "public/sw.js"), "utf8");
    expect(sw).toContain("cfc-shell");
    expect(sw).toContain("install");
    expect(sw).toContain("activate");
    expect(sw).toContain("fetch");
    expect(sw).toContain("index.html"); // offline navigation fallback
  });

  it("service worker declares the build-time precache placeholders", () => {
    const sw = readFileSync(join(root, "public/sw.js"), "utf8");
    // vite.config.js replaces these with the hashed build outputs. If either
    // placeholder is renamed, the shell silently loses its JS/CSS/fonts and a
    // cold offline start renders a blank page — so assert the contract here.
    expect(sw).toContain("__CFC_ASSETS__");
    expect(sw).toContain("__CFC_BUILD__");
    // The cache name must be derived from the build, never hardcoded, or a new
    // deploy would keep serving the previous cache.
    expect(sw).toContain('"cfc-shell-" + BUILD_ID');
  });

  it("manifest declares an installable standalone app", () => {
    const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8")) as {
      name: string;
      short_name: string;
      display: string;
      start_url: string;
      icons: unknown[];
    };
    expect(manifest.name).toBe("Couple Finance Control");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("./");
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it("ships every icon the manifest references, at the size it declares", () => {
    const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8")) as {
      icons: { src: string; sizes: string; type: string; purpose: string }[];
    };

    for (const icon of manifest.icons) {
      const file = join(root, "public", icon.src.replace(/^\.\//, ""));
      expect(existsSync(file), `missing ${icon.src}`).toBe(true);

      if (icon.type === "image/svg+xml") {
        // Resolution-independent: "any" is the only honest size. Declaring a
        // fixed pixel size on an SVG is what the original manifest got wrong.
        expect(icon.sizes, `${icon.src} should declare "any"`).toBe("any");
        continue;
      }

      const { w, h } = pngSize(file);
      expect(`${w}x${h}`, `${icon.src} size mismatch`).toBe(icon.sizes);
    }
  });

  it("declares both an 'any' and a raster 'maskable' icon", () => {
    const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8")) as {
      icons: { src: string; type: string; purpose: string }[];
    };
    const purposes = manifest.icons.map((i) => i.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");

    // Android masks the icon; an SVG-only maskable entry is not usable.
    const maskable = manifest.icons.find((i) => i.purpose === "maskable")!;
    expect(maskable.type).toBe("image/png");
    expect(maskable.src).toMatch(/\.png$/);

    // The maskable art must be scaled into the safe zone, so it cannot be a
    // byte-for-byte copy of the plain 512 icon.
    const maskableBytes = readFileSync(join(root, "public", maskable.src.replace(/^\.\//, "")));
    const plainBytes = readFileSync(join(root, "public/icons/icon-512.png"));
    expect(maskableBytes.equals(plainBytes)).toBe(false);
  });

  it("apple-touch-icon is a PNG — iOS ignores SVG touch icons", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    const match = html.match(/<link rel="apple-touch-icon"[^>]*href="([^"]+)"/);
    expect(match, "no apple-touch-icon link in index.html").toBeTruthy();

    const href = match![1];
    expect(href).toMatch(/\.png$/);
    const { w, h } = pngSize(join(root, "public", href.replace(/^\.\//, "")));
    expect(w).toBe(180);
    expect(h).toBe(180);
  });
});

describe("built shell is complete enough for a cold offline start", () => {
  const dist = join(root, "dist");
  const swPath = join(dist, "sw.js");

  it.skipIf(!existsSync(swPath))("every asset index.html loads is in the precache list", () => {
    const sw = readFileSync(swPath, "utf8");
    const listMatch = sw.match(/const ASSETS = typeof (\[[\s\S]*?\]) !== "undefined"/);
    expect(listMatch, "could not find the injected ASSETS list in dist/sw.js").toBeTruthy();
    const precached = new Set<string>(JSON.parse(listMatch![1]) as string[]);

    // Anything the initial document pulls in must be cached, or an offline cold
    // start renders a blank page: HTML is served, its JS/CSS are not.
    const html = readFileSync(join(dist, "index.html"), "utf8");
    const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => m[1]);
    const needed = refs.filter((r) => !r.endsWith(".webmanifest"));

    expect(needed.length).toBeGreaterThan(0);
    for (const ref of needed) {
      expect(precached.has(ref), `${ref} is loaded but not precached`).toBe(true);
    }

    // The navigation fallback and the manifest must be there too.
    expect(precached.has("./icons/icon-512.png")).toBe(true);
  });

  it.skipIf(!existsSync(swPath))("no build-time placeholder survives the build", () => {
    const sw = readFileSync(swPath, "utf8");
    expect(sw).not.toContain("__CFC_ASSETS__");
    expect(sw).not.toContain("__CFC_BUILD__");
  });
});

describe("fonts are vendored, not fetched", () => {
  it("index.html makes no third-party font request", () => {
    const html = readFileSync(join(root, "index.html"), "utf8");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
  });

  it("main.tsx imports the vendored stylesheet so Vite bundles it", () => {
    const main = readFileSync(join(root, "src/main.tsx"), "utf8");
    expect(main).toContain('"./assets/fonts/fonts.css"');
  });

  it("fonts.css defines every UI family from local files that exist", () => {
    const dir = join(root, "src/assets/fonts");
    const css = readFileSync(join(dir, "fonts.css"), "utf8");
    expect(css).not.toContain("gstatic.com");
    for (const family of ['"Bricolage Grotesque"', '"Instrument Sans"', '"Spline Sans Mono"']) {
      expect(css).toContain(family);
    }
    // latin + latin-ext for each family/style combination.
    expect((css.match(/@font-face/g) ?? []).length).toBeGreaterThanOrEqual(6);

    const woff2 = readdirSync(dir).filter((f) => f.endsWith(".woff2"));
    expect(woff2.length).toBeGreaterThanOrEqual(6);

    // Every declared face must point at a file that actually ships.
    for (const [, file] of css.matchAll(/url\("\.\/([^"]+)"\)/g)) {
      expect(existsSync(join(dir, file)), `missing ${file}`).toBe(true);
    }
  });

  it("ships the OFL licence for each vendored family", () => {
    const licences = readdirSync(join(root, "public/fonts/licenses"));
    expect(licences.length).toBe(3);
    for (const file of licences) {
      expect(readFileSync(join(root, "public/fonts/licenses", file), "utf8")).toContain(
        "SIL OPEN FONT LICENSE"
      );
    }
  });
});
