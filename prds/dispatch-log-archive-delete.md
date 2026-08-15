# Dispatches log with archive, delete, and export

Created: 2026-08-15 19:10 UTC
Last Updated: 2026-08-15 19:25 UTC
Status: Done

## Problem

1. The Dispatches sidebar on /admin/gifts grows without bound and pushes the page down; it needs its own scroll area.
2. There is no way to archive or delete a dispatch (campaign). Old and test campaigns pile up forever.
3. Admins want a Dispatches log section below the recipient ledger where they can archive, restore, delete with confirmation, and export the list as CSV, and have the sidebar stay in sync.

## Proposed solution

- Schema: optional `archivedAt` on `giftCampaigns`.
- Mutations (admin only, idempotent): `setCampaignArchived` toggles the timestamp; `deleteCampaignAdmin` cascade deletes the campaign's gift events, recipients, then the campaign itself.
- Sidebar shows non archived campaigns only and its list scrolls inside a fixed max height. The log lists every campaign with an Archived tag where relevant.
- Both surfaces read the same `listCampaignsAdmin` query, so an archive or delete in the log updates the sidebar in the same render (Convex reactivity).
- Log actions: Archive (single click, reversible with Restore), Delete (two step armed confirm in red, matching the board profile remove pattern), Download CSV (title, status, archived, product ID, created, last synced, sync error).
- If the selected campaign is archived it can stay selected in the ledger; if deleted, selection falls back to the newest visible campaign.

## Files to change

- convex/schema.ts (archivedAt on giftCampaigns)
- convex/gifts.ts (validator field, setCampaignArchived, deleteCampaignAdmin)
- src/components/GiftAdminPanel.tsx (scrolling rail data, Dispatches log section, armed delete state, CSV export)
- src/globals.css (rail scroll, dispatch log styles)

## Edge cases

- Deleting a campaign whose recipients hold portal/share tokens kills those pass pages; the confirm copy says gift history and passes are removed for good.
- Deleting or archiving an already gone campaign is a no-op (idempotent early returns).
- Deleting the selected campaign resets the ledger to the newest remaining campaign without a crash (selection is computed, not stored stale).
- Archiving every campaign leaves the sidebar with its empty state and the ledger prompts to choose a campaign.
- Arming delete on one row and clicking anything else disarms it.

## Verification steps

- npm run check
- Convex dev deploy accepts schema and mutations.
- Manual signed in pass: scroll the rail, archive and restore from the log, watch the sidebar update, delete a test campaign after confirm, export the CSV.

## Task completion log

- 2026-08-15 19:10 UTC Created.
- 2026-08-15 19:25 UTC Shipped: archivedAt on giftCampaigns, setCampaignArchived and deleteCampaignAdmin mutations, scrolling sidebar (420px cap, archived hidden), Dispatches log section with archive/restore, armed delete, and CSV export. npm run check green; Convex dev accepted the push. Signed in click-through left for the admin since the IDE browser stops at the X sign in gate.
