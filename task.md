# Task log

## To do

- [ ] Run one production sync (`xSync.refreshAll` from the admin page, or wait for the 15:17 UTC cron) so the live board picks up the reply-filtered post counts. Numbers will drop for everyone; that is the fix landing.
- [ ] Optional follow up if the "engagements" name keeps causing confusion: rename the column to "Public engagement" so it stops colliding with the broader engagements figure in X analytics.

## Completed — 2026-08-16 05:05 UTC (custom DM message per dispatch)

- [x] The New dispatch form has an "Edit the X DM message for this dispatch" toggle below Approved recipients. It opens a textarea prefilled with the default message as a template with `{link}`, `{name}`, and `{number}` placeholders, a character counter (1000 cap), Reset to default, and a live preview rendered with the first selected person. Only that dispatch's recipients get the custom text; the default message stays hardcoded for everything else. PRD: prds/custom-gift-dm-message.md.
- [x] Backend: optional `customDmMessage` on `giftCampaigns`, threaded through `createCampaign` and `createProvisioningCampaign` (trim plus 1000 char server cap). `sendGiftDm` renders through a new `buildGiftDmText` helper: default path is byte for byte the original text, custom path substitutes placeholders and appends the pass link and STOP notice if the text leaves them out. `convex/schema.ts`, `convex/gifts.ts`, `convex/giftActions.ts`.
- [x] Ledger: dispatches with an edited DM show a collapsible "Custom DM message active for this dispatch" note, and Copy DM copies the rendered custom text so the clipboard matches the send. `src/components/GiftAdminPanel.tsx`, `src/globals.css`.
- [x] Verified: `npm run lint` and `npm run typecheck` pass; node sanity check confirms the default output is unchanged and placeholders plus safety nets render correctly.

## Completed — 2026-08-16 04:50 UTC (Load more works past the Top filter)

- [x] The Top filter no longer hard caps the board. Top 30 opens with 30 rows and Load more adds 30 per click; Top 60 opens with 60 and adds 60, and so on until every yapper is visible. Before, picking any Top N hid the Load more button entirely, so a board with 120+ friends stopped at 60. "All yappers" keeps its 30 row steps. `src/components/Leaderboard.tsx`.
- [x] Search, mode toggle, sort, and filter changes reset the reveal back to the current filter's starting count instead of always 30. The "N people" counter beside search and the "Showing X of Y" footer now count the whole filtered board, not the capped slice.
- [x] Bumped both `listLeaderboard` subscriptions from 200 to 250 rows, the backend cap, so Load more can actually reach everyone the query can return. Checked the rest of `src/` for the same capped-list pattern; the leaderboard was the only one.
- [x] Verified: no linter errors on the touched file.

## Completed — 2026-08-16 03:25 UTC (approved recipients list boxed and viewport aware)

- [x] The Approved recipients list in the Gift studio campaign form is now a visible boxed well: full `--line-standard` border with `--radius-small`, inset `--studio-paper` background against the form's sheet, and inner padding, so the scroll region reads as one contained control instead of two floating hairlines. The last row drops its bottom border to avoid a double line against the box edge. `src/globals.css`.
- [x] The list height now scales with the viewport: `max-height: clamp(420px, 60dvh, 960px)` replaces the fixed 420px cap, so taller screens show more recipients before scrolling while small screens keep the old floor. Both themes covered since they each define the tokens used.

## Completed — 2026-08-16 03:10 UTC (board toolbar rearranged)

- [x] Row one of the board is now kicker plus search: "This week's board · Last 7 days", the freshness chip, and the methodology link on the left, with a compact search field (min 380px cap, 48px tall) right aligned beside them. New `board-search` class on the existing `.search-field` control keeps the inset styling.
- [x] Row two sits directly above the table: the Yappers / Convex mentions tabs on the left and the Top 30 filter, Copy link, Share, and Post on X actions right aligned. New `.board-controls` flex row; the old full width search line is gone.
- [x] Mobile (375px) verified by measurement: kicker, full width search, tabs, then share actions stack with no horizontal overflow. The share toolbar's mobile left align rule moved from `.board-toolbar` to `.board-controls`.
- [x] Verified in the browser in both themes; `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass. `src/components/Leaderboard.tsx`, `src/globals.css`.

## Completed — 2026-08-16 03:00 UTC (readable board kicker and time window)

- [x] The board kicker now reads "This week's board · Last 7 days" so the measurement window is stated where readers look first. The label renders at near full ink (`--broadcast-ink-soft`, weight 750) instead of muted caption ink. `src/components/Leaderboard.tsx`, `src/globals.css`.
- [x] Fixed a real contrast bug the screenshot exposed: the freshness chip and the "How this is measured" link had Convex theme overrides of `rgba(255, 250, 240, 0.6)` (near white) sitting on the cream `--studio-paper` background, so both were unreadable. The overrides are removed and both now use the theme's ink tokens.
- [x] In the Convex theme the bordered eyebrow box wrapped the whole kicker row (label, chip, and link). The border now sits on the label span only, so the chip and link stand beside the boxed label.
- [x] Verified in the local browser in both themes with screenshots; `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.

## Completed — 2026-08-16 03:00 UTC (default rank view and reply filter re-check)

- [x] Both board modes now open on the ranking view. Default `sortKey` is `rank` ascending, and toggling Yappers / Convex mentions resets to Rank instead of Engagements. Row order is unchanged because rank already encodes each mode's canonical order. `src/components/Leaderboard.tsx`.
- [x] Re-verified the reply filter on dev: re-ran `xSync:refreshAllScheduled`, today's snapshot upserts to postCount 26 / convexPostCount 11 (pre-fix rows were 42 / 26), and the browser board shows 26 posts with "11 of 26" share. Convex mention counts also exclude reply-thread mentions now, keeping Convex posts a true subset of Posts.
- [x] Verified in the local browser: Rank is `aria-sort="ascending"` and the active header on load in both modes, and sorting by Convex impressions then toggling back to Yappers resets to Rank. Tooltips render on all metric headers.
- [x] Verified: `npx tsc --noEmit`, `npm run lint`, and `npm run build` pass.

## Completed — 2026-08-16 02:55 UTC (metric definitions, honest post counts, column tooltips)

- [x] Investigated the "49 posts and 75k engagements ... that is way off" feedback. Read prod (`profiles:listLeaderboard`), then replayed the exact X API v2 request `convex/xSync.ts` makes for the rank 1 account. The stored values match the API, so **no resync was needed and a resync would not have changed anything**. The problem was definitional. PRD: prds/metric-definitions-and-tooltips.md.
- [x] Found the real data bug: X's `exclude=replies` does not remove self-thread replies. Breaking the board's own 50 results down by `referenced_tweets` gave 18 original, 22 quote posts, and 10 replies, so the Posts column counted replies it claimed to exclude. `convex/xSync.ts` now requests `referenced_tweets` and drops anything referencing `replied_to` or `retweeted`. Quote posts stay counted. All four metrics (posts, engagements, impressions, Convex mentions) now read from the same filtered list.
- [x] Verified on dev with a live sync: the same real account's snapshot went from postCount 42 to 26 after the change, which is the reply leakage coming out.
- [x] Added `src/components/MetricInfo.tsx`, an accessible definition popover (hover, focus, click for touch; closes on Escape, blur, outside pointer), and attached a plain language definition to every metric column header in both board modes, including the static Share of posts header. Styles for both themes in `src/globals.css`, with the last two columns' bubbles right aligned so they stay inside the table.
- [x] Added a "How this is measured" link beside the freshness chip, since the table header is `display: none` under the mobile breakpoint and tooltips are unreachable there.
- [x] Rewrote About sections 02 and 03 to state the exact rules: what counts as a post, and that engagements is likes + reposts + replies + quotes + bookmarks from the X API public metrics, which is narrower than the engagements number in X analytics. Added a closing note inviting corrections.
- [x] Fixed wrong refresh copy. The hero panel said "Daily at 08:00 UTC" but `convex/crons.ts` runs `17 15 * * *`. Now reads "Daily at 8:17 AM Pacific" on the board and About.
- [x] Verified: `npx tsc --noEmit`, `npm run lint`, and `npm run build` all pass; `npx convex dev --once` deployed and `xSync:refreshAllScheduled` ran clean on dev.

