# Sync every active profile and align board metrics with X analytics

Created: 2026-08-16 19:50 UTC
Last Updated: 2026-08-16 20:05 UTC
Status: Done

## Summary

GitHub issue 2 reports two real problems: the daily sync silently skips the
highest scoring profiles once the board passes 100 people, and the board's
metric definitions still diverge from what people see in their own X
analytics. This PRD fixes the sync so every active profile refreshes on
schedule, widens the counting rules toward what X analytics shows, and makes
every public description of the ranking agree with the code.

Reference: https://github.com/waynesutton/friendsofconvex-yapper-leaderboard/issues/2
Commits reference the issue with `Refs #2`. Never `Fixes` or `Closes`.

## Problem

1. `xSync.syncAllProfiles` asks `profiles.listForSync` for `{ limit: 100 }`.
   `listForSync` hard caps at 100 and reads `by_active_and_current_impressions`
   without `.order("desc")`. Convex indexes default to ascending, so the job
   refreshes the 100 lowest impression profiles and skips the top 19 on a 119
   person board. `@theo` stays stale until an admin refreshes by hand.
2. Posts excluded replies while X analytics counts them, so the board number
   read as flatly wrong to the people being measured.
3. Convex mention matching only looked at the top level `text` of original and
   quote posts. Replies about Convex, long form note text, and `convex.dev`
   links behind `t.co` wrappers were invisible.
4. Ranking copy disagreed with the code: the homepage ranks by public
   engagement, but the screen reader heading, `llms.txt`, sitemap description,
   and the generated public directory all said or used impressions.

## Root cause

- Sync targets were selected by current score through an index whose default
  ascending order nobody overrode, capped at a number nobody revisited when
  the board grew past 100.
- Metric rules accreted one definition at a time without checking them against
  the X analytics numbers members compare against.

## Proposed solution

### Sync: score blind, unbounded, batched

- New index `by_active_and_added_at` on `["active", "addedAt"]`.
- `listForSync` becomes cursor paginated over that index (join order, never
  score order) using Convex `.paginate()`.
- `syncAllProfiles` drains pages sequentially (X rate limits) with an eight
  minute in-action deadline. If profiles remain, it schedules
  `internal.xSync.refreshAllContinuation` with the cursor and running totals,
  which repeats until done. A 119 person board still finishes in one action;
  a 500 person board can never time out.
- Result gains `remainderScheduled` so the admin panel can say the rest is
  running in the background.

### Metrics: count what X analytics counts, where the public API allows

- Posts = original posts, quote posts, and replies from the last 7 days.
  Reposts stay out. `exclude=retweets` only; the `referenced_tweets` filter
  now drops only `retweeted`.
- Engagements formula unchanged (likes + reposts + replies + quotes +
  bookmarks from `public_metrics`). The public API cannot see X analytics'
  private engagements (link clicks, profile visits, detail expands); tooltips
  and About keep saying so.
- Convex post = any counted post whose top level text, long form
  `note_tweet.text`, or expanded / unwound URL (plus URL title and
  description) matches whole word `convex`. `convex.dev` links match. Pure
  parsing moves to `convex/xSyncParsing.ts` so tests need no network.

### Copy: engagement rank everywhere

- Leaderboard sr-only heading, About, README, `siteDirectory.ts` blurbs say
  the Yappers board ranks by public engagement.
- `siteFiles.listPublicDirectory` sorts like `listLeaderboard` (synced first,
  then engagements, impressions, posts, addedAt) so sitemap.md order matches
  the homepage.
- Tooltips updated: Posts includes replies; Convex posts names replies, long
  posts, and convex.dev links.

### Tests

- vitest + convex-test + @edge-runtime/vm, tests in `tests/`, outside
  `convex/` so the Convex bundler never sees them.
- `tests/xSyncParsing.test.ts`: post classification (original, quote, reply,
  repost), engagement field sum, Convex match on text / note text / expanded
  URL / convex.dev, no match on "convexity".
- `tests/profilesListForSync.test.ts`: seed 110 active + inactive profiles
  with mixed scores; paging visits every active profile exactly once,
  regardless of impressions.

## Files to change

- `convex/schema.ts` - add `by_active_and_added_at` index.
- `convex/profiles.ts` - paginated `listForSync`.
- `convex/xSyncParsing.ts` - new pure parsing module (post page parse, repost
  check, Convex haystack match).
- `convex/xSync.ts` - reply inclusive fetch params, batched drain with
  continuation action, `remainderScheduled` in results.
- `src/components/AdminPanel.tsx` - show background remainder in the sync
  message.
- `src/components/Leaderboard.tsx` - sr-only heading, Posts and Convex posts
  tooltip definitions.
- `src/pages/AboutPage.tsx` - sections 02 and 03 plus a ranking sentence.
- `convex/siteDirectory.ts` - engagement rank description.
- `convex/siteFiles.ts` - directory sorted by canonical board order.
- `README.md` - feature line states engagement rank and the post rule.
- `package.json`, `vitest.config.ts`, `tests/` - test setup.

## Edge cases and gotchas

- `refreshAll` keeps returning totals for the profiles it processed inline;
  when the remainder is scheduled the admin message says so instead of
  pretending the run finished.
- Two profiles created in the same millisecond: Convex cursors handle ties,
  which is why `.paginate()` beats a hand rolled `gt("addedAt", cursor)`.
- `\bconvex\b` already matches `convex.dev` (the dot is a word boundary), so
  one pattern covers both the word and the domain, and "convexity" still
  fails the match.
- Stored Convex post text prefers the long form note text when present so the
  expandable row shows the words that actually matched.
- Post counts will move again for everyone on the next production refresh
  (replies coming back in). That is the fix landing, same as the reply
  filter change earlier.

## Verification

- [x] `npm run test` passes: 17 tests, paging covers >100 profiles score
      blind (each exactly once, archived excluded), parsing fixtures classify
      and match correctly.
- [x] `npm run lint`, `npm run typecheck`, `npm run build` pass.
- [x] `npx convex dev --once` deploys schema and functions.
- [x] Dev run of `xSync:refreshAllScheduled` processed all 3 active dev
      profiles with `remainderScheduled: false`. The 2 failures are seed
      handles that do not exist on X; the real account resynced 26 → 116
      posts (replies back in) with 53 Convex posts from the widened scan.
- [x] Live dev `llms.txt` says engagement rank; `sitemap.md` people order is
      the canonical board order (synced rows first, then engagements).
- [ ] Comment on issue 2 with what changed; leave the issue open.

## Task completion log

- 2026-08-16 19:50 UTC - PRD created, implementation started.
- 2026-08-16 20:05 UTC - Implementation, tests, and dev verification done.
  Docs synced. Remaining: issue 2 comment and one production refresh.
