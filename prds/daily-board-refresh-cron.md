# Daily board refresh at 8 AM Pacific

Created: 2026-08-15 16:53 UTC
Last Updated: 2026-08-15 16:55 UTC
Status: Done

## Problem

`/about` says Convex keeps the board fresh once a day. The job already exists, but it runs at 08:17 UTC (around midnight Pacific), not 8 AM Pacific. Visitors cannot tell that a cron does the work.

## Proposed solution

Keep the existing internal action `internal.xSync.refreshAllScheduled`. Change `convex/crons.ts` to `17 15 * * *` (15:17 UTC). That is 8:17 AM Pacific during daylight time and 7:17 AM during standard time.

Minute 17 stays off the top of the hour. Convex cron expressions are UTC only. Docs: https://docs.convex.dev/scheduling/cron-jobs

Update `/about` section 04 with the 8 AM Pacific copy and a link to those docs.

## Files to change

- `convex/crons.ts`
- `src/pages/AboutPage.tsx`
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Same cron name so Convex updates the existing job instead of adding a second one.
- PST shifts the wall clock to 7:17 AM. Public copy still says 8 AM Pacific.
- Manual admin refresh stays available.

## Verification

- Cron expression is `17 15 * * *` and still calls `internal.xSync.refreshAllScheduled`.
- `/about` states the daily 8 AM Pacific refresh and links to Convex cron jobs.
- Job name is unchanged.

## Task completion log

- 2026-08-15 16:53 UTC — PRD opened.
- 2026-08-15 16:55 UTC — Cron moved to `17 15 * * *`. About copy and cron docs link shipped.
