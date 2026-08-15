# Cursor migration handoff

Created: 2026-08-10 05:08 UTC  
Last Updated: 2026-08-10 05:13 UTC  
Status: Done

This document gives the next developer or Cursor agent enough context to run,
repair, deploy, and finish Friends of Convex without depending on prior Codex
tasks.

## Read this first

The application source is in:

```text
/Users/waynesutton/Documents/sites/convex-yappers
```

The product is a people-only Friends of Convex leaderboard. It ranks approved X
accounts by public impressions from original posts in the previous seven days.
It also contains X sign-in, join requests, admin tools, bulk imports, and an
optional Fourthwall gift workflow.

Cursor is the editor and coding agent. It is not the production host. Moving the
project to Cursor does not move the live site by itself. The frontend must still
be deployed to a hosting provider, tested on a temporary URL, and then connected
to `friendsofconvex.com` through Cloudflare.

Keep Convex as the backend and Convex Auth as the authentication system. Do not
replace either one as part of this migration.

## Problem

The app has working local source and a deployed Convex production backend, but
the current Codex Sites workflow has become difficult to operate. The live
frontend also has a client-side environment bug that can replace the rendered
site with this message:

```text
Connect this Site to Convex.
Add a public NEXT_PUBLIC_CONVEX_URL value, then restart the development server.
```

Local development is confusing for a separate reason: `npm run dev` starts the
frontend but does not start the local Convex backend on port `3210`.

The migration must preserve production data, URLs, auth behavior, and the
current interface while making local startup and frontend deployment easier to
understand.

## Confirmed root causes

### Browser environment bug

`app/providers.tsx` currently reads:

```ts
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
```

The Vinext/Vite production browser bundle compiles that expression to the
equivalent of:

```js
var convexUrl = {}.NEXT_PUBLIC_CONVEX_URL;
```

The server can read the hosted environment variable and initially render the
application. The browser receives `undefined`, hydration runs with no Convex
client, and the configuration screen replaces the application.

This is not a Cloudflare DNS problem and it is not a missing Convex production
deployment. Fix the public browser environment path before changing hosting or
DNS.

### Local startup confusion

The current scripts start one service at a time:

- `npx convex dev` starts or connects the Convex development backend.
- `npm run dev` starts the Vinext frontend at `http://localhost:3000`.

The local `.env.local` already points the frontend at
`http://127.0.0.1:3210`. Adding the variable inline is only a temporary shell
override. It should not be required when `.env.local` is loaded.

### Repository state

As of this handoff, this folder is not a Git repository. `git status` and
`git log` fail because no `.git` directory exists. Do not assume the Codex Sites
source store is a replacement for normal Git history.

Before creating a private repository:

1. Confirm `.env.local` remains ignored.
2. Search the source tree for pasted credentials or tokens.
3. Do not commit `.convex`, `.wrangler`, build output, or local logs.
4. Ask the owner before creating or publishing a remote repository.

## Product rules that must remain true

- The public board contains people, not company accounts.
- Visible product copy must never call community members “tracked people” or
  use “tracked” as a label. Use “Friends of Convex” or “Friends on the board.”
- The homepage title is “Friends of Convex Yapper Leader Board.”
- The leaderboard uses original public X posts from the previous seven days.
- Replies and reposts are excluded from the metric window.
- Pending join requests stay inactive and do not appear publicly.
- `/admin`, `/admin/setup`, and `/admin/gifts` stay protected by Convex Auth and
  the numeric X user ID allowlist.
- Admin and Setup links do not appear in the public header or footer.
- The public Join link remains visible.
- Keep the Rolling Signal card at its current size.
- Keep leaderboard rows visible above the fold on a normal desktop viewport.
- Keep the new Convex theme as the default and the original warm Studio theme as
  the alternate.
- Keep the theme switcher in the header and persist the selection locally.
- Keep sortable leaderboard columns, search, sharing, and pagination.
- Keep the existing Fourthwall gift safety model. One recipient row represents
  one delivery. One provider-detected `GIFT` event can authorize only one
  automatic delivery.
- A later `STOP` blocks unsent gift DMs. A new gift requires a fresh `GIFT`
  request or a newly verified manual request.
- Never expose a private gift token or Fourthwall giveaway URL through the
  public share-card route.

## Current architecture

