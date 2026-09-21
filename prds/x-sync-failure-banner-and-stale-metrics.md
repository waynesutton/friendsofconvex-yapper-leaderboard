# X sync failures: honest banner, stale metrics, cap short circuit

Created: 2026-09-21 04:30 UTC
Last Updated: 2026-09-21 04:45 UTC
Status: Done

## Problem

On Sep 16 production showed the banner "Handles are live in Convex. Add the X API key to replace Awaiting X with real seven day metrics." while `X_BEARER_TOKEN` was set on the prod deployment. Every metric cell read "Awaiting X" even though the rows still held real numbers from earlier syncs.

## Root cause

The X developer project hit its billing cycle spend cap in the Aug 17 to Sep 17 cycle. Starting partway through the Sep 12 cron run, every `/2/users/by/username` call returned "Your monthly spend cap has been reached." `syncProfile` recorded that as `syncStatus: "error"` on all 184 active profiles. The cap is separate from prepaid credits and auto recharge: when the cycle cap is reached X blocks requests until the next cycle, no matter how much credit is loaded. The cycle reset on Sep 17 and the cron recovered on its own (181 synced, 3 unrelated errors on Sep 21).

Three code problems made the outage look like a config mistake:

1. The board banner fires whenever zero rows are `synced` and its copy assumes the only cause is a missing key.
2. Every metric cell hides its stored value unless `syncStatus === "synced"`. `recordSyncFailure` leaves the numbers in place, so the board had the data and refused to show it.
3. `syncBatchesFrom` keeps calling X for all 184 profiles after the first cap error, once a day, for as long as the cap holds. Each call fails the same way.

## Proposed solution

- Add a public `profiles.getSyncHealth` query: whether the key is set, counts of active rows by state, and the most common `syncError` among failing rows. No PII, only the X API message string.
- Treat a row as having metrics when `syncStatus === "synced"` or `lastSyncedAt !== null`. Apply that in `compareYapperRows` (server ranking), the client sort, the metric cells, the freshness chip, and the profile peek. "Awaiting X" stays for rows that have never synced.
- Banner copy branches on real state: missing key, sync failing with no metrics yet, sync failing with stale metrics on display, or first sync not run yet.
- `xSync.syncBatchesFrom` stops the run at the first spend cap error and reports `haltedReason`. `refreshAll` returns it so the admin Sync everyone feedback says why it stopped. The cron logs it.

## Files to change

- `convex/profiles.ts`: `compareYapperRows` groups on has metrics; new `getSyncHealth` query.
- `convex/xSyncParsing.ts`: `isSpendCapError` helper.
- `convex/xSync.ts`: short circuit in `syncBatchesFrom`, `haltedReason` in the refresh result.
- `src/components/Leaderboard.tsx`: `hasMetrics` helper, banner branches, cell and sort conditions.
- `src/components/ProfilePeek.tsx`: followers show for rows with metrics.
- `src/components/AdminPanel.tsx`: Sync everyone feedback shows `haltedReason`.
- `tests/groups.test.ts`, `tests/xSyncParsing.test.ts`: cover the new grouping and the cap matcher.

## Edge cases

- A row that errored before ever syncing (`lastSyncedAt === null`) still shows "Awaiting X" and still sorts after rows with numbers.
- Partial failures (a few handles renamed or suspended) do not trigger the banner; only zero synced rows does.
- A halted cron run leaves untouched profiles at their previous `synced` status, so the board shows the last good numbers plus the freshness chip.
- `isSpendCapError` matches "spend cap", "usage cap", and "UsageCapExceeded" so X wording changes still stop the run.

## Verification steps

- `npx tsc --noEmit`
- `npx vitest run`
- `npx eslint` on touched files
- `npx convex dev --once` pushes clean
- Browser: board with a mix of synced and error rows shows numbers for every row with a `lastSyncedAt`.

## Task completion log

- 2026-09-21 04:30 UTC: Diagnosed on prod via `npx convex env list --prod` and `npx convex data profiles --prod`. PRD written.
- 2026-09-21 04:45 UTC: All changes in. `npx convex dev --once` clean, `npx tsc --noEmit` clean, `npx vitest run` 32 passing (3 new), eslint clean on touched files, `npm run build` clean, `getSyncHealth` returns the expected shape on dev. Not yet deployed to production.
