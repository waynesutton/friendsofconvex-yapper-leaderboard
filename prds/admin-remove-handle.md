# Admin remove handle from the board

Created: 2026-08-15 18:30 UTC
Last Updated: 2026-08-15 18:30 UTC
Status: Done

## Problem

The Friends on the board section on `/admin` can archive and restore a profile, but nothing removes one for good. Wrong handles, test accounts, and decline leftovers pile up in the admin list forever.

## Proposed solution

A permanent Remove action per row with a two step confirm so one stray click cannot delete anyone.

- New admin only mutation `profiles.remove` that deletes the profile document and every snapshot in its history. Idempotent: a second call on a missing profile returns without error.
- Gift ledger rows (`giftRecipients`, `giftEvents`) are untouched. They carry their own copies of the handle and display name, so gift history still reads correctly after the profile is gone.
- In the Friends on the board row, a Remove button next to Archive/Restore. First click arms the button (label flips to Confirm, red styling, info message explains the delete). Second click deletes. Clicking any other row action disarms it.

## Files to change

- `convex/profiles.ts` — add the `remove` mutation.
- `src/components/AdminPanel.tsx` — confirm state, remove handler, Remove button per row.
- `src/globals.css` — `.icon-text-button.danger` armed style using `--signal-red`.

## Edge cases

- Double delete: second call finds no profile and returns null instead of throwing.
- Profile mid sync: the sync internals (`getForSync`, `recordSyncSuccess`, `recordSyncFailure`) run against a deleted id. `getForSync` already returns null for a missing profile; `recordSync*` patches would throw inside an action retry, which surfaces as a sync error and nothing more.
- Gift campaign creation reads live profiles when adding recipients; a removed profile simply no longer appears in the picker (it is off `listAdmin`).
- Rejoin after removal: the person can be re added by handle or request to join again; they start fresh with no history.

## Verification steps

1. `npm run check` passes.
2. On `/admin`, click Remove once: button arms and shows Confirm with the info message.
3. Click another action: the armed state resets.
4. Click Confirm: the row disappears from the admin list and the public board in realtime, and the snapshots for that profile are gone from the data browser.

## Task completion log

- 2026-08-15 18:30 UTC — Mutation, UI, styling, and docs sync completed. `npm run check` verified.
