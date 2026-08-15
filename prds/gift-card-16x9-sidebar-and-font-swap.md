# Gift card 16:9 sidebar art, label cleanup, Inter font swap, checkbox fix

Created: 2026-08-15 17:45 UTC
Last Updated: 2026-08-15 18:30 UTC
Status: Done

## Follow-up: footer label and animation removed (2026-08-15 18:30 UTC)

- The FRIENDS OF CONVEX GIFT footer (campaign title) is gone from the gift
  pass card. `.gift-card-center` uses `margin-block: auto` to stay vertically
  centered without it.
- The gradient wash animation was removed entirely: classes out of
  `GiftPortal.tsx`, overlay and keyframes out of `globals.css`.

## Follow-up: bottom stripe art and left alignment (2026-08-15 18:25 UTC)

The `background-image-sidebar.svg` art was replaced. The stripes no longer run
down the right side; they sweep along the bottom edge (flat near y=604 on the
left of the 1200x675 frame, rising to y=356 at the right edge). Changes:

- Card CSS: dropped the 23cqi right margins on header/footer, left aligned the
  center block (identity row, name, status line) with a 16cqi right margin so
  long names clear the rising stripes. Name auto-fit budget opened from
  108cqi to 124cqi. Header (FRIENDS OF CONVEX) and footer (FRIENDS OF CONVEX
  GIFT) stay in place.
- Animation: wash mask flipped from a right fade to a bottom fade
  (`inset: -18% -18% 34% -18%`, mask `to bottom, black 58%, transparent 94%`).
- OG renderer + preview script: new stripe paths in a `translate(0, -45)`
  group to bottom align the 675-tall art on the 630-tall canvas; all text left
  aligned at x=80; big handle sizing budget 860px.
- Verified with `npm run check`, the preview script, and live screenshots of
  both card pages.

## Problem

Five issues in one pass:

1. The gift signal card on `/gift/:token` is tall and square-ish. It should be a 16:9 Twitter card shape that fits the page, use `public/background-image-sidebar.svg`, and drop the "PERSONAL PASS / 2026" and "ONE GIFT / ONE PERSON" labels. The status line ("READY TO REVEAL") needs more separation below the big name. The art has racing stripe lines on the right ~23% of the frame, so no text can sit there.
2. The public share card on `/gift/share/:token` and its server rendered OG image still show "COMMUNITY / 2026", "FRIEND OF CONVEX", the campaign footer ("FRIENDS OF CONVEX GIFT"), and "BUILT TOGETHER". All of those go away. The OG image should also use the sidebar art and keep text off the right lines.
3. Space Grotesk is used as the display font across the app and in the OG renderer. Replace it with Inter everywhere.
4. The Board settings column checkboxes overflow their fieldset boxes on `/admin`. Root cause: the legend uses `float: left` and the first label gets laid out beside the float, escaping the box.
5. Add a slow gradient wash animation to the gift card, like the reference gif, but only on the solid color area, never on the stripe lines, and gated behind one class that is trivial to remove.

## Root cause (checkbox bug)

`.board-column-settings legend { float: left; width: 100%; }` puts the legend in flow, but the first `<label>` (a flex container, so a new BFC) is placed next to the float instead of below it and overflows the fieldset. Fix: `clear: both` on labels plus `min-width: 0` on the fieldset.

## Proposed solution

- `src/globals.css`
  - `--font-display` becomes `"Inter"`.
  - `.gift-signal-card`: `aspect-ratio: 16 / 9`, drop the fixed min-heights, background `url("/background-image-sidebar.svg")` stretched exactly (`background-size: 100% 100%`, the SVG is 1200x675 = 16:9).
  - Header, center block, and footer get `margin-right: 23cqw` so nothing lands on the stripe lines.
  - `.gift-card-center > p` gets top margin to push the status line below the name.
  - `.board-column-settings label { clear: both; }`, fieldset `min-width: 0`.
  - New `.gift-card-animated::before` overlay: blurred radial gradients in the gif palette (amber, deep purple, coral), masked to fade out before the stripe area, animated with transform. Removing the `gift-card-animated` class in `GiftPortal.tsx` removes the whole effect.
- `src/components/GiftPortal.tsx`
  - Remove "PERSONAL PASS / 2026", "ONE GIFT / ONE PERSON" / "THANK YOU" from the personal card.
  - Remove "COMMUNITY / 2026", the "FRIEND OF CONVEX" status line, and the whole footer from the public card.
  - Add `gift-card-animated` class with a remove-me comment.
- `index.html`: swap the Space Grotesk Google Fonts request for Inter.
- `convex/giftShareRender.ts` + `scripts/preview-share-og.mjs`: draw the sidebar stripe paths over the solid `#2A1E1D` field, center all text in the solid region (x = 462), remove the four labels, load `inter-500.ttf` / `inter-700.ttf`, and set `defaultFontFamily: "Inter"`.

## Files to change

- `src/globals.css`
- `src/components/GiftPortal.tsx`
- `index.html`
- `convex/giftShareRender.ts`
- `scripts/preview-share-og.mjs`

## Edge cases

- Long handles: big name still scales via `--gift-name-length`, but the usable width is now ~77% of the card, so the divisor shrinks.
- Redeemed passes: status line shows "GIFT REDEEMED"; the footer no longer shows "THANK YOU".
- Reduced motion: the global `prefers-reduced-motion` rule already freezes all animations including the new wash.
- OG image is 1200x630 while the art is 1200x675; the stripe paths extend past both edges so drawing them unscaled inside the canvas keeps the same x geometry.

## Verification steps

1. `npm run check` passes.
2. `node scripts/preview-share-og.mjs testyapper "Test Yapper"` renders with Inter, no removed labels, text clear of the stripes.
3. Browser: `/gift/test-portal-token-og` shows a 16:9 card with stripe art on the right and no text over it; `/admin` Board settings checkboxes all sit inside their boxes.

## Task completion log

- 2026-08-15 17:45 UTC: PRD created.
- 2026-08-15 17:50 UTC: All five changes implemented. Space Grotesk TTFs deleted from `public/render/fonts/`; Inter 500/700 TTFs in place.
- 2026-08-15 17:55 UTC: Verified. `npm run check` passes. OG preview renders with Inter, stripes on the right, all removed labels gone, text centered in the solid field. Browser DOM checks on `/gift/test-portal-token-og` and `/gift/share/test-share-token-og`: both cards measure 16:9 (ratio 1.78), use `background-image-sidebar.svg`, carry `gift-card-animated`, status line sits below the name with top margin, and content blocks keep a 23cqi right margin clear of the stripes.
