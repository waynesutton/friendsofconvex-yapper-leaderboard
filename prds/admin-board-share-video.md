# Admin board share video

Created: 2026-10-26 00:40 UTC
Last Updated: 2026-10-26 01:00 UTC
Status: Done

## Problem

Board snapshots unfurl on X as a static 1200x630 card. Admins want a short ranking video of the same snapshot so a post shows the board building itself. X web intents cannot attach media and X does not play `og:video`, so a playing video on X means the admin attaches an MP4 by hand: the native share sheet on a phone, or download plus upload in the X composer on desktop. Chat apps (iMessage, Discord, Telegram, Facebook) do play `og:video`, so serving the MP4 from `/b/:id` is a bonus there.

Only admins make, attach, or remove videos. Public visitors see no change.

## Proposed solution

- Render in the admin's browser with WebCodecs through `mediabunny` (H.264, 30 fps, 1200x630, fast start), loaded with a dynamic `import()` so the public bundle does not grow. No Chromium or ffmpeg in Convex.
- Frames come from `convex/ogArt.ts`, the same pure SVG code as the PNG card. `buildBoardCardFrameSvg(input, t)` draws the card at time `t`; at the end of the timeline it returns `buildBoardCardSvg(input)` byte for byte, so the video ends on the PNG card.
- Each frame SVG embeds Inter 500 and 700 as base64 `@font-face` (an SVG drawn as an image cannot see page fonts), goes through a Blob URL into `new Image()`, and is drawn on an `OffscreenCanvas`. Avatars arrive as data URIs from a server action, so the canvas never taints.
- Frame 0 is the finished card for one frame (the thumbnail), then the build plays from empty, then a 3 second hold.
- Upload the MP4 to Convex storage and attach it to the `boardShares` doc. `/v/board/:id.mp4` serves it with Range support. `/b/:id` adds `og:video` tags only when a video is attached and keeps `twitter:card=summary_large_image`.
- New admin page `/admin/share-video`, plus a Video link on the board toolbar that renders only for admins.

## Motion timeline

Easing: `eo(x) = 1 - (1-x)^3`, `eio` ease in out cubic, progress clamped to 0..1.

| Beat | Start | Length | Motion |
| --- | --- | --- | --- |
| Racing lines | 0 | 1.1 | clip rect width 0 to 1200, `eio` |
| Lockup | 0.10 | 0.5 | fade, `eo` |
| Label word i | 0.45 + 0.09i | 0.45 | rise 18px, fade, blur 3 to 0, `eo` |
| Subtitle and metric header | L + 0.25 | 0.45 | rise 30px, fade |
| Row i | L + 0.5 + 0.12i | 0.4 | rise 16px, fade; divider x2 LEFT to RIGHT over 0.3 |
| Rank 1 pulse | lastRowEnd + 0.15 | 0.35 | scale 1 to 1.12 to 1 |
| Board as of | lastRowEnd + 0.30 | 0.4 | fade |
| Hold | buildEnd | 3.0 | finished card |

`L` is the start of the last label word, `0.45 + (words - 1) * 0.09`. The prompt wrote `0.45 + words * 0.09` but also called it "the start of the last label word" and said the build ends near 2.5s; only the `(words - 1)` reading with the pulse and as of line keyed to the end of the last row gives a 2.53s build and a 5.53s video for a one word label with 5 rows. That reading is what ships.

Each label word animates on its own layer: the full label text with every other word set to `fill-opacity="0"`, so glyph positions match the single text element exactly and the final frame swaps in the static element with no jump.

## Deviations from the prompt

- `attachVideo` returns `{ status: "attached" }` or `{ status: "rejected", reason }` instead of throwing on a bad file. A throw rolls back the whole mutation, including `ctx.storage.delete`, so the bad upload would stay in storage. Signed out and non admin callers still get a thrown error.
- One extra admin query, `getShareVideo`, gives the page the current share's video state (a deduped share can be older than the first page of `listRecent`).
- `boardSharePage` reads `internal.boardShares.getForRender` (extended with the video fields) instead of the public `getBoardShare`, so the public query shape does not change.
- The Vite dev server proxies `/og/board/` and `/v/board/` to the Convex site so the admin page previews work on localhost. Production serves both from the same origin already.

## Files to change

