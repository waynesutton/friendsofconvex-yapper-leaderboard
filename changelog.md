# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Security

- The public leaderboard query now returns a trimmed projection instead of raw profile documents. Internal fields (`authUserId`, `syncError`, `xUserId`, membership status, source, and review timestamps) no longer leave the deployment through `profiles.listLeaderboard`. The board renders identically (2026-08-15).
- The gift pass query no longer includes the private Fourthwall URL. The URL is only returned by the reveal and claim mutations, which check pass expiry with server time, closing a path where a pass holder could keep reading a revealed link after expiry (2026-08-15).
- The unauthenticated X webhook CRC endpoint no longer clears the stored account activity error. It only records the validation time, so outside requests cannot hide real webhook failures from the admin configuration panel (2026-08-15).
- Full sec-check audit passed otherwise: every admin function is auth gated (verified with live unauthenticated probes), Fourthwall and X webhooks verify HMAC signatures with timing safe comparison, X sender tokens are AES-GCM encrypted at rest, no secrets exist in git history, and `npm audit` reports zero vulnerabilities (2026-08-15).

### Fixed

- The board's freshness chip and "How this is measured" link were unreadable in the Convex theme: leftover overrides painted them near white on the cream paper background. The overrides are gone and both now use the theme's ink tokens, so they read in both themes (2026-08-16).
- The Posts column no longer counts replies. X's `exclude=replies` parameter still returns self-thread replies, so a week that looked like 50 posts was really 18 original posts, 22 quote posts, and 10 replies. The sync now reads `referenced_tweets` and drops anything that is a reply or a repost, and every metric in the row (posts, engagements, impressions, Convex mentions) is counted from that same filtered list. Quote posts still count as posts. Post counts drop for everyone after the next daily refresh (2026-08-16).
- The board and About page said the daily refresh runs at 08:00 UTC. The cron actually runs at 15:17 UTC, so both now read "8:17 AM Pacific" (2026-08-16).
- The Share a safe public card button keeps its 56px pill size after a gift is confirmed. The confirmed message box was taller than the buttons, so the grid row stretched the share button into a bigger oval. The message is now the same 56px pill as the actions, and its copy reads "Gift confirmed." on both the board pass and Gift lab pages (2026-08-15).
- The gift count filter dropdown in the Approved recipients picker opens again. A recipient list style also matched the picker toolbar and its overflow clipped the floating menu, so the trigger toggled but no options appeared. The list now has its own class and the overflow rule no longer touches the toolbar (2026-08-15).
- Rank badges no longer drift after a sync or import. The leaderboard query now returns rows in the board's canonical order: synced profiles first, then engagements, impressions, posts, and added date as tie breakers, so the top 3 badges always sit on the top 3 engagement rows (2026-08-15).

### Changed

- Load more now works with every Top filter, not just All yappers. Top N is the starting row count and each Load more click reveals another N rows (Top 30 steps by 30, Top 60 by 60) until the whole board is visible, so a board with 120+ friends is always reachable from any filter. The people counter and the Showing X of Y footer count the full filtered board, and the leaderboard subscriptions now fetch the backend's 250 row cap (2026-08-16).
- The Approved recipients list in the Gift studio is now a boxed inset well with a full border, rounded corners, and a slightly darker background, so it is obvious the region scrolls. Its height also scales with the viewport (60% of the screen height, between 420px and 960px) instead of stopping at a fixed 420px, so taller screens show more recipients before scrolling (2026-08-16).
- The board toolbar is rearranged into two rows. Row one pairs the kicker (window label, freshness chip, methodology link) with a compact right aligned search field. Row two sits directly above the table with the Yappers / Convex mentions tabs on the left and the Top filter, Copy link, Share, and Post on X actions on the right. The full width search line is gone; on phones everything stacks with the search taking its own line (2026-08-16).
- The board kicker now reads "This week's board · Last 7 days" in bold, near full ink so the measurement window is visible at a glance. In the Convex theme the bordered box wraps just the label instead of the whole row, keeping the freshness chip and methodology link beside it (2026-08-16).
- The board opens on the ranking view in both modes. Yappers previously loaded with the Engagements column as the active sort; now Rank is active on load and when switching between Yappers and Convex mentions. The row order is unchanged since rank already follows each mode's canonical order, only the highlighted sort column moves (2026-08-16).
- README is the public setup source of truth: feature list covers Gift lab, Top N / Load more, 7 day gift expiry, and gift studio bulk tools; a new APIs and accounts section lists required and optional Convex env **names** with no secret values; the one prompt agent block documents Convex agent mode and the X OAuth callback shape without pointing at gitignored local docs (2026-08-16).
- Gift links now hard expire 7 days after the dispatch is created, and the cap applies to links generated before this rule with no migration. The portal query and both reveal mutations enforce the cap with server time; redeemed passes stay viewable. The campaign form caps Days active at 7, the DM text tells recipients about the window, and the gifts guide documents it (2026-08-15).

