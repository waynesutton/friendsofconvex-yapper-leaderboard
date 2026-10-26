# Daily board rankings with a 7 day history

Created: 2026-10-26 04:16 UTC
Last Updated: 2026-10-26 04:31 UTC
Status: Done

## Problem

The board only shows the live ranking. Nobody can look back at yesterday's Yappers order, and a shared card or video never says which day it came from. People want to step through the last week of each board, share a past day on X, and make the admin video for a past day, with the date clearly on every surface.

## Proposed solution

Save each board's ranking once a day and keep 7 days.

- **When.** `syncRuns.finish` schedules `boardRankings.captureAll` after every full board pass. Halted passes never finish, so a day with no good data leaves a gap instead of a stale copy under a new date. The day key is the Pacific date of the pass start.
- **What.** Yappers, Convex mentions, and every visible group (internal ones too, admin read only). Legends has no daily ranking and is skipped.
- **How.** One job per board (fan out keeps each transaction small). Rows come from `loadBoardRows`, the same path the live board reads, so a saved day matches what the board showed. Zero extra X API calls.
- **Storage.** `boardRankings` holds light metadata for the day list. `boardRankingRows` holds the rows (capped at `BOARD_MAX`, no bios) and is read only when someone opens a day. Same board and day upserts, so a later Sync everyone replaces the morning copy. Days older than 7 are pruned after each capture.
- **Board UI.** A day navigator next to the freshness chip: previous and next arrows around the date. Live reads "Today · Sun, Oct 25". A past day sets `?day=YYYY-MM-DD`, swaps the table to the saved rows (live bios and avatars merged in by profile id), shows a notice with a Back to today button, and disables Convex post expansion.
- **Sharing.** `createBoardShare({ board, day })` freezes rows from the saved ranking and stores `rankingDay`. The card subtitle becomes "Top 5 on Sat, Oct 24, 2026" and the as-of line names the saved ranking. The video uses the same layout, so it carries the date too. `/b/:id` meta names the date and the browser redirect lands on `?board=...&day=...`.
- **Admin video.** The share video page gets a day picker and passes the day through.

## Files to change

- `convex/rankingDays.ts` (new) — pure Pacific day helpers and `RANKING_HISTORY_DAYS`.
- `convex/schema.ts` — `boardRankings`, `boardRankingRows`, `boardShares.rankingDay`.
- `convex/boardRankings.ts` (new) — capture, prune, `captureNow`, `listDays`, `getRanking`, scrub on remove.
- `convex/profiles.ts` — `trusted` option on `loadBoardRows`; `remove` scrubs stored rankings.
- `convex/syncRuns.ts` — schedule the capture from `finish`.
- `convex/boardShares.ts`, `convex/boardShareRender.ts`, `convex/boardShareVideo.ts`, `convex/sharePages.ts`, `convex/ogArt.ts` — the day on shares, cards, meta, and video inputs.
- `src/components/Leaderboard.tsx`, `src/components/ShareVideoPanel.tsx`, `src/pages/BoardSharePage.tsx`, `src/globals.css` — UI.
- `src/pages/AdminDocsPage.tsx`, `src/pages/AboutPage.tsx` — docs.
- `tests/boardRankings.test.ts` (new), `tests/boardVideoFrames.test.ts`, `tests/boardShareVideo.test.ts`.

## Edge cases

- A sync halted all day leaves a gap; arrows skip to the nearest saved day.
- A halted pass resumed after midnight saves under the day it started.
- Hidden tabs and hidden groups are captured but unreadable while hidden. Internal groups read only for admins.
- Group, mute, and legend changes after capture do not rewrite history.
- Permanent profile remove strips that person from saved rankings.
- An unknown or pruned `?day=` falls back to the live board with a notice and a Dismiss button. The param stays in the URL until dismissed (no state change inside an effect), and Copy link drops it.
- Before the 8:17 AM PT pass, yesterday's saved ranking looks close to live. Each day shows its saved time.
- Queries never read the wall clock: `listDays` returns every saved day and the client drops today.

## Verification

- `npx convex dev --once` for codegen and schema push.
- `npm run check` (typecheck, lint, tests, build).
- `npx convex run boardRankings:captureNow` on dev to seed a day.
- Browser: arrows, past day view, Back to today, Post on X card PNG for a past day.

## Task completion log

- 2026-10-26 04:16 UTC — PRD written.
- 2026-10-26 04:20 UTC — Schema, capture, sharing, card, board navigator, video day picker, and tests done. `npm run check` passes (89 tests). `npx convex dev --once` pushed the schema.
- 2026-10-26 04:31 UTC — Verified on dev. Arrows step Oct 25 to Oct 24 and set `?day=`, the Convex mentions pill keeps the day, Back to today drops it. A dated share's `/og/board/<id>.png` reads "Top 3 on Sat, Oct 24, 2026", and `/b/<id>` title, description, and canonical carry the date. `getForRender` returns `rankingDay` for the video. The signed in video panel was not clicked through (admin X session needed). Admin docs and About updated.
