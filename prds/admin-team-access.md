# Admin team access from the dashboard

Created: 2026-10-08 22:58 UTC
Last Updated: 2026-10-08 23:05 UTC
Status: Done

## Problem

Adding an admin meant opening the Convex dashboard, finding a numeric X user
ID with a third party lookup tool, and editing the `ADMIN_X_USER_IDS` env
var by hand. There was no way to see who has admin access from inside the
app, and no way to add or remove someone without leaving it.

## Proposed solution

Two tiers of admin:

- **Owners**: the `ADMIN_X_USER_IDS` env list, unchanged. Always admin, never
  removable from the UI. This is the lockout guard and the bootstrap path for
  new forks.
- **Granted admins**: rows in a new `adminGrants` table, added and removed on
  a new `/admin/team` page (Admins tab).

Every admin check (`requireAdmin`, `isAdminViewer`, `isAdminUser`, `viewer`)
goes through one helper, `isAdminXUserId`, that checks the env list then the
grants table. Grants take effect on the next request and the viewer query is
reactive, so a new admin's open tab unlocks without a reload.

Adding someone:

- Type a name or handle. Board profiles match by handle prefix
  (`by_normalized_handle` index range) and by display name (new
  `search_display_name` search index on `profiles`).
- Or type any X handle (or paste an x.com link) and press Look up on X. The
  `admins.lookupHandle` action resolves the numeric ID through the X API.
- Either path opens a confirm card; Grant admin access writes the grant.

Removing: two step Remove on granted rows. Admins can't remove themselves,
and owner rows show the env var instead of a button.

## Files to change

- `convex/schema.ts`: `adminGrants` table, `search_display_name` on profiles
- `convex/authz.ts`: `ownerXUserIds`, `isAdminXUserId`, grants aware checks
- `convex/admins.ts` (new): `list`, `searchCandidates`, `lookupHandle`, `grant`, `revoke`
- `src/components/AdminTeamPanel.tsx`, `src/pages/AdminTeamPage.tsx` (new)
- `src/App.tsx`, `src/components/SiteHeader.tsx`, `src/globals.css`
- Copy: `AdminGate.tsx`, `AdminAccessNote.tsx`, `AdminDocsPage.tsx`, `AdminGiftsGuidePage.tsx`, README
- `tests/admins.test.ts` (new)

## Edge cases

- Env owner also granted: owner wins, the grant is hidden and harmless.
- Board profile with no synced X ID: offer Look up on X instead of granting.
- No `X_BEARER_TOKEN`: lookup fails with a message; board search still works.
- Granting twice: returns `already`, no duplicate row.
- Cap of 50 granted admins keeps the list query bounded.
- Removing yourself is blocked so nobody strands themselves mid session.

## Verification

- `npx convex dev --once`, `npx tsc --noEmit`, eslint on touched files,
  `npx vitest run` (new admin tests), `npm run build`.

## Task completion log

- 2026-10-08 23:05 UTC: shipped backend, page, docs, and tests.