### Added

- Custom DM message per dispatch. The New dispatch form gains an "Edit the X DM message for this dispatch" toggle below the Approved recipients picker. It opens a textarea prefilled with the default message, supports `{link}`, `{name}`, and `{number}` placeholders rendered per person at send time, shows a live preview with the first selected recipient, and caps the text at 1000 characters. Only the people in that dispatch receive the edited text; the default message stays unchanged for every other dispatch. If the custom text leaves out the pass link or a STOP mention, the send appends them automatically so every DM stays deliverable and compliant. The recipient ledger shows the active custom text for a dispatch, and Copy DM copies the same rendered message the send would produce (2026-08-16).
- Metric definitions on the board. Every metric column header now carries a small info tooltip that says exactly how the number is measured, in both the Yappers and Convex mentions views. Posts spells out that it means original posts and quote posts, not replies or reposts. Engagements spells out the formula, likes plus reposts plus replies plus quotes plus bookmarks from the X API public metrics, and notes that it is narrower than the engagements figure in X analytics. Tooltips open on hover and keyboard focus, toggle on tap, and close on Escape. A "How this is measured" link sits beside the freshness chip for mobile, where the table header is hidden (2026-08-16).
- The About page now states the measurement rules in full: what counts as a post, what engagements and impressions actually sum, that the seven day window is measured from the daily refresh, and that a number can be up to a day behind live X counts (2026-08-16).
- Gift lab at `/admin/gift-lab`: mint personal Fourthwall gift links for clients, customers, and friends who are not on the board. Admins enter a full name, pick a product from the shared Gift inventory shelf, and choose whether the link expires in 7 days or stays open. The page shows the full link with a copy button and keeps a log of every link with copy, open, Fourthwall status check, close, and two step delete. The recipient page at `/gift/for/:token` greets the person by name with no X handle and no public share card, and the existing Fourthwall webhook marks lab links redeemed (2026-08-16).
- Shared `GiftProductShelf` component: the Gift studio's Product shelf extracted so the Gift lab shows the same saved products with no duplicated logic (2026-08-16).
- Gift pass expiry countdown on the claim page: a live timer under the trust line shows days, hours, minutes, and seconds until the pass expires along with the exact date, turns red inside the last day, and flips the page to the closed card the moment it reaches zero on an unredeemed pass (2026-08-15).
- Hourly `expire gift links` cron that closes active gift dispatches whose links passed the 7 day cap, keeping the admin Dispatches log accurate without waiting for someone to open a dead link (2026-08-15).
- Rybbit analytics: the deferred tracking script now loads from the SPA shell `index.html`, covering every route (2026-08-15).
- Load more on the leaderboard: both board tabs replace Previous/Next paging with a Load more button and a "Showing X of Y" counter. A themed Top filter dropdown (Top 30, 60, 100, 150, All) sits next to Copy link and caps the list after search and sort; the board opens on Top 30 by default. Picking a Top N shows all N rows at once, so the list length always matches the dropdown; Load more only appears on All yappers, revealing thirty rows per click (2026-08-15).
- Gift count filter in the Approved recipients picker: All, No gifts yet, 1 through 4, and 5+ gifts. Combined with Select shown, selecting everyone who has never received a gift takes two clicks. Counts come from the gift history's gift numbers, so production data stays accurate (2026-08-15).
- Shared `FilterDropdown` component: a custom listbox dropdown styled on the app's palette tokens so it matches both themes, replacing native selects for the new filters (2026-08-15).
- Mobile X login guidance. Opening `/join` inside the X app's in-app browser now shows an instruction card to reopen the page in Safari or Chrome, since X's own Universal Links break the web OAuth round trip there. Phones outside the X app get a one-line "stay in this browser" hint, both sign-in buttons show an "Opening X sign-in" busy state, and a failed sign-in round trip surfaces a retry message instead of silently showing the button again. No OAuth, callback, or scope changes (2026-08-15).

