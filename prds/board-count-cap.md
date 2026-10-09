# Board count cap

Created: 2026-10-09 20:30 UTC
Last Updated: 2026-10-09 20:45 UTC
Status: Done

## Problem

The admin roster heading said "250 profiles" and the public hero said "248 Friends of Convex". Neither was true. Prod holds 267 profiles: 264 on the ranked board, 2 legends, and 1 pending join request.

## Root cause

Every board read stopped at 250 rows.

- `profiles.listAdmin` returned the newest 250 profiles of any status, so the heading capped at 250.
- `loadBoardRows` took the top 250 active profiles by impressions, then dropped the 2 legends, which left 248. The 16 lowest-impression members never reached the public board, its search, the share cards, or the discovery files.

## Proposed solution

- One shared `BOARD_MAX = 1000` in `convex/boardLimits.ts`, used by the board queries, admin roster, gift picker, share cards, discovery files, and the client subscriptions.
- The Convex mentions board read up to 90 snapshots per person on every load. At 250 people with full history, that is about 22,500 documents and 15 MB, close to the 16 MiB read limit. Store the weekly change, streak, and stored post count on the profile during `recordSyncSuccess`, and read those. Profiles without stored values fall back to the history read until their next daily sync.
- The admin heading shows the total plus a breakdown: on the board, legends, and off the board (archived, pending, declined).

## Files to change

- `convex/boardLimits.ts` (new)
- `convex/schema.ts`, `convex/validators.ts`
- `convex/profiles.ts`, `convex/boardShares.ts`, `convex/siteDirectory.ts`
- `src/components/Leaderboard.tsx`, `src/components/AdminPanel.tsx`, `src/components/GiftAdminPanel.tsx`, `src/globals.css`
- `tests/convexTrend.test.ts` (new)

## Edge cases

- Profiles synced before this change have no stored trend. The fallback history read covers them, and the 8:17 AM Pacific sync backfills everyone.
- A legend keeps stored trend fields, but every ranking already skips legends.
- Group boards keep their own 250 member cap.

## Verification

- `npx tsc -b`, `npx eslint .`, `npx vitest run`, `npm run build`
- `npx convex dev --once` on dev
- After deploying to prod, the hero reads 264 and the admin heading reads 267 profiles with 264 on the board, 2 legends, and 1 off the board.

## Task completion log

- 2026-10-09 20:30 UTC: PRD created after measuring prod counts and snapshot volume.
- 2026-10-09 20:45 UTC: Shipped to dev. tsc, eslint, 60 tests (2 new), and build pass. Prod deploy pending.