| Layer | Current implementation |
| --- | --- |
| Frontend framework | Next.js 16 App Router rendered through Vinext |
| Frontend build | Vite 8 with the Cloudflare Vite plugin |
| Frontend runtime | Cloudflare-compatible worker entry in `worker/index.ts` |
| UI | React 19, TypeScript, CSS theme tokens, Phosphor icons |
| Backend | Convex 1.43 queries, mutations, actions, HTTP actions, and crons |
| Authentication | `@convex-dev/auth` with X OAuth 2.0 |
| Admin authorization | Comma-separated stable numeric X IDs in `ADMIN_X_USER_IDS` |
| X data | App-only Bearer Token for profiles, Lists, posts, and metrics |
| Gift delivery | Fourthwall giveaway links plus a separate X DM sender grant |
| Gift consent | Manual confirmation, with optional legacy X Account Activity ingestion |
| DNS | Cloudflare-managed zone |
| Current frontend host | Codex Sites project registered in `.openai/hosting.json` |

The browser talks to the Convex API origin. OAuth callbacks and incoming
webhooks go to the separate Convex HTTP Actions origin.

## Current production ownership and URLs

Checked on 2026-08-10 UTC.

| Use | Current value or state |
| --- | --- |
| Public site | `https://friendsofconvex.com` |
| Public `www` alias | `https://www.friendsofconvex.com` redirects to the apex domain |
| Local frontend | `http://localhost:3000` |
| Local Convex client | `http://127.0.0.1:3210` |
| Local Convex HTTP Actions | `http://127.0.0.1:3211` |
| Convex team | `cvx-devx` |
| Convex project | `convex-yappers` |
| Convex development deployment recorded in the guide | `ceaseless-bobcat-587` |
| Convex production deployment | `agile-spaniel-476` |
| Production Convex client | `https://agile-spaniel-476.convex.cloud` |
| Production Convex HTTP Actions | `https://agile-spaniel-476.convex.site` |
| Optional Convex API custom domain | `https://api.friendsofconvex.com` |
| Codex Sites project ID | `appgprj_6a7856202ce881918fa93ae043e66101` |
| Codex Sites latest saved version | `6` |
| Codex Sites saved environment | `NEXT_PUBLIC_CONVEX_URL=https://agile-spaniel-476.convex.cloud` |
| Codex Sites access reported at handoff | Custom, owner-only |

The `api.friendsofconvex.com` custom domain is attached to the Convex API. The
current frontend still uses `https://agile-spaniel-476.convex.cloud`. Do not use
the API custom domain for OAuth callbacks or webhooks.

Cloudflare is the DNS provider. Export or inspect the live DNS records before
changing them. Preserve `api.friendsofconvex.com` and the `www` redirect during
the frontend cutover. Do not reuse a remembered DNS target from a screenshot.
Use the exact target supplied by the new frontend host.

## Exact production callback and webhook map

| Purpose | URL |
| --- | --- |
| Convex Auth X callback | `https://agile-spaniel-476.convex.site/api/auth/callback/twitter` |
| Separate X gift-sender callback | `https://agile-spaniel-476.convex.site/x-dm/callback` |
| X Account Activity webhook | `https://agile-spaniel-476.convex.site/x-account-activity` |
| Fourthwall `ORDER_PLACED` webhook | `https://agile-spaniel-476.convex.site/fourthwall/webhook` |

The X app Website URL and Convex `SITE_URL` should use the final browser origin:

```text
https://friendsofconvex.com
```

Callbacks remain on the `.convex.site` origin even after the frontend host
changes.

## Route inventory

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Searchable, sortable, paginated seven-day leaderboard |
| `/about` | Public | Friendly explanation of the board and how it works |
| `/join` | Public | X sign-in, join request, status, and shareable join link |
| `/admin` | Allowlisted admin | Add, archive, restore, sync, review, and import people |
| `/admin/setup` | Allowlisted admin | In-app operator setup instructions |
| `/admin/gifts` | Allowlisted admin | Fourthwall campaign and X DM gift studio |
| `/gift/[token]` | Possession of private token | Personalized private gift pass and reveal flow |
| `/gift/share/[token]` | Public share token | Safe thank-you/share card with no claim credentials |

The old public `/setup` route was intentionally removed.

## Completed application work

### Leaderboard