- Dispatches log toolbar: Recent, Archived, and All view tabs with counts, a search box that matches campaign title, gift name, or recipient handle, a select all checkbox with per row checkboxes, and bulk Archive, Restore, two step Confirm delete, and Clear actions backed by new capped bulk mutations. Download CSV now exports exactly what the log shows (2026-08-15).
- Approved recipients toolbar in the campaign form: search by name or handle, Select shown, Select GIFT ready (only profiles with an unused GIFT request), Clear, and a live selected count. Picking more than 50 recipients disables Create with an inline warning that matches the backend cap (2026-08-15).
- Batch X DM send in the recipient ledger: checkboxes appear on passes that can still be sent, Select sendable grabs them all, and Send X DMs delivers one at a time with a 2 second gap between sends. Every send still runs the full server side compliance checks (STOP, admin opt out, consent, link ready) right before the X API call, and the loop stops after three failures in a row instead of hammering X. A summary reports sent, already sent, and failed handles (2026-08-15).

- Dispatches log in the Gift studio, below the recipient ledger: every campaign, active and archived, with Archive and Restore, a two step Delete (the button arms in red, the second click removes the dispatch plus its passes and history), and a Download CSV export of the whole log. Archiving hides a dispatch from the sidebar without touching its passes; both the log and the sidebar read the same Convex query, so actions sync live (2026-08-15).
- Product shelf in the Gift studio: save labeled Fourthwall product IDs ahead of any send. Saves are verified against Fourthwall's Get Product endpoint, so typo'd IDs are rejected and each saved product carries its real name and a thumbnail preview. Shelf cards offer Use (fills the campaign form) and remove; the pick-to-fill chips in the form now show a tiny product image (2026-08-15).
- Remove button in the Friends on the board admin section: a two step confirm (Remove, then Confirm in red) permanently deletes a profile and its snapshot history. Gift ledger rows keep their own name copies, so gift history is unaffected (2026-08-15).
- A full README: what the board does, the stack, required environment values, a one prompt setup block for coding agents with Convex agent mode, manual run steps, and Convex docs links (2026-08-15).
- Download CSV in the Recipient ledger: one click exports the whole selected campaign (gift number, name, handle, status, sent/opened/redeemed times, consent source, DM opt out, delivery error, pass URL) as a spreadsheet-safe CSV named after the campaign and date (2026-08-15).
- Board freshness chip next to This week's board showing how recently the numbers synced (Updated 2h ago), with the exact time on hover and Awaiting first sync before the first pull (2026-08-15).
- Live AI and search discovery files that rebuild from the public board: `/llms.txt`, `/sitemap.md`, `/sitemap.xml`, and `/robots.txt`. Add or archive a handle and the next request updates the files. Footer links for `llms.txt` and `sitemap.md` sit next to the open source credit (2026-08-15).
- Agent Ready component for `agents.md`, `llms-full.txt`, RSS, status, and readiness scoring. The floating widget stays off so the files are the public surface (2026-08-15).
- Sitewide discovery hints in `index.html`: `llms.txt` describedby link, markdown sitemap alternate, XML sitemap link, and WebSite JSON-LD (2026-08-15).

- Admin control over which metric columns the public leaderboard shows: two checkbox lists on `/admin` (Yappers view and Convex mentions view) backed by a `boardDisplaySettings` singleton. The board hides unchecked columns live and keeps at least one column per view (2026-08-15).
- `/admin/docs`, an admin reference page with the Admin only area note, how to grant or revoke admin access, and what each admin surface does. Linked from the admin header nav (2026-08-15).
- Saved Fourthwall products in the Gift studio: save a product ID with a short label once, then pick it from a chip instead of pasting. Presets can be removed without touching existing campaigns (2026-08-15).
- Recipient ledger search by X handle, powered by a Convex full text search index with prefix matching for typeahead (2026-08-15).
- Tooltips across gift and admin actions explaining what each button does before you press it (2026-08-15).

