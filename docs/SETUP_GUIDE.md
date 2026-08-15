# Friends of Convex Yapper Board setup

Use this guide from top to bottom. Do not skip ahead to production. You will
connect three places:

1. X Developer Console supplies X login credentials and an API Bearer Token.
2. Convex stores data, runs scheduled syncs, checks admin access, and holds
   every secret.
3. Convex static hosting serves the React frontend from the same deployment.
   The browser bundle receives only the public Convex URL.

## The stack after the React rebuild

The frontend is a Vite React single page app in `src/`. It is hosted on Convex
itself with the official
[`@convex-dev/static-hosting`](https://www.convex.dev/components/static-hosting)
component, so there is no separate hosting provider, no Codex Sites project,
and no Cloudflare Worker.

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, Vite, react-router, TypeScript, CSS theme tokens, Phosphor icons |
| Frontend host | `@convex-dev/static-hosting` serving from the Convex HTTP Actions origin |
| Backend | Convex queries, mutations, actions, HTTP actions, and crons |
| Authentication | `@convex-dev/auth` with X OAuth 2.0 |
| Admin authorization | Comma separated numeric X IDs in `ADMIN_X_USER_IDS` |
| X data | App-only Bearer Token for profiles, Lists, posts, and metrics |
| Gifts | Fourthwall giveaway links plus a separate X DM sender grant |
| Package manager | npm |

The static hosting component uses app-owned root routing. The app keeps every
existing HTTP route at its exact URL, and `registerStaticRoutes` in
`convex/http.ts` serves the built frontend for everything else. SPA fallback
returns `index.html` for deep links like `/gift/<token>`.

## The short answer: yes, you need both Convex Auth and an X OAuth app

These are connected, but they are not substitutes for each other:

1. **Convex Auth is already installed in this codebase.** It creates the app
   session, stores the signed-in user, and lets the backend enforce `/admin`.
2. **An X OAuth 2.0 app is required.** Its Client ID and Client Secret make the
   **Continue with X** button work on `/join` and `/admin`.
3. **An X API Bearer Token is also required for data.** It reads profiles,
   public X Lists, posts, and public metrics. It is not used for login.

You do not need another authentication product. Development and production each
need their own Convex environment values. Using separate X OAuth apps for local
development and production is strongly recommended because their callback URLs
are different.

The optional auditable Fourthwall gift and X DM sender flow has four more
backend values, plus four OAuth 1.0a Account Activity values for automatic
`GIFT` and `STOP` detection. Finish this guide first, then follow
`fourthwall-setup.md`. No gift secret ever reaches the browser bundle.

## Where this app is right now

Checked on 2026-08-15 with the Convex CLI, X Developer Console, and live
requests:

| Layer | Current state |
| --- | --- |
| Frontend code | Vite React SPA in `src/`, builds clean with `npm run build` |
| Live sites | **Development:** `https://ceaseless-bobcat-587.convex.site` · **Production:** `https://friendsofconvex.dev` |
| Convex project | Linked to team `cvx-devx`, project `convex-yappers` |
| Convex development deployment | `ceaseless-bobcat-587` (cloud dev) |
| Convex production deployment | `agile-spaniel-476` |
| Custom domain | `friendsofconvex.dev` is attached to production HTTP Actions and `CONVEX_SITE_URL` is overridden to `https://friendsofconvex.dev` |
| X apps | `yappers-dev` and `yappers-app-prod` are confidential OAuth 2.0 web apps with separate credentials and exact callbacks |
| Production environment | All seven required values are set: `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, `ADMIN_X_USER_IDS`, and `X_BEARER_TOKEN` |
| Development environment | The same seven required names are set with separate development credentials; `SITE_URL` is `https://ceaseless-bobcat-587.convex.site` |
| First admin | `@waynesutton` signed in successfully and its stable numeric X ID is allowlisted on both deployments |
| Live verification | Both deployments passed X sign-in, `/admin` authorization, and X profile lookup; production `/about` and development `/`, `/join`, and `/about` direct loads passed |
| Convex API custom domain | Active at `https://api.friendsofconvex.com` for Convex API traffic only |

Because production `CONVEX_SITE_URL` is now `https://friendsofconvex.dev`, the
app builds every production OAuth callback and webhook on the custom domain.
Register the `friendsofconvex.dev` callback URLs in X, not the older
`.convex.site` ones.

### Setup completed on 2026-08-15

Normal X sign-in, stable-ID admin access, and app-only X data reads are ready on
development and production. `@waynesutton` is the first admin on both
deployments. The production backend is deployed, and the development static
site was rebuilt and uploaded after its stale host returned `503`/`404`.

The remaining Fourthwall, gift-DM sender, and X Activity work is optional and
separate. Follow `fourthwall-setup.md` only when you are ready to enable gifts.

Current X documentation marks the Account Activity API used by this code as
deprecated and points developers to the X Activity API. Normal X sign-in,
imports, leaderboard sync, and consent-first DM sending do not depend on that
legacy webhook. Automatic `GIFT` and `STOP` detection does. If X does not grant
legacy Account Activity access to this project, keep automatic detection off
and use the admin-confirmed fallback until the backend is migrated to X
Activity.

## Exact production URL map for the currently linked Convex project

| Use | Exact value |
| --- | --- |
| Production browser origin | `https://friendsofconvex.dev` |
| Production Convex client URL baked into the bundle | `https://agile-spaniel-476.convex.cloud` |
| Optional Convex API custom domain | `https://api.friendsofconvex.com` |
| Production HTTP Actions canonical origin (`CONVEX_SITE_URL`) | `https://friendsofconvex.dev` |
| X login callback for `/join` and `/admin` | `https://friendsofconvex.dev/api/auth/callback/twitter` |
| Dedicated X gift-DM sender callback | `https://friendsofconvex.dev/x-dm/callback` |
| X Account Activity webhook | `https://friendsofconvex.dev/x-account-activity` |
| Fourthwall `ORDER_PLACED` webhook | `https://friendsofconvex.dev/fourthwall/webhook` |

With static hosting, the frontend pages and the OAuth callbacks share the same
origin. The production routes are:

```text
https://friendsofconvex.dev/
https://friendsofconvex.dev/join
https://friendsofconvex.dev/admin
https://friendsofconvex.dev/admin/setup
https://friendsofconvex.dev/admin/gifts
```

`https://agile-spaniel-476.convex.site` still answers requests, but the app
builds its OAuth redirect and webhook URLs from `CONVEX_SITE_URL`, which is
now `https://friendsofconvex.dev`. Always register the `friendsofconvex.dev`
callbacks in X and Fourthwall.

`api.friendsofconvex.com` is attached to the **Convex API**, not HTTP Actions.
Do not use it for an X callback, a Fourthwall webhook, or the site itself.

## The friendsofconvex.dev domain is live

The domain work is done. Verified on 2026-08-11:

1. `friendsofconvex.dev` is attached to the production deployment as a custom
   domain for **HTTP Actions** and serves the deployed frontend.
2. Production `CONVEX_SITE_URL` is overridden to `https://friendsofconvex.dev`
   in **Settings → Environment Variables → Override Environment Variables**.
   This makes Convex Auth send `https://friendsofconvex.dev/api/auth/callback/twitter`
   to X during login, and it makes the gift sender callback and both webhooks
   resolve on the custom domain too.
3. Production `SITE_URL` is set to `https://friendsofconvex.dev`, so X returns
   people to the right page after sign-in.
4. `CONVEX_CLOUD_URL` still points at `https://agile-spaniel-476.convex.cloud`,
   which is correct; the browser bundle talks to the Convex API there.

Do not change the `CONVEX_SITE_URL` override. If it ever reverts to the
`.convex.site` value, X login breaks with a callback mismatch until the X app
callbacks are switched back to match. The older `friendsofconvex.com`
Cloudflare zone still exists from the previous hosting setup; leave
`api.friendsofconvex.com` in place.

## How sign-in and admin access work

There is one way to sign in: the **Continue with X** button. Convex Auth is
the session layer behind that button, not a second login method. There is no
email or password login.

Admin access is a two-part check that runs on the server inside every admin
query, mutation, and action:

1. The person must be signed in with X through Convex Auth.
2. Their stable numeric X user ID must appear in the `ADMIN_X_USER_IDS`
   environment variable on the deployment the site is using.

Admins can approve or decline join requests at `/admin`, import handles and
X Lists, and create and send Fourthwall gifts at `/admin/gifts`. To make
yourself the first admin, follow Part 4. To add more admins later, follow the
**Add a second or later admin after launch** section; each new admin signs in
once with X and you append their numeric ID to the allowlist.

## Security model

The app is designed so a page load can never expose a secret and a
non-admin can never reach an admin function:

- Every secret lives in Convex deployment environment variables. The browser
  bundle receives exactly one value, `VITE_CONVEX_URL`, which is public by
  design.
- Admin checks run in the backend with `requireAdmin`, which verifies the
  Convex Auth session and the numeric X ID allowlist. Hiding the `/admin` UI
  is cosmetic; the real enforcement is in every function.
- The allowlist uses numeric X user IDs, which cannot be changed or claimed by
  another account the way a handle can.
- Normal sign-in requests only `users.read` and `tweet.read`. It cannot post,
  follow, or read DMs.
- The Fourthwall webhook verifies the `X-Fourthwall-Hmac-SHA256` signature
  before writing anything. The X Account Activity webhook verifies X's CRC
  and event signatures with `X_API_SECRET`.
- The dedicated gift sender's OAuth token is encrypted with
  `X_DM_TOKEN_ENCRYPTION_KEY` before it is stored.
- Pending join requests stay `active: false` and never appear on the public
  leaderboard until an admin approves them.
- Development and production are separate deployments with separate data,
  separate keys, and separate X apps, so a leaked dev credential never
  unlocks production.

## Before you start

You need:

- Node.js 24 is recommended. Node.js 22.13 is the minimum supported version.
- An X account that will own the developer app.
- An X developer account with pay-per-use API access and credits.
- A Convex account. The project is already linked to a cloud dev deployment.

Keep credentials in a password manager while you work. Do not paste a secret
into chat, source files, screenshots, or a public environment variable.

## Where every value belongs

| Value | Development location | Production location | Reaches the browser? |
| --- | --- | --- | --- |
| `VITE_CONVEX_URL` | `.env.local`, normally written by `npx convex dev` | Set automatically by the static hosting deploy CLI at build time | **Yes. This is the only value the frontend receives.** |
| `SITE_URL` | Active development Convex deployment | Production Convex deployment | No |
| `JWT_PRIVATE_KEY` | Active development Convex deployment | Production Convex deployment; generate a new pair | No; secret |
| `JWKS` | Active development Convex deployment | Production Convex deployment; use the matching new pair | No |
| `AUTH_TWITTER_ID` | Active development Convex deployment | Production Convex deployment | No |
| `AUTH_TWITTER_SECRET` | Active development Convex deployment | Production Convex deployment | No; secret |
| `ADMIN_X_USER_IDS` | Active development Convex deployment | Production Convex deployment | No |
| `X_BEARER_TOKEN` | Active development Convex deployment | Production Convex deployment | No; secret |
| `FOURTHWALL_API_USERNAME` | Development deployment when gifts are enabled | Production Convex deployment | No |
| `FOURTHWALL_API_PASSWORD` | Development deployment when gifts are enabled | Production Convex deployment | No; secret |
| `FOURTHWALL_WEBHOOK_SECRET` | Cloud development deployment when redemption webhooks are enabled | Production Convex deployment | No; secret |
| `X_DM_TOKEN_ENCRYPTION_KEY` | Development deployment when X gift DMs are enabled | Production Convex deployment; generate a new key | No; secret |
| `X_API_KEY` | Cloud development deployment when automatic DM detection is enabled | Production Convex deployment | No |
| `X_API_SECRET` | Same cloud development deployment; signs X webhooks | Production Convex deployment | No; secret |
| `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN` | Same cloud development deployment; must represent the dedicated sender | Production Convex deployment | No; secret |
| `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET` | Same cloud development deployment | Production Convex deployment | No; secret |

Never put `JWT_PRIVATE_KEY`, `AUTH_TWITTER_SECRET`, `X_BEARER_TOKEN`, or
`CONVEX_DEPLOY_KEY` in `.env.local` as a `VITE_*` value. Anything prefixed with
`VITE_` is compiled into the public browser bundle. Convex development and
production deployments have separate data and separate environment variables;
values do not copy automatically.

### Use the right Convex target in terminal commands

The target flag is the safety rail:

```bash
# Linked cloud development deployment: ceaseless-bobcat-587.
npx convex env list --names-only

# Production deployment: agile-spaniel-476.
npx convex env --prod list --names-only
```

Use the default development target for the local walkthrough below. Use
`--prod` only after the CLI and dashboard both show
`cvx-devx / convex-yappers / agile-spaniel-476`. Development values never copy
to production.

## Part 1: Run the local site

### Step 1: Select Node.js 24 and install the project

First, check the version used by this terminal:

```bash
node --version
```

If it starts with `v24`, continue. This repository includes `.nvmrc` and
`.node-version`, so a Node version manager can select the right release
automatically.

If you use `nvm`, run:

```bash
nvm install
nvm use
node --version
```

Then install:

```bash
npm install
```

### Step 2: Start the Convex backend

Open one terminal and run:

```bash
npx convex dev
```

Leave this terminal running. It syncs `convex/` functions to the linked
development deployment and regenerates types as you edit. If you use a local
deployment instead of the cloud dev deployment, the printed URLs are:

- Convex data URL: `http://127.0.0.1:3210`
- Convex HTTP Actions URL: `http://127.0.0.1:3211`

If your terminal prints different values, use the printed values in every later
step, including `.env.local`.

### Step 3: Start the site

Open a second terminal and run:

```bash
npm run dev
```

Open <http://localhost:5174/>. The port is pinned to `5174` in
`vite.config.ts` so every URL in this guide stays accurate. Keep both terminals
running. The frontend reads `VITE_CONVEX_URL` from `.env.local`; the UI shows a
configuration screen instead of the leaderboard when the value is missing.

## Part 2: Create the X developer app

The app uses one X developer app for two separate jobs:

- OAuth 2.0 login for `/join` and `/admin`.
- App-only API reads for imports and seven-day metrics.

### Step 4: Create an app in X

1. Open the [X Developer Console](https://console.x.com/).
2. Sign in with the X account that will own this integration.
3. Create a Project and App if you do not already have one.
4. Add API credits and set a spending limit before importing people.
5. Open the app's user authentication settings.
6. Enable OAuth 2.0.
7. Choose a confidential web app option so X gives you both a Client ID and
   Client Secret.
8. Use read-only app permissions.
9. Set the website URL to `https://ceaseless-bobcat-587.convex.site` for the
   linked cloud development app.
10. Add the exact callback for your active development backend.

For a local Convex deployment:

```text
http://127.0.0.1:3211/api/auth/callback/twitter
```

For the linked cloud development deployment:

```text
https://ceaseless-bobcat-587.convex.site/api/auth/callback/twitter
```

The callback must match exactly, including scheme, host, port, path, and lack
of a trailing slash. Keep the development deployment's final `SITE_URL` set to
`https://ceaseless-bobcat-587.convex.site`. For a local sign-in test, you may
temporarily set it to `http://localhost:5174`, finish the round trip, and then
restore the cloud development URL.

The code requests only `users.read` and `tweet.read`. It does not request
posting, following, direct-message, or list-write access.

### Step 5: Copy the three X credentials

In the X app's keys and tokens area, copy:

1. OAuth 2.0 Client ID.
2. OAuth 2.0 Client Secret.
3. App-only Bearer Token.

The Client ID and Client Secret power X login. The Bearer Token powers imports
and leaderboard metrics. They are different values.

## Part 3: Finish Convex Auth locally

### Step 6: Generate one local signing key pair

Run:

```bash
npm run auth:keys
```

The terminal prints two complete lines named `JWT_PRIVATE_KEY` and `JWKS`.
Copy each value exactly. Do not commit the output.

### Step 7: Add the first five Convex values

Open the [Convex dashboard](https://dashboard.convex.dev/), select the active
development deployment, then open **Settings → Environment Variables** and add:

```text
SITE_URL=https://ceaseless-bobcat-587.convex.site
JWT_PRIVATE_KEY=<the full private key from Step 6>
JWKS=<the full JWKS value from Step 6>
AUTH_TWITTER_ID=<the OAuth 2.0 Client ID from X>
AUTH_TWITTER_SECRET=<the OAuth 2.0 Client Secret from X>
```

Or use CLI prompts that keep secrets out of shell history:

```bash
npx convex env set SITE_URL https://ceaseless-bobcat-587.convex.site
npx convex env set JWT_PRIVATE_KEY
npx convex env set JWKS
npx convex env set AUTH_TWITTER_ID
npx convex env set AUTH_TWITTER_SECRET
```

When a command prompts for a value, paste it and press Return.

### Step 8: Push and restart

The running `npx convex dev` process should detect the changes. If it does not,
stop it with Control-C and start it again. Restart `npm run dev` after changing
`SITE_URL` or `VITE_CONVEX_URL`.

## Part 4: Make the first X account an admin

The admin list uses stable numeric X user IDs, not handles. A handle can
change; the numeric ID stays attached to the account.

### Step 9: Create your Convex Auth user

1. Open <http://localhost:5174/join>.
2. Select **Continue with X**.
3. Approve the X login request.
4. Return to `/join`.

Do not submit a join request if this is only your operator account. Signing in
is enough to create its auth record.

### Step 10: Copy your stable X user ID

1. Open the Convex dashboard.
2. Select the current deployment.
3. Open **Data**.
4. Open the `users` table.
5. Find the row with your `xUsername`.
6. Copy its `xUserId` value. It is a numeric string.

### Step 11: Create the allowlist

Add this Convex environment variable:

```text
ADMIN_X_USER_IDS=<your numeric X user ID>
```

For more than one admin, separate IDs with commas and no quotation marks:

```text
ADMIN_X_USER_IDS=123456789,987654321
```

Reload <http://localhost:5174/admin>. The admin page now opens only for an
allowlisted, X-authenticated account. The same check runs inside every admin
query, mutation, import action, and manual sync action.

### Add a second or later admin after launch

You can have any number of admins. Do not replace the first ID when adding the
next one.

1. Ask the new admin to open the deployed `/join` page and select **Continue
   with X** once. They do not need to request leaderboard membership.
2. In the Convex dashboard, select the same deployment the site uses.
3. Open **Data → users** and find the new admin by `xUsername`.
4. Copy their numeric `xUserId`.
5. Open **Settings → Environment Variables**.
6. Edit `ADMIN_X_USER_IDS`, keep every existing ID, and append the new one with
   a comma:

```text
ADMIN_X_USER_IDS=123456789,987654321,555555555
```

7. Save, then ask the new admin to reload `/admin`. If they were already signed
   in, sign out and back in once.

Repeat this on development and production separately. To remove an admin,
delete only that person's numeric ID and leave the remaining IDs intact.

## Part 5: Turn on X data

### Step 12: Add the Bearer Token to Convex

In Convex environment variables, add:

```text
X_BEARER_TOKEN=<the app-only Bearer Token from X>
```

Or run:

```bash
npx convex env set X_BEARER_TOKEN
```

Paste the value only after the prompt appears.

This key enables:

- Single-handle profile lookup.
- Bulk lookup for up to 100 pasted handles.
- Public X List member import for the first 100 members.
- Public posts from the last seven days.
- Public impression and engagement totals.

The Bearer Token is not needed for X login itself. It is needed for imports and
metrics.

## Part 6: Use the app

### Add one person

1. Open `/admin`.
2. Enter an X handle.
3. Select **Add person**.
4. Select **Refresh** if metrics do not start immediately.

### Paste many handles

1. Open **Batch intake** in `/admin`.
2. Select **Paste handles**.
3. Paste up to 100 handles, profile URLs, or a mixture separated by spaces,
   commas, or new lines.
4. Select **Preview import**.
5. Review valid, existing, duplicate, invalid, and not-found rows.
6. Select **Import**. Only valid new rows are written.

### Import a public X List

1. Open the X List in a browser.
2. Copy its URL. The supported form contains `/i/lists/` followed by a numeric
   ID.
3. In `/admin`, select **X List URL**.
4. Paste the URL and select **Preview import**.
5. Review the first 100 members, then import the valid new rows.

Private X Lists are not imported by the current app. They require user-context
List access, while this import intentionally uses the server-side app Bearer
Token.

### Let people request to join

Share the `/join` URL on the live origin. A person signs in with X and selects
**Request to join**. Their record starts as `pending`, remains inactive, and is
absent from the public leaderboard. In `/admin`, select **Approve** to activate
it or **Decline** to keep it off the board.

## Part 7: Verify the production target without changing it

Production needs the Convex Cloud project owned by the intended team. This
folder currently points to:

```text
Target team slug: cvx-devx
Target project slug: convex-yappers
Development deployment: ceaseless-bobcat-587
Production deployment: agile-spaniel-476
```

Run:

```bash
npx convex env --prod list --names-only
npx convex deploy --dry-run
```

The dry run must identify:

```text
[Production] cvx-devx:convex-yappers:production
https://agile-spaniel-476.convex.cloud
```

Stop if your output differs from the intended target. For a different team or
project, stop the dev process and run:

```bash
npx convex dev --configure existing --team TARGET_TEAM_SLUG --project TARGET_PROJECT_SLUG --dev-deployment cloud --once
```

After a change, set every development environment value again because values
and data do not copy.

## Part 8: Deploy to production

### Step 13: Create fresh production Convex Auth keys

Run:

```bash
npm run auth:keys
```

Store the two output values in a password manager. Production needs its own
matching `JWT_PRIVATE_KEY` and `JWKS` pair. Never reuse the development pair.

### Step 14: Configure the production X OAuth app

Create a separate production Web App in the
[X Developer Console](https://console.x.com/):

1. Enable OAuth 2.0 for a confidential client.
2. Use `users.read` and `tweet.read` for normal sign-in.
3. Set **Website URL** to `https://friendsofconvex.dev`.
4. Add these two exact callbacks with no trailing slash:

```text
https://friendsofconvex.dev/api/auth/callback/twitter
https://friendsofconvex.dev/x-dm/callback
```

5. Copy the OAuth 2.0 Client ID and Client Secret.
6. Copy or generate the app-only Bearer Token for imports and metrics.

The first callback powers normal X login. The second is used later when an
admin connects the dedicated gift-DM sender.

If this same production X app will send gifts, enable **Read, Write, and Direct
Messages** in X before you generate the sender grant. Normal Convex Auth still
requests only `users.read` and `tweet.read`; the separate sender connection
requests `dm.read`, `dm.write`, `tweet.read`, `users.read`, and
`offline.access`.

### Step 15: Add all production Convex environment values

Production `SITE_URL` is already set to `https://friendsofconvex.dev`, so six
values remain. Open **Convex dashboard → cvx-devx → convex-yappers →
Production → Settings → Environment Variables** and add:

```text
JWT_PRIVATE_KEY=<new production private key>
JWKS=<matching production JWKS>
AUTH_TWITTER_ID=<production X OAuth 2.0 Client ID>
AUTH_TWITTER_SECRET=<production X OAuth 2.0 Client Secret>
ADMIN_X_USER_IDS=<all admin numeric X IDs separated by commas>
X_BEARER_TOKEN=<production X app Bearer Token>
```

Or use prompts that keep values out of shell history:

```bash
npx convex env --prod set JWT_PRIVATE_KEY
npx convex env --prod set JWKS
npx convex env --prod set AUTH_TWITTER_ID
npx convex env --prod set AUTH_TWITTER_SECRET
npx convex env --prod set ADMIN_X_USER_IDS
npx convex env --prod set X_BEARER_TOKEN
npx convex env --prod list --names-only
```

Confirm `SITE_URL` still reads `https://friendsofconvex.dev`:

```bash
npx convex env --prod get SITE_URL
```

After changing auth values, start a fresh browser session for the sign-in test
so an older cookie does not hide a redirect issue.

### Step 16: Deploy the frontend and backend together

One command builds the Vite app, deploys the Convex backend, and uploads the
static files:

```bash
npm run deploy
```

The CLI sets `VITE_CONVEX_URL` to the production client URL during the build,
so the bundle always points at the right backend. Never run
`npm run build && npx @convex-dev/static-hosting upload --prod` with a stale
`.env.local`; the one-command deploy is the safe path.

To smoke test on the development deployment first:

```bash
npx @convex-dev/static-hosting upload --build
```

That uploads to `https://ceaseless-bobcat-587.convex.site` without touching
production.

### Step 17: Verify X sign-in on the live origin

1. Open `https://friendsofconvex.dev/join`.
2. Select **Continue with X**.
3. Confirm X returns to the exact `/join` URL.
4. Open `/admin` and verify allowlist enforcement.

If X reports a callback mismatch, compare the registered callback character by
character with:

```text
https://friendsofconvex.dev/api/auth/callback/twitter
```

The production redirect uses the custom domain because `CONVEX_SITE_URL` is
overridden to `https://friendsofconvex.dev`. A callback registered on
`agile-spaniel-476.convex.site` will not match.

### Step 18: Bootstrap production admins

If you know the numeric X IDs from development, include all of them in
production `ADMIN_X_USER_IDS` before login.

For a new admin:

1. Have them sign in once at the live `/join` page.
2. Open **Production → Data → users** in Convex.
3. Copy their `xUserId`.
4. Append it to `ADMIN_X_USER_IDS` without removing existing IDs.
5. Reload `/admin`.

### Step 19: Test before sharing broadly

1. Open `/join` while signed out.
2. Continue with X and confirm the return to `/join`.
3. Submit a join request from a non-admin X account.
4. Confirm the pending person is absent from the public leaderboard.
5. Approve the person from `/admin` with an allowlisted account.
6. Confirm the person appears on the leaderboard.
7. Preview a two-handle import and a small public X List.
8. Refresh one person and confirm seven-day metrics appear.
9. Confirm a non-allowlisted X account cannot use `/admin`.
10. Open a deep route like `/about` directly and confirm the SPA fallback
    serves the app instead of a 404.
11. Check both themes on desktop and a phone-sized viewport.

## X API cost and data notes

X currently uses pay-per-use credits. User reads, List reads, and Post reads
are charged separately. Check the live prices in the X Developer Console
because X can change them.

The daily sync reads up to ten pages of 100 posts per active person, but only
posts in the last seven days. X deduplicates many same-day resource reads for
billing, but you should still start with a small board and set a spending
limit.

The leaderboard uses `public_metrics.impression_count`. X defines this as
screen appearances, not unique people. The app does not request private,
organic, or promoted metrics.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| The browser shows the configuration screen locally | `.env.local` must contain `VITE_CONVEX_URL`. Restart `npm run dev` after editing it. |
| The board shows loading skeletons forever | `VITE_CONVEX_URL` points at a backend that is not running. If `npx convex dev` uses the cloud development deployment, set `VITE_CONVEX_URL` to that deployment's `.convex.cloud` URL, not `http://127.0.0.1:3210`. |
| Every path on the deployed site returns 404 | Run `npx convex dev` or `npx convex deploy` after adding the static hosting component, then upload again. Confirm `registerStaticRoutes` is called in `convex/http.ts`. |
| The deployed site shows old code | Run `npm run deploy` again. HTML is served fresh with ETag revalidation; a hard reload clears any local cache. |
| The deployed bundle points at the wrong backend | Always deploy with `npm run deploy` so the CLI sets `VITE_CONVEX_URL` for the target deployment. |
| `/join` says X sign-in is not connected | Confirm `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, and `SITE_URL` exist on the active Convex deployment. |
| X says the callback is invalid | Register the callback on the deployment's `CONVEX_SITE_URL` origin plus `/api/auth/callback/twitter`. Development uses `https://ceaseless-bobcat-587.convex.site`; production uses `https://friendsofconvex.dev`. Match it exactly in X. |
| X returns to the wrong page | Check `SITE_URL`. Local should be `http://localhost:5174`; production should be `https://friendsofconvex.dev`. |
| `/admin` says this account is not an admin | Copy `xUserId` from the Convex `users` table and add it to `ADMIN_X_USER_IDS`. Do not use the handle. |
| A second admin lost access when added | Restore the existing IDs, then append the new numeric ID with a comma. Do not replace the whole allowlist. |
| Import says the X API is not configured | Add `X_BEARER_TOKEN` to the active Convex deployment. |
| X returns `401` | Regenerate the revoked or incorrect X credential and replace the matching Convex value. |
| X returns `429` | Wait for the rate-limit window, then retry a smaller operation. |
| X returns a billing or credit error | Add credits or raise the spending limit in the X Developer Console. |
| A private List fails | Use a public List. Private List import is outside this app's app-only Bearer Token flow. |
| A join request appears on the homepage before approval | Stop and check that the record is `pending` and `active: false`; pending records should never be public. |
| `npx convex deploy --dry-run` shows the wrong project | Stop. Run the `--configure existing --team ... --project ...` command with the intended slugs. |
| Production has no development users or data | This is expected. Development and production data and environment values are separate. |

## Reference links

- [Convex static hosting component](https://www.convex.dev/components/static-hosting)
- [Static hosting integration guide](https://github.com/get-convex/static-hosting/blob/main/INTEGRATION.md)
- [Convex Auth setup](https://labs.convex.dev/auth/setup)
- [Convex Auth manual key setup](https://labs.convex.dev/auth/setup/manual)
- [Convex Auth OAuth callback and environment variables](https://labs.convex.dev/auth/config/oauth)
- [Convex Auth production setup](https://labs.convex.dev/auth/production)
- [`npx convex dev` command reference](https://docs.convex.dev/cli/reference/dev)
- [`npx convex deploy` command reference](https://docs.convex.dev/cli/reference/deploy)
- [`npx convex env` command reference](https://docs.convex.dev/cli/reference/env)
- [Convex deploy keys](https://docs.convex.dev/cli/deploy-key-types)
- [Convex environment variables](https://docs.convex.dev/production/environment-variables)
- [Convex custom domains](https://docs.convex.dev/production/custom-domains)
- [Convex project configuration](https://docs.convex.dev/production/project-configuration)
- [Working with multiple Convex deployments](https://docs.convex.dev/production/multiple-deployments)
- [Convex documentation index for agents](https://docs.convex.dev/llms.txt)
- [Official Convex components catalog for agents](https://www.convex.dev/components/get-convex.md)
- [X Developer Console](https://console.x.com/)
- [X OAuth 2.0 Authorization Code with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X Activity API](https://docs.x.com/x-api/activity/introduction)
- [X user lookup, including up to 100 usernames](https://docs.x.com/x-api/users/lookup/introduction)
- [X List member endpoint](https://docs.x.com/x-api/lists/get-list-members)
- [X user-post timeline](https://docs.x.com/x-api/posts/timelines/introduction)
- [X public metric definitions](https://docs.x.com/x-api/fundamentals/metrics)
- [X API pricing](https://docs.x.com/x-api/getting-started/pricing)
- [X API rate limits](https://docs.x.com/x-api/fundamentals/rate-limits)
- [`fourthwall-setup.md`](fourthwall-setup.md) for auditable gifts and consent-first X DM delivery
