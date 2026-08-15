# Set up Fourthwall gifts and X DM delivery

This guide connects the gift studio at `/admin/gifts`. Follow it in order. You will create Fourthwall giveaway links in Convex, send each private portal link from one X account, and record redemption through a signed webhook.

## What you need

You need all four of these:

1. The existing Convex Auth setup from `SETUP_GUIDE.md` so admins can open `/admin/gifts`.
2. One Fourthwall shop with API access and at least one product that can be used for giveaway links.
3. One X developer app with OAuth 2.0 and Direct Message access.
4. One dedicated X account that will send the gift replies, such as `@FriendsOfConvex`.

You do not need an email form. A recipient first sends `GIFT` to the dedicated X account. An admin confirms that request, creates the recipient's pass, and replies once by X DM. Fourthwall asks for shipping details after the recipient opens the giveaway link.

Resend is not installed. The current X API supports this one-to-one reply flow. The gift studio keeps a **Copy DM** fallback for a recipient whose X settings block API delivery.

## Understand the three X connections

The app uses the same X developer app for three separate jobs:

| Grant | Who uses it | Scopes | Purpose |
| --- | --- | --- | --- |
| Convex Auth sign-in | Every admin or join applicant | `users.read tweet.read` | Identifies the person and creates the app session. |
| Gift sender connection | One dedicated sender account | `dm.read dm.write tweet.read users.read offline.access` | Sends one reply per gift delivery and refreshes the sender token. |
| Legacy Account Activity subscription | The same dedicated sender account | OAuth 1.0a API key/secret and user access token/secret | Delivers signed inbound `GIFT` and `STOP` events when X still grants access. |

Signing in at `/admin` does not automatically give the app DM access or Account Activity access. An admin must open `/admin/gifts` and select **Connect X sender** once. The OAuth 2.0 sender token is encrypted before it is stored in Convex. Account Activity uses four additional backend-only OAuth 1.0a values from the X Developer Console.

## Where every gift value belongs

| Variable | Convex development | Convex production | Browser bundle |
| --- | --- | --- | --- |
| `FOURTHWALL_API_USERNAME` | Yes | Yes | Never |
| `FOURTHWALL_API_PASSWORD` | Yes | Yes | Never |
| `FOURTHWALL_WEBHOOK_SECRET` | Yes, when using a public webhook | Yes | Never |
| `X_DM_TOKEN_ENCRYPTION_KEY` | Yes | Yes, use a new key before connecting production | Never |
| `AUTH_TWITTER_ID` | Already required by the main setup | Already required by the main setup | Never |
| `AUTH_TWITTER_SECRET` | Already required by the main setup | Already required by the main setup | Never |
| `X_API_KEY` | Yes, for automatic detection | Yes | Never |
| `X_API_SECRET` | Yes; also signs X webhooks | Yes | Never |
| `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN` | Yes; must represent the dedicated sender | Yes | Never |
| `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET` | Yes; paired with the access token | Yes | Never |
| `SITE_URL` | Your development frontend | Your final published frontend | Never |
| `VITE_CONVEX_URL` | `.env.local` for the site | Set by the static hosting deploy CLI at build time | Yes. This is the only value the browser receives. |

Do not prefix a secret with `VITE_`; anything with that prefix is compiled into
the public browser bundle. `X_API_SECRET` is the X **API/Consumer Secret**, not
the OAuth 2.0 `AUTH_TWITTER_SECRET` Client Secret.

`CONVEX_SITE_URL` is supplied by Convex automatically. Do not create or overwrite it. The app uses that value to build the OAuth callback and webhook URL.

## Exact production URLs for this project

The currently linked production deployment is `agile-spaniel-476` in Convex
team `cvx-devx`, project `convex-yappers`. The site is live at
`https://friendsofconvex.dev`, and production `CONVEX_SITE_URL` is overridden
to that domain, so every production callback and webhook lives on it:

