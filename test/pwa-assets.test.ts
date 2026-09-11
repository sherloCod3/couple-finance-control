// @vitest-environment node
/** PWA contract: the offline shell assets ship with the required fields (FIN-01). */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("PWA assets", () => {
  it("service worker caches the shell and handles fetch", () => {
    const sw = readFileSync(join(root, "public/sw.js"), "utf8");
    expect(sw).toContain("cfc-shell");
    expect(sw).toContain("install");
    expect(sw).toContain("activate");
    expect(sw).toContain("fetch");
    expect(sw).toContain("index.html"); // offline navigation fallback
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

  it("ships the referenced icon", () => {
    expect(existsSync(join(root, "public/icons/icon.svg"))).toBe(true);
  });
});