- Realtime Convex-backed people list.
- Rolling seven-day public X impression totals.
- Original posts only, excluding replies and reposts.
- Daily scheduled refresh at `08:00 UTC` and manual refresh actions.
- Search by display name or handle.
- Sortable Rank, Yapper, Posts, Engagements, and Impressions columns.
- Stable canonical ranks after client-side sorting.
- Desktop table and compact mobile cards.
- Rank/profile share links, copy link, X share intent, and footer pagination.
- Empty, loading, missing-key, sync-error, and awaiting-first-sync states.
- No fabricated metrics when X is not configured.
- The separate Top Signal podium strip was removed. “Top signal / 7 days” was
  moved next to the people-edition label.

### Admin, auth, and joining

- Convex Auth with X OAuth 2.0 identity.
- Stable numeric X user IDs stored with authenticated users.
- Backend admin allowlist enforced for admin queries, mutations, and actions.
- More than one admin supported through comma-separated X IDs.
- Public `/join` flow with pending, approved, and rejected states.
- Pending members stay off the public board until approval.
- Manual add, archive, restore, and per-person or full refresh.
- Preview-first paste import for up to 100 handles.
- Preview-first import of the first 100 members from a public X List.
- Duplicate normalization and idempotent import behavior.
- Repeatable JWT/JWKS key generator at `scripts/generate-auth-keys.mjs`.

### Fourthwall gifts and X DMs

- Admin-only campaign studio.
- One Fourthwall giveaway link per selected recipient.
- Separate X OAuth 2.0 PKCE sender connection with DM scopes.
- Sender access and refresh tokens encrypted before storage.
- Consent-first delivery with manual copy fallback.
- Private personalized gift pass with open, reveal, and click tracking.
- Separate safe public share card.
- Signed and deduplicated Fourthwall `ORDER_PLACED` webhook.
- Manual Fourthwall status reconciliation.
- Delivery event ledger and recipient lifecycle statuses.
- Repeat gifts to the same person through a new recipient row and new consent.
- Gift numbering and bounded prior-delivery history.
- Idempotent send behavior for an already-sent recipient.

### Automatic gift intent

