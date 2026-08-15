# Compact the home board chrome

Created: 2026-08-15 09:36 UTC
Last Updated: 2026-08-15 09:40 UTC
Status: Done

## Problem

The home board sits too far down. A second headline ("People, ranked by public impressions") plus a separate share row and mode-tab row add height before the table.

## Proposed solution

Remove the visible board h2. Keep a screen-reader only heading so the section still has a name.

Put This week's board, the Impressions / Convex yappers toggle, and Copy / Share / Post on X on one toolbar row above search.

Keep the kicker with the board, not in the global header, so About and Join stay clean.

Tighten board-shell top padding and hero bottom padding so the table moves up.

## Files to change

- `src/components/Leaderboard.tsx`
- `src/globals.css`
- `task.md`, `changelog.md`

## Edge cases

- Mode still changes the hidden heading text.
- Convex theme boxed kicker stays, with zero extra bottom margin inside the toolbar.
- Mobile wraps: kicker, then tabs, then share actions, all still above search.
- Admin list headings are unchanged.

## Verification

- Home page in both themes, desktop and 375px.
- Toggle still switches ranking mode.
- Share buttons still copy, share, and post.
- `npm run check`

## Task completion log

- 2026-08-15 09:36 UTC — PRD opened.
- 2026-08-15 09:40 UTC — Toolbar shipped. Desktop row is 46px. `npm run check` passed.