- Footer social cluster on the right: Convex, X, LinkedIn, YouTube, Discord, and GitHub. GitHub now opens `https://github.com/get-convex`. Phosphor icons for the brand socials, official Convex mark for convex.dev (2026-08-15).
- Small gray "open source yapper board" credit on the left of the footer, linking to `https://github.com/waynesutton/friendsofconvex-yapper-leaderboard` (2026-08-15).
- Admin navigation in the site header on `/admin` routes for signed in admins: Board ops, Gift studio, How to send gifts, an Admin @handle chip, and Sign out in the top right. The Setup guide links are commented out, not deleted (2026-08-15).
- A shared admin only notice on `/admin` and `/admin/gifts` that marks the signed in user as an admin and walks through granting admin access by adding a numeric X user ID to `ADMIN_X_USER_IDS` in the Convex dashboard (2026-08-15).
- `/admin/gifts/guide`, a plain language walkthrough of the Gift studio for non technical admins: status lights, campaigns, adding a recipient, sending, tracking, revoking, and what recipients can share (2026-08-15).
- Personalized OpenGraph for public gift share pages. `GET /gift/share/:token` now rewrites the SPA shell's title and meta tags with the recipient's handle, and `GET /og/gift/:token.png` renders a 1200×630 card server side with `@resvg/resvg-wasm` and Space Grotesk, showing the recipient avatar, handle at an auto fitted size, and campaign name. Unknown tokens fall back to the default site image (2026-08-15).
- `scripts/preview-share-og.mjs`, a local preview of the share card renderer using the same wasm and fonts shipped under `public/render/` (2026-08-15).

### Fixed

- The Add to the board handle box on `/admin` now accepts a leading @, extra spaces, or a pasted x.com/twitter.com profile link. Input sanitizes to a plain handle as you type, so browser pattern validation no longer blocks pastes like "@name" (2026-08-15).

### Changed

