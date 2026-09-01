# Admin yapper search on the main board and groups

Created: 2026-09-01 04:20 UTC
Last Updated: 2026-09-01 04:25 UTC
Status: Done

## Summary

Admins need a name and handle search on the Friends on the board list and on each group member roster. With 180+ people, finding one row to rescan, archive, mute, or retire is currently a long scroll.

## Problem

The public leaderboard already filters the active pill (Yappers, Convex mentions, or a group) by name or @handle. The admin surfaces that manage those same people do not:

- `/admin` Friends on the board lists every profile with no search. A 184 person board is a long scroll to find one handle.
- `/admin/groups` member rosters list every member with no search. Mute, retire, and remove all live on those rows.

There is no error. The lists load. They just cannot be queried.

## Root cause (for bugs)

Not a bug. The gift studio already has compact search. The board ops and groups rosters never grew a matching control.

## Proposed solution

Client side filter on the lists already loaded. Both queries are capped at 250 rows, the same board max, so a Convex search index is not needed.

Match the public board rule: trim, strip a leading @, case insensitive substring on display name and handle.

Reuse the compact gift ledger search pill so admin search looks the same everywhere. Heading count becomes "N of M profiles" (or members) while a term is active. Empty search restores the full list. No matches shows the same "No yappers match that search." copy as the public board.

Also raise `profiles.listAdmin` from 200 to 250 on `/admin` so the roster and search cover the same cap as the public board.

## Files to change

- `prds/admin-yapper-search.md` - this PRD
- `src/lib/yapperSearch.ts` - shared name and handle matcher
- `src/components/AdminPanel.tsx` - search on Friends on the board
- `src/components/GroupsPanel.tsx` - search on each group member roster
- `src/globals.css` - heading action cluster so search sits next to Sync everyone
- `src/pages/AdminDocsPage.tsx` - one line each on board ops and groups
- `task.md`, `changelog.md`, `files.md` - tracking

## Edge cases and gotchas

- Leading @ is ignored so `@weihup` and `weihup` hit the same row.
- An empty or whitespace term shows everyone.
- Armed Confirm remove / retire drafts stay on the profile id. Searching away hides the row; searching back still shows the armed state.
- Sync everyone still syncs every active profile, not just the filtered view.
- Mute, retire, and remove still hit the real membership or profile. Filter is display only.
- Group search is per expanded card, not a global "which group is this person in" lookup.
- Public board search is unchanged. It already filters the active group pill.

## Verification

- [x] Typecheck, eslint on touched files, and vitest (29 tests) pass.
- [x] Public home search still filters the Yappers pill (typed "wayne", only Wayne Sutton remained).
- [ ] Type a display name on `/admin` and only matching rows remain. Heading reads N of M profiles.
- [ ] Type `@handle` and the same row matches. Clear the box and the full list returns.
- [ ] Nonsense term shows "No yappers match that search."
- [ ] Rescan, Archive, Retire, and Remove still work on a filtered row.
- [ ] Same search on an expanded group in `/admin/groups` for mute, retire, and remove.

The signed in `/admin` and `/admin/groups` checks need an admin X session. The IDE browser stops at Continue with X.

## Related

- Public board search: `src/components/Leaderboard.tsx`
- Gift studio compact search: `src/components/GiftAdminPanel.tsx`
- Group mute and retire: `prds/group-mute-and-retire-mode.md`
