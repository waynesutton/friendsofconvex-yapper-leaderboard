# @convex mention queue

Created: 2026-10-02 06:51 UTC
Last Updated: 2026-10-02 07:10 UTC
Status: Done

## Summary

An admin only queue at `/admin/queue` lists people on X who mentioned @convex at least twice in the last 30 days and are not on the board yet. It shows 30 at a time with Load more, newest mention first. Each row links to the person's last two mentions and has Add to board and Dismiss buttons.

## Problem

New Convex fans show up in @convex mentions every day. Today an admin has to spot them by hand on X, copy the handle, and paste it into `/admin`. Nobody keeps a running list, so repeat mentioners slip by.

## Root cause (for bugs)

Not a bug. The board only learns about people an admin adds, a self join, or an X List import. Nothing reads @convex mentions.

## Proposed solution

- A cron every 6 hours (minute 41 of 00, 06, 12, 18 UTC; was hourly at first) reads the X mentions timeline for @convex (`GET /2/users/:id/mentions`) with the app only `X_BEARER_TOKEN`, `expansions=author_id`, and `since_id`, so each run only pays for new posts. The first run backfills up to 30 days, capped by X at the 800 most recent mentions.
- Posts land in `mentionPosts` (deduped by post id). One `mentionCandidates` row per author keeps a 30 day mention count and a status: `watching` (1 mention), `queued` (2 or more), `added`, `dismissed`.
- A daily recount demotes people whose mentions aged out of the 30 day window and prunes posts older than 35 days.
- `listQueue` is an admin paginated query over `by_status_and_last_mention_at`, descending, with each person's last two posts attached.
- Add to board upserts the profile through `upsertImportedProfile` with source `mention-queue`, marks the candidate `added`, and schedules a metrics sync for that one profile.
- Scan now button for an on demand run. Spend cap and missing key errors are stored and shown on the page.

## Files to change

- `prds/mention-queue.md` (this PRD)
- `convex/schema.ts` (three new tables, `mention-queue` profile source)
- `convex/validators.ts` (profile source literal)
- `convex/mentionQueue.ts` (new: scan, record, recount, list, add, dismiss, restore, status)
- `convex/imports.ts` (export `requestX` and `parseXUser`)
- `convex/profiles.ts` (`upsertImportedProfile` accepts the new source)
- `convex/xSync.ts` (`refreshOneInternal`)
- `convex/crons.ts` (scan every 6 hours, daily recount)
- `src/pages/AdminQueuePage.tsx`, `src/components/MentionQueuePanel.tsx` (new)
- `src/App.tsx`, `src/components/SiteHeader.tsx`, `src/globals.css`, `src/pages/AdminDocsPage.tsx`
- `tests/mentionQueue.test.ts` (new)
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- People already on the board never enter the queue. The scan and Add to board both check `by_x_user_id`.
- Posts written by @convex itself are skipped.
- Protected or suspended authors are missing from the author expansion, so their posts are skipped.
- The first scan only reaches the 800 most recent mentions. The page notes this until the queue has 30 days of history.
- A spend cap error stops the scan at the first failure and keeps the existing queue.
- Dismissed people stay dismissed even if they keep mentioning @convex. Restore puts them back.

## Verification

- [x] `npx convex dev --once` pushes the schema and functions.
- [x] `npx tsc --noEmit`, `npx vitest run` (40 tests), eslint on touched files, `npm run build`.
- [x] convex-test: two mentions queue, one mention watches, duplicate post ids ignored, recount demotes aged out mentions, Add to board is idempotent, queue pages in date order past 30.
- [x] One scan on dev: 792 mentions over 8 pages (X's 800 cap reached back to Sep 21, about 10 days), 457 authors, 109 queued.
- [ ] Signed in browser pass of `/admin/queue` (needs an admin X session).

## Task completion log

- 2026-10-02 06:51 UTC: PRD written.
- 2026-10-02 07:05 UTC: Schema, backend, crons, page, tests, and docs shipped to dev.
- 2026-10-02 07:18 UTC: Schedule is now an admin setting (off, or every 1, 4, or 6 hours, default 6). See prds/mention-queue-scan-settings.md.
- 2026-10-02 07:10 UTC: Scan moved from hourly to every 6 hours. X bills per post read, and since_id means both schedules read the same posts, so cost barely changes; it cuts requests by 6x. The first dev scan saw about 80 mentions a day, far under the 800 per run cap, so no posts are missed.