- The Yappers board now defaults to the Engagements sort whether the impressions column is shown or hidden; column headers still sort on click and Convex mentions keeps its rank default (2026-08-15).
- Dispatches log rows now read as batches: every recipient in a dispatch shows as its own bold @handle chip with a check on sent ones, led by a "N of M sent" counter, replacing the comma separated +N summary. Row titles are larger, the sidebar rail shows the same sent count, and the log CSV gained a sent_count column. `gifts.listCampaignsAdmin` returns per recipient sent state to power this (2026-08-15).
- The gift status under each name in Create personal passes is now large, bold, and high contrast: gift count with an icon, DMs sent count, and last status; "No gifts yet" renders as a pill. The recipient list scrolls in a taller pane with a thin scrollbar and contained overscroll (2026-08-15).
- The Dispatches sidebar list now flexes to the full height of the studio section, matching the campaign form beside it and resizing with it; the 420px cap only applies on single column layouts (2026-08-15).
- Dispatches sidebar and Dispatches log rows now list the person and the gift: up to two recipient @handles (extras collapse into a +N count, full list on hover) plus the gift's product name from the product shelf, falling back to a shortened Fourthwall product ID. The Dispatches log CSV gained gift_product, recipients, and recipient_count columns (2026-08-15).
- The Dispatches sidebar in the Gift studio scrolls inside its own 420px panel instead of stretching the page, and only shows non archived dispatches (2026-08-15).
- Gift pass and public share cards are now 16:9 with the racing stripe art (`public/background-image-sidebar.svg`), which sweeps along the bottom edge and rises to the right. Card labels trimmed: "PERSONAL PASS / 2026", "ONE GIFT / ONE PERSON", "COMMUNITY / 2026", "FRIEND OF CONVEX", "FRIENDS OF CONVEX GIFT", and "BUILT TOGETHER" are gone. FRIENDS OF CONVEX stays top left; the identity block, name, and status line are left aligned and vertically centered above the stripes (2026-08-15).
- The personalized share OG image matches the new card: solid `#2A1E1D` field, stripe lines along the bottom, text left aligned in the solid area (2026-08-15).
- Space Grotesk is gone from the app. Inter is the display face in CSS, `index.html`, the OG renderer, and the preview script; the old TTFs were removed from `public/render/fonts/` (2026-08-15).
- A slow gradient wash animation on the gift cards was tried and removed on request; the cards sit on the flat `#2A1E1D` field from the art (2026-08-15).
- The public repository link in the footer, `index.html` JSON-LD, and project docs moved from `waynesutton/convexyappers` to `https://github.com/waynesutton/friendsofconvex-yapper-leaderboard` (2026-08-15).
- Top 3 rank badges now show in both board modes, Yappers and Convex mentions. Each badge is a bigger plain medal floating just left of the profile avatar, no background or border. First place is larger still (2026-08-15).
- Daily X metrics cron moved from 08:17 UTC to 15:17 UTC, which is 8:17 AM Pacific during daylight time. Same internal refresh action. Minute 17 stays off the top of the hour (2026-08-15).
- `/about` now says Convex refreshes the board once a day at 8 AM Pacific and links to the Convex cron jobs docs (2026-08-15).
- Join page dropped Copy this join link. Continue with X is the join action. Copy now says admin review is rolling and not automatic (2026-08-15).
- The leaderboard mode toggle now reads Yappers and Convex mentions instead of Impressions and Convex yappers (2026-08-15).
- The header theme switch is a single round Phosphor icon button; the pill with the color wheel logo and text label is gone (2026-08-15).
- The `/admin` and `/admin/gifts` intros dropped to one compact h1 line so the working page starts sooner. The Admin only area note moved to `/admin/docs` (2026-08-15).
- Site favicon is now `public/favicon.png` (dark square, white Convex pinwheel, racing stripes). The footer and gift passes still use `public/convex/symbol-color.svg` (2026-08-15).
- Gift pass headline type is smaller. The `@handle` is its own wrapping line and scales with name length so long handles stay inside the copy column (2026-08-15).
- Gift signal cards (private pass and public share) use the dark radial wash in `public/background-image.svg`. Personalized share OpenGraph images (`/og/gift/:token.png`) use the same gradient. The PNG twin is `public/background-image.png` (2026-08-15).
- Home board chrome is one toolbar row above search: This week's board, the ranking mode toggle, and Copy / Share / Post on X. The "People, ranked by public impressions" heading is gone from the page (it stays for screen readers). Hero and board padding are tighter so the table sits higher (2026-08-15).
- Every big page headline now uses Neue Haas Grotesk Display at weight 900 from the Typekit kit: admin intro, gift studio intro, gift pass, public share page, closed pass card, and admin sign in states join the hero, board title, join, and editorial headlines. The gift signal card name stays in Space Grotesk to match the server rendered OG image (2026-08-15).
- The gift pass and share card recipient name now auto sizes with CSS container queries so long handles fit on one line instead of overflowing the card (2026-08-15).
- The site default social preview is `public/og-friends-of-convex.png` (Friends of Convex / Yapper / Leader board). Gift share pages still rewrite `og:image` to the personalized `/og/gift/:token.png` card. Unknown share tokens fall back to the default file (2026-08-15).

### Fixed

- Mobile leaderboard cards no longer overlap their metric labels. In Convex mentions view the five metrics auto-flowed into the card's narrow rank column, so "Convex posts (7d)" and "Convex engagement" collided with the cells beside them. Metrics now stack as full width label and value rows in both toggle views, so any admin visible column mix lays out cleanly (2026-08-15).
- Gift DM sends that failed with a bare "X OAuth failed with status 400" now report X's real OAuth error (`error: error_description`) and tell the admin to reconnect the sender when a refresh token is rejected. X access tokens expire after 2 hours, so any send after that window refreshes first; a stale or revoked refresh token needs a fresh Reconnect sender authorization (2026-08-15).
- Event history in the recipient ledger looked like plain text because `display: flex` on the summary removed the native disclosure triangle. It now shows a caret that rotates when open, a hover state, and a tooltip. The one other disclosure in the app (admin access note) still has its native triangle (2026-08-15).
- Product shelf inputs rendered without borders or background because the input styles were scoped to the campaign form; they now use the shared inset control treatment with a visible border and coral focus state (2026-08-15).
- Board settings column checkboxes no longer overflow their boxes on `/admin`. The floated legend was pushing the first label outside the fieldset; labels now clear the float (2026-08-15).
- Admins no longer have to sign in twice to reach `/admin`. The gate now waits for the Convex Auth token exchange to finish instead of flashing a second sign in screen (2026-08-15).
- Long gift pass usernames no longer clip against the pass card (2026-08-15).

