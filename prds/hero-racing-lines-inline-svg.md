# Hero racing lines as an inline SVG

Created: 2026-10-24 21:35 UTC
Last Updated: 2026-10-24 22:05 UTC
Status: Done

## Problem

The home hero paints `/brand/convex-racing-lines.png` as a CSS background. The PNG is a separate request, so the stripes flash in after the rest of the hero. The art is sized by width (`min(72vw, 1140px)`), so the climb drifts relative to the signal panel as the viewport changes. Past 1140px of art the flat run stops short of the left edge.

## Root cause

A raster background image loads after first paint and can only be positioned against the hero box, not against the signal panel.

## Proposed solution

- Trace the PNG into vector paths and ship them as `public/brand/convex-racing-lines-wide.svg` (viewBox `-3000 0 4729 455`, three filled paths `#F3B01D`, `#EE3430`, `#8D2676`). The flat run extends 3000 units left of the art. The top right run extends 3000 units past the viewBox so a left shift never exposes its end.
- Inline the same paths in `src/components/RacingLines.tsx` so they paint with the hero.
- Wrapper: absolute, full width, bottom anchored, `height: clamp(150px, 16vw, 230px)`, `overflow: hidden`, `pointer-events: none`, `aria-hidden`, `z-index: 0`.
- SVG: absolute right bottom, `height: 100%`, `width: auto`, `preserveAspectRatio="xMaxYMax meet"`, shifted by `--racing-lines-x`.
- Above 1000px, `--racing-lines-x` is computed from the hero padding, the grid gap, and the `minmax(260px, 0.55fr)` panel column so the climb center sits under the signal panel center. At 1000px and below the panel stacks under the copy, so the shift is 0 and the climb stays at the right edge.
- Reveal: wrapper `clip-path` from `inset(0 100% 0 0)` to `inset(0 0 0 0)`, 1.1s, `cubic-bezier(.65,0,.35,1)`, once per page load. Reduced motion shows the final state.
- Remove `background-image` from the Convex theme `.hero`; keep `#211718`.

## Files to change

- `public/brand/convex-racing-lines-wide.svg` (new)
- `src/components/RacingLines.tsx` (new)
- `src/components/Leaderboard.tsx`
- `src/globals.css`

## Edge cases

- Studio theme never showed the stripes, so the component is hidden outside `data-theme="convex"`.
- Returning to the board from another route does not replay the reveal.
- Per band staggered clips were skipped: CSS `inset()` on an SVG `<g>` resolves against the group bounding box, which reaches 3000 units off screen, so most of each reveal would happen out of view.

## Verification

- Pixel diff of the traced paths against the PNG at 3266x859: 0.37% of pixels differ, all on anti-aliased edges.
- Browser check at 1440, 1001, 760, and 390 widths: climb under the panel on desktop, bands reach both viewport edges, no layout shift.
- `npm run lint`, `npm run typecheck`, `npm run build`.

## Task completion log

- 2026-10-24 21:35 UTC Traced the PNG, added the SVG asset and `RacingLines`, wired the hero, removed the background image.
- 2026-10-24 22:05 UTC Follow up: smaller hero type and a `.hero-copy` bottom margin tied to `--racing-lines-height` so the copy clears the flat bands by 14px on desktop.
