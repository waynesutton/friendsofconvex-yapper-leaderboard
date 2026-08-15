# Fourthwall development and production gift setup

Created: 2026-08-15 07:23 UTC
Last Updated: 2026-08-15 07:23 UTC
Status: In Progress

## Problem

The consent-first gift workflow is deployed, but neither Convex deployment has
the Fourthwall credentials, redemption webhook secret, or X sender-encryption
key required to create and deliver personal giveaway links. The requested gift
set includes a Friends of Convex Shirt in the `convex-dev-shop` Fourthwall
dashboard and a Vintage Convex Hat at `store.convex.dev`, so shop ownership and
giveaway compatibility must be verified before a campaign is created.

## Proposed solution

1. Reconcile `docs/fourthwall-setup.md` with the current Fourthwall Platform API.
2. Confirm the exact shop, product IDs, API-user access, and whether both
   products can be issued by one shop or need separate campaigns/integrations.
3. Configure development `ceaseless-bobcat-587` and production
   `agile-spaniel-476` with deployment-specific secrets while keeping the only
   public origins at `https://ceaseless-bobcat-587.convex.site` and
   `https://friendsofconvex.dev` respectively.
4. Register separate signed `ORDER_PLACED` webhooks for the two deployments.
5. Connect the X gift sender in each deployment. Keep legacy Account Activity
   disabled unless the X app demonstrably has access; retain manual consent as
   the supported fallback.
6. Create a recipient-specific, 100%-free Fourthwall giveaway link only after
   verifying the product and the corrected admin handle `@waynesutton`.
7. Preview the X DM and require action-time confirmation before the real send.

## Files to change

- `docs/fourthwall-setup.md`
- `prds/2026-08-15-fourthwall-dev-production-gift-setup.md`
- `task.md`
- `changelog.md`
- `files.md`
- Convex or React source only if the live API proves the current integration is
  incompatible.

## Edge cases

- The shirt and hat may belong to different Fourthwall shops; a shop-level API
  user cannot issue a giveaway for a product outside its shop.
- Fourthwall creates a package for one `productId`; a two-product gift may need
  two campaigns and two single-use links.
- Creating API users, webhooks, OAuth grants, or sending an X DM are external
  side effects and require confirmation immediately before submission.
- Development and production webhook secrets and X token-encryption keys must
  remain distinct.
- `@waynesuttton` in the new request conflicts with the user's prior explicit
  correction and the verified admin account `@waynesutton`; do not target the
  misspelled handle.
- A real redemption can create fulfillment cost; do not redeem or purchase
  without a separate exact-price confirmation.

## Verification

- List Convex environment-variable names without printing secret values.
- Confirm Fourthwall API access and product ownership through the official API.
- Confirm both exact webhook URLs and signatures.
- Verify `/admin/gifts` readiness on both exact origins.
- Create only the user-approved test pass and preview its private portal and
  Fourthwall destination.
- Send no DM or paid fulfillment without action-time confirmation.
- Run `npm run check` and `npm run test:x-account-activity` under Node 24 if
  source or setup documentation changes.

## Task completion log

- 2026-08-15 07:23 UTC — Read the full setup guide and current official
  Fourthwall overview, authentication, giveaway-link, webhook, and order-event
  documentation. Confirmed both Convex deployments currently contain only the
  seven normal auth/X environment-variable names; all gift values are missing.
