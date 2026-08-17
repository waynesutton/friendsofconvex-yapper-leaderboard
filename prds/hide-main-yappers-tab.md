# Hide the main Yappers tab for forks

Created: 2026-08-17 06:08 UTC
Last Updated: 2026-08-17 06:11 UTC
Status: Done

## Problem

A fork that only runs custom group boards cannot hide the main Yappers list.
Board settings already has "Show the Convex mentions tab" for forks that do
not track Convex mentions, but the Yappers pill is hard coded, so every fork
ships the full main list next to its groups.

## Proposed solution

A `showYappersTab` flag on the board display settings, same shape as
`showConvexTab`: missing means true so nothing changes on deploy. A second
checkbox in the Board tabs fieldset turns it off. The public board drops the
Yappers pill and falls back to the first available pill (Convex mentions if
on, otherwise the first group). The mutation refuses to hide both tabs unless
at least one visible group exists, so the board can never go blank.

## Files to change

- `convex/schema.ts` — optional `showYappersTab` on `boardDisplaySettings`.
- `convex/boardSettings.ts` — field in the display validator, default, get,
  set, and the no-blank-board guard.
- `src/components/AdminPanel.tsx` — second checkbox in Board tabs.
- `src/components/Leaderboard.tsx` — conditional Yappers pill and first-pill
  fallback for the active board.
- `src/pages/AdminDocsPage.tsx` — board operations section mentions it.

## Edge cases

- Both tabs off with no visible group: rejected server side with a message
  telling the admin to show a group first.
- Both tabs off and the only visible groups have zero active members: no
  pills render, and the active board falls back to the Yappers table so the
  page still works; the pill strip simply has nothing to switch.
- `?board=impressions` links while the tab is hidden fall back to the first
  pill, same as unknown slugs.
- The main list query stays subscribed because the hero count and freshness
  chip read it; hiding the tab is presentation, matching how the hidden
  Convex tab keeps its subscription.
- Settings saved before the field existed keep the tab visible.

## Verification

- `npx tsc --noEmit` and `npx vitest run` clean, Convex push clean.
- Manual: toggle the tab off with a visible group, confirm the board opens
  on the group pill and `?board=impressions` redirects there; toggle both
  tabs off with no groups and confirm the save is rejected.

## Task completion log

- 2026-08-17 06:08 UTC — PRD written, implementation started.
- 2026-08-17 06:11 UTC — Schema field, display query and mutation guard,
  admin checkbox, pill fallback, and admin docs done. `npx tsc --noEmit` and
  `npx vitest run` (27 tests) clean; Convex push ready.
