# Vinext development startup fix

Created: 2026-08-09 05:15 UTC  
Last Updated: 2026-08-09 05:48 UTC  
Status: Complete

## Problem

`npm run dev` exits before serving the app. The terminal reports a Vite native-config warning, a failed TypeScript Next config import, a legacy tsconfig-path plugin warning, and `Space_Grotesk is not a function`.

## Root cause

- The shell currently resolves Node 20.20.1 even though this project declares Node 22.13 or newer and current Vinext requires `node:fs/promises.glob`.
- The user's `~/.zshrc` explicitly prepends Homebrew `node@20`, so package installs and project version files cannot change the selected runtime.
- The empty `next.config.ts` is imported directly by Vinext 0.0.7. Node 20 does not load that TypeScript module in this path.
- `vite.config.ts` imports the local Sites plugin without its `.ts` extension, which Vite 8 flags for its planned native config loader.
- Vinext 0.0.7 targets Vite 7, while the app uses Vite 8.2.1. That mismatch causes obsolete-plugin warnings and incompatible build options.
- Vinext 0.0.7's `next/font/google` shim does not expose `Space_Grotesk` as a named export. The layout calls the missing export during worker startup.
- The app did not declare Next for TypeScript module definitions, and its custom worker targeted an older Vinext image API.

## Proposed solution

1. Replace the empty TypeScript Next config with an equivalent ESM `.mjs` config.
2. Use Vinext's dynamic Google-font loader so Space Grotesk works with the installed Vinext release.
3. Add the explicit `.ts` extension for the local Vite plugin and enable TypeScript import extensions.
4. Enable Vite 8's native tsconfig path resolver.
5. Keep the worker and font paths compatible with the installed Vinext API.
6. Add project Node-version files and a startup check so common version managers select Node 24 and unsupported terminals fail clearly.
7. Verify development startup, rendering, dependency installation, and production checks under Node 24.

## Files to change

- `app/layout.tsx`
- `vite.config.ts`
- `tsconfig.json`
- `next.config.ts`
- `next.config.mjs`
- `.nvmrc`
- `.node-version`
- `package.json`
- `package-lock.json`
- `worker/index.ts`
- `scripts/check-node-version.mjs`
- `SETUP_GUIDE.md`
- `task.md`
- `changelog.md`
- `files.md`

## Edge cases

- A developer still invokes npm from a globally installed Node 20 binary.
- The Vite plugin list contains nested or falsy plugin entries.
- Production Google-font handling differs from development CDN loading.
- The empty Next config is removed without changing any app behavior.
- Port 3000 is already occupied by an earlier server.

## Verification

- Confirm `npm run dev` stays running under Node 24 without the reported warnings or font crash.
- Request `/` and confirm HTTP 200.
- Run lint, TypeScript, and the production build.
- Confirm the homepage retains all three intended font families.

## Task completion log

- 2026-08-09 05:15 UTC: Reproduced the environment and inspected Vinext 0.0.7, Vite 8.2.1, the font shim, Next config loader, and Vite warning source. Root causes confirmed.
- 2026-08-09 05:34 UTC: Modernized config and worker compatibility paths, added Node 24 selection guidance and preflight checks, and completed validation.
- 2026-08-09 05:34 UTC: `npm run check` passed under Node 24; `npm run dev` served `/` with HTTP 200 and retained Space Grotesk. Production dependency audit reported zero vulnerabilities.
- 2026-08-09 05:34 UTC: Confirmed an unsupported Node 20 terminal now stops immediately with a clear version message instead of an internal Vinext stack trace.
- 2026-08-09 05:48 UTC: Installed Homebrew Node 24.19.0 and replaced the forced `node@20` PATH entry in `~/.zshrc` with `node@24`.
- 2026-08-09 05:48 UTC: Reinstated Vinext's dynamic Space Grotesk loader and removed its redundant `vite-tsconfig-paths` plugin for consistent fresh-shell startup.
- 2026-08-09 05:48 UTC: Verified a new login shell selects Node 24, `npm run dev` stays running without the reported errors, and `/` returns HTTP 200 with Space Grotesk.
