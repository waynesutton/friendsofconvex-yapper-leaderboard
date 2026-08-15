# Rank badges in both modes with a bigger avatar anchored mark

Created: 2026-08-15 17:14 UTC
Last Updated: 2026-08-15 17:14 UTC
Status: Done

## Problem

The top 3 rank badges only rendered in Convex mentions mode, as tiny marks next to the rank number. The Yappers mode showed nothing. The marks were too small to notice and first place had no extra moment.

## Root cause

`Leaderboard.tsx` gated the badge lookup on `convexMode`, and `RankBadgeMark` rendered inline inside the rank cell at 15px text / 20px image size.

## Proposed solution

- Drop the `convexMode` gate so ranks 1 to 3 get badges in both ranking modes.
- Move the badge out of the rank cell onto an `avatar-stack` wrapper around the profile avatar, floating fully to the left of the avatar as a plain bigger medal: 28px (34px for first place) with no background, border, or chip. A first pass used a bordered white chip overlapping the avatar; user feedback rejected it.
- First place renders larger than second and third. A sparkle popout animation was shipped, then removed on user request; no animation remains.
- Mobile cards shrink the badge (22px, 26px for first) and tuck it closer so it clears the rank number in the 36px rank column.

## Files to change

- `src/components/Leaderboard.tsx`: badge lookup for both modes, `avatar-stack` wrapper, reworked `RankBadgeMark` with sparkle spans for rank 1.
- `src/globals.css`: replaced the old inline `.rank-badge` rules with the avatar anchored chip, first place variant, `badge-sparkle-pop` keyframes, and mobile size overrides.

## Edge cases

- Image badges (admin uploaded) render inside the same chip at 26px / 31px.
- Dimmed Convex mode rows keep the badge at the row's reduced opacity.
- Reduced motion users get a static badge; the global media query kills the animation.
- Sort or search does not move badges: they follow canonical rank, not the visible row order.

## Verification steps

- `npx tsc --noEmit` passes.
- Browser check on localhost: badges show in Yappers and Convex mentions modes, first place has the coral ring and sparkles, mobile 375px card clears the rank number.

## Task completion log

- 2026-08-15 17:14 UTC: Shipped and verified in both modes and at mobile width.
