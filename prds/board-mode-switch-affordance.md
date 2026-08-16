# Board mode switch affordance

Created: 2026-08-16 19:15 UTC
Last Updated: 2026-08-16 19:25 UTC
Status: Done

## Problem

The Yappers / Convex mentions control sits on cream paper in a cream pill. The inactive lane uses caption gray, so the switch reads as a status label rather than a control. People miss that the board has a second ranking.

## Root cause

The track uses `--control-inset` with no border, matching the page. Inactive type uses `--caption-ink`. There is no hover fill, no sliding thumb, and the two lanes are content sized so the rest side looks like leftover space.

## Proposed solution

Treat the control as a studio channel switch.

- Sheet white track with a full ink border so it lifts off the paper
- Equal lanes so both rankings look tappable
- Sliding ink thumb that translates with the selected mode
- Inactive type in broadcast ink, with a hover fill on the rest lane
- Coral live pip on the selected lane, matching the Rolling signal panel
- Arrow key support on the tablist

## Files to change

- `src/components/Leaderboard.tsx`
- `src/globals.css`
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Convex theme remaps the same tokens, so no extra theme overrides
- `prefers-reduced-motion` already collapses transitions globally
- Import source tabs keep the old inset style; this restyle is `.mode-tabs` only
- Mobile: switch goes full width under 760px so both labels stay tappable

## Verification

- Both themes: inactive lane is readable and hoverable
- Thumb slides Yappers to Convex mentions and back
- Keyboard: Tab to a lane, ArrowLeft / ArrowRight switches and moves focus
- `npx tsc --noEmit` and `npm run lint`

## Task completion log

- 2026-08-16 19:15 UTC — PRD opened.
- 2026-08-16 19:25 UTC — Switch restyled, verified in the local browser on both rankings, lint and typecheck pass.
