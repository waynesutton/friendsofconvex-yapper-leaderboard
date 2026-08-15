# Fourthwall gift pass

Created: 2026-08-08 19:48 UTC  
Last Updated: 2026-08-08 20:14 UTC  
Status: Complete

## Problem

Friends of Convex admins need a private way to issue one free Fourthwall gift to an approved X account, send that person a personalized link, and see the full lifecycle from link creation through redemption. Recipients should not have to complete a second identity form before Fourthwall collects the shipping details it already needs.

## What is missing

- The app has no campaign, recipient, delivery, or redemption records.
- Convex Auth only requests identity scopes. It does not retain provider access tokens, so it cannot send X DMs.
- The app has no separate OAuth grant for a dedicated X sender account.
- Fourthwall order webhooks are not registered or verified.
- There is no private recipient portal or public share state.

## Proposed solution

Build a consent-first gift flow:

1. An admin connects one dedicated X sender account through a separate OAuth 2.0 PKCE grant with `dm.read`, `dm.write`, `tweet.read`, `users.read`, and `offline.access`.
2. The sender tokens are encrypted before storage and refreshed by the Convex backend.
3. A recipient first sends `GIFT` to the sender account on X. The admin confirms that inbound request before issuing a gift. This avoids unsolicited automated DMs.
4. The admin creates a campaign, selects approved leaderboard profiles, and asks Fourthwall to create one giveaway link per recipient.
5. Convex assigns each link to one opaque portal token and records creation, send attempt, open, reveal, click, and redemption timestamps.
6. The app replies by X DM with the recipient's `/gift/[token]` URL. A manual copy-message fallback remains available for API or recipient-setting failures.
7. The personalized gift page reveals the Fourthwall destination, records the click, and offers a transparent X share action.
8. A signed Fourthwall `ORDER_PLACED` webhook marks the matching giveaway link redeemed by `source.giftId`. Admins can also reconcile a package against Fourthwall status.

No recipient form is needed. The selected X profile establishes who the gift is for, and Fourthwall handles shipping details during redemption.

## Data model

- `giftCampaigns`: title, Fourthwall product ID, package ID, portal expiry, creator, status, and timestamps.
- `giftRecipients`: campaign/profile relation, snapshotted X identity, opaque portal token, Fourthwall link ID and URL, consent record, lifecycle status, delivery identifiers, and event timestamps.
- `giftSenderConnections`: one encrypted X sender token set, sender identity, scopes, expiration, and connection metadata.
- `giftOAuthStates`: one-use PKCE state with an expiry and initiating admin.
- `giftWebhookEvents`: deduplication record for Fourthwall event IDs.

Every read path uses a bounded indexed query. Giveaway links are stored per recipient rather than in an unbounded campaign array.

## Security and policy boundaries

- `/admin/gifts` and every gift-management function require the existing Convex Auth admin allowlist.
- Public gift queries accept only an unguessable portal token and return the minimum display data.
- Fourthwall credentials, webhook secret, X client secret, token-encryption key, sender access token, and refresh token never reach the browser.
- X DM sending requires an admin-recorded inbound request. A successful X API response is recorded as `sent`, not `delivered` or `read`.
- Webhook signatures are verified against the exact raw body and duplicate event IDs are idempotent.
- Portal tokens can expire or be revoked. A Fourthwall giveaway URL remains a bearer capability and is shown only after the portal reveal action.
- Resend is not installed because the current X API supports the required one-to-one DM reply. Manual copy remains the fallback.

## Interface direction

- Keep the existing site shell and admin visual language unchanged.
- Add `/admin/gifts` as an admin-only gift studio with a campaign form, recipient selector, connection status, and lifecycle ledger.
- Add `/gift/[token]` as an isolated Convex-branded signal card using official logo artwork and the red, yellow, and purple rotor colors.
- Use borders and surface shifts rather than decorative shadows.
- Motion is limited to the rotor and reveal transition, uses transform/opacity, and stops under `prefers-reduced-motion`.
- Controls remain keyboard reachable, at least 44px high, and usable at 375px wide.

## Files to change

- `convex/schema.ts`
- `convex/convex.config.ts`
- `convex/http.ts`
- `convex/gifts.ts`
- `convex/giftActions.ts`
- `convex/giftCrypto.ts`
- `convex/giftWebhooks.ts`
- `app/admin/page.tsx`
- `app/admin/gifts/page.tsx`
- `app/gift/[token]/page.tsx`
- `app/components/AdminPanel.tsx`
- `app/components/GiftAdminPanel.tsx`
- `app/components/GiftPortal.tsx`
- `app/globals.css`
- `public/convex/*`
- `fourthwall-setup.md`
- `task.md`
- `changelog.md`
- `files.md`

## Edge cases

- Fourthwall credentials or product ID are missing or invalid.
- Fewer or more giveaway links are returned than requested.
- The same profile is selected twice for one campaign.
- The recipient has no numeric X user ID yet.
- The recipient has not requested the DM, blocks the sender, or does not accept requests.
- The sender access token expires and refresh-token rotation returns a new refresh token.
- The recipient opens the same portal in several tabs or clicks the Fourthwall button more than once.
- A webhook is delivered more than once, arrives after a manual reconciliation, or has no gift ID.
- A portal is expired, revoked, redeemed, or malformed.
- Fourthwall reports a giveaway link as cancelled.

## Verification

- Run `npx convex codegen` and a non-production Convex push when a deployment is available.
- Run `npm run lint`, `npm run typecheck`, and `npm run build`.
- Verify unauthenticated gift admin queries and actions fail.
- Verify a valid portal token returns only public fields; an invalid token returns a closed state.
- Verify open and reveal mutations are idempotent.
- Verify the webhook rejects a bad signature and deduplicates a repeated event ID.
- Test the gift portal at 375px, desktop width, keyboard-only navigation, and reduced motion.
- Confirm existing `/`, `/about`, `/join`, `/admin`, and `/admin/setup` routes retain their current behavior.

## Task completion log

- 2026-08-08 19:48 UTC: Fourthwall giveaway, X DM, Convex Auth token-storage, webhook, and Convex brand research completed. Architecture selected.
- 2026-08-08 20:14 UTC: Backend, protected admin studio, private portal, safe public share card, environment guide, and project documentation completed.
- 2026-08-08 20:14 UTC: `npm run check` passed with lint, TypeScript, and the production Vinext build. Browser QA confirmed the existing homepage, unauthenticated admin gate, invalid-token state, and a 375px layout without horizontal overflow.
- 2026-08-08 20:14 UTC: Convex code generation passed. A non-production function push remains deferred because the existing local Agent Mode process on port 3210 was not healthy enough for the CLI to connect; no process was terminated and no production deployment was attempted.