### Added

- Separate confidential X OAuth 2.0 apps, app-only Bearer Tokens, Convex Auth signing pairs, and complete seven-variable environment configuration for development and production. `@waynesutton` is the first stable-ID admin on both deployments (2026-08-15).
- Convex mentions ranking mode on the leaderboard: a segmented Impressions / Convex yappers toggle, ranking by Convex post count with impressions, engagement, and overall impressions as tiebreakers, a highlighted post-count pill, share of posts, weekly change, dimmed zero rows that stay on the board, and expandable rows that reveal the matched posts with dates and per-post metrics. The scan reuses the existing sync fetch, so it adds zero extra X API calls, and old snapshots load without a migration and show a rescan hint (2026-08-11).
- Convex streak chips for rows with two or more consecutive weeks containing a Convex post, computed from snapshot history anchored to the latest snapshot time (2026-08-11).
- Top 3 rank badges in Convex mode with an admin board-settings section to replace each default medal with a custom emoji, short text, or an uploaded PNG or SVG stored in Convex file storage (2026-08-11).
- A Slack digest action posting the top Convex yappers (rank, handle, post count with share, impressions, streak) through `SLACK_BOT_TOKEN` and `SLACK_DIGEST_CHANNEL`, with an optional channel override from the admin page (2026-08-11).

### Changed

- `docs/SETUP_GUIDE.md` now records the completed 2026-08-15 auth/X setup, final dev and production `SITE_URL` values, exact X app ownership, first-admin state, and verified live routes (2026-08-15).
- The admin per-profile sync button is now labeled Rescan, and both it and Sync everyone carry tooltips explaining that a sync re-pulls recent posts and rescans them for Convex mentions (2026-08-11).

- Both setup guides now document the live `https://friendsofconvex.dev` origin. Every production OAuth callback and webhook URL moved from `agile-spaniel-476.convex.site` to `friendsofconvex.dev` because production `CONVEX_SITE_URL` is overridden to the custom domain and the app builds those URLs from it (2026-08-11).
- `docs/SETUP_GUIDE.md` gained a verified 2026-08-11 environment audit, an ordered what's-left checklist for dev and production, a "How sign-in and admin access work" section, and a "Security model" section covering server-side admin enforcement, secret placement, webhook signatures, and encrypted sender tokens (2026-08-11).
- `docs/fourthwall-setup.md` status table and production steps now mark the domain and production `SITE_URL` complete and drop the already-set `SITE_URL` command (2026-08-11).
- Footer attribution now reads Built with Cursor + Convex. The Cursor logo mark from logos.lndev.me replaces the Codex icon and links to cursor.com, and the Convex wordmark grew from 62 to 92 pixels (2026-08-10).
- The footer GitHub icon now links to the `waynesutton/friendsofconvex-yapper-leaderboard` repository and the Codex Sites + Convex Backend Skill text link was removed (2026-08-10).
- The Vite dev server is pinned to port 5174 in `vite.config.ts`, and the setup and Fourthwall guides now use `http://localhost:5174` in every local URL (2026-08-10).
- The Copy this join link action on the join page doubled from 13 to 26 pixels so it reads as the primary page action. The copy icon scales with it and the coral underline offset grew to match (2026-08-10).

### Fixed

- Rebuilt and uploaded the development static frontend, restoring `200` responses on `/`, `/join`, and `/about` after the dev host returned `503`/`404` (2026-08-15).
- Replaced the last visible import status using `tracked` with `Already on this board.` and deployed the backend correction to development and production (2026-08-15).
- Mobile leaderboard cards no longer truncate common display names. The third card column now caps at the action-button width so long metric labels wrap instead of squeezing the name column, verified at 320, 375, and 390 pixel widths (2026-08-10).
- Row action buttons on the board now carry an invisible hit-area extension that meets the 44 pixel minimum touch target without changing the 38 pixel visual circle (2026-08-10).
- Development `.env.local` now points `VITE_CONVEX_URL` at the linked cloud development deployment instead of an unstarted local backend, which left the board stuck on loading skeletons (2026-08-10).

### Added