- Signed X Account Activity CRC and POST endpoints.
- Inbound `GIFT` detection and `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, or `QUIT`
  suppression.
- Duplicate event protection by X event ID.
- Only privacy-minimized command metadata is stored, not complete DM text.
- Global intent state applies across campaigns.
- One automatic `GIFT` event is atomically consumed by one recipient delivery.
- Admin-confirmed inbound consent remains available when the webhook integration
  cannot run.

X now describes the Account Activity API used by this code as deprecated. The
code is present, but activation is not guaranteed for a new X developer app.
Keep the manual fallback until this integration is either confirmed or migrated
to the current X Activity API.

### Interface and brand work

- Original Cohere-inspired warm paper and coral interface retained as `Studio`.
- New Convex.dev-inspired dark plum and cream interface added as the default.
- Persistent accessible theme switcher in the public header.
- Theme initialization avoids a visible flash when local storage is available.
- Official Convex logos, symbol, supplied racing-line artwork, and design brief
  are stored in the project.
- Homepage and About typography were reduced to keep useful content higher.
- Rolling Signal card dimensions were preserved.
- New default and older social preview cards remain in `public/`.
- Responsive checks were previously completed at desktop and mobile widths.

The theme work is in the local source. It was completed after the currently
reported Sites version was saved, so Cursor must not assume the latest local
design is what a signed-out visitor sees in production.

## Convex data model

| Table | Purpose |
| --- | --- |
| Convex Auth tables | Sessions, accounts, verification, and OAuth state owned by Convex Auth |
| `users` | Auth user plus stable X identity fields |
| `profiles` | Curated people, public metrics, sync state, and membership review state |
| `snapshots` | Dated per-profile metric snapshots |
| `giftCampaigns` | Fourthwall product/package campaign and provisioning state |
| `giftRecipients` | One numbered gift delivery, private/public tokens, consent, DM IDs, and redemption state |
| `giftIntentStates` | Latest global `GIFT` or `STOP` state for one X user |
| `xAccountActivityEvents` | Deduplicated privacy-minimized inbound X events |
| `xAccountActivityConfigs` | Webhook registration and sender subscription state |
| `giftEvents` | Per-recipient lifecycle ledger |
| `giftSenderConnections` | Encrypted dedicated sender access and refresh tokens |
| `giftOAuthStates` | Expiring one-use PKCE state records |
| `giftWebhookEvents` | Deduplication records for Fourthwall webhooks |

Read `convex/_generated/ai/guidelines.md` before editing anything under
`convex/`. Preserve the existing indexes and bounded queries unless a migration
plan proves a change is safe.

## Environment variables

Never put secret values in this PRD, source files, Cursor rules, browser code,
Git, screenshots, or chat prompts.

### Local frontend

Current `.env.local` contains these keys and is ignored by Git:

```text
CONVEX_DEPLOYMENT
VITE_CONVEX_URL
NEXT_PUBLIC_CONVEX_URL
VITE_CONVEX_SITE_URL
```

For local Agent Mode, the intended browser value is:

```text
VITE_CONVEX_URL=http://127.0.0.1:3210
```

`NEXT_PUBLIC_CONVEX_URL` is the existing Next-style name. Do not rely on it in
browser code until the Vinext/Vite replacement path has been fixed and tested.

### Production frontend host

The new host needs a build-time public browser value:

```text
VITE_CONVEX_URL=https://agile-spaniel-476.convex.cloud
```

If the implementation keeps `NEXT_PUBLIC_CONVEX_URL` for server rendering, set
it to the same production URL. The browser bundle still needs a Vite-compatible
replacement. Neither variable is a secret.

### Convex development and production

Set these independently on each selected Convex deployment. Development values
are not copied to production.

| Variable | Purpose | Required now |
| --- | --- | --- |
| `SITE_URL` | Browser origin used after auth | Yes |
| `JWT_PRIVATE_KEY` | Convex Auth signing key | Yes for auth |
| `JWKS` | Public key set paired with the private key | Yes for auth |
| `AUTH_TWITTER_ID` | X OAuth 2.0 client ID | Yes for auth |
| `AUTH_TWITTER_SECRET` | X OAuth 2.0 client secret | Yes for auth |
| `ADMIN_X_USER_IDS` | Comma-separated numeric X administrator IDs | Yes for admin |
| `X_BEARER_TOKEN` | App-only X data reads and imports | Yes for live leaderboard data |
| `FOURTHWALL_API_USERNAME` | Fourthwall API user | Only when activating gifts |
| `FOURTHWALL_API_PASSWORD` | Fourthwall API password | Only when activating gifts |
| `FOURTHWALL_WEBHOOK_SECRET` | Verifies Fourthwall webhook bodies | Only when activating gifts |
| `X_DM_TOKEN_ENCRYPTION_KEY` | Encrypts sender tokens at rest | Only when activating gifts |
| `X_API_KEY` | OAuth 1.0a/legacy activity app key | Only for automatic X intent |
| `X_API_SECRET` | OAuth 1.0a secret and webhook verification | Only for automatic X intent |
| `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN` | Dedicated sender OAuth 1.0a token | Only for automatic X intent |
| `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET` | Paired dedicated sender token secret | Only for automatic X intent |

`CONVEX_SITE_URL` is supplied by Convex and is used by Auth configuration and
webhook setup code. Do not copy a localhost value into production.

The existing setup guides contain conflicting historical snapshots of the
production environment. Before depending on auth, inspect the production
deployment directly and confirm every required key exists. Do not assume a
checked task entry means the value is still present.

## Known incomplete or unverified work

Treat these as migration tasks, not finished production features:

1. Fix the browser Convex URL replacement in `app/providers.tsx`.
2. Make local startup obvious. Prefer one documented command that starts both
   the frontend and the intended development backend, or clearly name separate
   `dev:web` and `dev:backend` scripts.
3. Confirm the Convex production environment. Historical project notes disagree
   about whether `SITE_URL` still points at the older Sites origin or the custom
   domain.
4. Add or verify production Convex Auth keys, X OAuth credentials, the admin
   allowlist, and the X Bearer Token.
5. Verify `/join` and `/admin` through a real production X sign-in.
6. Decide the replacement frontend host. Cursor does not make this decision or
   deploy the site automatically.
7. Deploy the latest local Convex theme source to a temporary host URL and run
   browser QA before moving DNS.
8. Confirm whether the site should be public. The Sites API reported custom,
   owner-only access at handoff.
9. Activate Fourthwall only after a one-person test with real credentials.
10. Keep legacy X Account Activity disabled unless the X project has access.
    Plan migration to X Activity if automatic intent detection is still wanted.
11. Initialize private Git history only after a secret scan and owner approval.
12. Recheck development-only dependency advisories before changing Vinext,
    Vite, Cloudflare, React, or Next pins.
13. The current Vinext build passes but prints Vite/Rolldown compatibility
    warnings for `treeshake.preset`, `experimentalMinChunkSize`, and ineffective
    dynamic imports. Treat these as toolchain debt, not a reason to force an
    upgrade during the environment repair.

## Required migration sequence

### 1. Preserve the current state

1. Copy the project folder to a safe backup location.
2. Export or snapshot the Convex production data before any schema change.
3. Record the live Cloudflare DNS records and redirects.
4. Record the current Convex production environment key names without copying
   secret values into the repository.
5. Confirm the active X and Fourthwall app settings in their dashboards.

Do not change DNS, production schema, auth origins, or the current site in this
step.

### 2. Reproduce the current toolchain

Use Node 24. The project is pinned in `.nvmrc` and `.node-version`.

```bash
cd /Users/waynesutton/Documents/sites/convex-yappers
nvm use
node --version
npm install
```

Expected Node version: 24.x. The minimum enforced by the project is 22.13.

### 3. Run development without production data

Terminal 1:

```bash
npx convex dev
```

Terminal 2:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Do not point local code at `agile-spaniel-476` merely to avoid starting the
development backend. Local UI actions could modify production data.

### 4. Fix the client environment boundary

The smallest intended change is to make the client read the Vite public value:

```ts
const convexUrl = import.meta.env.VITE_CONVEX_URL;
```

If SSR requires a fallback, implement it explicitly and verify both server and
browser behavior. Another acceptable approach is a Vite `define` replacement
for `process.env.NEXT_PUBLIC_CONVEX_URL`, but it must be build-time and must not
copy secret environment values into the client.

Required checks after the fix:

```bash
npm run lint
npm run typecheck
npm run build
```

Inspect `dist/client` and confirm:

- the production build contains `https://agile-spaniel-476.convex.cloud`;
- the production browser bundle contains no `127.0.0.1:3210`;
- the client code no longer contains `{}.NEXT_PUBLIC_CONVEX_URL`;
- browser hydration does not replace the page with the configuration screen.

