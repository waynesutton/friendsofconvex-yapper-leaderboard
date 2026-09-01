# Group mute and retire mode

Created: 2026-08-17 06:24 UTC
Last Updated: 2026-08-31 20:05 UTC
Status: Done

## Problem

Two people can be on the board without belonging in the race, and today the
only tool for either case is Archive, which deletes them from view entirely.

The first case is a group board that needs someone listed but not ranked: a
host, a Convex employee sitting in a community group, an organizer whose
numbers would swamp the people the board is meant to spotlight. Archiving
takes them off the main board too, which is wrong; removing them from the
group hides that they are part of it.

The second case is the opposite problem. Someone holds number one long enough
that the race stops being interesting. There is no way to retire a champion
with a celebration, only a way to make them disappear.

## Proposed solution

Two separate controls.

**Per group mute.** A `muted` flag on the membership row, not the profile, so
the same person can be muted on one board and ranked on every other. Muted
members still count toward the group's member count and pill, still show on
the public board, and still match search. They render below a divider row with
a dash for a rank and no medal.

**Retire mode.** `retiredAt` and `retiredNote` on the profile. Retiring pulls
someone out of every ranking (main board, Convex mentions, group boards) and
opens a public champion page at `/retired/<handle>` built to post on X. The
note is the admin's "why we retired them" line. Unretiring clears both fields
and puts them straight back in the running.

## Files to change

- `convex/schema.ts` — `muted` on `groupMemberships`, `retiredAt` and
  `retiredNote` on `profiles`. All optional, so no migration runs.
- `convex/groups.ts` — `setMemberMuted` mutation, `muted` and `retired` on
  `listMembers` rows, and retired people dropped from the active member count
  that gates pill visibility.
- `convex/profiles.ts` — `setRetired` mutation, `getRetired` public query,
  ranked and muted sections in the group leaderboard path, and retired people
  filtered out of all three leaderboard paths.
- `convex/validators.ts` — optional `muted` on the public board row and the
  two retirement fields on the admin profile validator.
- `convex/siteFiles.ts` — retired people leave llms.txt and the sitemaps.
- `convex/sharePages.ts`, `convex/http.ts` — crawler HTML rewrite for
  `/retired/:handle`.
- `src/components/GroupsPanel.tsx` — Mute and Unmute per member row.
- `src/components/Leaderboard.tsx` — unranked muted section under a divider.
- `src/components/AdminPanel.tsx` — Retire with an inline note field, plus
  Unretire and a Champion page link once retired.
- `src/pages/RetiredPage.tsx`, `src/App.tsx` — the champion page and route.
- `src/globals.css` — divider, muted row, retire form, champion page.

## Edge cases

- Muting every member leaves a board with only the divider section. Fine.
- Column sorts and search cannot pull a muted row above the divider; the
  muted check runs before every other comparison in the client sort.
- Rank numbers skip muted rows, so the person below a muted row keeps their
  real position instead of inheriting a gap.
- Retired people are skipped on group boards even when unmuted there.
- Archive still wins. An archived profile appears nowhere, champion page
  included, and Retire is disabled until they are restored.
- Stats keep syncing for muted and retired profiles, so the champion page
  shows live numbers rather than a frozen snapshot.
- Retiring twice keeps the original `retiredAt` and only replaces the note.
- An unknown or unretired handle at `/retired/...` gets a short "nobody has
  been retired under that handle" card linking home.

## Verification

- `npx tsc --noEmit`, `npx eslint`, `npx vitest run` (27 tests), `vite build`,
  and a clean `npx convex dev --once` push.
- Browser: `/retired/nobodyhere` renders the not-found card and the home
  board renders unchanged, both with a clean console.
- Manual with a signed in admin: mute a group member and confirm they drop
  below the divider with no rank while the pill count holds; retire someone
  and confirm they leave all three boards and the champion page loads.

## Task completion log

- 2026-08-17 06:24 UTC — PRD written, implementation started.
- 2026-08-17 06:41 UTC — Schema, mute and retire backends, admin controls,
  board divider, champion page, and crawler meta tags done. Typecheck, lint,
  tests, build, and Convex push all clean.
- 2026-08-31 20:05 UTC — Retire was only on the main `/admin` row, so an admin
  inside a group could mute but not retire. Added the same Retire control, note
  field, Champion page link, and Unretire to every group member row, disabled
  Mute on retired rows, and said in both the panel and `/admin/docs` that retire
  from a group is still profile wide. Typecheck, lint, tests, and build clean.
