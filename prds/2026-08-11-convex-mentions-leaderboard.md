# Convex mentions leaderboard mode

Created: 2026-08-11 19:50 UTC
Last Updated: 2026-08-11 20:15 UTC
Status: Done

## Problem

The yapper board ranks people by overall seven day impressions. There is no way to see who is posting about Convex specifically. We want a second view that ranks the same people by how often their recent posts mention Convex, using the post data the sync already pulls, with zero extra X API calls.

## Proposed solution

### Backend

1. Sync scan. Add `text` to the tweet fields the sync already requests. Run each post through a word boundary, case insensitive match `/\bconvex\b/i`. Matching posts are Convex posts.
2. Snapshot storage. Store per profile, per snapshot: `convexPostCount`, `convexImpressions`, `convexEngagements`, and `convexPosts` (post id, url, text trimmed to 200 characters, posted date, per post impressions and engagements). Stored posts are capped at 100, the sync per page fetch limit. All new snapshot fields are optional so old snapshots stay valid with no migration.
3. Profile denormalization. Mirror the latest scan onto the profile: `currentConvexPosts`, `currentConvexImpressions`, `currentConvexEngagements`, `convexScannedAt`. All optional. A profile without `convexScannedAt` reports "not scanned yet" and the UI points to Rescan.
4. Query mode. `listLeaderboard` takes an optional `mode` arg. Default mode is byte for byte the current behavior. `convex` mode reads the same active profiles through the same index, then sorts by Convex post count, Convex impressions, Convex engagement, and overall impressions as the final tiebreaker. Convex mode rows also carry `convexWeeklyChange` (latest snapshot count minus the closest snapshot at least seven days older) and `convexStreak` (consecutive seven day buckets, anchored to the latest snapshot windowEnd, never the wall clock, that contain at least one snapshot with a Convex post). Streak lookback is capped at 12 weeks and snapshot reads are bounded per profile.
5. Expanded posts. A separate `getConvexPosts` query returns the stored posts from a profile's latest snapshot so the main query payload stays small.
6. Rank badges. New `rankBadges` table (rank 1 to 3, kind emoji | text | image, value, optional `_storage` id). Admin mutations to set and clear; public query returns badges with defaults (medal emojis) and signed image urls. Badge images are PNG or SVG in Convex file storage via `generateUploadUrl`.
7. Slack digest. No Slack integration exists in this app, so add a minimal one: `slack.postConvexDigest` action (admin) posts the top Convex yappers (rank, handle, Convex posts with share, impressions, streak) using `SLACK_BOT_TOKEN` and `SLACK_DIGEST_CHANNEL` env vars, with an optional channel override arg.

### Frontend

1. Segmented toggle above the board reusing the existing `.import-tabs` pill pattern: "Impressions" and "Convex yappers". Both queries stay subscribed so toggling re-sorts instantly with no refetch flicker.
2. Convex mode columns: Rank, Yapper, Convex posts (7d) as a highlighted pill, Share of posts (x of y), Convex impressions, Convex engagement, Weekly change. Rows with zero Convex posts are dimmed, never hidden.
3. Rows with stored posts get an expand caret revealing linked post text, date, and per post metrics.
4. Streak chip on rows with a streak of 2 or more weeks.
5. Top 3 badges next to the rank in Convex mode.
6. Help lines: zero impressions plan fallback (ranking falls through to engagement automatically via the sort chain; a notice says so) and a "not scanned yet, run a rescan" notice.
7. Admin: "Board settings" section with the three badge editors; the per row Refresh and Sync everyone buttons get tooltips saying they re-pull posts and rescan for Convex mentions; a "Post Slack digest" button.

### Deviation from the prompt

The public board has no sync button (sync is admin only in this app), so the "Rescan" rename lands on the admin buttons plus a rescan hint in Convex mode instead of a public board button.

## Files to change

- `convex/schema.ts` - optional snapshot and profile fields, `rankBadges` table
- `convex/validators.ts` - profile validator additions, leaderboard row, convex post, badge validators
- `convex/xSync.ts` - fetch text, scan mentions, pass convex data to the mutation
- `convex/profiles.ts` - `listLeaderboard` mode, `getConvexPosts`, `recordSyncSuccess` additions, internal digest query
- `convex/badges.ts` - new
- `convex/slack.ts` - new
- `convex/convex.config.ts` - `SLACK_BOT_TOKEN`, `SLACK_DIGEST_CHANNEL`
- `src/components/Leaderboard.tsx` - mode toggle and Convex view
- `src/components/AdminPanel.tsx` - board settings, digest button, tooltips
- `src/globals.css` - mode tabs, convex grid, pill, expand panel, badge editor styles

## Edge cases

- Old snapshots without convex fields: profile has no `convexScannedAt`, row shows "not scanned yet" and stays dimmed at the bottom of the convex ranking (zero counts, overall impressions tiebreak).
- X plan returns zero impressions: sort chain falls through to engagement on its own; help line appears when scanned rows have posts but zero total convex impressions.
- Deleted badge image: `getUrl` returns null, UI falls back to the default medal.
- Query determinism: streak and weekly change anchor to snapshot `windowEnd`, never `Date.now()` inside the query.
- Post text with uppercase or punctuation around "Convex": word boundary regex handles it; "convexity" does not match.

## Verification steps

- `npm run lint` and `npm run typecheck` pass.
- Toggling views re-sorts instantly with both queries subscribed.
- An account with zero Convex posts shows dimmed with a zero pill, not missing.
- Old snapshots load without errors and show the rescan hint.
- Default mode results are unchanged.

## Task completion log

- 2026-08-11 19:50 UTC - PRD written, implementation started.
- 2026-08-11 20:15 UTC - Feature complete. Schema, sync scan, mode query, badges, Slack digest, board UI, and admin settings all shipped. Lint, typecheck, and production build pass. Smoke tested both leaderboard modes, `getConvexPosts`, and `listRankBadges` on the dev deployment; pre-feature rows report the not-scanned state correctly and the default ranking is unchanged.
