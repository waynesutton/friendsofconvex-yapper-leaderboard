# Gift studio bulk operations

Created: 2026-08-15 20:55 UTC
Last Updated: 2026-08-15 21:05 UTC
Status: Done

## Problem

Every gift studio surface is one-at-a-time today:

- The Dispatches log has per row Archive and Delete only. No way to filter recent vs archived, no search, no select all, no bulk archive or delete.
- The Dispatches sidebar list is capped at a fixed 420px, so it does not use the full height of the studio section and does not grow when the campaign form beside it grows.
- The Approved recipients picker is a plain checkbox list with no search and no select all, painful past a dozen profiles.
- Sending X DMs is one click per recipient. A ten person dispatch means ten clicks and ten waits.

## Proposed solution

### Dispatches log

Match the dashboard log toolbar pattern: view tabs (Recent, Archived, All), a search box (matches title, product name, and recipient handles), a select all checkbox, per row checkboxes, and a bulk toolbar with Archive or Restore, a two step Confirm delete, and Clear. Backend gains two capped bulk mutations, `gifts.setCampaignsArchived` and `gifts.deleteCampaignsAdmin`, both admin only and idempotent.

### Sidebar height

The rail becomes a flex column and the campaign list flexes to the section height (which the form defines), scrolling inside. On single column layouts the 420px cap returns so the page does not stretch.

### Approved recipients

Client side search over handle and display name, plus Select shown, Select GIFT ready, and Clear buttons with a live selected count. Selecting more than 50 disables Create with a hint (the backend cap stays authoritative).

### Batch X DM send

Checkboxes on sendable ledger rows (link ready, not sent, not opted out), Select sendable, and a Send X DMs button that loops sequentially with a 2 second gap between sends. Compliance is preserved because each send still calls `giftActions.sendGiftDm`, which re-checks STOP, admin opt out, consent, and link readiness right before the API call and records send events. The loop stops early after 3 consecutive failures (a dead sender token fails everything, so stop hammering X). Progress and a final sent/failed summary surface in the feedback strip.

## Files to change

- `convex/gifts.ts`: add `setCampaignsArchived` and `deleteCampaignsAdmin` bulk mutations.
- `src/components/GiftAdminPanel.tsx`: dispatch log tabs, search, selection, bulk toolbar; recipient picker search and select buttons; ledger batch selection and sequential send loop.
- `src/globals.css`: rail flex height, dispatch toolbar and checkbox styles, picker toolbar styles, ledger batch bar.

## Edge cases

- Bulk delete keeps the two step confirm; anything else disarms it.
- Selection prunes automatically when a filter, view, or live query change removes rows.
- Batch send skips rows that became unsendable between selection and their turn (the action throws, the loop records the failure and moves on).
- Deleting the selected sidebar campaign falls back to the newest visible one (existing behavior).
- Select shown in the picker respects the current search filter; the 50 recipient cap shows before submit.

## Verification steps

- `npm run typecheck` and lint pass.
- Convex dev accepts the new mutations.
- Manual signed in pass: filter, select, bulk archive, restore, delete; batch send two ready recipients and confirm spacing plus event log entries.

## Task completion log

- 2026-08-15 20:55 UTC PRD drafted.
- 2026-08-15 21:05 UTC Implemented all four surfaces, typecheck and lint pass, Convex dev accepted the mutations, deployed to prod (`npx convex deploy --yes` plus `npm run deploy -- --skip-convex`). Signed in bulk flows still need a manual pass since the IDE browser stops at the X sign in gate.
