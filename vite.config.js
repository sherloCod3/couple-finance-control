import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Single source of truth for the release version: `package.json`. It is injected
 * as a compile-time constant so the version shown in the UI cannot drift from the
 * manifest. Read through `import.meta.url` rather than a cwd-relative path, since
 * the config is loaded from wherever the build was started.
 *
 * This is unrelated to the Dexie schema version (`db.version(2)`), which only
 * moves when an index changes — see docs/domain/03-migrations-and-backup.md.
 */
const { version: appVersion } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
);

/**
 * Injects the hashed build outputs into the service worker's precache list and
 * versions the cache from their content hash.
 *
 * Without this, `public/sw.js` could only precache `index.html`, so a cold
 * offline start served a cached document that referenced JS/CSS the worker had
 * never cached — a blank page until one online reload had happened. CI asserts
 * the placeholder is gone from `dist/sw.js`.
 */
function pwaPrecache() {
  return {
    name: "cfc-pwa-precache",
    apply: "build",
    closeBundle() {
      const dist = path.resolve("dist");
      const swPath = path.join(dist, "sw.js");
      if (!existsSync(swPath)) {
        throw new Error("dist/sw.js is missing — cannot inject the precache manifest.");
      }

      const collect = (dir) => {
        const abs = path.join(dist, dir);
        if (!existsSync(abs)) return [];
        return readdirSync(abs)
          .filter((f) => /\.(js|css|woff2|png|svg)$/.test(f))
          .sort()
          .map((f) => `./${dir}/${f}`);
      };

      const assets = [...collect("assets"), ...collect("icons"), ...collect("fonts")];
      if (assets.length === 0) throw new Error("No build assets found to precache.");

      const buildId = createHash("sha1").update(assets.join("|")).digest("hex").slice(0, 8);

      let sw = readFileSync(swPath, "utf8");
      if (!sw.includes("__CFC_ASSETS__") || !sw.includes("__CFC_BUILD__")) {
        throw new Error("public/sw.js is missing its precache placeholders.");
      }
      sw = sw
        .replace(/__CFC_BUILD__/g, JSON.stringify(buildId))
        .replace(/__CFC_ASSETS__/g, JSON.stringify(assets));
      writeFileSync(swPath, sw);

      console.log(`\n  PWA precache: ${assets.length} assets, build ${buildId}`);
    },
  };
}

export default defineConfig({
  // Relative base so the built app works at a domain root AND under a sub-path
  // (e.g. a GitHub Pages project site). The PWA metadata is already relative —
  // manifest start_url/scope "./", and the worker is registered as "./sw.js" —
  // so an absolute "/assets/*" base would 404 under a sub-path and render a
  // blank page. See README "Deploying".
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), tailwindcss(), pwaPrecache()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
