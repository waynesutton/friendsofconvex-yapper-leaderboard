# Gift lab: named Fourthwall gift links for people off the board

Created: 2026-08-16 00:25 UTC
Last Updated: 2026-08-16 00:45 UTC
Status: Done

## Problem

The Gift studio only sends gifts to approved board members with a synced X profile, an X consent trail, and a DM delivery path. The team also wants to hand a Fourthwall gift to clients, customers, and friends who are not on the board and have no X handle in the system. There is no way to mint a personal gift link from just a name.

## Proposed solution

A new admin only page at `/admin/gift-lab` (Gift lab) that:

- Reuses the shared Gift inventory Product shelf (same `giftProductPresets` data and Fourthwall verified saves) as its own section on the page.
- Has a small create form: the person's full name, a Fourthwall product picked from the shelf or pasted, and one checkbox that decides whether the link expires (7 days, matching the studio cap) or never expires.
- Calls Fourthwall `/giveaway-links` with `number: 1`, stores the private Fourthwall URL server side, and mints an unguessable token.
- Shows the full generated link (`/gift/for/:token`) with a copy icon right on the page, plus a Lab links log listing every link with status, expiry, copy, open, check Fourthwall, revoke, and a two step delete.
- No X sender section, no consent section, no DMs, no emails. The page only creates links for the team to copy and share themselves.

The recipient page at `/gift/for/:token` says "A signal of thanks for {Full Name}" (no X handle, no avatar), shows the gift card, a reveal button that goes to Fourthwall, a countdown only when the link expires, and no "Share a safe public card" button. The route is a normal SPA route served by the `@convex-dev/static-hosting` catch all already registered last in `convex/http.ts`, so no HTTP route work is needed.

## Data

New `giftLabLinks` table:

- `fullName`, `token` (32 byte base64url), `fourthwallProductId`, `fourthwallPackageId`, `fourthwallGiftId`, `fourthwallUrl`, `fourthwallStatus`
- `status`: provisioning, ready, opened, revealed, redeemed, cancelled, error
- `expiresAt` (number or null; null means the link never expires)
- `createdByUserId`, `openedAt`, `revealedAt`, `fourthwallClickedAt`, `redeemedAt`, `revokedAt`, `syncError`, `createdAt`, `updatedAt`
- Indexes: `by_token`, `by_created_at`, `by_fourthwall_gift_id`

## Files to change

- `convex/schema.ts` — add `giftLabLinks`.
- `convex/giftLab.ts` — new: public portal query and mutations (token gated, private URL only through mutations with server time expiry checks, same as the studio), admin list, revoke, delete, internal create, finalize, error, and status sync helpers.
- `convex/giftActions.ts` — `createLabLink` (admin, Fourthwall provisioning, expiry choice) and `syncLabLink` (admin, per link Fourthwall status check).
- `convex/gifts.ts` — `applyFourthwallOrder` falls back to `giftLabLinks` by `fourthwallGiftId` so the existing signed webhook marks lab links redeemed too.
- `src/components/GiftProductShelf.tsx` — new shared Product shelf extracted from the studio panel so both pages stay in sync.
- `src/components/GiftAdminPanel.tsx` — swap its inline shelf markup for the shared component; no behavior change.
- `src/components/GiftLabPanel.tsx` — new admin page body.
- `src/pages/AdminGiftLabPage.tsx` — `AdminGate` wrapped route.
- `src/components/GiftPortal.tsx` — export the closed card, countdown, and rotor so the lab portal reuses them.
- `src/components/GiftLabPortal.tsx` and `src/pages/GiftLabPassPage.tsx` — recipient thank you page.
- `src/App.tsx`, `src/components/SiteHeader.tsx` — routes and admin nav link.
- `src/globals.css` — small additions on existing tokens for the generated link result and lab rows.

## Edge cases

- Fourthwall provisioning fails: the link row stays in `error` with the message stored, visible in the log, deletable.
- Expired link opened: closed card with the expired message; server time enforced in every mutation, client `now` only feeds the display query, matching `gifts.getPortal`.
- Revoked link: closed card; revoke is admin only and idempotent.
- Never expires: no countdown renders and the portal query skips the expiry check.
- Duplicate names are fine: each link is its own row and token.
- Webhook redemption: `ORDER_PLACED` events that do not match a board recipient now check lab links before giving up; dedupe unchanged.
- Long names: card reuses the container query font sizing variable.

## Verification steps

- `npm run typecheck`, `npm run lint`, `npm run build` pass.
- `npx convex dev --once` accepts the schema and functions.
- Seed a lab link on dev and load `/gift/for/:token`: name renders without an @, no share button, reveal returns the Fourthwall URL, countdown only when expiry set.
- Unauthenticated probe of `giftLab:listLinksAdmin` throws the sign in error.

## Task completion log

- 2026-08-16 00:25 UTC — PRD written, implementation started.
- 2026-08-16 00:45 UTC — Done. Backend (`giftLabLinks` schema, `convex/giftLab.ts`, `createLabLink`/`syncLabLink` actions, webhook fallback), shared `GiftProductShelf`, admin page at `/admin/gift-lab` with header nav link, recipient page at `/gift/for/:token`, and styles shipped. Typecheck, lint, and build pass; convex dev deployed the schema and indexes. Browser verified: invalid token shows the closed card, a seeded link renders "A signal of thanks for Fable Test" with no handle or share card, and reveal flips the card and offers the Fourthwall button. Docs synced.