## Completed — 2026-08-16 00:55 UTC (README and agent setup prompt)

- [x] Rewrote `README.md` so fork setup is self contained (local `docs/` stays gitignored). Feature list now covers Gift lab, Top N / Load more, 7 day gift expiry, product shelf, Dispatches bulk ops, and admin surfaces.
- [x] Added an APIs and accounts table with Convex env **names only** (required X OAuth + Bearer Token + Auth keys + SITE_URL + ADMIN_X_USER_IDS; optional Fourthwall, X DM / Account Activity, Slack). No secret values.
- [x] Updated the one prompt coding agent block for Convex agent mode (`CONVEX_AGENT_MODE=anonymous`), callback URL shape, and skip list for gifts on first run.
- [x] Synced `task.md`, `changelog.md`, and `files.md` for this docs pass.

## Completed — 2026-08-16 00:52 UTC (confirmed state button size and copy)

- [x] The Share a safe public card button no longer changes shape after a gift is confirmed. `.gift-portal-actions` is a grid and its items stretch to the row height, so the taller confirmed message box (68px, boxy corners) stretched the share pill into a bigger oval. `.gift-redeemed-message` is now the same 56px pill as `.gift-primary-action` and `.gift-share-action`, so both grid cells match before and after redemption. `src/globals.css`.
- [x] Confirmed message copy changed from "Fourthwall confirmed your gift." to "Gift confirmed." on both the board gift pass and Gift lab pages; the "Thank you for being a Friend of Convex." line stays. `src/components/GiftPortal.tsx`, `src/components/GiftLabPortal.tsx`.
- [x] Verified: no linter errors on the three touched files.

## Completed — 2026-08-16 00:45 UTC (Gift lab named links)

- [x] New admin page `/admin/gift-lab` (Gift lab) linked from the admin header nav. Enter a full name, pick a Fourthwall product, and check or uncheck "Link expires 7 days" to mint a personal gift link at `/gift/for/:token`. The full URL shows on the page with a copy button, plus a Gift lab links log with per link copy, open, Check Fourthwall, Close link, and two step Delete. No consent section, no X sender, no DMs, no emails. PRD: prds/gift-lab-custom-links.md. `src/components/GiftLabPanel.tsx`, `src/pages/AdminGiftLabPage.tsx`, `src/App.tsx`, `src/components/SiteHeader.tsx`.
- [x] Recipient page says "A signal of thanks for {Full Name}" with the branded gift card, a reveal button to Fourthwall, and a countdown only when the link expires. No X handle, no avatar, no public share card. `src/components/GiftLabPortal.tsx`, `src/pages/GiftLabPassPage.tsx`; `GiftCountdown` and `GiftRotor` exported from `GiftPortal.tsx` for reuse. Served by the existing `@convex-dev/static-hosting` catch all, so no HTTP route changes.
- [x] Backend: `giftLabLinks` table (`by_token`, `by_created_at`, `by_fourthwall_gift_id`), `convex/giftLab.ts` (portal query and mutations with server time expiry, admin list/revoke/delete, internal helpers), `giftActions.createLabLink` and `syncLabLink`, and `gifts.applyFourthwallOrder` now falls back to lab links so the signed Fourthwall webhook marks them redeemed.
- [x] Product shelf extracted into shared `src/components/GiftProductShelf.tsx`; the Gift studio and Gift lab read the same saved products.
- [x] Verified: `npm run typecheck`, `npm run lint`, and `npm run build` pass; convex dev deployed the schema and functions; browser test of a seeded link showed the name-only page, reveal flow, and the closed card for an invalid token. A test row named "Fable Test" is on dev; delete it from the Gift lab log.

## Completed — 2026-08-15 23:59 UTC (gift count dropdown fix)

- [x] The "All gift counts" dropdown in the Approved recipients picker opens again. The recipient list rule `.gift-profile-picker > div` also matched the picker toolbar, and its `overflow-y: auto` clipped the floating menu, so the caret flipped but no options showed. The list div now carries a `gift-profile-list` class and the CSS targets only it, which also removes the stray border line under the toolbar. Filters (No gifts yet, 1 through 4, 5+) work as designed. `src/components/GiftAdminPanel.tsx`, `src/globals.css`.
- [x] Verified: `npm run typecheck` and `npm run build` pass.

## Completed — 2026-08-15 23:46 UTC (engagement rank badges and 7 day gift links)

- [x] Rank badges now follow the engagement order after every sync or import. `profiles.listLeaderboard` sorts synced profiles first, then engagements, impressions, posts, and added date as tie breakers, so the canonical rank the frontend uses for badges matches the board's default Engagements sort. Verified against the dev deployment: rows come back synced-first in engagement order. `convex/profiles.ts`.
- [x] Gift links now expire 7 days after the dispatch is created, including links generated before this rule. `giftLinkExpiresAt` in `convex/gifts.ts` caps the portal window at creation plus 7 days with no migration, `getPortal` and the reveal mutations enforce it with server time, and redeemed passes stay viewable.
- [x] Hourly cron `expire gift links` (`convex/crons.ts` → `gifts.expireGiftLinks`) closes active dispatches past the cap so the admin Dispatches log stays honest. Dry run on dev returned `{ expired: 0 }` with no active expired campaigns.
- [x] Claim page countdown: `GiftCountdown` in `src/components/GiftPortal.tsx` ticks every second under the trust line ("The claim button goes directly to fourthwall.com..."), shows days, hours, minutes, seconds plus the exact expiry date, turns red inside the last day, and swaps to the closed card the moment it hits zero on an unredeemed pass. Styles in `src/globals.css` on existing tokens.
- [x] Admin side: campaign form caps Days active at 7 (default 7) with a hint about the hourly job, the DM text tells recipients the pass expires 7 days after issue, and `/admin/gifts-guide` documents the cap. `src/components/GiftAdminPanel.tsx`, `convex/giftActions.ts`, `src/pages/AdminGiftsGuidePage.tsx`.
- [x] Verified: `npm run typecheck` and `npm run build` pass; `npx convex run profiles:listLeaderboard` and `npx convex run gifts:expireGiftLinks` behave as expected on dev.

## Completed — 2026-08-15 22:55 UTC (Rybbit analytics)

- [x] Added the Rybbit analytics script (`data-site-id="1706f8ad75ab"`, deferred) to the head of `index.html`. The app is a Vite SPA, so this single shell covers every route.

## Completed — 2026-08-15 22:50 UTC (board load more and gift studio visibility)

- [x] Leaderboard defaults to the Engagements sort in Yappers view whether or not the impressions column is visible; every column header still sorts on click and Convex mentions keeps its rank default. `src/components/Leaderboard.tsx`.
- [x] Replaced Previous/Next pagination with a centered Load more button plus a "Showing X of Y" counter on both board tabs. Search, sort, tab, and filter changes reset the reveal.
- [x] New themed dropdown component `src/components/FilterDropdown.tsx` (no native select): secondary button trigger, floating menu on palette tokens, outside click and Escape to close, listbox roles. Used twice.
- [x] Top filter dropdown next to Copy link on the board: Top 30, 60, 100, 150, or All, applied after search and sort; the people counter follows the cap. Defaults to Top 30. The list length matches the dropdown: Top N renders all N rows at once, and Load more only appears on All yappers, stepping thirty rows per click.
- [x] Dispatches log rows read as batches: every account in a dispatch renders as its own bold @handle chip (no comma line, no +N collapse), sent chips get a check mark, and a "N of M sent" counter pill leads the row. Titles bumped to 17px. The sidebar rail line and the CSV (`sent_count` column) show the same count. Backend: `gifts.listCampaignsAdmin` now returns `recipientDetails` (handle, name, sent) and `sentCount` — additive fields, safe on prod.
- [x] Create personal passes picker: the gift line under each name is now 12px bold high contrast with a gift icon count, a paper plane sent count, and the last status; "No gifts yet" renders as a pill. Counts come from `giftNumber` in gift history so prod data stays accurate even past the 250 row window.
- [x] Approved recipients scrolling: taller 420px pane, thin scrollbar, contained overscroll, and a bottom border so the cut off point is visible.
- [x] Gift count filter dropdown in the picker toolbar: All, No gifts yet, 1 through 4, and 5+ gifts. Works with search, and Select shown targets the filtered list, so "select everyone with no gifts" is two clicks.
- [x] Verified: `npx tsc --noEmit` and `npx eslint` on all touched files pass.

