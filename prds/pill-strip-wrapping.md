# Pill strip wrapping for many groups

Created: 2026-08-17 05:45 UTC
Last Updated: 2026-08-17 05:47 UTC
Status: Done

## Problem

The board pill strip renders every pill as an equal lane in one CSS grid row
(`repeat(var(--tab-count), 1fr)`, width capped at the container). With 5 or 6
groups the lanes shrink and labels ellipsize; with the 12 group cap plus
Yappers and Convex mentions (14 lanes) each lane is about 90px on desktop and
about 25px on a phone. Pills never wrap and never scroll, so a board with many
groups becomes unreadable.

## Root cause

The channel switch was designed for 2 lanes and generalized to N by adding
`--tab-count`. The sliding ink thumb needs equal width lanes in a single row,
so the layout can only compress, not wrap.

## Proposed solution

Two presentations, picked by pill count:

- 4 pills or fewer: the existing channel switch, untouched. Equal lanes,
  sliding thumb, coral pip.
- 5 pills or more: a `mode-tabs--wrap` variant. The container drops its own
  border and thumb, becomes a wrapping flex row with an 8px gap, and each pill
  is its own bordered capsule sized to its label. The active pill gets the ink
  fill directly. Rows stack below naturally at any viewport width.

Keyboard arrows, icons, the internal board lock, aria-pressed, and the
`?board=` URL sync are unchanged; only the layout class and the thumb render
conditionally.

## Files to change

- `src/components/Leaderboard.tsx` — compute `wrapPills = pills.length > 4`,
  add the `mode-tabs--wrap` class, skip the thumb span when wrapped.
- `src/globals.css` — `.mode-tabs--wrap` styles plus active state fill; a
  small mobile adjustment so wrapped pills stay comfortable at 390px.

## Edge cases

- Exactly 4 pills: channel switch (thumb still meaningful, lanes readable).
- Exactly 5 pills: wrapped capsules.
- An admin viewing internal boards can push the count past the public count,
  so the same viewer-dependent pill list drives the threshold; a visitor with
  3 public pills keeps the thumb while an admin with 6 sees capsules.
- Long group names: capsules keep `mode-tab-label` truncation with a max
  width so one long name cannot take a whole row.

## Verification

- `npx tsc --noEmit` and `npx vitest run` clean.
- Browser check at desktop and 390px with the DOM padded to 6 and 14 pills:
  wrapped rows, readable labels, active fill on the pressed pill.

## Task completion log

- 2026-08-17 05:45 UTC — PRD written, implementation started.
- 2026-08-17 05:47 UTC — Shipped: `mode-tabs--wrap` variant in Leaderboard
  and globals.css. Verified with `npx tsc --noEmit`, `npx vitest run` (27
  tests), and a live browser check with the DOM padded to 14 pills at 1024px
  and narrow widths: capsules wrap into rows, the active pill carries the ink
  fill and coral pip, the long name truncates at 180px.