### 5. Make one-command development predictable

Cursor should propose one of these paths before changing scripts:

- Keep two explicit commands and rename them `dev:backend` and `dev:web`.
- Add a small process runner and make `npm run dev` start both services with
  readable prefixed logs and clean shutdown.
- Use a Convex cloud development deployment for OAuth testing while keeping
  production separate.

Do not hide a failed Convex process behind a frontend that still returns HTTP
200. The UI should clearly say which backend URL it is using in development.

### 6. Choose and test the new frontend host

The lowest-change host is likely Cloudflare Workers because the project already
uses `@cloudflare/vite-plugin`, Wrangler, and a worker entry. Confirm support for
the current Vinext build before committing to it.

Using Vercel is possible but is a larger build migration. It may require
removing Vinext and Cloudflare-specific code and returning to the native Next.js
runtime. Do not combine that framework migration with DNS cutover unless there
is a clear rollback plan.

For either host:

1. Deploy to the provider's temporary URL.
2. Set the public production Convex client URL.
3. Test public pages, realtime data, auth, admin rejection, and mobile layout.
4. Keep `friendsofconvex.com` on the old host until the temporary URL passes.

### 7. Configure auth against the final domain

Production Convex:

```text
SITE_URL=https://friendsofconvex.com
```

Production X app:

```text
Website URL: https://friendsofconvex.com
Callback: https://agile-spaniel-476.convex.site/api/auth/callback/twitter
Gift sender callback: https://agile-spaniel-476.convex.site/x-dm/callback
```

Use stable numeric X user IDs in `ADMIN_X_USER_IDS`. To add another admin,
preserve all existing IDs and append the new ID with a comma.

### 8. Cut over Cloudflare DNS

Only after the temporary deployment passes:

1. Obtain the exact apex and `www` records from the new host.
2. Preserve the `api.friendsofconvex.com` Convex record.
3. Preserve or recreate the `www` to apex redirect with path and query strings.
4. Change only the frontend records.
5. Verify TLS, apex, `www`, `/join`, `/admin`, `/about`, and a deep gift route.
6. Keep the old deployment available until the new host is stable.

