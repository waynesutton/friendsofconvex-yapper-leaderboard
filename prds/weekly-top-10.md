# Weekly top 10 for every board

Created: 2026-10-26 17:56 UTC
Last Updated: 2026-10-26 18:13 UTC
Status: Done (dev); production deploy pending in task.md

## Problem

Every Friday the team wants to post each board's top 10 for the week on X, with a card, a video, and a link that keeps working. Today a snapshot holds 5 rows, saved days are pruned after a week, and every board is shared by hand one at a time.

## Proposed solution

- **A week is one saved day.** The daily sync already counts a rolling 7 days per person, so Friday's saved ranking is the week. No new aggregation, no extra X API calls.
- **Trigger.** `boardRankings.captureBoard` schedules `weeklyTops.captureBoardWeek` when the saved day is a Friday (Pacific). That runs after the board's numbers are finished, so a halted or long sync never freezes half a week. A Friday re-sync updates the week's pointer.
- **Storage.** The weekly snapshot is a normal `boardShares` document with `period: "week"` and up to 10 rows, so the PNG prewarm, `/og/board/:id.png`, `/b/:id`, `/v/board/:id.mp4`, and `og:video` keep working. `weeklyTops` holds one pointer per board per week (`weekOf`). Shares are never pruned, so the archive outlives the 7 day ranking history.
- **Card.** Above 5 rows the card splits into two columns (1 to 5, 6 to 10) at the same 1200 by 630 size. The subtitle reads "Top 10 for the week ending" plus the date. The 5 row card stays byte for byte the same.
- **Video.** Still rendered in the admin browser. The weekly admin page opens each board's snapshot in the Share video page through `?share=`.
- **Manual capture.** `/admin/weekly` captures any saved day, so a week can go out before the first Friday (last Friday or today). CLI: `npx convex run weeklyTops:captureWeek '{"day":"YYYY-MM-DD"}'`.
- **Public.** `/weekly?week=&board=` shows every visible board's top 10 for a week with Post on X and Copy link.
- **No workflow component.** No flaky external steps: each board capture is one idempotent mutation, and the image route renders on a cache miss.

## Files to change

- `convex/schema.ts` — `boardShares.period`, `weeklyTops`.
- `convex/rankingDays.ts` — `isFriday`.
- `convex/boardShares.ts` — row limit, period in snapshot and hash, `insertBoardShare`.
- `convex/weeklyTops.ts` (new) — captures and queries.
- `convex/boardRankings.ts` — Friday hook.
- `convex/ogArt.ts`, `convex/boardShareRender.ts`, `convex/boardShareVideo.ts`, `convex/sharePages.ts` — card, video inputs, meta.
- `convex/siteDirectory.ts`, `agent-ready.config.json` — `/weekly` in discovery files.
- `src/pages/WeeklyPage.tsx`, `src/components/WeeklyBoards.tsx`, `src/pages/AdminWeeklyPage.tsx`, `src/components/WeeklyAdminPanel.tsx` (new).
- `src/components/ShareVideoPanel.tsx`, `src/pages/BoardSharePage.tsx`, `src/App.tsx`, `src/components/SiteHeader.tsx`, `src/pages/AdminDocsPage.tsx`, `src/pages/AboutPage.tsx`, `src/globals.css`.
- Tests: `tests/weeklyTops.test.ts` (new), `tests/boardShares.test.ts`, `tests/boardVideoFrames.test.ts`.

## Edge cases

- Internal groups never get a weekly share (share links are public). Hidden tabs and hidden groups are skipped at capture and filtered on read.
- A board with no synced rows that day gets no weekly entry.
- A group renamed later keeps its frozen label on the card; the weekly page shows the live name.
- Re-capturing an unchanged week returns the same share id (dedupe by hash).
- Off-Friday manual captures read "week ending" plus that day.
- Removing a profile does not rewrite past weekly shares, same as daily shares.

## Verification

- `npx convex dev --once`, `npm run check`.
- Capture the Oct 23 week on dev, open `/og/board/<id>.png`, `/b/<id>`, and `/weekly`.

## Task completion log

- 2026-10-26 17:56 UTC — PRD written.
- 2026-10-26 18:13 UTC — Shipped on dev. `npm run check` passes (100 tests). Two column card checked with `node scripts/preview-board-og.mjs weekly` and `weekly-convex`; the second metric label overlapped the subtitle, so only the right one stays. Ten row video stagger is 0.06s so the longest label stays under 6s. Captured the Oct 23 week on dev (Yappers and Convex mentions), fetched the PNG, and checked the `/b/` title, description, and canonical with curl. Browser pass on `/weekly`: both cards, deep link focus, phone width, and the `/b/` redirect. Copy link now falls back to `execCommand` when the Clipboard API rejects and says "Copy failed" when both refuse.
