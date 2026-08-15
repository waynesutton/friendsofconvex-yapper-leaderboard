# Fourthwall integration status

Created: 2026-08-15 08:26 UTC
Last Updated: 2026-08-15 08:26 UTC
Status: In Progress

## Scope

This is the live setup and incident log for the Friends of Convex Fourthwall
gift integration. It covers only these deployed origins:

- Development: `https://ceaseless-bobcat-587.convex.site`
- Production: `https://friendsofconvex.dev`
- Convex development deployment: `ceaseless-bobcat-587`
- Convex production deployment: `agile-spaniel-476`
- Fourthwall shop: `convex-dev-shop`
- Connected X gift sender and admin: `@waynesutton`

Credential values and private gift tokens are intentionally omitted.

## Requested products

### Friends of Convex Shirt

- Fourthwall product ID: `f0d27d03-cb85-41eb-bb97-eea5820ba8a6`
- Verified source product:
  `https://convex-dev-shop.fourthwall.com/admin/dashboard/products/all/f0d27d03-cb85-41eb-bb97-eea5820ba8a6/?page=1`
- Current result: one production giveaway pass is active and ready for
  `@Fayeezashaikh`.

### Vintage Convex Hat

- Fourthwall product ID: `3fbdb57d-170e-437c-b2c1-3275941ab9c2`
- Store page: `https://store.convex.dev/products/vintage-convex-hat`
- Current result: verified as a separate product in the same Fourthwall shop,
  but no hat campaign or giveaway pass has been created.

Fourthwall creates giveaway packages for one product ID at a time. The shirt
and hat therefore require separate campaigns and separate private links.

## What is configured and working

### Fourthwall

- A Fourthwall Open API user exists for the shop.
- The Open API uses HTTP Basic authentication.
- The actual API username and password are now stored in both Convex
  deployments.
- The API username is an email-style generated identifier.
- The API password is a separate 40-character credential.
- Two `Order placed` webhooks are registered:
  - `https://ceaseless-bobcat-587.convex.site/fourthwall/webhook`
  - `https://friendsofconvex.dev/fourthwall/webhook`
- Fourthwall provides one shop-wide webhook signing secret. The same current
  signing secret is therefore stored in both deployments for verification of
  their respective webhook requests.
- The production API successfully created a personal giveaway link for the
  exact Friends of Convex Shirt product ID.

### Convex

- Both deployments contain the required gift variables:
  `FOURTHWALL_API_USERNAME`, `FOURTHWALL_API_PASSWORD`,
  `FOURTHWALL_WEBHOOK_SECRET`, and `X_DM_TOKEN_ENCRYPTION_KEY`.
- Development and production use separate X DM token-encryption keys.
- Production successfully changed a campaign from provisioning to active after
  the Fourthwall API password was corrected.
- The successful production campaign is titled
  `Friends of Convex Shirt gift` and uses 30 portal-access days.
- The recipient ledger shows the ready pass for `@Fayeezashaikh` as gift #3.

### X sender

- `@waynesutton` is connected as the gift sender in development and
  production.
- The sender grant includes `dm.read`, `dm.write`, `tweet.read`, `users.read`,
  and `offline.access`.
- Both deployed X apps include their correct gift-DM callback:
  - `https://ceaseless-bobcat-587.convex.site/x-dm/callback`
  - `https://friendsofconvex.dev/x-dm/callback`
- Manual consent is available and was used for the confirmed
  `@Fayeezashaikh` request.

## What failed and why

### Credential capture and rotation

An earlier browser inspection exposed staged credential values in a tool
snapshot. Work stopped before those staged values were saved. The Fourthwall
API user was removed and recreated, the webhook signing secret was rotated,
and the exposed draft values were discarded. No credential values are recorded
in this repository.

The replacement credentials were then mapped incorrectly:

- Production `FOURTHWALL_API_USERNAME` initially received a UUID-shaped value
  instead of the generated email-style API username.