## Completed — 2026-08-15 22:36 UTC (security scan fixes)

- [x] Ran the sec-check audit across every Convex function, webhook, OAuth flow, and secret path. All admin functions are gated (confirmed with live unauthenticated probes against the dev deployment), webhooks verify HMAC signatures, sender tokens are AES-GCM encrypted at rest, no secrets are in git history, and `npm audit` reports zero vulnerabilities. Three lower severity findings were fixed.
- [x] Public `profiles.listLeaderboard` no longer returns raw profile docs. New `publicLeaderboardRowValidator` in `convex/validators.ts` projects only the fields the board renders; `authUserId`, `syncError`, `xUserId`, `membershipStatus`, `source`, `requestedAt`, and `reviewedAt` stay server side. The board UI already derived its type from the query, so no visible change.
- [x] `gifts.getPortal` no longer ships the private Fourthwall URL. The query trusts a client supplied `now` for the expiry display, so the URL now only travels through the `reveal` and `recordFourthwallClick` mutations, which enforce expiry with server time. `GiftPortal.tsx` switches its revealed check to the existing `revealed` flag; the claim button behavior is unchanged.
- [x] The unauthenticated X CRC endpoint can no longer clear `lastError` on the account activity config; it only records `lastValidatedAt` now, so an outsider hitting the URL cannot mask real webhook errors in the admin panel.
- [x] Verified: `npm run typecheck` and `npm run lint` pass, `npx convex dev --once` deployed clean, and a live re-probe of `profiles:listLeaderboard` shows only the projected fields. Unauthenticated probes of `profiles:listAdmin` and `gifts:listCampaignsAdmin` still throw the sign-in error.

## Completed — 2026-08-15 21:41 UTC (mobile X login UX)

- [x] Guided mobile visitors through X sign-in without touching the OAuth setup. New `src/lib/browserEnvironment.ts` detects the X app's in-app WebView from the user agent, checks for coarse-pointer (touch) devices, and tracks a sessionStorage sign-in attempt flag. PRD: `prds/mobile-x-login-ux.md`.
- [x] `/join`: signed-out visitors inside the X app browser see an instruction card (open in Safari on iPhone, Chrome on Android) above a still-working Continue with X button; other phones get a one-line "stay in this browser" hint. The button now disables while redirecting ("Opening X sign-in").
- [x] Failed OAuth round trips are no longer silent. Convex Auth redirects back with no query param on failure, so the attempt flag plus a signed-out return shows "Sign-in didn't finish. Stay in this browser and try once more." exactly once. Flags older than ten minutes are ignored; storage errors degrade to the old behavior.
- [x] `AdminGate` got the same busy state, failure message, and mobile hint on its Continue with X screen. Backend, callbacks, scopes, and share intent links are untouched.
- [x] Verified: `npm run check` (lint, tsc, build) passes. Browser checks on the dev server: desktop `/join` and `/admin` unchanged, simulated `Twitter for iPhone` UA shows the in-app card with the button still enabled, a seeded attempt flag shows the retry message once and clears on the next load.

## Completed — 2026-08-15 21:30 UTC (forgiving X handle input)

- [x] The Add to the board handle box on `/admin` now accepts anything reasonable: typed or pasted values with a leading @, extra spaces, or a full x.com/twitter.com profile link all sanitize to a plain handle as you type. Before, the HTML pattern only allowed one optional @, so pastes like "@name " failed browser validation and never reached Convex.
- [x] Frontend only change in `src/components/AdminPanel.tsx` (`sanitizeHandleInput` plus a tightened input pattern). The backend `normalizeHandle` in `convex/profiles.ts` already strips @ and lowercases, so no server change was needed.
- [x] Verified: no linter errors; input sanitization happens on every change so the visible field never shows a double @.

## Completed — 2026-08-15 21:05 UTC (gift studio bulk operations)

- [x] Dispatches log toolbar like the dashboard logs pattern: Recent, Archived, and All view tabs with counts, a search box matching title, gift name, or recipient @handle, a select all checkbox, per row checkboxes, and a bulk action cluster (Archive, Restore, two step Confirm delete, Clear). Bulk actions only touch selected rows still visible, so a search or tab change can never act on hidden dispatches. Download CSV now exports what the log shows. PRD: `prds/gift-studio-bulk-operations.md`.
- [x] Backend: `gifts.setCampaignsArchived` (bulk, cap 50) and `gifts.deleteCampaignsAdmin` (bulk, cap 25) with a shared `deleteCampaignCascade` helper that the single delete reuses. Both admin only and idempotent.
- [x] Dispatches sidebar list now flexes to the full height of the studio section (the campaign form defines it) and grows or shrinks as the form resizes; the 420px cap only returns on single column layouts so the page never stretches.
- [x] Approved recipients picker: search by name or handle, Select shown, Select GIFT ready (only unused GIFT requests), Clear, and a live selected count. Selecting more than 50 disables Create with an inline warning matching the backend cap.
- [x] Batch X DM send in the recipient ledger: checkboxes on sendable passes, Select sendable, and a Send X DMs button that sends one at a time with a 2 second gap. X rules stay intact because every send still runs `giftActions.sendGiftDm`, which re-checks STOP, admin opt out, consent, and link readiness server side right before each API call. Three failures in a row stop the loop; a summary reports sent, already sent, and failures.
- [x] Verified: `npm run typecheck` and `npm run lint` pass; Convex dev accepted the mutations. Deployed to prod (backend `npx convex deploy --yes`, frontend `npm run deploy -- --skip-convex`, live at friendsofconvex.dev). Signed in bulk flows need a manual pass since the IDE browser stops at the X sign in gate.

## Completed — 2026-08-15 19:50 UTC (dispatch rows show person and gift)

