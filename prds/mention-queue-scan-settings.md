# Mention queue scan settings

Created: 2026-10-02 07:15 UTC
Last Updated: 2026-10-02 07:18 UTC
Status: Done

## Problem

The @convex mention scan schedule is hardcoded in `convex/crons.ts` (every 6 hours). Admins cannot change how often it runs without a code change and deploy, and there is no way to pause the feature, for example during an X spend cap month or on a fork that does not want it.

## Proposed solution

- Store two settings on the existing `mentionScanState` singleton: `enabled` (missing means true) and `intervalHours` (1, 4, or 6; missing means 6, the recommended default).
- Convex crons are static, so the cron goes back to hourly at minute 41 and the scheduled action decides whether a scan is due. A run that is off or not due returns before any X call, so it costs nothing on the X side.
- Due rule: no scan yet, or the last scan was at least `intervalHours` ago, with a 10 minute grace so cron jitter never pushes a 6 hour scan to 7 hours. A Scan now press resets the clock, so the next automatic scan does not repeat it.
- Admin mutation `setScanSettings` and the settings returned by `getScanStatus`.
- `/admin/queue` gets an Automatic scans panel using the Board settings fieldset style: an on/off checkbox and three radio options (Every hour, Every 4 hours, Every 6 hours, recommended). The banner shows the schedule and when the next scan is due.
- Turning the feature off stops all X reads (automatic and Scan now). Queue data stays, Add to board and Dismiss still work, and the daily recount keeps aging the window because it never calls X.

## Files to change

- `convex/schema.ts`, `convex/mentionQueue.ts`, `convex/crons.ts`
- `src/components/MentionQueuePanel.tsx`, `src/globals.css`, `src/pages/AdminDocsPage.tsx`
- `tests/mentionQueue.test.ts`
- `task.md`, `changelog.md`, `files.md`, `prds/mention-queue.md`

## Edge cases

- No state doc yet: settings save creates it with the defaults for everything else.
- Turning the feature back on after a long pause: the stored `since_id` still works; X returns up to 800 recent mentions and older ones are gone.
- Switching from 6 hours to 1 hour: the next hourly cron run sees the scan is due and runs.

## Verification

- [x] Unit tests for the due rule and for disabled and not due runs skipping X.
- [x] `npx convex dev --once`, `npx tsc --noEmit`, `npx vitest run` (43 tests), eslint, `npm run build`.

## Task completion log

- 2026-10-02 07:15 UTC: PRD written.
- 2026-10-02 07:18 UTC: Settings, hourly gated cron, Automatic scans panel, tests, and docs shipped.