### 9. Activate integrations one at a time

Recommended order:

1. Public leaderboard query and realtime updates.
2. X sign-in and one non-admin rejection test.
3. One admin login and one join approval.
4. One pasted-handle preview and import.
5. One small public X List preview.
6. One person refresh and then a full refresh.
7. One Fourthwall test recipient using manual consent.
8. One X DM send from the dedicated sender.
9. One Fourthwall redemption webhook.
10. Automatic `GIFT` and `STOP` only if the X app has supported webhook access.

## Verification checklist

### Local

- [ ] Node 24 is selected in a fresh terminal.
- [ ] Dependency installation finishes without changing the chosen framework.
- [ ] Local Convex listens on `127.0.0.1:3210`.
- [ ] The frontend listens on `localhost:3000`.
- [ ] `npm run dev` behavior is documented or changed to start the intended full stack.
- [ ] The browser does not show the Convex configuration screen.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:x-account-activity` passes.

### Production frontend

- [ ] A signed-out visitor can open the homepage without a host login gate.
- [ ] The browser bundle contains the production Convex client URL.
- [ ] The browser bundle contains no localhost Convex URL.
- [ ] Server render and browser hydration show the same application state.
- [ ] Realtime leaderboard changes reach the browser.
- [ ] Search, sorting, share actions, and pagination work.
- [ ] Both themes work on desktop and mobile.
- [ ] No visible interface copy uses “tracked.”

### Auth and admin

- [ ] `/join` returns from X to the correct application route.
- [ ] A pending join request stays absent from the public leaderboard.
- [ ] An allowlisted X user can open `/admin`.
- [ ] A signed-out or non-allowlisted user cannot use any admin backend function.
- [ ] A second comma-separated admin ID works without removing the first.

### Gifts

- [ ] `/admin/gifts` rejects non-admins.
- [ ] One private portal token reveals only its assigned Fourthwall link.
- [ ] A public share token never returns the private token or giveaway URL.
- [ ] One automatic `GIFT` event cannot create or send two deliveries.
- [ ] `STOP` blocks an unsent gift.
- [ ] A fresh `GIFT` can authorize a later gift without reusing an older row.
- [ ] Fourthwall webhook signatures and duplicate events are handled safely.

### Domain cutover

- [ ] `https://friendsofconvex.com` serves the new host.
- [ ] `https://www.friendsofconvex.com/path?query=1` redirects to the matching apex path and query.
- [ ] `https://api.friendsofconvex.com` still reaches the Convex API custom domain.
- [ ] Convex Auth and both external webhooks still use `agile-spaniel-476.convex.site`.

## Main files for Cursor

| File | Why it matters |
| --- | --- |
| `AGENTS.md` | Project coding, Convex, UI, and documentation rules |
| `convex/_generated/ai/guidelines.md` | Required Convex implementation rules |
| `package.json` | Runtime pins, scripts, and dependency versions |
| `.env.local` | Ignored local deployment and public frontend URLs |
| `app/providers.tsx` | Current P0 browser environment bug |
| `vite.config.ts` | Vinext, Sites, and Cloudflare build wiring |
| `worker/index.ts` | Cloudflare worker entry |
| `app/globals.css` | Convex and Studio theme systems |
| `app/components/Leaderboard.tsx` | Public board behavior and sorting |
| `app/components/AdminPanel.tsx` | Core admin controls |
| `app/components/JoinBoard.tsx` | X sign-in and join flow |
| `app/components/GiftAdminPanel.tsx` | Gift campaigns, consent, sending, and history |
| `app/components/GiftPortal.tsx` | Private gift pass and public share card |
| `convex/schema.ts` | Current data model and indexes |
| `convex/auth.ts` | X identity provider configuration |
| `convex/authz.ts` | Numeric X admin allowlist enforcement |
| `convex/profiles.ts` | Leaderboard and membership functions |
| `convex/imports.ts` | Handle and public X List imports |
| `convex/xSync.ts` | Seven-day X metric aggregation |
| `convex/gifts.ts` | Gift state and one-consent-per-delivery rules |
| `convex/giftActions.ts` | Fourthwall and X DM external actions |
| `convex/http.ts` | Auth, callback, and webhook routes |
| `SETUP_GUIDE.md` | Existing operator setup, including historical state |
| `fourthwall-setup.md` | Existing gift activation guide |
| `.openai/hosting.json` | Legacy Codex Sites project binding; do not treat it as the new host config |

