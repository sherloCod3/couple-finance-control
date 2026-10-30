/**
 * Verifies the app's core promise end to end: **a cold offline start renders
 * the app shell**. It builds nothing — point it at an existing `dist/`.
 *
 * How it works: serves `dist/` over http://127.0.0.1 (a secure context, so
 * service workers are allowed), drives headless Chrome over the DevTools
 * Protocol, waits for the worker to install, cuts the network, reloads, and
 * checks that the shell still renders from cache.
 *
 * No dependencies: Node 22 ships a global WebSocket, which is all CDP needs.
 *
 * Run:  npm run verify:offline      (after `npm run build`)
 * Env:  CHROME_PATH=/path/to/chrome to override browser discovery
 *
 * Runs in CI on ubuntu-latest against the runner's Chrome; locally it needs
 * Chrome installed (CHROME_PATH overrides discovery).
 * `test/pwa-assets.test.ts` guards the precache contract without a browser.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const PORT = 4173;
const CDP_PORT = 9222;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

// ------------------------------------------------------------------ preflight
if (!existsSync(join(DIST, "index.html"))) {
  console.error("dist/index.html not found — run `npm run build` first.");
  process.exit(2);
}

const CHROME = [
  process.env.CHROME_PATH,
  process.env.CHROME_BIN,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((p) => p && existsSync(p));

if (!CHROME) {
  console.error("No Chrome/Chromium found. Set CHROME_PATH to the executable.");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -------------------------------------------------------------- static server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, "index.html");
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const APP = `http://127.0.0.1:${PORT}/`;

// ---------------------------------------------------------------------- chrome
const profile = await mkdtemp(join(tmpdir(), "cfc-verify-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    // CI runners run Chrome as root/sandboxed containers.
    ...(process.env.CI ? ["--no-sandbox", "--disable-dev-shm-usage"] : []),
    "about:blank",
  ],
  { stdio: "ignore" }
);

let version;
for (let i = 0; i < 60 && !version; i++) {
  try {
    version = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();
  } catch {
    await sleep(250);
  }
}
if (!version) {
  chrome.kill();
  server.close();
  console.error("Chrome did not expose the DevTools Protocol.");
  process.exit(2);
}
console.log(`browser: ${version.Browser}`);

// ----------------------------------------------------------------- CDP client
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  const entry = msg.id && pending.get(msg.id);
  if (!entry) return;
  pending.delete(msg.id);
  if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
  else entry.resolve(msg.result);
});

const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`timeout: ${method}`));
    }, 30_000);
  });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Network.enable", {}, sessionId);
// Desktop viewport: the sidebar (and so the app's name) is `hidden lg:flex`.
await send(
  "Emulation.setDeviceMetricsOverride",
  { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false },
  sessionId
);

const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId
  );
  if (exceptionDetails) throw new Error(`${exceptionDetails.text} :: ${expression}`);
  return result.value;
};

// -------------------------------------------------- 1. online load + SW install
console.log("\n[1] loading the app online…");
await send("Page.navigate", { url: APP }, sessionId);
await sleep(2500);

const registered = await evaluate(`navigator.serviceWorker.ready.then((r) => !!r.active)`);
const cacheState = await evaluate(`
  (async () => {
    const names = await caches.keys();
    const shell = names.find((n) => n.startsWith("cfc-shell-"));
    if (!shell) return { shell: null, cached: 0 };
    const keys = await (await caches.open(shell)).keys();
    return { shell, cached: keys.length };
  })()
`);
console.log(`    service worker active: ${registered}`);
console.log(`    cache name:            ${cacheState.shell}`);
console.log(`    precached entries:     ${cacheState.cached}`);

// The offline indicator renders only while offline, so it is not part of the
// shell contract. Hide it before reading the text the shell is compared on.
const SHELL_TEXT = `(() => {
  const badge = document.querySelector("[data-offline-badge]");
  if (badge) badge.style.display = "none";
  return document.getElementById("root").innerText;
})()`;

const onlineText = await evaluate(SHELL_TEXT);
console.log(`    rendered text length:  ${onlineText.length}`);

// ------------------------------------------------------- 2. go offline, reload
console.log("\n[2] cutting the network and reloading…");
await send(
  "Network.emulateNetworkConditions",
  { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 },
  sessionId
);
await sleep(500);

// Prove the network is really dead before trusting the reload. A same-origin
// probe would be answered by the worker, so probe cross-origin instead.
const navOnline = await evaluate(`navigator.onLine`);
const crossOriginDead = await evaluate(`
  fetch("https://example.com/__cfc_probe__", { mode: "no-cors" })
    .then(() => false).catch(() => true)
`);
console.log(`    navigator.onLine:      ${navOnline}`);
console.log(`    cross-origin dead:     ${crossOriginDead}`);

await send("Page.reload", { ignoreCache: true }, sessionId);
await sleep(3500);

const offlineText = await evaluate(SHELL_TEXT);
const hasShell = await evaluate(`document.body.innerText.includes("Couple Finance")`);
const swControls = await evaluate(`!!navigator.serviceWorker.controller`);

console.log(`    rendered text length:  ${offlineText.length}`);
console.log(`    app shell present:     ${hasShell}`);
console.log(`    SW controls the page:  ${swControls}`);

// --------------------------------------------------------------------- verdict
const ok =
  registered &&
  cacheState.cached > 0 &&
  !navOnline &&
  crossOriginDead &&
  swControls &&
  offlineText.length > 1000 &&
  offlineText === onlineText &&
  hasShell;

console.log(
  `\n${ok ? "PASS" : "FAIL"} — cold offline start ${
    ok ? "renders the identical app shell from the service-worker cache" : "did not render"
  }`
);

chrome.kill();
server.close();
await sleep(1000); // let Chrome release its profile handles before cleanup
await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
process.exit(ok ? 0 : 1);
