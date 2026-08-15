# X Account Activity gift consent

Created: 2026-08-08 20:23 UTC  
Last Updated: 2026-08-08 20:38 UTC  
Status: Complete

## Problem

The gift studio relies on an admin checkbox to confirm that a recipient sent `GIFT` to the dedicated Friends of Convex X account. A recipient who later sends `STOP` also depends on an admin manually suppressing their recipient record. This is usable as a fallback but does not provide automatic, provider-verified consent or opt-out tracking.

## Root cause

- The app can send DMs through its dedicated OAuth 2.0 sender grant but has no X Account Activity webhook.
- X webhook CRC and POST signatures are not handled.
- The dedicated sender account is not subscribed to Account Activity.
- Consent state exists only on a campaign recipient, so a `GIFT` request that arrives before campaign creation has nowhere to live.
- Opt-out state is campaign-recipient specific instead of applying to the X account across campaigns.

## Proposed solution

1. Add a public Convex HTTP endpoint at `/x-account-activity` that supports X challenge-response GET requests and signed POST event delivery.
2. Verify every POST against the exact raw body using the X app API secret and `x-twitter-webhooks-signature`.
3. Parse only inbound `message_create` events addressed to the connected dedicated sender account.
4. Treat a leading `GIFT` command as active consent and a leading `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, or `QUIT` command as suppression.
5. Deduplicate by X DM event ID and store only the detected command and delivery metadata, not the complete DM text.
6. Keep one indexed global intent row per X user ID so consent can be detected before a campaign exists and STOP applies to future sends.
7. Add an admin-only action that registers the public HTTPS webhook with X, subscribes the dedicated sender through OAuth 1.0a, and records status.
8. Show Account Activity readiness and per-profile consent state in `/admin/gifts`.
9. Allow automatic consent to replace the manual checkbox for detected recipients while retaining the manual fallback. Never allow the manual checkbox to override an active STOP.
10. Recheck global suppression immediately before every API send.

## Authentication boundary

Three X credential sets remain separate:

- Convex Auth OAuth 2.0 identifies admins and join applicants.
- The existing OAuth 2.0 sender grant sends DMs and refreshes its access token.
- X Account Activity uses the app API key/secret plus the dedicated sender's OAuth 1.0a access token/secret to subscribe that account. The existing app bearer token registers the webhook.

All secret values live in the selected Convex deployment. Codex Sites receives none of them.

## Data model

- `giftIntentStates`: one row per sender X user ID with the latest request, STOP, command source, profile match, and timestamps.
- `xAccountActivityEvents`: one row per inbound DM event ID for idempotency and a privacy-minimized audit trail.
- `xAccountActivityConfigs`: singleton registration/subscription status for the dedicated sender webhook.
- `giftRecipients`: optional consent source and event ID fields for newly issued passes while preserving existing rows.

Every read path uses a bounded indexed query. No full DM body is stored.

## Files to change

- `convex/schema.ts`
- `convex/convex.config.ts`
- `convex/giftCrypto.ts`
- `convex/gifts.ts`
- `convex/giftActions.ts`
- `convex/giftWebhooks.ts`
- `convex/http.ts`
- `app/components/GiftAdminPanel.tsx`
- `app/globals.css`
- `fourthwall-setup.md`
- `SETUP_GUIDE.md`
- `task.md`
- `changelog.md`
- `files.md`

## Edge cases

- X repeats the same event or sends duplicate events for more than one subscription.
- The webhook payload contains outbound DMs, typing events, read receipts, or unrelated account activity.
- A DM is addressed to a different subscribed user or arrives before the sender connection exists.
- The sender writes `GIFT`, later `STOP`, and later sends a new `GIFT` request.
- A STOP arrives after a pass is created but before the gift reply is sent.
- A sender is not yet a synced leaderboard profile.
- The webhook registration exists but the sender subscription is missing or revoked.
- The app is running in local Agent Mode and does not have a public HTTPS webhook URL.
- X webhook registration succeeds but OAuth 1.0a subscription fails.
- X revokes the sender's subscription or API credentials.

## Verification

- Run Convex code generation, TypeScript, lint, and the production build.
- Unit-test CRC output, signature verification, payload parsing, inbound filtering, duplicate events, GIFT, STOP, and re-consent ordering.
- Confirm a bad or missing POST signature returns `401` without writes.
- Confirm the CRC response uses the X API secret and `sha256=` prefix.
- Confirm outbound DMs and unrelated activity return `200` without changing consent.
- Confirm STOP blocks a send even when the recipient was manually confirmed earlier.
- Confirm a later provider-verified GIFT clears the global STOP state.
- Confirm the existing manual confirmation still works when Account Activity is unavailable.
- Confirm `/`, `/about`, `/join`, `/admin`, `/admin/setup`, `/admin/gifts`, and gift routes still build.

## Task completion log

- 2026-08-08 20:23 UTC: Current X Account Activity, Webhooks, OAuth 1.0a, Convex HTTP action, and component guidance reviewed. Architecture selected.
- 2026-08-08 20:38 UTC: Added signed CRC and event ingestion, privacy-minimized command storage, global consent/suppression, sender subscription setup, admin states, send-time enforcement, operator documentation, and parser/crypto coverage. Lint, TypeScript, and the production build passed. Convex code generation refreshed the generated API, but uploading to the existing local Agent Mode backend remains deferred because the process already holding port 3210 is not responding.
