# Gift studio product shelf with Fourthwall previews

Created: 2026-08-15 18:50 UTC
Last Updated: 2026-08-15 19:05 UTC
Status: Done

## Problem

1. Saved Fourthwall products can only be created from inside the campaign form, tied to whatever is in the product ID input. Admins want to stock products with labels ahead of time, before any send, and still pick them when creating a campaign.
2. Saved products are label plus raw ID only. There is no confirmation the ID is real and no visual of what will be gifted.

## Research

Fourthwall Platform API `GET /open-api/v1.0/products/{productId}` returns the product `name`, `thumbnailImage` (with `url` and `transformedUrl`), and `images`. API keys (the Basic auth pair the app already uses for giveaway links) have full access. Rate limit 100 requests / 10 seconds per shop. Source: https://docs.fourthwall.com/api-reference/platform/products/get-product

## Proposed solution

1. Verified saves. Saving a preset becomes an admin action (`giftActions.saveProductPreset`) that first asks Fourthwall for the product. A found product stores `productName` and `thumbnailUrl` on the preset; a 404 rejects the save with a clear message so typo'd IDs never reach a campaign. If Fourthwall credentials are missing or the lookup fails for a network reason, the preset still saves without a preview.
2. Product shelf. A new Gift studio section between the sender panel and the campaign form where admins add label + product ID pairs anytime. Each saved product renders as a card: thumbnail (or a gift glyph placeholder), Fourthwall product name, admin label, shortened ID, a Use button that fills the campaign form's product ID, and a remove button.
3. The existing pick-to-fill chips under the campaign form's product ID input stay, now with a tiny thumbnail when one is stored. The in-form label + Save product row moves to the shelf (one add flow, two pick surfaces).

## Files to change

- convex/schema.ts (optional productName, thumbnailUrl on giftProductPresets)
- convex/gifts.ts (internal upsert mutation replaces the public save; validator gains the new fields)
- convex/giftActions.ts (saveProductPreset action with Fourthwall lookup)
- src/components/GiftAdminPanel.tsx (shelf section, chips with thumbnails, save flow moves to the shelf)
- src/globals.css (shelf cards, chip thumbnails)

## Edge cases

- Fourthwall 404: save rejected with "could not find this product ID".
- Fourthwall creds missing or network failure: preset saves without preview; feedback says the preview could not load.
- Re-saving an existing ID updates label, name, and thumbnail instead of duplicating.
- Presets saved before this change have no name or image; cards show the placeholder and the label only.
- Thumbnail URLs live on Fourthwall's CDN; images render with plain img tags and empty alt (decorative next to the name).

## Verification steps

- npm run check (lint, tsc, build)
- Dev deploy accepts the schema change (fields optional, no migration).
- Browser where sign in permits: add a product on the shelf, watch the name and image appear, Use fills the form, chips show thumbnails, remove works. Otherwise verified through types and code review.

## Task completion log

- 2026-08-15 18:50 UTC Created after confirming the Get Product endpoint shape.
- 2026-08-15 19:05 UTC Shipped: verified save action, internal upsert, schema fields, product shelf UI, chip thumbnails. `npm run check` passes; Convex dev deploy clean. Signed in shelf flow awaits a manual pass (IDE browser stops at the X sign in gate).
