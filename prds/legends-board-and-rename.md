# Legends board and the retire rename

Created: 2026-09-01 09:05 UTC
Last Updated: 2026-09-01 09:22 UTC
Status: Done

## Problem

Retire mode shipped working but with four rough edges.

The champion page shows four numbers: posts, engagements, impressions, and
followers. Engagements and impressions are the competitive metrics, the ones
the race is fought over, so putting them on a page that says "you are done
competing" reads like a scoreboard at a retirement party. Posts and followers
are the career numbers and the only two worth keeping.

There is no way for a visitor to find these people. The champion page exists at
a URL, but nothing on the board links to a list of everyone who has one.

Worse, a retired person is unreachable inside the group they belong to. They are
filtered out of the group board entirely, so searching their handle on a board
they are a member of returns nothing, which looks like a bug rather than a
status.

And the word itself is wrong. "Retired" is accurate but deflating: it reads like
someone quit or was pushed out. The feature is meant to be the happiest thing
that can happen to a person on this board.

## Proposed solution

Rename the feature to **Legends** across the app, and fix the three
functional gaps.

**Legends.** Pill label "Legends", page at `/legends/:handle`, admin action
"Make legend", status "legend", page headline "Undefeated legend". Database
fields become `legendAt` and `legendNote`, the mutation becomes
`profiles.setLegend`, and the query becomes `profiles.getLegend`.
`/retired/:handle` stays alive as a redirect so links already posted on X keep
working, and the crawler route answers on both prefixes.

**Two numbers on the page.** Posts and followers only. `getLegend` stops
returning engagements and impressions at all, so the public payload carries
less than it did.

**A Legends pill.** A new `mode: "legends"` on `listLeaderboard` returns
legends newest first. The pill only renders when at least one person is a
legend, so a fresh fork never shows an empty tab. Nobody on this board gets a
rank number, because ranking champions against each other defeats the point:
the rank cell carries a crown instead.

**Legends found by search in their groups.** Group boards now receive their
legend members as a third section after ranked and muted. The client hides them
until a search term matches, so the default board is unchanged but typing a
handle finds them. Every legend row anywhere carries an "Undefeated legend"
link to their page.

## Files to change

- `convex/schema.ts` — `legendAt` and `legendNote` on `profiles`, replacing
  `retiredAt` and `retiredNote`.
- `convex/migrations.ts` — one-time backfill copying the old fields to the new
  names and clearing the old ones.
- `convex/profiles.ts` — `setLegend`, `getLegend` (posts and followers only),
  `mode: "legends"`, group legends as a third section, renamed filters.
- `convex/validators.ts` — `legend` on the public board row, renamed profile
  fields.
- `convex/groups.ts` — `legend` instead of `retired` on member rows.
- `convex/siteFiles.ts` — renamed field in the discovery file filters.
- `convex/sharePages.ts`, `convex/http.ts` — `legendSharePage`, serving both
  `/legends/` and the legacy `/retired/` prefix.
- `src/pages/LegendPage.tsx` — renamed from `RetiredPage.tsx`, two stats.
- `src/App.tsx` — `/legends/:handle` plus a `/retired/:handle` redirect.
- `src/components/Leaderboard.tsx` — Legends pill, crown rank cell, legend
  rows hidden until searched on group boards, "Undefeated legend" link.
- `src/components/AdminPanel.tsx`, `src/components/GroupsPanel.tsx` — renamed
  controls and copy.
- `src/globals.css` — `.legend-*` classes, two column stats, legend row styles.
- `src/pages/AdminDocsPage.tsx` — renamed section and copy.

## Edge cases

- Nobody is a legend yet: no pill, and `mode: "legends"` returns an empty array
  rather than erroring.
- A legend is the only active member of a group: the group pill still hides,
  because legends do not count toward the active member count. Unchanged.
- Searching a group board for a legend who is also muted: legend wins, they
  render in the legends section with the crown, not the muted section.
- Column sorting on the Legends board still works, since those comparisons do
  not read the rank map. Rank sort keeps the newest first order.
- Old `/retired/<handle>` links: the SPA redirects to `/legends/<handle>` and
  crawlers still get per person meta tags on the old prefix.
- Existing legend records made before the rename: the backfill migration moves
  them, and the code never reads the old field names afterward.

## Verification steps

- `npx tsc --noEmit`, `npx eslint`, `npx vitest run`, `vite build`, and a clean
  `npx convex dev --once` push.
- Run the backfill and confirm every previously retired profile has `legendAt`.
- Browser: Legends pill appears only with a legend present, the crown renders
  instead of a rank, a group board search finds a legend, and
  `/retired/<handle>` lands on `/legends/<handle>`.

## Task completion log

- 2026-09-01 09:05 UTC — PRD written, implementation started.
- 2026-09-01 09:22 UTC — Shipped. Rename landed across schema, queries, routes, CSS,
  and copy; `convex/migrations.ts` added for the field move and ran clean on dev
  (3 scanned, 0 moved), with no pre-rename records found in production. Legends
  pill, crown rank cell, group search behavior, and the two stat legend page are
  in. `npx tsc --noEmit`, `npx vitest run` (29 tests), `npm run build`, and
  `npx convex dev --once` all clean; `npx eslint` reports only the pre-existing
  `SiteHeader.tsx` set-state-in-effect error. Remaining manual check needs a real
  legend on the board plus an admin session.
