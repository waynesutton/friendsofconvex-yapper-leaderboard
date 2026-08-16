# Metric definitions, honest post counts, and column tooltips

Created: 2026-08-16 02:45 UTC
Last Updated: 2026-08-16 02:58 UTC
Status: Done

## Problem

Public feedback on the board, from the person sitting at rank 1:

> "49 posts and 75k engagements? How is this being measured lol that is way off"

The board showed Theo at 49 posts, 75,465 engagements, and 4.94M impressions. Nothing on
the page said what a "post" is or what an "engagement" is, so the numbers looked invented.

## Investigation

Production values, read from `profiles:listLeaderboard` on the prod deployment:

| field | prod value |
| --- | --- |
| currentPosts | 49 |
| currentEngagements | 75,465 |
| currentImpressions | 4,939,824 |
| lastSyncedAt | 2026-08-15 23:24 UTC |

A direct X API v2 replay of the exact request `convex/xSync.ts` makes, three hours later:

| counting rule | posts | board engagement sum | impressions |
| --- | --- | --- | --- |
| board rule (`exclude=retweets,replies`) | 50 | 75,047 | 4,902,574 |
| exclude retweets only | 232 | 84,604 | 5,843,684 |
| no exclude at all | 200 (page capped) | 73,267 | 4,665,752 |

### Root cause: this is a definition problem, not a sync problem

1. **The stored numbers are faithful to the X API.** A resync reproduces them (49 vs 50,
   75,465 vs 75,047, the drift is just three hours of new activity). No resync is needed
   and no resync would change the complaint.

2. **"Posts" does not mean what a reader thinks it means.** The board counts original
   posts only. In the same seven days Theo published 232 non-repost items. The board
   reported 49. Both numbers are true, but the column is labeled "Posts" with no
   qualifier, so 49 reads as flatly wrong.

3. **`exclude=replies` leaks replies.** Breaking the board's own 50 results down by
   `referenced_tweets` type: 18 original, 22 quote posts, and **10 replies**. X's
   `exclude` filter does not remove self-thread replies, so the column is not even
   internally consistent with the rule it claims to apply.

4. **"Engagements" is a custom formula that collides with a familiar X term.** The board
   sums `like + retweet + reply + quote + bookmark` from `public_metrics`. X's own
   analytics screen defines engagements far more broadly (link clicks, profile visits,
   detail expands, follows), which produces a much larger number for the same posts.
   Two different quantities are wearing the same name. Bookmarks alone are 8,611 of the
   75,047, about 11 percent.

5. **The freshness copy was wrong.** The hero panel said "Daily at 08:00 UTC". The cron
   in `convex/crons.ts` runs at `17 15 * * *`, which is 15:17 UTC.

## Solution

Make each number match its label, then say the formula out loud everywhere the number
appears. No ranking or scoring change.

1. Filter replies server side in the sync so "Posts" really is original posts plus quote
   posts. Request `referenced_tweets` and skip anything referencing `replied_to` or
   `retweeted`, instead of trusting X's `exclude` parameter.
2. Add a reusable accessible `MetricInfo` tooltip and attach a plain language definition
   to every metric column header in both board modes.
3. Add a "How this is measured" link in the board toolbar so mobile, where the table
   header is hidden, still has a route to the definitions.
4. Rewrite the About page methodology sections with the exact formulas.
5. Fix the refresh time copy to match the cron.

## Files to change

- `convex/xSync.ts` — request `referenced_tweets`, skip replies and reposts, comment why.
- `src/components/MetricInfo.tsx` — new tooltip component.
- `src/components/Leaderboard.tsx` — per column definitions, `headerCell` hint argument,
  toolbar link, corrected refresh copy.
- `src/globals.css` — `MetricInfo` styles for both themes.
- `src/pages/AboutPage.tsx` — exact measurement copy.
- `task.md`, `changelog.md`, `files.md` — docs sync.

## Edge cases

- Posts with no `referenced_tweets` field stay counted; only explicit reply and repost
  references are dropped.
- The Convex mention scan reuses the same filtered post list, so Convex post counts stay
  consistent with the Posts column instead of drifting from it.
- The tooltip must not break the CSS grid. It renders inside the existing
  `[role="columnheader"]` span, which becomes an inline flex row.
- The table header is `display: none` under the mobile breakpoint, so tooltips there are
  unreachable by design; the toolbar link covers that case.
- Tooltip opens on hover and on focus, closes on Escape, outside pointer down, and blur,
  and is click toggleable for touch.
- Numbers drop for everyone after the next sync. Expected, and now defensible.

## Verification

- [x] Replayed the live X API request for the rank 1 account and confirmed the stored
      values match the API under the board's rule.
- [x] Counted `referenced_tweets` types to prove replies leak through `exclude=replies`.
- [x] `npx tsc --noEmit` clean.
- [x] `npm run lint` clean.
- [x] `npm run build` clean.
- [x] `npx convex dev --once` deployed, then `xSync:refreshAllScheduled` ran on dev and
      the same real account's snapshot `postCount` moved from 42 to 26, which is the
      reply leakage being removed.

## Task completion log

- 2026-08-16 02:45 UTC — Investigation complete, root cause confirmed as definitional.
- 2026-08-16 02:58 UTC — Reply filter, tooltips, toolbar link, About copy, and the cron
  copy fix all shipped and verified. Remaining step is a single production sync so the
  live board picks up the corrected post counts.
