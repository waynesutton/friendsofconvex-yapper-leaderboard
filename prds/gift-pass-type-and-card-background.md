# Gift pass type size and racing stripe card background

Created: 2026-08-15 09:55 UTC
Last Updated: 2026-08-15 10:22 UTC
Status: Done

## Problem

1. The private gift pass page still clips long `@handles` in the left headline. The username sits in a huge Neue Haas Grotesk Display line and runs into the pass card.
2. The gift signal card and the personalized share OpenGraph image still use a flat dark fill with CSS/SVG rings. That art is wrong. Both should use the racing stripe background in `public/background-image.svg` and `public/background-image.png`.
3. The site default OpenGraph image must stay `public/og-friends-of-convex.png` (Friends of Convex / Yapper / Leader board). That file is not the per-recipient share card.

## Root cause

- `.gift-portal-copy h1` is `clamp(46px, 6vw, 82px)` at weight 900. The handle is inline in that headline. The grid also forces the card to `minmax(480px, 1.3fr)`, so the copy column is too narrow and the handle cannot wrap.
- `.gift-signal-card` paints `#171717` plus `::before` / `::after` rings. `convex/giftShareRender.ts` mirrors that same ring drawing instead of the racing stripe artwork.
- The default site meta in `index.html` already points at `og-friends-of-convex.png`. The share route rewrites `og:image` to `/og/gift/:token.png`. Those two images must stay separate.

## Proposed solution

1. Shrink the gift pass and public share headlines. Put the `@handle` on its own wrapping line and size it from `--gift-name-length`. Give the copy column `min-width: 0` and stop forcing the card to 480px.
2. Fill `.gift-signal-card` with `/background-image.svg` (`cover`, center). The SVG is a dark radial wash from `#2A1E1D` to `#906763`. Drop the ring pseudo elements.
3. Rebuild the 1200×630 share PNG on the same radial wash, centered like the in-app card.
4. Keep `index.html` `og:image` and `twitter:image` on `https://friendsofconvex.dev/og-friends-of-convex.png`. Unknown share tokens still redirect to that file.

## Files to change

- `src/globals.css` copy type, grid, card background
- `src/components/GiftPortal.tsx` handle as its own sized line
- `convex/giftShareRender.ts` racing stripe share image
- `scripts/preview-share-og.mjs` match the renderer
- `index.html` confirm default OG URL
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- X handles max out at 15 characters plus `@`. Longer test names must still wrap, never clip.
- Long display names on the card identity row must wrap inside the card.
- Mobile stacked layout uses the same wrapping handle, not a larger viewport clamp that undoes the fit.
- Share image render still works if the avatar fetch fails.
- Default site unfurl never uses `/og/gift/:token.png`.

## Verification steps

1. Gift pass with `@testyapper` and a 15 character handle shows the full username on the left with no clip.
2. Gift signal card and public share card show the dark radial wash.
3. `node scripts/preview-share-og.mjs testyapper "Test Yapper"` writes a PNG on that same wash.
4. `index.html` `og:image` is `https://friendsofconvex.dev/og-friends-of-convex.png`.
5. Lint, TypeScript, and production build pass.

## Task completion log

- 2026-08-15 09:55 UTC PRD created.
- 2026-08-15 10:10 UTC Copy type reduced and wrapping handle shipped. Gift cards use `background-image.svg`. Share OG renderer uses the racing stripe paths. Default site OG confirmed as `og-friends-of-convex.png`. Verified on `/gift/test-portal-token-og` (handle 27px, no clip, SVG background 200) and `scripts/preview-share-og.mjs`. `npm run check` passes.
- 2026-08-15 10:22 UTC Background files replaced with a dark radial wash. Cards now load the new SVG centered with no overlay. Share OG inlines the same gradient. Verified computed styles on `/gift/test-portal-token-og` and `scripts/preview-share-og.mjs`. `npm run check` passes.