## Cursor operating instructions

Give Cursor this PRD together with the full project folder. Its first task
should be:

```text
Read AGENTS.md, convex/_generated/ai/guidelines.md, and
prds/2026-08-10-cursor-migration-handoff.md completely. Diagnose the current
project before editing. Do not change production Convex, Cloudflare DNS, X,
Fourthwall, or the live site. First fix the client-side Convex URL boundary so
local and production browser bundles receive the correct public URL. Then make
the local full-stack startup predictable, run lint/typecheck/build/tests, and
show the proposed frontend hosting plan and rollback steps before deploying.
Keep Convex and Convex Auth. Preserve every existing route, data model, theme,
admin rule, and gift consent rule. Never print or commit secret values.
```

After the first repair is verified, ask Cursor for a separate deployment plan.
Do not authorize DNS or production writes in the same step as the code repair.

## Related project documents

- `SETUP_GUIDE.md`
- `fourthwall-setup.md`
- `prds/2026-08-08-friends-of-convex-yapper-board.md`
- `prds/2026-08-08-x-join-and-imports.md`
- `prds/2026-08-08-fourthwall-gift-pass.md`
- `prds/2026-08-08-x-account-activity-gift-consent.md`
- `prds/2026-08-08-repeat-gift-deliveries.md`
- `prds/2026-08-09-vinext-dev-startup.md`
- `prds/2026-08-09-production-urls-and-sites-registration.md`
- `prds/2026-08-10-convex-theme-system.md`
- `prds/lessons.md`

## Official references

- Convex documentation: <https://docs.convex.dev/home>
- Convex TypeScript practices: <https://docs.convex.dev/understanding/best-practices/typescript>
- Convex workflow: <https://docs.convex.dev/understanding/workflow>
- Convex Auth setup: <https://labs.convex.dev/auth/setup>
- Convex custom domains: <https://docs.convex.dev/production/custom-domains>
- X API introduction: <https://docs.x.com/x-api/introduction>
- Fourthwall guide overview: <https://docs.fourthwall.com/guides/overview>
- Cloudflare Workers Vite plugin: <https://developers.cloudflare.com/workers/vite-plugin/>

## Edge cases for the migration

- The local frontend can return HTTP 200 while the Convex process is absent.
- A server-rendered page can look correct before hydration replaces it.
- Production and development Convex deployments have separate data and secrets.
- Changing `SITE_URL` can send a successful X login to the wrong frontend.
- X handle changes must not change admin identity. Use the numeric X ID.
- The custom API subdomain and HTTP Actions origin are different services.
- Gift links are bearer capabilities. Logs and analytics must not capture the
  private token or Fourthwall destination.
- A repeated Fourthwall or X webhook must not create another state transition.
- A new frontend host can require different caching or WebSocket configuration
  for Convex subscriptions.
- DNS cutover can succeed at the apex while `www`, deep links, or TLS still fail.
- A framework upgrade can remove the Vinext compatibility work that currently
  keeps fonts, config loading, and the worker image handler running.

## Files changed for this handoff

- `prds/2026-08-10-cursor-migration-handoff.md`
- `files.md`

## Task completion log

- 2026-08-10 05:08 UTC: Inventoried routes, schema tables, environment key
  references, scripts, setup guides, completed task records, design assets, and
  the registered Sites project.
- 2026-08-10 05:08 UTC: Confirmed the current Sites project ID, live custom
  domain, saved version number, owner-only access state, and saved production
  Convex URL without copying secret values into this document.
- 2026-08-10 05:08 UTC: Documented the browser bundle environment failure, local
  two-process requirement, safe hosting and DNS cutover order, remaining
  integration work, verification checklist, and a first Cursor prompt.
- 2026-08-10 05:13 UTC: Ran `npm run check`; lint, TypeScript, and the Vinext
  production build passed. Reconfirmed that the generated client bundle still
  contains `{}.NEXT_PUBLIC_CONVEX_URL`, so the documented P0 bug remains real
  and must be repaired before deployment.
