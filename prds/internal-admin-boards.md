# Internal admin only boards

Created: 2026-08-17 04:13 UTC
Last Updated: 2026-08-17 04:13 UTC
Status: Done

## Problem

Every custom group pill was public. There was no way to run a board the
admins can watch without showing it to visitors, like an internal Convex
team board.

## Proposed solution

An `internal` flag on groups. An internal board keeps every group feature
(members, X List sync, ranking) but its pill renders only for signed in
admins, the leaderboard query blocks everyone else server side, and the
board never enters the discovery files.

## Files changed

- `convex/schema.ts` — `internal: v.optional(v.boolean())` on `groups`.
  Missing means false, so existing groups stay public and no migration runs.
- `convex/authz.ts` — new `isAdminViewer` helper: a non throwing admin check
  for public queries that show extra rows to admins.
- `convex/groups.ts` — `listPublic` skips internal groups unless the viewer
  is an admin and returns an `internal` flag on each row; `listAdmin`
  returns the flag; `update` accepts it.
- `convex/profiles.ts` — `listLeaderboard` with a `groupId` loads the group
  first and returns an empty board when it is internal and the viewer is
  not an admin, so a guessed group id leaks nothing.
- `convex/siteFiles.ts` — `listPublicDirectory` excludes internal groups
  from llms.txt, sitemap.md, and sitemap.xml.
- `src/components/GroupsPanel.tsx` — Make internal / Make public toggle on
  each group card with a lock icon, internal state in the card summary, and
  a note in the How pills work panel.
- `src/components/Leaderboard.tsx` — internal pills render a lock icon so a
  signed in admin can tell the board is not public.

## Edge cases

- A visitor with a direct `/?board=slug` link to an internal board: the pill
  list does not contain the slug, so the frontend falls back to Yappers. If
  someone calls `listLeaderboard` with the raw group id, the query returns
  an empty array.
- An internal board that is also hidden (`visible: false`) stays hidden for
  admins too; visibility still wins.
- Admins see internal pills through the same reactive `listPublic` query, so
  signing in or out updates the pill strip live with no reload.

## Verification

- `npm run check` (lint, typecheck, 27 vitest tests, build) passes.
- `npx convex dev --once` deploys the schema and functions cleanly.
- Manual: mark a group internal in `/admin/groups`, confirm the pill stays
  visible with a lock while signed in as admin, disappears in a private
  window, and `/llms.txt` and `/sitemap.md` drop the group.

## Task completion log

- 2026-08-17 04:13 UTC — Shipped: schema flag, admin aware queries, server
  side guard, discovery exclusion, admin toggle, lock icon pill, docs.
