# Custom DM message per dispatch

Created: 2026-08-16 05:05 UTC
Last Updated: 2026-08-16 05:05 UTC
Status: Done

## Problem

The X DM sent with every gift pass is hardcoded inside `sendGiftDm` in `convex/giftActions.ts`. Admins had no way to write a different message for a specific group of recipients. The ask: select people in Approved recipients, toggle an edit box that opens with the default message, edit it, and have only that group receive the custom text. The default message must never be overwritten.

## Proposed solution

A dispatch is created from exactly the people selected in Approved recipients, so one optional `customDmMessage` field on `giftCampaigns` gives "the selected people at that time get the custom message" with no new tables. The hardcoded default stays as the fallback for every dispatch without a custom message.

Custom messages support three placeholders rendered per person at send time: `{link}` (pass URL), `{name}` (display name), `{number}` (gift number). Two safety nets keep every send deliverable and compliant: the pass link is appended when `{link}` is missing, and the STOP notice is appended when the text never mentions STOP.

## Files changed

- `convex/schema.ts` — optional `customDmMessage` on `giftCampaigns`.
- `convex/gifts.ts` — field added to `giftCampaignFields` (flows into `listCampaignsAdmin` and `getCampaignForSync`); `createProvisioningCampaign` accepts, trims, caps at 1000 characters, and stores it.
- `convex/giftActions.ts` — `createCampaign` passes the message through; new exported `buildGiftDmText` helper renders the default byte for byte or the custom text with placeholders and safety nets; `sendGiftDm` loads the campaign via the existing `getCampaignForSync` query and uses the helper.
- `src/components/GiftAdminPanel.tsx` — "Edit the X DM message for this dispatch" toggle below the Approved recipients picker; textarea prefilled with the default template, placeholder legend, live character counter, Reset to default button, and a live preview rendered with the first selected person's name and next gift number; ledger shows a collapsible "Custom DM message active for this dispatch" note; Copy DM copies the rendered custom text when one exists.
- `src/globals.css` — editor panel, textarea, tools row, preview, and ledger note styles on existing theme tokens.

## Edge cases

- Empty or whitespace-only custom text falls back to the default message.
- Custom text over 1000 characters is rejected server side; the textarea caps input client side.
- Campaigns created before this feature have no field and keep the default path.
- A custom message without `{link}` still delivers the pass URL (appended).
- A custom message without any STOP mention still carries the opt out notice (appended). The word boundary check means "unstoppable" does not count as a STOP mention.
- Batch send and single send share `sendGiftDm`, so both use the stored message with no batch loop changes.
- STOP suppression, opt out, consent, and Fourthwall readiness checks are untouched.

## Verification

- `npm run lint` and `npm run typecheck` pass.
- Node sanity check: default path output matches the original hardcoded string byte for byte for null, empty, and whitespace messages; placeholders substitute; both safety nets append; the STOP word boundary behaves.

## Task completion log

- 2026-08-16 05:05 UTC — Schema field, backend threading, `buildGiftDmText`, form editor with preview, ledger note, Copy DM support, CSS, and verification all done.
