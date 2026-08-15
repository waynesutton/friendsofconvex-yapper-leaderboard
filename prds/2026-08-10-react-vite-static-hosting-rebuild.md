# React Vite rebuild on Convex static hosting

Created: 2026-08-10 05:35 UTC
Last Updated: 2026-08-10 05:35 UTC
Status: In Progress

## Problem

The current frontend is Next.js 16 rendered through Vinext with a Cloudflare
worker entry and a Codex Sites host binding. That stack has a confirmed P0
browser bug: the production bundle compiles `process.env.NEXT_PUBLIC_CONVEX_URL`
to `{}.NEXT_PUBLIC_CONVEX_URL`, so hydration replaces the app with a
configuration screen. The hosting workflow is also hard to operate and the
project is moving off Codex Sites.

## Root cause

- Vinext/Vite does not perform the Next-style `process.env.NEXT_PUBLIC_*`
  replacement in the browser bundle.
- The frontend host, build tool, and runtime were three separate systems with
  three different environment conventions.

## Proposed solution

Rebuild the frontend as a plain Vite React single page app and host it on the
Convex deployment itself with the official
[`@convex-dev/static-hosting`](https://www.convex.dev/components/static-hosting)
component.

- Convex stays the database and backend. Nothing under `convex/` changes except
  two wiring files.
- Convex Auth with X OAuth stays the authentication system.
- App-owned root routing keeps every existing HTTP route at its exact URL:
  `/api/auth/callback/twitter`, `/x-dm/callback`, `/fourthwall/webhook`, and
  `/x-account-activity`. `registerStaticRoutes` adds the static catch-all after
  them, and exact routes win over the catch-all.
- The browser reads `import.meta.env.VITE_CONVEX_URL` with a runtime
  `getConvexUrl()` fallback when served from `*.convex.site`. This closes the
  P0 environment bug.
- react-router-dom replaces the Next App Router. All eight routes are
  preserved.
- Google Fonts link tags replace `next/font` for Geist, Space Grotesk, and
  Geist Mono. The CSS font variables keep the same names.
- Tailwind 4 stays through PostCSS because `globals.css` imports it for the
  reset layer. All theme tokens and classes move over unchanged.
- npm remains the package manager.
- The future domain is `friendsofconvex.dev`. Docs are updated so the domain
  can be attached to the Convex HTTP Actions origin when purchased.

## Files to change

New frontend:

- `index.html` — document shell, theme boot script, fonts, meta and OG tags.
- `src/main.tsx` — React root and router.
- `src/App.tsx` — layout with header, routes, footer.
- `src/providers.tsx` — Convex client and `ConvexAuthProvider`.
- `src/lib/usePageTitle.ts` — per-route document titles.
- `src/globals.css` — moved from `app/globals.css` plus font variable block.
- `src/pages/*` — Home, About, Join, Admin, AdminSetup, AdminGifts, GiftPass,
  GiftShare.
- `src/components/*` — ported components with `next/link` replaced by
  react-router `Link`.

Convex wiring:

- `convex/convex.config.ts` — `app.use(staticHosting)`.
- `convex/http.ts` — `registerStaticRoutes(http, components.staticHosting)`.

Config:

- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`,
  `eslint.config.mjs`, `.gitignore`, `.env.local`.

Removed:

- `app/`, `worker/`, `build/`, `next.config.mjs`, `next-env.d.ts`,
  `tsconfig.tsbuildinfo`, `.next/`, `.vinext/`, `.wrangler/`, `.openai/`,
  stale `dist/`.

Docs:

- `SETUP_GUIDE.md` and `fourthwall-setup.md` rewritten for the new stack and
  the future `friendsofconvex.dev` domain.
- `task.md`, `changelog.md`, `files.md` synced.

## Product rules preserved

- People-only board; no visible copy uses the word "tracked."
- Homepage title stays "Friends of Convex Yapper Leader Board."
- Seven-day original-post metric; replies and reposts excluded.
- Pending join requests stay off the public board.
- `/admin`, `/admin/setup`, `/admin/gifts` stay behind Convex Auth and the
  numeric X ID allowlist. Admin links stay out of the public header and footer.
- Both themes, the header switcher, and local persistence stay.
- Sortable columns, search, share actions, and pagination stay.
- Gift consent, STOP suppression, private token secrecy, and the one-consent
  one-delivery rule are backend behavior and are untouched.

## Edge cases

- SPA fallback must serve `index.html` for deep links like `/gift/<token>`;
  the component does this by default.
- Exact HTTP routes must beat the static catch-all so webhooks keep working.
- `VITE_CONVEX_URL` must never leak a localhost value into a production
  bundle; the static-hosting CLI sets it per target deployment at build time.
- Convex Auth OAuth state uses cookies against the `.convex.site` HTTP Actions
  origin; the SPA origin and callback origin stay the same as today.
- The `?search=` query parameter on `/` must still prefill the leaderboard
  search box.

## Verification steps

1. `npm install` completes.
2. `npx convex dev --once` pushes the component wiring and regenerates types.
3. `npm run lint` passes.
4. `npm run typecheck` passes.
5. `npm run build` passes and `dist/` contains no `NEXT_PUBLIC` references.
6. Local smoke test: `npx convex dev` plus `npm run dev`, homepage renders the
   leaderboard, theme switcher works, `/about`, `/join`, `/admin` render.
7. Production deploy later with `npm run deploy` after owner approval.

## Task completion log

- 2026-08-10 05:35 UTC: PRD created; audit of all frontend source, Convex
  wiring, and the static-hosting integration guide completed.