- The `convex-helpers` package for shared Convex server and client utilities (2026-08-10).
- The official `@convex-dev/eslint-plugin` recommended rules with type-aware linting so Convex best practices are enforced on every lint run (2026-08-10).
- Vite React single page app in `src/` with react-router-dom routes for every public, admin, gift, and join page (2026-08-10).
- The `@convex-dev/static-hosting` component with app-owned root routing so the frontend and backend publish together with `npm run deploy` (2026-08-10).
- A `usePageTitle` hook, an `index.html` shell with the no-flash theme boot script, and Google Fonts loading that replaces `next/font` (2026-08-10).
- A persistent header theme switcher with a new Convex-inspired default and the
  original warm Studio design preserved as the alternate.
- Official Convex wordmarks, the supplied racing-line artwork, the complete
  design brief, and the supplied Convex homepage reference in the project.
- A new dark 1200×630 Convex-themed social preview card for the default theme.
- Sortable leaderboard columns with ascending and descending controls on desktop and compact card-layout sorting on smaller screens.
- Private production deployment at
  `https://friends-of-convex-yappers.waynesutton.chatgpt.site`, backed by the
  approved Convex production deployment.
- Verified production URL map for the linked Convex project, including the X
  login and gift-sender callbacks, X Account Activity endpoint, Fourthwall
  webhook, Convex client URL, confirmed private Sites routes, and pending public
  access.
- A production handoff checklist that distinguishes Site registration, saved
  versions, private deployment, confirmed live URL, and public access.
- Friends of Convex people-only seven-day X impression leaderboard.
- Search, profile links, share actions, and footer pagination.
- Open local `/admin` for adding, archiving, restoring, and syncing X handles.
- Convex schema, realtime queries, X sync actions, snapshots, and daily refresh cron.
- Honest missing-key and sync-error states with no fabricated rankings.
- About and setup routes, plus the standalone operator guide.
- Responsive warm-paper and coral interface inspired by the supplied Cohere reference.
- Required “Built with Codex / Powered by Convex” footer attribution.
- Convex Auth X login for join requests and admin access.
- Public `/join` route with a copyable group link and membership status.
- Pending, approved, and rejected membership review states.
- Preview-first bulk handle and public X List imports for up to 100 accounts.
- Local JWT key generator and ordered auth, environment, X API, and production instructions.
- Admin-only Fourthwall gift studio with campaign provisioning, recipient selection, and a lifecycle event ledger.
- Separate consent-first X sender connection with encrypted refresh tokens and one-to-one DM delivery.
- Personalized private gift passes, safe public share cards, giveaway-link reveal tracking, and redemption status.
- Signed and deduplicated Fourthwall `ORDER_PLACED` webhook handling plus manual package reconciliation.
- Standalone novice guide for development, production, environment values, callbacks, consent, and troubleshooting.
- Signed X Account Activity webhook ingestion with automatic inbound `GIFT` consent and `STOP` suppression.
- Admin-only webhook registration, OAuth 1.0a sender subscription, connection health, and per-profile intent indicators.
- Privacy-minimized X activity audit records and global per-X-user intent state that applies across gift campaigns.
- Numbered repeat gift deliveries with a separate recipient record, pass, Fourthwall link, X DM ID, redemption lifecycle, and event ledger for every gift.
- Bounded per-person gift history and prior-delivery status in the admin recipient picker.
- Node 24 project pins and startup preflight guidance for unsupported terminal runtimes.

### Fixed

- The production browser bundle no longer depends on `NEXT_PUBLIC_CONVEX_URL`, which the old build system never compiled in. The Vite build reads `VITE_CONVEX_URL` and falls back to `getConvexUrl()` on the static host (2026-08-10).
- Documented why this folder previously did not appear in ChatGPT Sites and
  completed its registration, saved-version, deployment, and live-URL lifecycle.
- Reordered production setup so the final `.chatgpt.site` origin is obtained
  before it is entered as `SITE_URL` or the X app Website URL.
