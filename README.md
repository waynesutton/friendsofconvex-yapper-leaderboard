# Friends of Convex yapper leaderboard

A people only, seven day X leaderboard for the Friends of Convex community. Post about Convex, climb the board, earn a badge. That is the whole game.

![Friends of Convex Yapper Leader Board](public/og-friends-of-convex.png)

Live at [friendsofconvex.dev](https://friendsofconvex.dev). Everything on the board updates in realtime through [Convex](https://convex.dev), so when the daily sync runs, every open browser tab watches the ranks shuffle at the same moment.

## What it does

The board tracks public X activity for an approved list of people over a rolling seven day window. No bots, no brands, just yappers.

- Two board modes: a general Yappers ranking (defaults to engagements), and a Convex mentions mode that only counts posts that mention Convex
- Expandable rows in Convex mentions mode that reveal the posts behind the numbers
- Top filter (30 / 60 / 100 / 150 / All) plus Load more, a board freshness chip, streak chips, and avatar anchored rank badges for the top 3
- Sign in with X to request a spot; admins approve or reject from a review queue
- Bulk imports from pasted handles or a public X List
- A daily cron that refreshes metrics every morning at 8 AM Pacific
- Admin controlled board columns, custom rank badges, permanent remove, and an optional Slack digest
- Gift studio: Fourthwall gift links to yappers over X DM, with consent first delivery, product shelf, Dispatches log (archive / restore / bulk delete / CSV), batch DM send, and 7 day link expiry with a live countdown
- Gift lab: mint named Fourthwall gift links for people who are not on the board (full name greeting, optional 7 day expiry, no X handle and no public share card)
- Personalized share cards rendered as a 1200 by 630 PNG on the backend
- Two themes, live `llms.txt` / `sitemap.md` / `sitemap.xml` / `robots.txt` that rebuild whenever the board changes, and OpenGraph cards for sharing

## The stack

| Layer | What runs it |
| --- | --- |
| Frontend | React 19, Vite, react router, TypeScript, Tailwind CSS 4 |
| Backend | Convex queries, mutations, actions, HTTP actions, and crons |
| Auth | [Convex Auth](https://labs.convex.dev/auth) with X OAuth 2.0 |
| Hosting | [@convex-dev/static-hosting](https://www.convex.dev/components/static-hosting) serving the SPA from the Convex HTTP Actions origin |
| X data | App only Bearer Token for profiles, Lists, posts, and metrics |
| Gifts (optional) | Fourthwall giveaway links plus a dedicated X DM sender |

## APIs and accounts you need

You will create accounts and paste **variable names** into Convex with `npx convex env set`. Never commit secrets. Never put secrets in chat, screenshots, or any `VITE_*` value (those ship to the browser). The only browser facing value is `VITE_CONVEX_URL`, which `npx convex dev` writes for you.

### Required for the board and X sign in

| What to create | Convex env names to set | Where it comes from |
| --- | --- | --- |
| Convex project | (deployment created by CLI) | Free [Convex](https://convex.dev) account; `npx convex dev` creates the deployment |
| Convex Auth signing keys | `JWT_PRIVATE_KEY`, `JWKS` | Run `npm run auth:keys` locally, then set both on the deployment |
| Site origin | `SITE_URL` | Local: `http://localhost:5174`. Production: your public origin |
| X OAuth 2.0 app (confidential client) | `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET` | [X Developer Portal](https://developer.x.com) OAuth 2.0 Client ID and Client Secret |
| X app only access | `X_BEARER_TOKEN` | Same X app: App only Bearer Token (read profiles, Lists, posts, metrics) |
| First admin | `ADMIN_X_USER_IDS` | Comma separated **numeric** X user IDs (not handles). Read `xUserId` from the Convex `users` table after you sign in at `/join` |

X OAuth callback URL to register on the X app (exact match, no trailing slash on the origin):

```text
{CONVEX_SITE_URL}/api/auth/callback/twitter
```

`CONVEX_SITE_URL` is the Convex HTTP Actions origin for that deployment (shown in the Convex dashboard). Local Vite runs on port `5174`; `SITE_URL` must match where the browser actually loads the app.

### Optional Gift studio and Gift lab

Skip these until the board works. Both gift surfaces share the Fourthwall product shelf.

| What to create | Convex env names to set | Used for |
| --- | --- | --- |
| Fourthwall API user | `FOURTHWALL_API_USERNAME`, `FOURTHWALL_API_PASSWORD` | Create / sync gift links (studio + lab) |
| Fourthwall webhook signing secret | `FOURTHWALL_WEBHOOK_SECRET` | Mark links redeemed when Fourthwall posts an order |
| AES key for stored X tokens | `X_DM_TOKEN_ENCRYPTION_KEY` | Encrypt the connected X DM sender tokens at rest |
| Extra X app for DMs / Account Activity (optional) | `X_API_KEY`, `X_API_SECRET`, `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN`, `X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET` | Automatic GIFT / STOP DM consent |

### Optional Slack digest

| What to create | Convex env names to set |
| --- | --- |
| Slack bot + channel | `SLACK_BOT_TOKEN`, `SLACK_DIGEST_CHANNEL` |

## What you need on your machine

- Node.js 22.13 or newer (the repo pins Node 24 in `.nvmrc`)
- A free [Convex](https://convex.dev) account
- An X developer app with OAuth 2.0 credentials for sign in
- An X API Bearer Token for reading public profiles and posts
- Optional: Fourthwall credentials (and a second X app) if you want Gift studio or Gift lab

## One prompt setup with a coding agent

Fork this repo, open it in Cursor, Claude Code, or any coding agent, and paste this prompt. Cloud agents should run Convex in [agent mode](https://docs.convex.dev/cli/agent-mode) so they get an isolated anonymous deployment that does not touch your personal dev deployment.

```text
Set up my fork of the Friends of Convex yapper leaderboard so it runs locally.

Follow this README. Do not invent secret values. Ask me for each credential
and set it with `npx convex env set`. Never write secrets into source files,
chat logs you plan to commit, or any VITE_* variable.

APIs and accounts required (names only; I will paste the values):
1. Convex account (CLI creates the deployment)
2. X OAuth 2.0 Client ID and Client Secret -> AUTH_TWITTER_ID, AUTH_TWITTER_SECRET
3. X App only Bearer Token -> X_BEARER_TOKEN
4. Convex Auth keys from `npm run auth:keys` -> JWT_PRIVATE_KEY, JWKS
5. SITE_URL (use http://localhost:5174 for local Vite)
6. After I sign in, my numeric X user id -> ADMIN_X_USER_IDS

Optional later (skip for first run): Fourthwall API username/password,
FOURTHWALL_WEBHOOK_SECRET, X_DM_TOKEN_ENCRYPTION_KEY, X Account Activity
keys, Slack digest tokens.

Steps:
1. Confirm Node.js 22.13 or newer, then run npm install.
2. Start the Convex backend:
   - Local agent / human: npx convex dev
   - Cloud coding agent: CONVEX_AGENT_MODE=anonymous npx convex dev
3. Run npm run auth:keys, then set JWT_PRIVATE_KEY and JWKS on the
   active deployment with npx convex env set.
4. Set SITE_URL to http://localhost:5174 on the active deployment.
5. Ask me for AUTH_TWITTER_ID and AUTH_TWITTER_SECRET. Remind me to
   register this exact callback on my X OAuth 2.0 app:
   {CONVEX_SITE_URL}/api/auth/callback/twitter
   (use the deployment's Convex HTTP Actions origin for CONVEX_SITE_URL).
6. Ask me for X_BEARER_TOKEN and set it.
7. Start the frontend with npm run dev (http://localhost:5174), then
   walk me through signing in at /join with my X account.
8. After I sign in, read my numeric xUserId from the users table and
   set ADMIN_X_USER_IDS to it so I can open /admin.
9. Run npm run check and confirm lint, typecheck, and build all pass.

Skip Gift studio, Gift lab, Fourthwall, X Account Activity webhooks, and
Slack for now. Use https://docs.convex.dev and
https://docs.convex.dev/cli/agent-mode if anything about Convex is unclear.
```

## Run it by hand

```bash
npm install
npx convex dev        # starts the backend, writes VITE_CONVEX_URL to .env.local
npm run auth:keys     # print JWT_PRIVATE_KEY and JWKS, then env set both
npm run dev           # starts the site at http://localhost:5174
```

For a cloud coding agent on an isolated deployment:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run auth:keys` | Generates the Convex Auth JWT key pair |
| `npm run check` | Lint, typecheck, and build in one pass |
| `npm run deploy` | Deploys the frontend and backend together to Convex static hosting |

## Admin surfaces after you are allowlisted

| Path | What it is for |
| --- | --- |
| `/admin` | Board ops: add / archive / remove handles, imports, column and badge settings |
| `/admin/gifts` | Gift studio: campaigns, product shelf, Dispatches log, X DM delivery |
| `/admin/gift-lab` | Gift lab: named links for people off the board |
| `/admin/gifts/guide` | Plain language Gift studio walkthrough |
| `/admin/docs` | How admin access works and what each surface does |

## Learn more

- [Convex docs](https://docs.convex.dev)
- [Convex Auth](https://labs.convex.dev/auth)
- [Convex components](https://www.convex.dev/components)
- [Convex agent mode](https://docs.convex.dev/cli/agent-mode)
- [X Developer Portal](https://developer.x.com)
- [files.md](files.md) for a map of every file in this repo
- [changelog.md](changelog.md) for what shipped and when
