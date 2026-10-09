# Stale board after an X spend cap halt

Created: 2026-10-09 23:00 UTC
Last Updated: 2026-10-09 23:17 UTC
Status: Done

## Problem

Luke Whiting (@thelukewhiting) sits at #7 on the Convex Team board with 14 posts, 116 engagements, and 4K impressions. His Oct 8 post has 750K views and 8.6K likes. The board chip says "Updated 34m ago", so it looks like the numbers are current and wrong.

## Root cause

Prod data, read 2026-10-09 23:00 UTC:

- Luke last synced 2026-10-08 15:17 UTC (8:17 AM Pacific). His post went up the evening of Oct 8, after that sync.
- The Oct 9 15:17 UTC cron hit "Your monthly spend cap has been reached." on the very first profile in join order (@waynesutton, 15:17:04 UTC) and halted, as designed. Zero profiles synced on Oct 9.
- The Oct 8 run also halted, at @Hamzaa_i (15:18 UTC), so 34 profiles that joined since Oct 2 still show Oct 7 numbers.
- Every halted row keeps `syncStatus: "synced"`, so the board notice never fires. Only 3 rows carry the spend cap error, while 8 "Could not find user" rows outnumber it, so the most common error is not even the cap.
- The freshness chip shows the newest `lastSyncedAt` of any row. Three admin rescans after the cap was raised (22:07 to 23:08 UTC) made the whole board read "34m ago".
- Nothing retries after a halt. Raising the spend later does not refill the board until the next 8:17 AM run.

## Proposed solution

- A `syncRuns` singleton records when the last full pass started, when it finished, and when and why a pass halted.
- `getSyncHealth` returns `boardSyncedAt` (start of the last finished full pass) and a halt notice when the newest pass stopped early. The chip and hero use `boardSyncedAt`, so one manual rescan no longer passes as a board update.
- The board notice says the numbers are from the last full sync and that the newest run was stopped by X.
- A halted run retries itself every 2 hours from the page where it stopped, up to 6 times. Each retry costs one request while X still refuses. A fresh cron or a manual Sync everyone resets the chain.
- `groups.refreshMembers` rescans only one group's active members. Groups admin gets a Rescan members button. Runs past the action deadline continue in the background.
- `getSyncHealth` reads up to `BOARD_MAX` profiles instead of 250.

## Files to change

- `convex/schema.ts`, `convex/syncRuns.ts` (new), `convex/xSync.ts`, `convex/profiles.ts`, `convex/groups.ts`
- `src/components/Leaderboard.tsx`, `src/components/GroupsPanel.tsx`
- `tests/syncRuns.test.ts` (new)

## Edge cases

- First deploy has no `syncRuns` doc. The chip falls back to the newest row time, as today.
- A retry that finds a newer pass already started stops without syncing.
- Group rescan stops at the first spend cap error, like the full run.
- Legends and archived members are skipped by the group rescan.

## Verification

- `npx convex dev --once`, `npx tsc -b`, eslint, `npx vitest run`, `npm run build`.
- After deploy, run Sync everyone once so the board refills today.

## Task completion log

- 2026-10-09 23:00 UTC: Root cause confirmed from prod data.
- 2026-10-09 23:17 UTC: Shipped to dev; typecheck, lint, 64 tests, and build pass.