```text
Public site origin: https://friendsofconvex.dev
Gift studio: https://friendsofconvex.dev/admin/gifts
Convex API custom domain: https://api.friendsofconvex.com
Convex client URL: https://agile-spaniel-476.convex.cloud
Production HTTP Actions canonical origin: https://friendsofconvex.dev
Convex Auth X callback: https://friendsofconvex.dev/api/auth/callback/twitter
X gift-DM sender callback: https://friendsofconvex.dev/x-dm/callback
X Account Activity webhook: https://friendsofconvex.dev/x-account-activity
Fourthwall ORDER_PLACED webhook: https://friendsofconvex.dev/fourthwall/webhook
```

The frontend is served by the Convex static hosting component from the same
origin as the callbacks and webhooks. `https://agile-spaniel-476.convex.site`
still answers requests, but the app builds its callback and webhook URLs from
`CONVEX_SITE_URL`, which is `https://friendsofconvex.dev` in production.
Register the `friendsofconvex.dev` URLs in X and Fourthwall.

`api.friendsofconvex.com` serves the Convex API. It does not serve the HTTP
actions in this guide. Never use localhost or `api.friendsofconvex.com` for a
production callback or webhook.

### What is already set and what is still missing

Verified on 2026-08-11:

| Item | Status |
| --- | --- |
| Frontend live on Convex static hosting | Complete at `https://friendsofconvex.dev` |
| `friendsofconvex.dev` custom domain and `CONVEX_SITE_URL` override | Complete |
| Production `SITE_URL` | Complete; set to `https://friendsofconvex.dev` |
| Convex API custom domain | Complete, but optional and not selected as the default API origin |
| Production Convex Auth, admin allowlist, and X values | Not added yet; finish `SETUP_GUIDE.md` Part 8 first |
| Fourthwall API values and webhook | Not added yet |
| X gift sender connection | Not connected yet |
| Automatic `GIFT` and `STOP` detection | Current code uses the deprecated Account Activity API; use it only if X grants legacy access, otherwise use the manual fallback until the app is migrated to X Activity |

Complete normal X sign-in from `SETUP_GUIDE.md` before you configure gifts.

## Part 1: Create a Fourthwall API user

### Step 1: Open the shop as a super admin

