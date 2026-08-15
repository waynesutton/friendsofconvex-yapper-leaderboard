# Admin header nav, gifts guide, gift card resize, and personalized share OG

Created: 2026-08-15 09:00 UTC
Last Updated: 2026-08-15 09:25 UTC
Status: Done

## Problem

1. Admin links (Gift studio, Setup guide, Sign out) live inside the dark security banner on `/admin`. They belong in the site header so every admin page shares one navigation spot.
2. There is no plain-language guide for non technical admins on how to send gifts from the Gift studio.
3. The admin pages do not say they are admin only, do not explain how to add another admin, and do not mark the signed in user as an admin.
4. Long X handles overflow the gift pass card. The big `@handle` needs to auto fit the card width.
5. Sharing a gift pass on X shows the default site OpenGraph image. The share page at `/gift/share/:token` should serve a personalized card image with the recipient's handle.
6. The default OG image shows three people icons with bars. It should be simple: same text, white, no leaderboard rows.

## Root cause

- The app is a Vite SPA served by the Convex static hosting component. Crawlers never run React, so `react-helmet` style client meta tags cannot work. Meta tags must be injected server side.
- The gift card `h2` uses a viewport based clamp, which ignores the actual handle length.

## Proposed solution

1. `SiteHeader` reads `api.authz.viewer`. On `/admin` routes for signed in admins it shows Board ops, Gift studio, Gifts guide, an `Admin @handle` chip, and a Sign out button top right. `AdminPanel` banner drops its links and gains an admin note plus "how to add an admin" instructions. Setup guide links are commented out.
2. New route `/admin/gifts/guide` (AdminGate protected) with a non technical walkthrough of sending gifts.
3. Admin chip in the banner on `/admin` and `/admin/gifts` marking the signed in user as admin, plus a short note that the area is admin only and how to add another admin via `ADMIN_X_USER_IDS`.
4. Gift card name auto resize: the card becomes a CSS container, the `h2` font size derives from `--gift-name-length` set inline, using `cqw` units.
5. Personalized share OG:
   - `convex/sharePages.ts` (default runtime): `GET /gift/share/:token` fetches the static `index.html` shell from the same deployment and rewrites the title, description, `og:*`, and `twitter:*` tags with the recipient data from `api.gifts.getShareCard`. Browsers still get the full SPA.
   - `convex/giftShareRender.ts` (`"use node"`): internal action renders a 1200x630 PNG with `@resvg/resvg-wasm`. The wasm binary and Space Grotesk TTFs are fetched from static hosting (`public/render/`). The SVG mirrors the gift card design: dark surface, red and yellow rings, Convex symbol, avatar, auto sized `@handle`, campaign footer.
   - `GET /og/gift/:token.png` HTTP route returns the PNG with long cache headers.
6. New default OG image `public/og-friends-of-convex.png` without the people rows, all text white. `index.html` points at it with absolute URLs so X unfurls correctly.

## Files to change

- `src/components/SiteHeader.tsx` admin aware header nav
- `src/components/AdminPanel.tsx` banner cleanup, admin note, admin chip
- `src/components/GiftAdminPanel.tsx` links update, admin note, admin chip
- `src/components/GiftPortal.tsx` name length CSS variable on both cards
- `src/pages/AdminGiftsGuidePage.tsx` new guide page
- `src/App.tsx` new route
- `src/globals.css` header admin styles, chip, banner note, card container sizing
- `convex/sharePages.ts` new HTML injection + PNG HTTP actions
- `convex/giftShareRender.ts` new node action for PNG rendering
- `convex/http.ts` route registration
- `index.html` absolute OG URLs, new default image
- `public/render/resvg.wasm`, `public/render/fonts/*.ttf` renderer assets
- `public/og-friends-of-convex.png` new default OG image
- `package.json` adds `@resvg/resvg-wasm`

## Edge cases

- Unknown share token: share page serves the plain shell with default meta; image route returns 404.
- Recipient avatar fetch failure: card renders without the avatar.
- Very long handles (X max 15 chars plus `@`): both the CSS sizing and the SVG sizing scale down.
- Non admin or signed out visitor on `/admin`: header shows the normal public nav only.
- First deploy ordering: renderer assets upload in the same `npm run deploy` as the backend, so the fetch at render time succeeds.

## Verification steps

1. `npm run check` passes (eslint, tsc, vite build).
2. `npx convex dev --once` pushes functions without errors.
3. Visit `/admin` signed in: header shows Gift studio, guide, admin chip, Sign out; banner has no links and shows the admin note.
4. Visit `/admin/gifts/guide`: guide renders behind AdminGate.
5. Gift pass with a 15 char handle fits on one to two lines without clipping.
6. `curl https://<site>/gift/share/<token>` returns HTML with personalized `og:image` pointing at `/og/gift/<token>.png`.
7. `curl -I https://<site>/og/gift/<token>.png` returns `image/png`.

## Task completion log

- 2026-08-15 09:00 UTC PRD created, renderer assets staged (`public/render/`), `@resvg/resvg-wasm` installed.
- 2026-08-15 09:10 UTC Header admin nav, `AdminAccessNote`, `/admin/gifts/guide`, gift card container-query sizing, `convex/sharePages.ts`, `convex/giftShareRender.ts`, new default OG image, and `index.html` absolute meta URLs all implemented. `npm run check` passes.
- 2026-08-15 09:20 UTC Local render preview verified via `scripts/preview-share-og.mjs`. Live dev verification on `ceaseless-bobcat-587.convex.site` with a seeded test pass: `/gift/share/test-share-token-og` serves personalized meta, `/og/gift/test-share-token-og.png` returns the rendered PNG (200, image/png), unknown tokens 302 to `/og-friends-of-convex.png`. Note: the unknown-token image route redirects to the default image instead of returning 404, which unfurls better than an error.