- `convex/schema.ts`: optional `videoStorageId`, `videoRenderedBy`, `videoRenderedAt` on `boardShares`.
- `convex/ogArt.ts`: `boardVideoTimeline`, `boardVideoFrameState`, `buildBoardCardFrameSvg`; `buildBoardCardSvg` shares the layout code.
- `convex/boardShareVideo.ts` (new): `getVideoInputs`, `generateVideoUploadUrl`, `attachVideo`, `removeVideo`, `listRecent`, `getShareVideo`. The `/v/board/` route reads the file through `internal.boardShares.getForRender`.
- `convex/boardShares.ts`: `getForRender` returns the video fields.
- `convex/sharePages.ts`: `boardShareMeta` helper, `og:video` tags, `boardShareVideo` route. `convex/http.ts`: register `/v/board/`.
- `convex/siteDirectory.ts`: explicit `Allow` lines for `/b/`, `/og/`, `/v/`.
- `src/lib/boardVideo.ts` (new): font loading, frame drawing, mediabunny encode.
- `src/components/ShareVideoPanel.tsx`, `src/pages/AdminShareVideoPage.tsx` (new), `src/App.tsx`, `src/components/SiteHeader.tsx`, `src/components/Leaderboard.tsx`, `src/globals.css`.
- `vite.config.ts`, `package.json` (`mediabunny`).
- `tests/asXUser.ts` (new, shared helper), `tests/admins.test.ts`, `tests/boardShareVideo.test.ts`, `tests/boardVideoFrames.test.ts`.
- `src/pages/AdminDocsPage.tsx`, `task.md`, `changelog.md`, `files.md`.

## Edge cases

- Browser without H.264 WebCodecs encoding: the page says "Video needs Chrome or Safari 26 or newer" and stops.
- No AAC encoder: ship video only.
- Upload that is not `video/mp4`, is over 8 MB, or targets a missing share: deleted, rejected.
- Replacing a video deletes the old file; the URL carries `?v=<videoRenderedAt>` so caches and chat apps fetch the new one.
- Internal groups never appear in the picker (`createBoardShare` refuses them anyway). Hidden tabs are left out.
- `/b/:id` keeps `Cache-Control: public, max-age=86400`. A crawler that fetched a snapshot before a video was attached keeps the old tags until it refetches, so attach before posting.
- Visitors and non admins get identical board toolbar markup; the Video link only renders when `viewer.isAdmin` is true.
- The `.convex.site` edge rewrites `Cache-Control: no-store` on the video 404 to `public, max-age=14400` (it does the same to the existing `/og/board` fallback redirect; `cf-cache-status: BYPASS`, so the edge itself does not store it). Harmless here: `og:video` only appears once a video is attached and always carries `?v=<videoRenderedAt>`, so no crawler fetches the unstamped URL first.

## Verification

- `npm run check`, `npx convex dev --once`.
- Spike in a Chromium browser: frames render with Inter, canvas not tainted, `ffprobe` shows H.264, yuv420p, 30 fps, 1200x630, moov before mdat.
- `ffmpeg -ss 0.4` frame shows the lines mid draw; frame 0 and the last frame equal the finished card.
- `curl -i -H "Range: bytes=0-1"` on `/v/board/<id>.mp4` returns 206; `/b/<id>` shows `og:video` only after attach.
- Signed out board toolbar has no Video link.

## Task completion log

- 2026-10-26 00:40 UTC: PRD written.
- 2026-10-26 00:45 UTC: Phase 0 spike in Chromium: `canEncodeVideo("avc")` true, canvas not tainted, 167 frames in 4.8s, 152,712 bytes, H.264 High yuv420p 30 fps, moov before mdat, silent AAC. Final frame against the resvg PNG: about 30 dB PSNR (4:2:0 chroma and antialiasing). Spike files deleted.
- 2026-10-26 00:52 UTC: Backend, tests, admin page, toolbar link, CSS, and Vite proxy done. `npm run check` passes (78 tests), `npx convex dev --once` pushes. mediabunny lands in its own lazy chunk.
- 2026-10-26 00:55 UTC: Live checks on dev. The real `renderBoardVideo` module rendered the fixture in 1.6s with the same ffprobe result; frames at 0, 0.4s, 1.3s, and the end show poster, stripes drawing, rows building, finished card. `/b/<id>` without a video has no `og:video` and keeps `summary_large_image`; `/v/board/<id>.mp4` returns 404; `/og/board/<id>.png` returns 200; robots.txt lists the three Allow lines. Signed out, `/admin/share-video` shows the admin sign in and the board toolbar is Copy link, Share, Post on X with no Video link.
- Not verified here (needs an admin X session or other hardware): Make snapshot, Attach, Remove, the live 206 Range response on an attached video, Safari 26, the iPhone share sheet, and iMessage or Discord unfurls. Listed in `task.md`.