1. Sign in to the [Fourthwall dashboard](https://fourthwall.com/).
2. Open the shop that will provide the free gifts.
3. Confirm your Fourthwall role is **SUPER ADMIN**. Only a super admin can create an API user for the shop.
4. Follow Fourthwall's [authentication guide](https://docs.fourthwall.com/guides/authentication) to create an API user for your own shop.
5. Copy the generated API username and password into a password manager.

This app uses HTTP Basic authentication because it manages one shop you control. Fourthwall OAuth is intended for an app that connects many unrelated shops.

### Step 2: Find the giveaway product ID

1. Open Fourthwall's [Platform API reference](https://docs.fourthwall.com/api-reference/platform/overview).
2. Use the product listing endpoint with the API user you created.
3. Find the exact product you want to give away.
4. Copy its product ID. The gift studio calls it the **Fourthwall product ID**.

Keep the product active and available in the shop. The product ID is entered when an admin creates a campaign; it is not an environment variable.

### Step 3: Know what Fourthwall creates

The app calls Fourthwall's [Create Giveaway Links endpoint](https://docs.fourthwall.com/api-reference/platform/giveaway-links/create-giveaway-links). Fourthwall returns one single-use URL per selected recipient and groups those URLs under one package ID.

The app stores each returned `giftId` and URL on the matching Convex recipient record. It does not generate a coupon code and does not ask the recipient for an address.

## Part 2: Add the X DM callback

### Step 4: Enable the X app permissions

1. Open the [X Developer Console](https://console.x.com/).
2. Open the same OAuth 2.0 app used by Convex Auth, or create a separate app for this deployment.
3. Choose the confidential web app option so you have a Client ID and Client Secret.
4. Enable read access and Direct Message read/write access.
5. Confirm the project has pay-per-use API credits and set a spending limit.

The current X API price page lists DM creation as a paid API operation. Prices can change, so check the [live X API pricing page](https://docs.x.com/x-api/getting-started/pricing) before a large campaign.

### Step 5: Add both development callbacks

If you are using local Convex Agent Mode and it printed the default HTTP Actions URL, add these exact callbacks to the X app:

```text
http://127.0.0.1:3211/api/auth/callback/twitter
http://127.0.0.1:3211/x-dm/callback
```

If Convex printed a different port, replace only `3211` with the printed HTTP Actions port.

For the linked cloud development deployment, add these exact callbacks:

```text
https://ceaseless-bobcat-587.convex.site/api/auth/callback/twitter
https://ceaseless-bobcat-587.convex.site/x-dm/callback
```

If you later relink the folder to another development deployment, open
**Convex dashboard → Development → Settings → URL & Deploy Key**, copy that
deployment's `.convex.site` origin, and replace only the origin in both URLs.

The first callback powers normal sign-in. The second callback returns the dedicated sender grant to Convex.

### Step 6: Keep X DM consent-first

Do not automatically DM every leaderboard account. X's automation rules require a clear request from the recipient before an automated DM.

The gift studio provides **Copy “DM us GIFT” link** after the sender account is connected. Share that link with an eligible person. They open it and send `GIFT` to the dedicated sender account. Only then should an admin select that person and confirm the consent checkbox.

If the person replies `STOP`, use **Mark opt-out** in the recipient ledger. The app blocks further API sends for that recipient.

After Account Activity is enabled, the webhook records `GIFT` automatically and applies `STOP` across every unsent pass for that X user. The manual confirmation and opt-out controls remain available when the webhook is not connected.

### Step 6A: Create the OAuth 1.0a Account Activity credentials

The code in this repository currently calls the legacy Account Activity
endpoints under `/2/account_activity`. X now marks that API as deprecated and
recommends the X Activity API. Check your X project before creating credentials:

- If X still grants this app Account Activity access, the steps below match the
  code that is deployed today.
- If X does not offer that access, skip Steps 6A and 6B, do not select **Enable
  automatic detection**, and use the admin-confirmed `GIFT` and `STOP` controls.
- Moving to X Activity requires backend code changes for its OAuth 2.0 private
  event subscription and event payloads. New environment values alone will not
  migrate this app.

The safest setup is for the dedicated sender account to own the X developer app. If another account owns the app, X requires a separate three-legged OAuth 1.0a authorization flow for the sender.

1. Sign in to the [X Developer Console](https://console.x.com/) as the dedicated sender account.
2. Open the app used by this deployment.
3. Confirm the project still has **Account Activity API** access. X documents
   that legacy API as deprecated, even where access is still available.
4. Confirm app permissions are **Read, Write, and Direct Messages** before generating tokens.
5. Open **Keys and tokens**.
6. Under **Consumer Keys**, copy the **API Key**. This becomes `X_API_KEY`.
7. Copy the **API Key Secret**. This becomes `X_API_SECRET` and is also used to verify X webhook signatures.
8. Under **Authentication Tokens**, confirm the existing app Bearer Token is the `X_BEARER_TOKEN` already used by the leaderboard.
9. Generate an **Access Token and Secret** for the dedicated sender account.
10. Copy the Access Token into `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN`.
11. Copy the Access Token Secret into `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET`.

If you changed app permissions after generating the access token, regenerate both the Access Token and Access Token Secret. Treat all four values as passwords.

### Step 6B: Know where automatic detection can run

X requires a public HTTPS webhook without a custom port. Local Agent Mode at `127.0.0.1` cannot receive Account Activity events. Use a Convex Cloud development deployment or production.

For the linked cloud development deployment, the legacy webhook URL is:

```text
https://ceaseless-bobcat-587.convex.site/x-account-activity
```

The same endpoint handles X's GET challenge-response check and signed POST events. Do not add this URL manually in the X console; the **Enable automatic detection** button registers it through the X API and subscribes the connected sender account.

## Part 3: Configure Convex development

### Step 7: Generate the development encryption key

Run this once:

```bash
openssl rand -base64 32
```

Copy the one-line result into a password manager. This is `X_DM_TOKEN_ENCRYPTION_KEY`.

Do not change this value after connecting the sender account. A replacement key cannot decrypt the token already stored in Convex. If you must rotate it, set the new value and immediately use **Reconnect sender** so new encrypted tokens replace the old ones.

### Step 8: Add the gift values to the active development deployment

For local Agent Mode, keep `npx convex dev` running and use the explicit local
target. Convex will prompt you privately:

```bash
npx convex env --deployment local set FOURTHWALL_API_USERNAME
npx convex env --deployment local set FOURTHWALL_API_PASSWORD
npx convex env --deployment local set X_DM_TOKEN_ENCRYPTION_KEY
```

Localhost cannot receive Account Activity or Fourthwall webhooks, so do not add
those webhook values just to make the local status panel green. Use manual
`GIFT` confirmation and **Check Fourthwall** locally.

For the linked cloud development deployment `ceaseless-bobcat-587`, use:

```bash
npx convex env --deployment dev set FOURTHWALL_API_USERNAME
npx convex env --deployment dev set FOURTHWALL_API_PASSWORD
npx convex env --deployment dev set X_DM_TOKEN_ENCRYPTION_KEY
npx convex env --deployment dev set X_API_KEY
npx convex env --deployment dev set X_API_SECRET
npx convex env --deployment dev set X_ACCOUNT_ACTIVITY_ACCESS_TOKEN
npx convex env --deployment dev set X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET
```

Add the webhook secret later in Step 11. Confirm cloud-development names
without printing values:

```bash
npx convex env --deployment dev list --names-only
```

You should also see the existing `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, `ADMIN_X_USER_IDS`, `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` values from `SETUP_GUIDE.md`.

### Step 9: Push and open the gift studio

Keep the development backend running:

```bash
npx convex dev
```

Start the frontend in another terminal:

```bash
npm run dev
```

Then:

1. Open <http://localhost:5174/admin/gifts>.
2. Sign in with an allowlisted X admin account.
3. Confirm **Fourthwall** says **API user ready**.
4. Select **Connect X sender**.
5. At X, sign in as the dedicated sender account and approve the DM scopes.
6. Confirm X returns to `/admin/gifts` and the page shows the sender handle.
7. On a Convex Cloud development deployment, select **Enable automatic detection**.
8. Confirm **X Account Activity** changes to **Automatic GIFT and STOP live**.

In local Agent Mode, leave automatic detection disconnected and use the manual consent checkbox. That is expected because X cannot call localhost.

### Step 10: Create a test pass

1. Ask one approved leaderboard person to send `GIFT` to the connected sender account.
2. If Account Activity is enabled, wait up to 10 seconds and confirm their profile says **GIFT ready**. If it is not enabled, use the manual consent checkbox.
3. In `/admin/gifts`, enter a short campaign title.
4. Paste the Fourthwall product ID from Step 2.
5. Use 30 portal access days for the first test.
6. Select only that person's profile.
7. Select **Create 1 pass**. Automatically detected consent does not require the manual checkbox.
8. Open the new private pass before sending it. Confirm the page shows the correct handle and that **Reveal my gift** returns a `fourthwall.com` destination.
9. Ask the person to send `STOP`, confirm the profile changes to **STOP active**, and confirm **Send X DM** is blocked.
10. Ask them to send a fresh `GIFT`, confirm consent becomes active again, and then use **Send X DM**.
11. If X rejects the API send because of the recipient's settings, use **Copy DM** and reply manually from the same sender account.

An X `201` response means X created the message event. The app labels this `sent`; it does not claim the DM was read.

### Send another gift to the same person later

Repeat gifts are supported and remain separate in the ledger:

1. Create a new campaign for the new product or dispatch. Do not reuse the earlier recipient row or private portal link.
2. Ask the person to send a fresh `GIFT` to the dedicated sender. One provider-detected `GIFT` event authorizes one new delivery.
3. Wait for their profile to change from **GIFT used** to **GIFT ready**. If Account Activity is unavailable, manually confirm that the person made a new request for this specific gift.
4. Select the same person again and create the campaign. The picker shows their previous gift count.
5. Confirm the new ledger row says **Gift #2** or the next number. It has its own Fourthwall link, private portal, X DM event ID, redemption status, and event history.
6. Send the new DM from that new recipient row. Selecting **Send X DM** again on an already-sent row remains idempotent and does not create another X message.

An active `STOP` blocks new campaign creation and every unsent delivery for that X account. A fresh `GIFT` allows a new delivery, but it does not silently reactivate older recipient rows that were blocked by the earlier `STOP`. Ask the person to send a fresh `GIFT` before issuing another gift; never use the manual checkbox to override `STOP`.

## Part 4: Add Fourthwall redemption tracking

### Step 11: Create the webhook

For the linked cloud development deployment, use:

```text
https://ceaseless-bobcat-587.convex.site/fourthwall/webhook
```

For production, use:

```text
https://friendsofconvex.dev/fourthwall/webhook
```

Create an `ORDER_PLACED` webhook in Fourthwall. You can use the shop dashboard or the [Fourthwall webhook management API](https://docs.fourthwall.com/webhooks/api-management). Copy the webhook secret returned by Fourthwall.

Add that secret to the matching Convex deployment:

```bash
# Cloud development
npx convex env --deployment dev set FOURTHWALL_WEBHOOK_SECRET

# Production, only when configuring production
npx convex env --prod set FOURTHWALL_WEBHOOK_SECRET
```

Fourthwall signs the exact request body in `X-Fourthwall-Hmac-SHA256`. The Convex HTTP action rejects a missing or incorrect signature before it writes an event.

Local Agent Mode runs on `127.0.0.1`, so Fourthwall cannot call it from the internet. During purely local testing, use **Check Fourthwall** in the campaign ledger to reconcile statuses manually. Use a cloud development deployment when you want to test the real webhook.

### Step 12: Test redemption

1. Redeem one test giveaway link through Fourthwall.
2. Return to `/admin/gifts`.
3. Wait for the webhook, or select **Check Fourthwall**.
4. Confirm the recipient changes to `redeemed`.
5. Reopen the private pass and confirm it shows the thank-you state.
6. Use **Share a safe public card**. Confirm the shared URL contains `/gift/share/` and never exposes the private `/gift/<token>` URL or the Fourthwall giveaway URL.

Fourthwall webhooks may be delivered more than once. Convex deduplicates them by the Fourthwall event ID. Manual package checks remain useful because Fourthwall documents webhook delivery as best effort.

## Part 5: Configure production in the intended Convex team

### Step 13: Link this folder to the intended team before production

Follow Parts 8 and 9 of `SETUP_GUIDE.md`. This folder currently points to
`cvx-devx / convex-yappers`. Reconfigure only if that is not the intended owner.
The cloud development command for a different target is:

```bash
npx convex dev --configure existing --team TARGET_TEAM_SLUG --project TARGET_PROJECT_SLUG --dev-deployment cloud --once
```

Then run the read-only target checks:

```bash
npx convex dashboard
npx convex env --prod list --names-only
npx convex deploy --dry-run
```

Stop if the dashboard or dry run shows the wrong team or project. If the CLI
asks whether to push, answer **No** or cancel; target inspection is not
production approval.

### Step 14: Add the production callbacks to X

For the currently linked production deployment, add both callbacks to the
production X OAuth app:

```text
https://friendsofconvex.dev/api/auth/callback/twitter
https://friendsofconvex.dev/x-dm/callback
```

Set the X app website URL to `https://friendsofconvex.dev`. The first
callback powers normal X sign-in; the second returns the dedicated DM sender
grant. Production `CONVEX_SITE_URL` is overridden to the custom domain, so a
callback registered on `agile-spaniel-476.convex.site` will not match.

The Account Activity registration button uses:

```text
https://friendsofconvex.dev/x-account-activity
```

Do not add that webhook manually in X. The admin action registers it through
the X API and subscribes the connected sender account.

### Step 15: Create fresh production values

Create a new production token-encryption key:

```bash
openssl rand -base64 32
```

Production `SITE_URL` is already set to `https://friendsofconvex.dev`. In
**Convex dashboard → target project → Production → Settings → Environment Variables**, add:

```text
FOURTHWALL_API_USERNAME=<production Fourthwall API username>
FOURTHWALL_API_PASSWORD=<production Fourthwall API password>
FOURTHWALL_WEBHOOK_SECRET=<production ORDER_PLACED webhook secret>
X_DM_TOKEN_ENCRYPTION_KEY=<new production 32-byte base64 key>
```

Only when X has confirmed legacy Account Activity access for this app, also
add:

```text
X_API_KEY=<production X API or Consumer Key>
X_API_SECRET=<production X API or Consumer Secret>
X_ACCOUNT_ACTIVITY_ACCESS_TOKEN=<dedicated production sender access token>
X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET=<matching sender access token secret>
```

If the same Fourthwall shop powers development and production, the API username and password may match. The webhook secret should come from the production webhook configuration, and the token-encryption key must be created fresh for production.

The terminal form requires `--prod`:

```bash
npx convex env --prod set FOURTHWALL_API_USERNAME
npx convex env --prod set FOURTHWALL_API_PASSWORD
npx convex env --prod set FOURTHWALL_WEBHOOK_SECRET
npx convex env --prod set X_DM_TOKEN_ENCRYPTION_KEY
```

The legacy automatic-detection commands are optional:

```bash
npx convex env --prod set X_API_KEY
npx convex env --prod set X_API_SECRET
npx convex env --prod set X_ACCOUNT_ACTIVITY_ACCESS_TOKEN
npx convex env --prod set X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET
npx convex env --prod list --names-only
```

Do not forget the existing production values from the main guide: `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, `ADMIN_X_USER_IDS`, and `X_BEARER_TOKEN`.

### Step 16: Deploy only after checking the target

The command that changes the linked production deployment is:

```bash
npx convex deploy
```

Run it only after `npx convex deploy --dry-run` names `cvx-devx /
convex-yappers / agile-spaniel-476` and you give fresh approval. The full
production publish is one command that deploys the backend and uploads the
frontend together:

```bash
npm run deploy
```

### Step 17: Verify the deployed frontend

The static hosting deploy CLI sets `VITE_CONVEX_URL` to the production client
URL at build time, so there is no separate frontend host configuration. Never
add a gift secret to `.env.local` with a `VITE_` prefix.

After the production site is live:

1. Confirm production `SITE_URL` reads `https://friendsofconvex.dev`.
2. Open `https://friendsofconvex.dev/admin/gifts` as an allowlisted admin.
3. Select **Connect X sender** and grant the production sender account.
4. If X confirmed legacy Account Activity access, select **Enable automatic detection** and confirm the production sender subscription. Otherwise leave it off and use manual confirmation.
5. Create the Fourthwall `ORDER_PLACED` webhook at `https://friendsofconvex.dev/fourthwall/webhook`.
6. Send `GIFT`, `STOP`, and a new `GIFT` from one real test account before sending more gifts.
7. Run one real low-value Fourthwall test before sending more gifts.

## What the app records

For each recipient, Convex stores:

- the person's per-account gift number and separate campaign recipient record;
- the selected X user ID and handle snapshot;
- the automatic or manual consent time and the provider event used for that delivery;
- the Fourthwall package, gift ID, link, and status;
- the X send attempt, API message event ID, conversation ID, or error;
- private portal open, reveal, and Fourthwall click times;
- redemption time from the webhook or manual package check;
- opt-out state and a timestamped event history.

The app does not store a shipping address, payment method, X password, or Fourthwall customer email.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Fourthwall says credentials are missing | Add `FOURTHWALL_API_USERNAME` and `FOURTHWALL_API_PASSWORD` to the same Convex deployment used by the site. |
| Fourthwall returns `401` | Recreate or copy the API username and password. Do not use a normal shop login password. |
| A campaign remains `error` | Open its error text, verify the product ID, and confirm the product is active. Creating a new campaign is safer than retrying an unknown external result. |
| X sender connection is disabled | Add `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, and `X_DM_TOKEN_ENCRYPTION_KEY` to Convex. |
| Automatic detection is disabled | First confirm X still grants this app access to the deprecated Account Activity API. If it does, add the four legacy values to the same Convex deployment. If it does not, keep automatic detection off and use manual confirmation until the X Activity migration is built. |
| Setup says X subscribed a different account | Regenerate the OAuth 1.0a Access Token and Secret while signed in as the same dedicated account connected under **X sender**. |
| X webhook CRC fails | Confirm `X_API_SECRET` is the API/Consumer Secret, the deployment is public HTTPS, and the URL has no port. Then select **Enable automatic detection** again. |
| GIFT or STOP does not appear | Confirm Account Activity access is approved, the sender subscription is live, and the DM was sent to the exact connected sender. Use **Recheck X events** and inspect the saved error. |
| X says the callback is invalid | Add the exact `/x-dm/callback` URL on the deployment's `CONVEX_SITE_URL` origin. Development uses `https://ceaseless-bobcat-587.convex.site`; production uses `https://friendsofconvex.dev`. |
| X does not return a refresh token | Confirm `offline.access` was approved, then use **Reconnect sender**. |
| X DM returns `403` | Confirm the person sent the sender account a DM, accepts requests, has not blocked the sender, and the X app has DM permissions. |
| X DM returns `429` | Wait for the user/app rate-limit window. The current docs list 15 sends per user per 15 minutes and daily caps; verify the live limit before a batch. |
| The gift page opens but has no Fourthwall button | The campaign is still provisioning or Fourthwall did not return an available link. Check the campaign error and use **Check Fourthwall**. |
| Fourthwall redemption does not appear locally | Localhost is not public. Use **Check Fourthwall** or move development to Convex Cloud. |
| Webhook returns `401` | Copy the secret from the exact Fourthwall webhook configuration into `FOURTHWALL_WEBHOOK_SECRET`. |
| Public share exposes the private claim | Stop sharing it. Only share `/gift/share/<token>`. Private claim paths use `/gift/<different-token>`. |

## Reference links

- [Fourthwall developer overview](https://docs.fourthwall.com/guides/overview)
- [Fourthwall authentication](https://docs.fourthwall.com/guides/authentication)
- [Create giveaway links](https://docs.fourthwall.com/api-reference/platform/giveaway-links/create-giveaway-links)
- [Get giveaway package status](https://docs.fourthwall.com/api-reference/platform/giveaway-links/get-package)
- [Fourthwall `ORDER_PLACED` event and `source.giftId`](https://docs.fourthwall.com/api-reference/order-events/order-placed)
- [Fourthwall signature verification](https://docs.fourthwall.com/webhooks/signature-verification)
- [Fourthwall webhook delivery limits](https://docs.fourthwall.com/webhooks/limitations)
- [Fourthwall webhook management](https://docs.fourthwall.com/webhooks/api-management)
- [X Direct Message integration guide](https://docs.x.com/x-api/direct-messages/manage/integrate)
- [X Account Activity introduction](https://docs.x.com/x-api/account-activity/introduction)
- [X Account Activity quickstart and subscription requirements](https://docs.x.com/x-api/account-activity/quickstart)
- [X Activity API replacement](https://docs.x.com/x-api/activity/introduction)
- [X Webhooks CRC and signature verification](https://docs.x.com/x-api/webhooks/quickstart)
- [X OAuth 1.0a overview](https://docs.x.com/fundamentals/authentication/oauth-1-0a/overview)
- [X create-DM endpoint](https://docs.x.com/x-api/direct-messages/create-dm-message-by-participant-id)
- [X OAuth 2.0 Authorization Code with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X automation rules](https://help.x.com/en/rules-and-policies/x-automation)
- [X restricted use cases](https://docs.x.com/developer-terms/restricted-use-cases)
- [X API pricing](https://docs.x.com/x-api/getting-started/pricing)
- [X API rate limits](https://docs.x.com/x-api/fundamentals/rate-limits)
- [Convex HTTP actions](https://docs.convex.dev/functions/http-actions)
- [Convex environment variables](https://docs.convex.dev/production/environment-variables)
- [Convex brand resources](https://www.convex.dev/brand)
