/// <reference types="vite/client" />

/**
 * Release version, injected at build time from `package.json` by `vite.config.js`
 * and `vitest.config.ts`. Not the Dexie schema version.
 */
declare const __APP_VERSION__: string;
