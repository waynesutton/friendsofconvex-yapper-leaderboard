# Board snapshot share cards

Created: 2026-10-06 20:26 UTC
Last Updated: 2026-10-06 20:40 UTC
Status: Done (dev). Production needs a deploy plus a static upload.

## Problem

Post on X shares the live board URL (`/?board=...`). X never runs React, so every post gets the same site wide card (`og-friends-of-convex.png`), and X caches cards per URL, so even a dynamic image would freeze on whatever X fetched first. People want the post to show the ranking of the tab they are on (Yappers, Convex mentions, a group, or Legends) at the moment they posted.

The X post intent only takes text and a URL, so the image has to arrive through the shared URL's `twitter:image`.

## Proposed solution

- Clicking Post on X (or Share) calls a public mutation `createBoardShare({ board })`. The server resolves the tab itself, freezes the top 5 rows into a `boardShares` document, and returns its id. The client never sends rows.
- Snapshots dedupe by board plus a hash of the frozen rows. Rankings only move on the daily sync or an admin edit, so repeat clicks reuse one id and one URL, which bounds the table without a rate limiter.
- The intent shares `/b/:id`. An HTTP action rewrites the SPA shell meta tags (title, description, `og:image`, `twitter:image`, `noindex`, canonical) for crawlers.
- `/og/board/:id.png` serves a 1200x630 PNG drawn by resvg with the same stripe art, fonts, and Convex mark as the gift card. The mutation schedules a prewarm render that stores the PNG in Convex file storage, so the crawler gets a stored blob with an immutable cache header. A miss renders inline and stores.
- Card content per tab: Yappers and groups show rank plus engagements, Convex mentions shows rank plus mention count, Legends shows a crown and no rank, newest first. An "As of" line uses the newest `lastSyncedAt` among the rows.
- Internal groups, hidden groups, and tabs turned off in board settings return `null`; the button falls back to the plain live URL.
- Visitors who open `/b/:id` in a browser are sent to `/?board=<board>`.

## Files to change

- `convex/schema.ts` (new `boardShares` table)
- `convex/profiles.ts` (extract `loadBoardRows` from `listLeaderboard`)
- `convex/boardShares.ts` (new: mutation, queries, pure helpers)
- `convex/ogRenderKit.ts` (new: shared resvg loader, avatar fetch, art)
- `convex/giftShareRender.ts` (import the shared kit)
- `convex/boardShareRender.ts` (new: board card SVG and render action)
- `convex/sharePages.ts`, `convex/http.ts`
- `src/components/Leaderboard.tsx`, `src/pages/BoardSharePage.tsx` (new), `src/App.tsx`
- `src/pages/AdminDocsPage.tsx`
- `scripts/preview-board-og.mjs` (new), `tests/boardShares.test.ts` (new)
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Empty or loading tab: no rows, return `null`, plain URL share.
- Fewer than 5 people: draw what exists.
- Avatar fetch fails: placeholder circle.
- Long names: truncated.
- Group renamed later: the label is frozen in the snapshot on purpose.
- Safari popup blocking: the tab opens synchronously on click, then navigates once the mutation returns.
- Unknown snapshot id: the page keeps default meta and the image redirects to the default OG art.

## Verification

- [x] `npx convex dev --once`, `npx tsc --noEmit`, eslint on touched files, `npx vitest run` (51 passing), `npm run build`.
- [x] convex-test: dedupe, new id on changed rows, internal and hidden boards refused, Legends rows unranked, Convex tab uses mention count.
- [x] Local PNG preview with `node scripts/preview-board-og.mjs`.
- [x] Dev deployment: `curl` `/b/<id>` meta tags and fetch `/og/board/<id>.png` for Yappers and Convex mentions (Legends is empty on dev, so the mutation correctly returns null).

## Notes from verification

- The renderer fetches fonts and the resvg wasm from static hosting at `/render/...`. Dev static hosting was stale and returned 404 for the fonts until `npx @convex-dev/static-hosting upload --build` ran. Production needs the same static upload with the deploy.
- Cloudflare cached the fallback redirect for 4 hours. The fallback now sends `Cache-Control: no-store`, but the edge still reports `max-age=14400` on redirects, so a failed first fetch can stick at the edge for a while. The stored PNG path is unaffected.
- First render on dev took about 3.8s; stored hits serve in about 0.4s. The mutation prewarms, so the X crawler normally hits the stored blob.

## Task completion log

- 2026-10-06 20:26 UTC: PRD written.
- 2026-10-06 20:40 UTC: Shipped on dev. Card subtitle reads "Leading right now" for one row, and the as of line follows the last row instead of a fixed spot.