- [x] Dispatches sidebar and Dispatches log rows now show who received each dispatch and what the gift is. `gifts.listCampaignsAdmin` returns each campaign plus `recipientHandles`, `recipientCount`, and `productName` (looked up from the product shelf preset matching the campaign's Fourthwall product ID, falling back to the preset label, then a shortened product ID).
- [x] Rows render a second line: up to two @handles (extras collapse into "+N more", full list on hover) and the gift name. New `.gift-dispatch-detail` style keeps handles and product names in their real casing under the uppercase status line.
- [x] The Dispatches log CSV export gained `gift_product`, `recipients`, and `recipient_count` columns.
- [x] Verified: `npx tsc --noEmit` passes, no linter errors, Convex dev accepted the new validators. Deployed to prod: `npx convex deploy --yes` then `npm run deploy -- --skip-convex` (live at friendsofconvex.dev). The signed in rows need a manual look since the IDE browser stops at the X sign in gate.

## Completed — 2026-08-15 19:25 UTC (mobile leaderboard cards)

- [x] Fixed overlapping metric labels on the mobile leaderboard cards. In Convex mentions view the five metric cells auto-flowed into the card's 36px rank column, so "Convex posts (7d)" and "Convex engagement" overlapped the neighboring cells. Yappers view had "Posts" squeezed into the same 36px track.
- [x] Metric cells now span the full card width as label and value rows (label left, value right, hairline divider per row). Works for any admin visible column mix in both toggle views; removed the per-column grid pins and the convex mode auto-flow override in `src/globals.css`.
- [x] Mobile audit of other pages at 390px: join, about, and the gift studio breakpoints are fine; no other overlaps found.
- [x] Verified in the browser at 390px emulated width on both toggle views; no linter errors.

## Completed — 2026-08-15 19:20 UTC

- [x] Diagnosed the production "X OAuth failed with status 400" on gift sends. Prod logs show `giftActions:sendGiftDm` failing at 12:07 and 12:08 PM; the stored sender connection was created about 11 hours earlier, its 2 hour access token had expired, and X rejected the refresh token grant. The opaque message came from `errorMessage` ignoring the OAuth `error` and `error_description` fields the X token endpoint returns.
- [x] `errorMessage` in `convex/giftActions.ts` now surfaces `error: error_description` from OAuth payloads, and a rejected refresh throws an actionable message: reconnect the sender in the gift studio, then retry the send.
- [x] Event history in the recipient ledger now shows a caret that rotates open, a hover state, and a tooltip. The `display: flex` on the summary had removed the native disclosure triangle, leaving plain text with no toggle affordance.
- [x] Audited the rest of the app for the same problem: the only other `<details>` (admin access note) keeps its native triangle, and no click handlers sit on non-interactive elements.
- [x] Verified: `npx tsc --noEmit` passes and no linter errors. Remediation on prod still needed: click Reconnect sender in the gift studio, then resend.

## Completed — 2026-08-15 19:25 UTC

- [x] Dispatches sidebar on `/admin/gifts` scrolls on its own: the campaign list caps at 420px with a thin inner scrollbar, so a long history never stretches the studio. Archived dispatches leave the sidebar. PRD: `prds/dispatch-log-archive-delete.md`.
- [x] New Dispatches log section below the recipient ledger: every campaign (active and archived) with Archive, Restore, a two step Delete (arms red, second click confirms; anything else disarms), and a Download CSV export (title, status, archived time, product ID, created, last synced, sync error).
- [x] Backend: optional `archivedAt` on `giftCampaigns`, admin `gifts.setCampaignArchived` toggle, and `gifts.deleteCampaignAdmin` which cascade deletes the campaign's events, recipients (their pass and share pages die with them), then the campaign. Both idempotent.
- [x] Sidebar and log stay in sync automatically because both render from the same `listCampaignsAdmin` query; deleting the selected campaign falls back to the newest visible one.
- [x] Verified: `npm run check` passes (lint, typecheck, build); Convex dev accepted the schema and mutations. Archive and delete clicks need a signed in manual pass since the IDE browser stops at the X sign in gate.

## Completed — 2026-08-15 19:10 UTC

- [x] Product shelf add inputs styled like the campaign form fields: inset background, visible border, small radius, 48px height, coral focus border. They previously rendered as bare text.

## Completed — 2026-08-15 19:05 UTC

- [x] Product shelf in the Gift studio: a new section where admins save labeled Fourthwall product IDs before any dispatch. Each save calls the Fourthwall Get Product endpoint, rejects unknown IDs, and stores the product name plus thumbnail. Cards show the image (or a gift glyph), label, name, short ID, a Use button that fills the campaign form, and remove. PRD: `prds/gift-product-shelf-previews.md`.
- [x] The pick-to-fill chips under the campaign form's product ID input stay and now show a tiny product thumbnail when one is stored. The old in-form label plus Save row moved to the shelf.
- [x] Backend: `giftActions.saveProductPreset` action (Fourthwall lookup, 404 rejects, other failures save without preview), `gifts.upsertProductPreset` internal mutation, optional `productName` and `thumbnailUrl` on `giftProductPresets`.
- [x] Verified: `npm run check` passes (lint, typecheck, build); Convex dev deploy accepted the schema. The signed in shelf flow needs a manual pass since the IDE browser stops at the X sign in gate.

## Completed — 2026-08-15 18:40 UTC

- [x] Admins can permanently remove a handle from the Friends on the board section. New admin only `profiles.remove` mutation deletes the profile plus all its snapshots and is idempotent. PRD: `prds/admin-remove-handle.md`.
- [x] Remove button per admin row with a two step confirm: first click arms it (red Confirm state plus an info message), second click deletes; any other row action disarms it. New `.icon-text-button.danger` style on `--signal-red`.
- [x] Verified: `npm run check` passes (lint, typecheck, build).

## Completed — 2026-08-15 18:30 UTC

- [x] FRIENDS OF CONVEX GIFT footer removed from the gift pass card (the campaign title span and its `<footer>` are gone from `GiftPortal.tsx`; the unused footer CSS selector was trimmed). The center block now uses `margin-block: auto` so it stays vertically centered without the footer.
- [x] Gradient wash animation removed for good: `gift-card-animated` classes deleted from both cards and the `::before` overlay plus `gift-card-wash` keyframes deleted from `globals.css`.
- [x] Verified: `npm run check` passes; live DOM shows no footer text and class lists without `gift-card-animated`; screenshot of `/gift/test-portal-token-og` confirms the flat field and centered content.

## Completed — 2026-08-15 18:25 UTC

- [x] Updated `public/background-image-sidebar.svg` art applied: stripes now sweep along the bottom edge and rise to the right. Card text left aligned (identity block, name, status line); FRIENDS OF CONVEX header and FRIENDS OF CONVEX GIFT footer stay where they were. The 23cqi right margins are gone; the center block keeps 16cqi so long names clear the rising stripes. PRD: `prds/gift-card-16x9-sidebar-and-font-swap.md`.
- [x] OG renderer and preview script draw the new bottom stripe paths (shifted up 45px to bottom align on the 1200x630 canvas) with left aligned text at x=80. Big handle sizing opened up to the wider field (860px budget).
- [x] Gradient wash animation mask flipped from a right fade to a bottom fade so it still never touches the stripe lines.
- [x] Verified: `npm run check` passes; `node scripts/preview-share-og.mjs` renders the new layout; live screenshots of `/gift/test-portal-token-og` and `/gift/share/test-share-token-og` confirm left aligned text clear of the stripes.

## Completed — 2026-08-15 17:58 UTC

- [x] Gift pass card is 16:9 (Twitter card shape) with `public/background-image-sidebar.svg` art. "PERSONAL PASS / 2026" and "ONE GIFT / ONE PERSON" labels removed; the READY TO REVEAL status line moved below the name with extra spacing. Header, center block, and footer keep a 23cqi right margin so no text lands on the stripe lines. PRD: `prds/gift-card-16x9-sidebar-and-font-swap.md`.
- [x] Public share card and its server OG image dropped "COMMUNITY / 2026", "FRIEND OF CONVEX", "FRIENDS OF CONVEX GIFT", and "BUILT TOGETHER". Both use the sidebar art; the OG renderer draws the stripe paths and centers text in the solid field (x=462).
- [x] Space Grotesk removed app-wide. `--font-display` is Inter, `index.html` loads Inter from Google Fonts, the OG renderer and preview script load `inter-500.ttf` / `inter-700.ttf`, and the Space Grotesk TTFs are deleted from `public/render/fonts/`.
- [x] Slow gradient wash animation (`gift-card-animated` class) on both cards, masked so it only touches the solid area, never the stripes. Remove the class in `GiftPortal.tsx` to kill it.
- [x] Board settings checkbox overflow fixed: `clear: both` on labels (the floated legend was pushing the first label out of the fieldset) plus `min-width: 0` on the fieldset.
- [x] Verified: `npm run check` passes; `node scripts/preview-share-og.mjs` renders correctly; browser DOM checks show both cards at ratio 1.78 with the sidebar background and no removed labels.

## Completed — 2026-08-15 17:30 UTC

- [x] Repo link updated everywhere from `https://github.com/waynesutton/convexyappers` to `https://github.com/waynesutton/friendsofconvex-yapper-leaderboard`: `src/components/BuiltWithFooter.tsx`, `index.html` JSON-LD, `task.md`, `changelog.md`, and `prds/footer-convex-socials.md`.
- [x] New README with the board description, feature list, stack table, required environment values, a one prompt agent setup block (Convex agent mode for cloud agents), manual run commands, and Convex docs links. No private Fourthwall or credential details included.
- [x] Verified: repo wide search shows zero remaining `convexyappers` references.

## Completed — 2026-08-15 17:14 UTC

- [x] Top 3 rank badges now show in both ranking modes (Yappers and Convex mentions), not just Convex. PRD: `prds/rank-badges-both-modes.md`.
- [x] Badges moved from the rank cell to plain bigger medals floating left of the avatar, no background or border: 28px (34px for first place) on desktop, 22px/26px on mobile so they clear the rank number. Sparkle popout on first place was tried and removed on request.
- [x] Verified: `npx tsc --noEmit` passes; browser check confirmed both modes and the 375px mobile card.

## Completed — 2026-08-15 16:55 UTC

- [x] Daily X metrics cron now runs at 15:17 UTC (8:17 AM Pacific during daylight time), still calling `internal.xSync.refreshAllScheduled`. Minute 17 stays off the top of the hour. PRD: `prds/daily-board-refresh-cron.md`.
- [x] `/about` section 04 states the once a day 8 AM Pacific refresh and links to https://docs.convex.dev/scheduling/cron-jobs.
- [x] Join page dropped Copy this join link. Continue with X is the only join action. Copy now says admins review on a rolling basis and joining is not automatic.

## Completed — 2026-08-15 11:00 UTC

- [x] Download CSV button in the Recipient ledger tools on `/admin/gifts`. Client side only: exports every recipient in the selected campaign (gift number, name, @handle, status, sent/opened/redeemed ISO times, consent source, DM opt out, delivery error, pass URL) with RFC 4180 escaping and a formula-injection guard. Filename is the campaign slug plus date. PRD: `prds/ledger-csv-and-board-freshness.md`.
- [x] Board freshness chip next to This week's board: relative label (Updated 2h ago) from the existing `lastSyncedAt` data, absolute time in the tooltip, Awaiting first sync when nothing has synced. Styled for both themes.
- [x] Verified: `npm run check` passes; browser check confirms the chip text, tooltip, and both themes. CSV export verified through types and code review (admin page sits behind X sign in).

## Completed — 2026-08-15 10:50 UTC

- [x] Agent Ready plus live discovery files so search engines and AI agents can read the board. `llms.txt` and `sitemap.md` rebuild from active public handles on each request. Footer links sit next to the open source credit. PRD: `prds/agent-ready-seo-aeo-geo.md`.
- [x] Also serving live `robots.txt` and `sitemap.xml`, plus Agent Ready `agents.md`, `llms-full.txt`, RSS, status, and readiness. Widget stays hidden.
- [x] Verified: `npm run check` passed. Development `GET /llms.txt` lists 3 public people. Archive/restore is live because the files read the same `active` index as the board.

## Completed — 2026-08-15 10:45 UTC

- [x] Admin board column controls: `boardDisplaySettings` singleton, `convex/boardSettings.ts` (public `getBoardDisplay`, admin `setBoardDisplay`), and checkbox lists on `/admin` for the Yappers and Convex mentions views. The public board hides unchecked columns, rebuilds its grid per visible set, and falls back to rank order when the active sort column is hidden. Toggle labels renamed to Yappers / Convex mentions. PRD: `prds/admin-controls-docs-theme-search.md`.
- [x] New `/admin/docs` page hosting the Admin only area note plus pointers to Board operations, Gift studio, and access revoking. The note is gone from `/admin` and `/admin/gifts`; the header admin nav links to Admin docs.
- [x] `/admin` and `/admin/gifts` intros are now one compact h1 line in the guide typeface instead of a multi line hero.
- [x] Theme switch is an icon only round button (Phosphor CircleHalf), no label or color wheel; accessible name kept.
- [x] Fixed the double login on `/admin`: `AdminGate` now also gates on `useConvexAuth()`, so the OAuth exchange window shows "Checking admin access" instead of a second sign in button.
- [x] Saved Fourthwall products: `giftProductPresets` table with admin list/save/delete, pick-to-fill chips under the product ID input, and a label + Save product row.
- [x] Recipient ledger search: `search_handle` text index on `giftRecipients`, `searchRecipientsAdmin` prefix query, and a round search box in the ledger heading with a no-match empty state. Campaign totals still count the whole campaign during a search.
- [x] Tooltips (`title`) on gift and admin actions: send/copy/open/opt-out per recipient, sender connection buttons, campaign submit, Check Fourthwall, badge save/reset, approve/decline, archive/restore, add person, and every column checkbox.
- [x] Verified: `npm run check` (lint, tsc, build) passes; dev deploy added the new indexes; browser check confirms the renamed toggles and the working icon theme switch. Admin pages verified through code plus the auth gate (the IDE browser is signed out).

## Completed — 2026-08-15 10:24 UTC

- [x] Replaced the tab favicon with `public/favicon.png` (dark Convex pinwheel mark with racing stripes). Left `public/convex/symbol-color.svg` in place for gift passes and the footer.
- [x] Verified: `index.html` points `rel="icon"` and `rel="apple-touch-icon"` at `/favicon.png`; file is 1024×1024 PNG.

## Completed — 2026-08-15 10:22 UTC

- [x] Gift pass and share cards now use the new dark radial wash in `public/background-image.svg` (PNG is the raster twin). Share OG renderer matches that gradient. Racing stripe paths and the extra card overlay are gone. PRD: `prds/gift-pass-type-and-card-background.md`.
- [x] Verified: card `background-image` is `/background-image.svg` at center, fill `#2a1e1d`, no `::before` overlay; `node scripts/preview-share-og.mjs`; lint, TypeScript, and production build pass.

## Completed — 2026-08-15 10:10 UTC

- [x] Gift pass left copy is smaller and the `@handle` sits on its own wrapping line sized from character length, so long names no longer clip into the card. PRD: `prds/gift-pass-type-and-card-background.md`.
- [x] Gift signal card and public share card use `public/background-image.svg` (racing stripes). Personalized share OG (`/og/gift/:token.png`) uses the same artwork. Site default OG stays `public/og-friends-of-convex.png`.
- [x] Verified: `@testyapper` handle font 27px in a 492px copy column with no clip; card background `url(/background-image.svg)` 200; `node scripts/preview-share-og.mjs`; lint, TypeScript, and production build pass.

## Completed — 2026-08-15 09:40 UTC

- [x] Removed the visible "People, ranked by public impressions" heading on the home board. Kept a screen reader heading so the section still has a name. PRD: `prds/compact-home-board-chrome.md`.
- [x] Put This week's board, the Impressions / Convex yappers toggle, and Copy / Share / Post on X on one toolbar row above search. Tightened hero and board-shell padding so the table starts higher.
- [x] Verified: toolbar is one 46px row on desktop, hidden heading still names the section, lint, TypeScript, and production build pass.

## Completed — 2026-08-15 09:35 UTC

- [x] Footer right side now has Convex, X, LinkedIn, YouTube, Discord, and GitHub icons. GitHub points at `https://github.com/get-convex`. Phosphor brand icons for the socials; official Convex mark for Convex.dev. PRD: `prds/footer-convex-socials.md`.
- [x] Footer left side keeps Built with Cursor + Convex and adds a small gray "open source yapper board" link to `https://github.com/waynesutton/friendsofconvex-yapper-leaderboard`.
- [x] Verified: desktop split layout, stacked mobile layout with icons staying in a row, both themes, lint, TypeScript, and production build.

## Completed — 2026-08-15 09:30 UTC

- [x] Extended the Neue Haas Grotesk Display 900 headline rule in `src/globals.css` to every big page headline: admin intro, gift studio intro, gift pass, public share page, closed pass card, and the admin sign in states, in both themes. The gift signal card `@handle` stays in Space Grotesk to match the server rendered OG image. Verified live on `/admin`, `/gift/:token`, and `/gift/share/:token` with computed styles and `document.fonts` confirming the Typekit face loads at weight 900.

## Completed — 2026-08-15 09:25 UTC

- [x] Moved admin navigation into the site header on `/admin` routes: Board ops, Gift studio, How to send gifts, an Admin @handle chip, and Sign out top right. Setup guide links commented out. PRD: `prds/admin-header-gifts-guide-og-share.md`.
- [x] Added the shared `AdminAccessNote` to `/admin` and `/admin/gifts` marking the signed in admin and explaining how to add another admin via `ADMIN_X_USER_IDS`.
- [x] Built `/admin/gifts/guide`, the non technical Gift studio walkthrough (status lights, campaigns, recipients, sending, tracking, revoking, safe sharing).
- [x] Auto sized the recipient name on the gift pass and share cards with container queries so long handles fit.
- [x] Shipped personalized share OpenGraph: `convex/sharePages.ts` HTTP actions rewrite `/gift/share/:token` meta tags and serve `/og/gift/:token.png`, rendered by `convex/giftShareRender.ts` with `@resvg/resvg-wasm` plus Space Grotesk fonts from `public/render/`. Unknown tokens redirect to the default image.
- [x] Regenerated the default OG image (`public/og-friends-of-convex.png`) without the people icons and bars, white text, and pointed `index.html` at absolute URLs.
- [x] Verified: lint, TypeScript, and production build pass; local render preview via `scripts/preview-share-og.mjs`; live dev checks on `ceaseless-bobcat-587.convex.site` with a seeded test pass (`/gift/share/test-share-token-og` serves personalized meta, the PNG route returns the rendered card, unknown tokens 302 to the default image).

## In progress — 2026-08-15 07:23 UTC

- [ ] Complete the Fourthwall API user, product, signed webhook, X gift-sender, and recipient-specific free-gift setup for development and production. Keep the exact public origins at `https://ceaseless-bobcat-587.convex.site` and `https://friendsofconvex.dev`. PRD: `prds/2026-08-15-fourthwall-dev-production-gift-setup.md`.
- [ ] Verify whether the Friends of Convex Shirt and Vintage Convex Hat are available to the same Fourthwall shop or must be issued as separate campaigns; do not send a DM or trigger paid fulfillment without action-time confirmation.

## Completed — 2026-08-15 07:15 UTC

- [x] Configured confidential OAuth 2.0 and fresh app-only Bearer Tokens for X apps `yappers-dev` and `yappers-app-prod`, with exact development and custom-domain production callbacks.
- [x] Generated separate Convex Auth signing pairs and set all seven required environment-variable names on development `ceaseless-bobcat-587` and production `agile-spaniel-476`; no secret was committed.
- [x] Signed in as `@waynesutton`, derived its stable numeric X ID, and set it as the first admin on both deployments. The operator account was not submitted as a production board member.
- [x] Verified X sign-in, `/admin` authorization, and X profile lookup on both deployments. Production `/about` loads directly; the repaired development static site returns `200` for `/`, `/join`, and `/about`.
- [x] Deployed the validated backend to production and uploaded the correctly targeted static build to development. `npm run check` and `npm run test:x-account-activity` pass under Node 24. PRD: `prds/2026-08-15-dev-production-auth-x-setup.md`.

## Completed — 2026-08-11 20:15 UTC

- [x] Added a Convex mentions ranking mode to the leaderboard. PRD: `prds/2026-08-11-convex-mentions-leaderboard.md`. The sync now requests post text (zero extra X API calls), scans every post with a word boundary `/\bconvex\b/i` match, and stores per-snapshot Convex post counts, impressions, engagement, and the matched posts (capped at 100, text trimmed to 200 characters). All new schema fields are optional so old snapshots need no migration.
- [x] `listLeaderboard` gained an optional `mode` argument. Default mode is unchanged; `convex` mode sorts by Convex posts, then Convex impressions, Convex engagement, and overall impressions, and computes weekly change plus a consecutive-week streak anchored to snapshot timestamps, never the wall clock.
- [x] Board UI: a segmented Impressions / Convex yappers toggle (existing pill tab pattern), swapped metric columns in Convex mode (Convex posts pill, share of posts, Convex impressions, Convex engagement, weekly change), dimmed zero rows that stay visible, expand carets revealing the stored posts with dates and per-post metrics, streak chips at 2 or more weeks, and help notices for unscanned rows and the zero-impressions engagement fallback.
- [x] Admin board settings section (the app has no settings page): top 3 rank badge editors accepting an emoji, short text, or an uploaded PNG or SVG stored in Convex file storage, with reset to the default medals; badges render next to ranks 1 to 3 in Convex mode.
- [x] Slack digest: new `convex/slack.ts` admin action posting the top Convex yappers (rank, handle, posts with share, impressions, streak) via `SLACK_BOT_TOKEN` and `SLACK_DIGEST_CHANNEL`, with a channel override input on the admin page.
- [x] Renamed the admin per-row sync button to Rescan with a tooltip explaining it re-pulls posts and rescans for mentions; Sync everyone got the same tooltip.
- [x] Verified lint, TypeScript, and the production build pass; smoke-tested `listLeaderboard` (both modes), `getConvexPosts`, and `listRankBadges` against the dev deployment. Pre-feature rows correctly report the not-scanned state.

## Completed — 2026-08-11 08:20 UTC

- [x] Verified the live production state with the Convex CLI and live requests: `friendsofconvex.dev` serves the deployed site, production `CONVEX_SITE_URL` is overridden to `https://friendsofconvex.dev`, production `SITE_URL` is set, and `CONVEX_CLOUD_URL` still points at `agile-spaniel-476.convex.cloud`.
- [x] Corrected every production callback and webhook URL in `docs/SETUP_GUIDE.md` and `docs/fourthwall-setup.md` to the `friendsofconvex.dev` origin, since the app builds those URLs from the overridden `CONVEX_SITE_URL`. The old `.convex.site` callbacks would fail X's exact-match check.
- [x] Rewrote the current-state and what's-left sections with the verified 2026-08-11 environment audit: production is missing `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, `ADMIN_X_USER_IDS`, and `X_BEARER_TOKEN`; the dev deployment has zero environment variables.
- [x] Added a "How sign-in and admin access work" section (X login only through Convex Auth, numeric X ID allowlist, multi-admin steps) and a "Security model" section (server-side `requireAdmin`, secret placement, webhook signatures, encrypted sender tokens, pending-member privacy) to `docs/SETUP_GUIDE.md`.
- [x] Replaced the planned-domain instructions with the live-domain record and updated both troubleshooting tables for the custom domain callback rules.

## Production handoff completed — 2026-08-15 07:15 UTC

- [x] Development deployment has all seven normal auth/X values and serves its uploaded static frontend at `https://ceaseless-bobcat-587.convex.site`.
- [x] Production deployment has all seven normal auth/X values and serves `https://friendsofconvex.dev` through its custom HTTP Actions domain.
- [x] Production X OAuth app uses `https://friendsofconvex.dev` and registers the login and gift-sender callbacks exactly.
- [x] `/join` sign-in, `/admin` allowlist enforcement, X lookup, and direct SPA routes passed on the applicable live origins.
- [ ] Optional gift flow: follow `docs/fourthwall-setup.md` when Fourthwall and X Activity setup is requested.

## Completed — 2026-08-10 06:40 UTC

- [x] Replaced the Codex footer icon with the Cursor logo mark (saved to `public/built-with/cursor.svg`, links to cursor.com) and removed the retired `codex-color.svg` asset. The mark inverts to white on the dark Convex-theme footer.
- [x] Removed the Codex Sites + Convex Backend Skill footer link; the GitHub icon remains and now points to `https://github.com/waynesutton/friendsofconvex-yapper-leaderboard`.
- [x] Enlarged the footer Convex wordmark from 62 to 92 pixels.
- [x] Pinned the Vite dev server to port 5174 in `vite.config.ts` and swapped every `localhost:5173` URL in `SETUP_GUIDE.md` and `fourthwall-setup.md` to `localhost:5174`.
- [x] Verified footer in both themes and both layouts, lint, TypeScript, and production build all pass.

Historical note: admin setup was still pending at this checkpoint and was completed on 2026-08-15.

## Completed — 2026-08-10 06:30 UTC

- [x] Audited every route in a mobile browser viewport (320, 375, and 390 pixel widths, both themes): home, about, join, admin, admin setup, gift studio, gift pass, and gift share card. No page produces horizontal overflow and no element exceeds the viewport.
- [x] Fixed the mobile leaderboard card grid so the third column caps at the action-button width; long metric labels such as "Impressions (7D)" now wrap instead of truncating display names like "Wayne Sutton" to a single letter.
- [x] Added an invisible hit-area extension to the board row action buttons so taps meet the 44 pixel minimum touch target while the visual 38 pixel circle stays the same.
- [x] Repointed development `VITE_CONVEX_URL` in `.env.local` at the linked cloud development deployment, fixing a board stuck on loading skeletons, and documented the symptom in the setup guide troubleshooting table.
- [x] Seeded three test profiles with seven-day metrics on the development deployment so the populated board renders during local work.
- [x] Confirmed all other touch targets (theme toggle, share toolbar, sort controls, pagination, search) already meet 44 pixels, and confirmed the desktop table layout is unchanged.
- [x] Verified lint, TypeScript, and the production build all pass.

## Completed — 2026-08-10 06:15 UTC

- [x] Installed `convex-helpers` so its server and client utilities are available to the app.
- [x] Installed `@convex-dev/eslint-plugin` and added its recommended rules to `eslint.config.mjs` with type-aware linting.
- [x] Auto-fixed all 33 flagged database calls in `convex/gifts.ts`, `convex/profiles.ts`, and `convex/xAccountActivity.ts` to the explicit `db.patch("table", id, ...)` format.
- [x] Moved the daily X metrics cron from 08:00 to 08:17 UTC to avoid the top-of-the-hour traffic spike.
- [x] Verified lint, TypeScript, and the production build all pass with zero problems.

## Completed — 2026-08-10 06:10 UTC

- [x] Applied Neue Haas Grotesk Display at weight 900 to the hero title, board title, join headline, and about headline in both themes via a cascade-final rule in `src/globals.css`.
- [x] Added the Typekit stylesheet `https://use.typekit.net/xmd6bow.css` to `index.html`.

## Completed — 2026-08-10 05:45 UTC

- [x] Rebuilt the entire frontend as a Vite React single page app in `src/`, replacing the Next.js App Router and Vinext. PRD: `prds/2026-08-10-react-vite-static-hosting-rebuild.md`.
- [x] Ported every page, admin feature, gift flow, and both themes to react-router-dom routes with identical interfaces and behavior.
- [x] Added the `@convex-dev/static-hosting` component with app-owned root routing so auth callbacks and webhooks keep their exact paths.
- [x] Fixed the production browser bundle bug by moving from `NEXT_PUBLIC_CONVEX_URL` to Vite's `VITE_CONVEX_URL` with a `getConvexUrl()` fallback.
- [x] Removed Next.js, Vinext, Cloudflare worker, and Codex Sites files from the root; kept every markdown file plus `prds/` and `docs/`.
- [x] Rewrote `SETUP_GUIDE.md` and `fourthwall-setup.md` for the new stack, the single `npm run deploy` publish, and the planned `friendsofconvex.dev` domain.
- [x] Verified npm install, Convex codegen, lint, TypeScript, the production build, a bundle scan for stale env names, and a live browser smoke test.

## Superseded production handoff (historical)

Replaced by the updated pending list at the top of this file. The domain
purchase, custom domain attachment, first deploy, and production `SITE_URL`
were completed by 2026-08-11.

## Completed — 2026-08-10 02:22 UTC

- [x] Added the supplied Convex design brief, homepage reference, official logos, and racing-line artwork to the project.
- [x] Made a Convex.dev-inspired theme the default across the leaderboard, About, Join, Admin, Setup, Gift Studio, and gift pass routes.
- [x] Preserved the original warm studio design as the `Studio` alternate and added a persistent, accessible header switcher.
- [x] Updated the favicon and generated a matching 1200×630 social preview card without removing the prior card.
- [x] Kept the desktop hero compact enough to reach leaderboard content above the fold while preserving the Rolling Signal card size.
- [x] Verified both themes at 1280×720, verified homepage and Join at 390×844, confirmed no horizontal overflow, and found no fresh browser warnings or errors.
- [x] Passed lint, TypeScript, and the production Vinext build.

## Completed — 2026-08-09 11:52 UTC

- [x] Added sortable Rank, Yapper, Posts, Engagements, and Impressions columns to the public leaderboard.
- [x] Made sorting apply after search and before pagination, with stable canonical ranks and synced metric rows ahead of awaiting-X rows.
- [x] Added accessible sort state, clear direction indicators, and compact sort controls for card layouts.
- [x] Passed lint, TypeScript, the production build, and the production browser-bundle safety scan.

## Completed — 2026-08-09 11:45 UTC

- [x] Removed the standalone Top Signal podium strip from the homepage.
- [x] Moved “Top signal / 7 days” beside the Friends of Convex people-edition label.
- [x] Raised the leaderboard while preserving the Rolling Signal card and existing board controls.
- [x] Passed lint, TypeScript, the production build, and the production browser-bundle safety scan.

## Superseded ChatGPT Sites handoff (historical)

The React rebuild replaced this hosting path. The remaining production work now lives in the new pending section above.

- [x] Registered this folder in ChatGPT Sites and persisted the confirmed `project_id` (removed in the React rebuild).
- [x] Confirmed and deployed `cvx-devx / convex-yappers / agile-spaniel-476`.
- [x] Set `NEXT_PUBLIC_CONVEX_URL`, saved a Sites version, deployed it privately, and confirmed the `.chatgpt.site` origin (both retired).
- [x] Set production `SITE_URL` to the Sites origin (now needs the static hosting origin instead).

## Completed — 2026-08-09 10:38 UTC

- [x] Registered the existing project once in ChatGPT Sites and confirmed it appears in the Sites list.
- [x] Deployed the approved Convex production functions, schema, indexes, HTTP routes, and crons.
- [x] Configured Sites with the production Convex client URL and production Convex with the confirmed `SITE_URL`.
- [x] Published Sites version 3 with owner-only access and confirmed its canonical live URL.
- [x] Replaced pending production URL placeholders throughout the operator guides and protected setup page.
- [x] Passed lint, TypeScript, production build, browser-bundle safety scan, X Account Activity tests, and a read-only production Convex query.

## Completed — 2026-08-09 10:11 UTC

- [x] Completed `prds/2026-08-09-production-urls-and-sites-registration.md`.
- [x] Added the verified Sites lifecycle and exact Convex production URL map to every setup guide.
- [x] Explained why the app is absent from ChatGPT Sites and the one registration step that fixes it.
- [x] Verified every production callback and webhook path against `convex/http.ts` and Convex Auth routing.
- [x] Passed lint, TypeScript, the Vinext production build, and X Account Activity parser and signature tests.

## Completed — 2026-08-09 05:58 UTC

- [x] Hardened the reusable `$codex-sites-convex` skill with runtime-first preflight, Node 24 project pins, localhost health/process rules, and Node 20/24 regression coverage.
- [x] Clarified in this app's pre-command failure that `npm install` cannot switch the terminal's Node.js runtime.
- [x] Verified the skill, the app's fresh-shell runtime, frontend HTTP response, and both local frontend and Convex listeners.

## Completed — 2026-08-09 05:48 UTC

- [x] Diagnosed the persistent `predev` failure as a forced Homebrew Node 20 entry in `~/.zshrc`, not a missing npm package.
- [x] Installed Homebrew Node 24.19.0 and made it the persistent login-shell runtime.
- [x] Hardened the Vinext Space Grotesk and tsconfig-path compatibility paths across the supported Node runtime.
- [x] Verified Node/npm selection, fresh-shell development startup, homepage HTTP 200 rendering, and the full project check.

## Completed — 2026-08-09 05:34 UTC

- [x] Fixed the Vinext development startup failures in `prds/2026-08-09-vinext-dev-startup.md`.
- [x] Replaced unsupported config and font-loader paths without changing the interface.
- [x] Moved tsconfig path resolution to Vite 8's native option.
- [x] Added compatibility handling for the installed Vinext, Vite, font, and custom image worker APIs.
- [x] Added Node 24 project pins, a clear unsupported-runtime preflight, and novice setup instructions.
- [x] Verified dependency install, the dev server, homepage response, lint, TypeScript, production build, and production dependency audit.

## Completed — 2026-08-08 20:49 UTC

- [x] Made repeat gifts explicit and safe without allowing the same automatic consent event to authorize unlimited DMs.
- [x] Added per-person gift numbering and bounded delivery history.
- [x] Atomically consumed automatic `GIFT` consent when a recipient pass is created.
- [x] Show prior gifts and consent availability in `/admin/gifts`.
- [x] Updated setup documentation and verified repeat delivery behavior.

## Completed — 2026-08-08 20:38 UTC

- [x] Built automatic X Account Activity `GIFT` consent and `STOP` suppression from `prds/2026-08-08-x-account-activity-gift-consent.md`.
- [x] Added signed CRC/event handling, idempotent command storage, and global per-X-user intent state.
- [x] Added admin webhook registration/subscription status and automatic consent indicators without removing the manual fallback.
- [x] Updated campaign creation, send-time suppression, and novice setup instructions for the required OAuth 1.0a credentials.
- [x] Verified webhook parsing and crypto helpers, lint, TypeScript, the production build, and existing route compilation.

## Deferred Account Activity activation

- [ ] Add the four OAuth 1.0a values to a public Convex Cloud development deployment.
- [ ] Connect the dedicated X sender, select **Enable automatic detection**, and run one real `GIFT` → `STOP` → `GIFT` test.

## Completed — 2026-08-08 20:14 UTC

- [x] Built the auditable Fourthwall gift-pass flow described in `prds/2026-08-08-fourthwall-gift-pass.md`.
- [x] Added the protected gift studio, separate X sender OAuth grant, encrypted token storage, Fourthwall link generation, recipient lifecycle ledger, and signed redemption webhook.
- [x] Added the personalized `/gift/[token]` page with official Convex assets, reveal tracking, Fourthwall CTA, and safe public X sharing.
- [x] Wrote `fourthwall-setup.md` with novice-friendly development and production setup steps.
- [x] Verified lint, TypeScript, the production build, admin gating, invalid-token handling, and the 375px layout.

## Deferred gift activation

- [ ] Add the Fourthwall, X DM sender, and encryption values to the selected Convex development deployment.
- [ ] Connect the dedicated X sender account and run the first test campaign with one consenting recipient.
- [ ] Add production-only gift values and register the Fourthwall webhook after the production Convex target is approved and deployed.

## Completed — 2026-08-08T08:00:32Z

- [x] Created the product requirements document.
- [x] Initialized the Codex Sites/Vinext application structure.
- [x] Started an accountless local Convex backend in Agent Mode.
- [x] Added type-safe profiles and snapshots schemas with indexed access.
- [x] Built X profile lookup and rolling seven-day public metric aggregation.
- [x] Added manual per-person and full-list refresh plus a daily Convex cron.
- [x] Built the people-only leaderboard with search, rank movement, sharing, and pagination.
- [x] Built the intentionally open local `/admin` management route.
- [x] Added About and Setup routes and a standalone setup guide.
- [x] Added required Codex and Convex footer attribution.
- [x] Generated and wired a project-specific social preview card.
- [x] Verified real Convex persistence and the missing-X-key path with a real public handle.

## Deferred by design

- [ ] Add `X_BEARER_TOKEN` to each selected cloud Convex deployment.
- [ ] Add X OAuth credentials, Convex Auth signing keys, and `ADMIN_X_USER_IDS` separately to development and production.
- [ ] Complete the ordered production handoff checklist at the top of this file.

## Validation — 2026-08-08T08:13:43Z

- [x] `npm run check` — lint, TypeScript, and production Vinext build passed.
- [x] Convex code generation and function upload passed in local Agent Mode.
- [x] Codex Sites + Convex structural verifier passed.
- [x] `/`, `/admin`, `/about`, and `/setup` returned HTTP 200.
- [x] Production dependency audit reported zero vulnerabilities.
- [x] Real local Convex data remained readable after regeneration.
- [x] Archive/restore and duplicate-handle idempotency passed against local Convex.

## Toolchain note

The full development tree currently reports 5 high-severity advisories inherited from the Vinext and Cloudflare build toolchain. The production dependency audit reports zero vulnerabilities. The available automatic development-tool fix requires forced or breaking dependency changes, so it was not applied. Recheck these pins when the Sites starter updates.

## Completed — 2026-08-08T08:19:56Z

- [x] Compressed homepage and About hero typography and top spacing.
- [x] Preserved the Rolling Signal card dimensions.
- [x] Renamed the homepage headline.
- [x] Moved Setup to `/admin/setup` without adding auth.
- [x] Removed Admin and Setup links from public navigation and footer attribution.
- [x] Re-ran lint, TypeScript, and the production build successfully.
- [x] Verified public routes and `/admin/setup`; confirmed the old `/setup` route returns 404.

## Completed — 2026-08-08T09:53:32Z

- [x] Added Convex Auth with X OAuth 2.0 profile identity.
- [x] Protected `/admin`, `/admin/setup`, every admin function, imports, and manual sync actions with a stable X user ID allowlist.
- [x] Added `/join` with X sign-in, a shareable join link, pending membership requests, and status views.
- [x] Added admin approve and decline actions; pending people remain inactive and off the public board.
- [x] Added preview-first imports for up to 100 pasted handles and the first 100 members of a public X List.
- [x] Replaced the setup guide with ordered local and production instructions for X, Convex, Codex Sites, auth keys, environment values, costs, testing, and troubleshooting.
- [x] Added a repeatable Convex Auth signing-key generator.
- [x] Preserved the public leaderboard, search, share, pagination, About route, and existing local Convex data.
- [x] Verified unauthenticated admin reads are rejected while the public leaderboard remains readable.
- [x] Ran the Convex authorization scan and Convex code review checklist with no unresolved high-severity finding.
- [x] Ran lint, TypeScript, production build, Convex function upload, and local route checks successfully.

## Completed — 2026-08-08T19:24:55Z

- [x] Reworked the standalone and protected in-app setup guides into one ordered development-to-production workflow.
- [x] Documented the exact separation between Convex Auth, X OAuth 2.0 credentials, and the X API Bearer Token.
- [x] Added a development/production/Codex Sites environment-variable placement matrix.
- [x] Replaced the legacy anonymous-mode command with the current accountless Agent Mode sequence.
- [x] Added explicit commands and stop checks for linking this folder to a different Convex team and project.
- [x] Added production-only environment commands, production URL handling, and the Codex Sites rebuild step.
- [x] Added a repeatable multi-admin procedure that preserves every existing numeric X ID.
- [x] Checked the current Convex CLI, official documentation index, and official components catalog; no new component was needed.
- [x] Verified the documented target-team and production environment command syntax against the installed Convex CLI 1.43.0.
- [x] Re-ran lint, TypeScript, and the production build successfully.