- Fixed `npm run dev` startup failures caused by the Vinext/Vite version mismatch, TypeScript Next config loading, and the unsupported Space Grotesk loader.
- Fixed persistent local startup failures caused by the terminal forcing Homebrew Node 20, and made the Vinext font/plugin compatibility path stable under Homebrew Node 24.
- Clarified the startup failure and reusable Sites workflow so repeating `npm install` is never presented as a Node-version fix.
- Updated Vite path resolution and the Cloudflare image worker to the current Vinext APIs.
- Added the missing Next type dependency and aligned React, React DOM, and React Server Components patch versions.

### Security

- Protected `/admin`, `/admin/setup`, admin reads and writes, imports, and manual syncs with Convex Auth.
- Added a backend allowlist keyed by stable numeric X user IDs.
- Kept pending join requests inactive and absent from the public leaderboard until approval.
- Kept Fourthwall and X sender credentials in Convex, encrypted X sender tokens at rest, and separated private claim tokens from public share tokens.
- Required an admin-confirmed inbound gift request before X DM delivery and recorded API creation as sent rather than delivered or read.
- Added expiring and revocable private gift passes, webhook signature checks, and idempotent event handling.
- Verify X Account Activity CRC and POST signatures with the API secret, deduplicate DM events, ignore outbound messages, and never store complete DM text.
- Recheck global X opt-out state immediately before DM delivery so a recent `STOP` blocks unsent gifts.
- Atomically consume each provider-detected `GIFT` event once so it cannot authorize multiple automated DMs.
- Keep older recipient rows suppressed after `STOP`; a fresh `GIFT` authorizes a new delivery without silently reactivating previous unsent gifts.

### Changed

- Migrated every `ctx.db.get`, `patch`, and `delete` call to the explicit table-name format recommended by Convex 1.31+, applied by the ESLint autofix (2026-08-10).
- Moved the daily X metrics refresh cron from 08:00 to 08:17 UTC to avoid the top-of-the-hour traffic spike (2026-08-10).
- Switched the hero title, board title, join headline, and about headline to the Adobe Fonts Neue Haas Grotesk Display face at weight 900, loaded from Typekit kit `xmd6bow` in `index.html` (2026-08-10).
- Rebuilt the frontend from the Next.js App Router on Vinext to a plain Vite React SPA served by Convex static hosting; the interfaces, admin features, X features, and both themes are unchanged (2026-08-10).
- Removed Next.js, Vinext, Cloudflare worker, and Codex Sites files and dependencies from the repository root (2026-08-10).
- Rewrote `SETUP_GUIDE.md` and `fourthwall-setup.md` for the new stack, the `npm run deploy` publish flow, and the planned `friendsofconvex.dev` custom domain (2026-08-10).
- Restyled every public, admin, setup, join, and gift route through shared theme
  tokens without changing application behavior or exposing private navigation.
- Tightened the new desktop hero and board controls so leaderboard content
  begins above the fold while the Rolling Signal card keeps its dimensions.
- Changed the site favicon from the Codex mark to the official Convex symbol.
- Removed the separate Top Signal podium strip, moved its seven-day label into
  the hero eyebrow, and raised the leaderboard higher on the homepage.
- Registered the app in ChatGPT Sites, configured the hosted production Convex
  URL, and replaced pending Site URL placeholders with the confirmed canonical
  production origin.
- Reduced homepage and About hero typography and vertical spacing so leaderboard content appears sooner.
- Renamed the homepage headline to “Friends of Convex Yapper Leader Board.”
- Moved the in-app setup guide from `/setup` to `/admin/setup`.
- Removed Admin and Setup links from the public header and footer.
- Added a public Join the board link without exposing Admin or Setup navigation.
- Moved all X and auth secrets to Convex; Codex Sites needs only the public Convex client URL.
- Expanded both setup guides with an ordered Convex Auth, X OAuth, development, target-team production, and Codex Sites environment workflow.
- Updated local setup to the supported accountless `npx convex dev --once` Agent Mode flow.
- Documented comma-separated multi-admin access and safe add/remove steps using stable numeric X IDs.
- Added an admin-only Gift studio entry without changing public navigation or the existing leaderboard interface.
- Documented why the X DM flow uses a separate sender grant from Convex Auth and why Resend is not required for the supported reply flow.
- Automated provider-verified gift consent while preserving the admin-confirmed fallback; an active X `STOP` cannot be overridden manually.
- Made repeat recipients explicit in the gift studio with `GIFT ready`, `GIFT used`, prior gift counts, and per-person gift numbers.
