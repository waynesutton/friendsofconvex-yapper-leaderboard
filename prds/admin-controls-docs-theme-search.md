# Admin display controls, admin docs page, theme icon, product presets, ledger search

Created: 2026-08-15 10:12 UTC
Last Updated: 2026-08-15 10:50 UTC
Status: Done

## Problem

Eight requests from one admin session:

1. Admins cannot control which metric columns the public leaderboard shows. The mode toggle labels also read Impressions and Convex yappers; they should read Yappers and Convex mentions.
2. The Admin only area note and the how to add an admin instructions repeat on `/admin` and `/admin/gifts`. They belong on their own docs page.
3. The `/admin` and `/admin/gifts` intro headlines wrap to two or three lines and take too much vertical space. They should be one small h1 line, then the page.
4. The header theme switch is a pill with an icon, a color wheel logo, and a text label. It should be a single simple Phosphor icon button.
5. Admins sometimes have to press Continue with X twice before `/admin` renders. Root cause: `AdminGate` only looks at the `authz.viewer` query. During the OAuth code exchange after the redirect back, the client is briefly unauthenticated, so the query returns `authenticated: false` and the gate shows the sign in button again even though the sign in is completing. The gate never consults `useConvexAuth().isLoading`.
6. Creating a gift campaign requires pasting the Fourthwall product ID every time. Admins want saved product IDs to pick from.
7. Gifts and admin controls need tooltips.
8. The Recipient ledger has no search.

## Proposed solution

1. New `boardDisplaySettings` singleton table plus `convex/boardSettings.ts` with a public `getBoardDisplay` query (defaults: all columns on) and an admin `setBoardDisplay` mutation. The admin Board settings section gets two checkbox lists (Yappers view, Convex mentions view). The Leaderboard reads the settings, hides columns, and computes the grid template per visible column set. Toggle labels renamed.
2. New `/admin/docs` page (AdminGate + editorial layout) hosting the AdminAccessNote and short pointers to the other admin pages. The note is removed from `/admin` and `/admin/gifts`; the header admin nav gains an Admin docs link.
3. CSS: `.admin-intro h1` and `.gift-admin-intro h1` drop to a compact single line size; intro sections tighten.
4. `ThemeSwitcher` becomes an icon only circular button using one Phosphor icon; label and color wheel removed. Accessible name kept.
5. `AdminGate` gates on `useConvexAuth()` so the OAuth exchange window shows Checking admin access instead of a second sign in button.
6. New `giftProductPresets` table with admin list, save, and delete functions. The campaign form gets a preset picker and a save current ID button.
7. `title` tooltips on all gift and admin action buttons that lack them.
8. Search index `search_handle` on `giftRecipients` (filter field `campaignId`) with a `searchRecipientsAdmin` query. A search input in the ledger heading; non empty input switches the list to search results, with a client side displayName fallback match on the loaded page.

## Files to change

- convex/schema.ts (two new tables, one search index)
- convex/boardSettings.ts (new)
- convex/gifts.ts (product presets, searchRecipientsAdmin)
- src/components/Leaderboard.tsx (settings, renames, dynamic grid)
- src/components/AdminPanel.tsx (checkbox lists, note removal, tooltips)
- src/components/GiftAdminPanel.tsx (preset picker, note removal, search, tooltips)
- src/components/AdminGate.tsx (useConvexAuth)
- src/components/ThemeSwitcher.tsx (icon only)
- src/components/SiteHeader.tsx (Admin docs link)
- src/pages/AdminDocsPage.tsx (new)
- src/App.tsx (route)
- src/globals.css (compact intros, theme icon, checkbox lists, preset row, ledger search)

## Edge cases

- Hiding every column in a mode: the mutation rejects an all false set so the board never renders empty.
- Current sort key on a hidden column: the board falls back to rank order.
- Search with an unloaded displayName match: search index covers handle; displayName matches come from the loaded page filter.
- Preset deletion never touches campaigns already created from it.
- No settings doc yet: `getBoardDisplay` returns all true defaults.

## Verification steps

- npm run check (lint, tsc, build)
- Browser: leaderboard renames, column hiding live from admin toggles, /admin/docs renders behind the gate, compact intros, icon theme switch works in both themes, ledger search finds a seeded recipient, preset save and pick round trips.

## Task completion log

- 2026-08-15 10:12 UTC Created.
- 2026-08-15 10:20 UTC Schema (boardDisplaySettings, giftProductPresets, search_handle index), convex/boardSettings.ts, and the gifts.ts preset and search functions shipped; dev deploy added all indexes.
- 2026-08-15 10:25 UTC Leaderboard renames, admin checkbox lists, /admin/docs page, compact admin intros.
- 2026-08-15 10:35 UTC Icon-only theme switch, AdminGate double-login fix, preset picker UI, ledger search UI, tooltips across gift and admin actions.
- 2026-08-15 10:50 UTC Verified: npm run check passes (lint, tsc, build); browser check confirms the renamed toggles and working icon theme switch; admin pages verified through code plus the auth gate (the IDE browser is signed out). Docs synced (task.md, changelog.md, files.md). Done.