- Both deployments initially received the UUID-shaped Fourthwall webhook
  signing token as `FOURTHWALL_API_PASSWORD`.
- The real API password is a separate 40-character value.

The production username was corrected first, but Fourthwall continued to
return `Unauthorized` because the password was still the webhook token. The
actual password was then identified from the labeled Fourthwall password field
without printing it and saved to both Convex deployments.

### Failed production campaigns

Three production campaign rows remain in error status:

| UTC time | Campaign | Result |
| --- | --- | --- |
| 2026-08-15 08:07 | `Friends of Convex gift` | Fourthwall returned `Unauthorized`; no ready giveaway link and no DM. |
| 2026-08-15 08:09 | `Friends of Convex gift` | Fourthwall returned `Unauthorized`; no ready giveaway link and no DM. |
| 2026-08-15 08:20 | `Friends of Convex Shirt gift` for `@Fayeezashaikh` | Fourthwall returned `Unauthorized`; Convex request `5abd1b89ffe4232d` failed in `giftActions:createCampaign`. |

The failed rows were not deleted because they are part of the audit ledger.
They caused the successful recipient record to be numbered gift #3 even though
only one Fourthwall shirt link became ready.

## Successful production result

At 2026-08-15 08:25 UTC, production created one active Fourthwall giveaway pass
with these verified inputs:

- Recipient: `@Fayeezashaikh`
- Campaign: `Friends of Convex Shirt gift`
- Product ID: `f0d27d03-cb85-41eb-bb97-eea5820ba8a6`
- Portal access: 30 days
- Consent: manually confirmed after the user stated the recipient requested the
  gift
- State: active campaign, ready recipient pass, not sent, not opened, not
  redeemed

The private portal URL exists but is omitted from this repository. The app's
generated X DM has been previewed to the user. Sending it remains paused for
the required action-time approval.

## What is not working or not complete

- Automatic inbound `GIFT` and `STOP` detection is not enabled. The connected X
  apps do not have the four legacy OAuth 1.0a Account Activity credentials and
  the legacy API is deprecated. Manual confirmation and manual opt-out remain
  the supported fallback.
- No X DM has been sent for the ready shirt pass.
- No hat campaign or hat pass has been created.
- Development is configured but has not created a live Fourthwall test pass.
- A real redemption has not been performed, so no fulfillment order or cost
  has been created.
- The registered Fourthwall webhooks are present with the correct URLs and
  signing secret, but end-to-end redemption delivery has not been proven by a
  real order event.
- The three failed production campaign rows remain visible and affect gift
  numbering.

## Verification completed

- Confirmed the exact development and production public origins.
- Confirmed all required Convex environment-variable names without printing
  values.
- Confirmed the Fourthwall username and password have different expected
  shapes and corrected both deployments.
- Confirmed both Fourthwall `Order placed` webhook registrations.
- Confirmed both X sender OAuth connections and callback URLs.
- Confirmed the exact shirt product ID from the user-specified Fourthwall
  product page.
- Confirmed production shows `Created 1 new personal Fourthwall gift passes`.
- Confirmed the successful shirt campaign is active and its recipient pass is
  ready.
- Confirmed the DM send button is available but has not been selected.

## Remaining safe completion order

1. Obtain action-time approval for the exact X DM and send it to
   `@Fayeezashaikh`.
2. Verify the app records the DM as sent without opening the recipient's
   private pass.
3. Obtain separate approval before creating the Vintage Convex Hat campaign.
4. Do not redeem either gift or create a fulfillment order without explicit
   cost approval.
5. After the live work is complete, update `docs/fourthwall-setup.md`, the main
   setup PRD, `task.md`, `changelog.md`, and `files.md`, then run the project
   checks.

## Task completion log

- 2026-08-15 08:26 UTC — Recorded the live Fourthwall configuration, credential
  incident and correction, three failed production campaigns, one successful
  shirt pass, unsent-DM boundary, and remaining hat, webhook, and automatic
  consent work.
