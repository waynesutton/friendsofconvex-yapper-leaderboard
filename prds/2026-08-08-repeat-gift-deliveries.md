# Repeat gift deliveries

Created: 2026-08-08 20:43 UTC  
Last Updated: 2026-08-08 20:49 UTC  
Status: Complete

## Problem

The data model already creates one recipient record per campaign, so the same X account can technically receive gifts in separate campaigns. The admin interface does not make that capability or the person's prior gift history clear, and one provider-detected `GIFT` event can currently be reused for unlimited future campaign creation.

## Goal

Allow an approved person to receive multiple distinct gift DMs over time while preserving a separate Fourthwall link, portal, X message ID, redemption lifecycle, consent record, and event history for every delivery.

## Safety model

- One recipient row remains one gift and one X DM.
- The same profile may appear in any number of different campaigns.
- A provider-detected `GIFT` event authorizes one new delivery and is atomically consumed when its recipient row is created.
- A later gift requires a fresh `GIFT` event or a fresh admin-confirmed manual request.
- An active global `STOP` blocks campaign creation and send-time delivery across every campaign.
- A fresh `GIFT` authorizes the new delivery but does not silently reactivate older recipient rows suppressed by an earlier `STOP`.
- Re-sending the same recipient row remains idempotent and returns `already_sent`; a new gift always receives a new recipient row, portal token, Fourthwall gift ID, and DM event ID.

## Data changes

- Add optional consumption metadata to `giftIntentStates` so existing rows remain valid during rollout.
- Add an optional `giftNumber` to `giftRecipients`; new deliveries receive the next per-X-user number.
- Continue using `giftEvents` for the complete lifecycle of each delivery.
- Add a bounded admin history query so prior gifts are visible while selecting recipients.

## Interface changes

- Show each person's previous gift count and last delivery status in the recipient picker.
- Distinguish an available `GIFT` request from a request already used for an earlier gift.
- Label each ledger row with its per-person gift number.
- Explain that repeat gifts require a new campaign and fresh consent.

## Verification

- Confirm the same profile can be selected for two different campaigns.
- Confirm each delivery receives a distinct recipient record, token pair, Fourthwall link, and gift number.
- Confirm one automatic `GIFT` event cannot be consumed by two concurrent campaigns.
- Confirm a fresh `GIFT` makes the person eligible again.
- Confirm manual confirmation remains available for a separately verified request.
- Confirm `STOP` blocks all unsent deliveries and repeat campaign creation.
- Run lint, TypeScript, parser/crypto tests, and the production build.

## Task completion log

- 2026-08-08 20:43 UTC: Existing recipient, campaign, consent, send, and admin history flows reviewed. Repeat-delivery architecture selected.
- 2026-08-08 20:49 UTC: Added numbered repeat deliveries, bounded admin history, atomic X consent-event consumption, separate links and message tracking, and protection against reactivating older STOP-suppressed rows. Parser/crypto tests, lint, TypeScript, and the production build passed.
