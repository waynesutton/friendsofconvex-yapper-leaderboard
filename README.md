# Friends of Convex yapper leaderboard

A people only, seven day X leaderboard for the Friends of Convex community. Post about Convex, climb the board, earn a badge. That is the whole game.

![Friends of Convex Yapper Leader Board](public/og-friends-of-convex.png)

Live at [friendsofconvex.dev](https://friendsofconvex.dev). Everything on the board updates in realtime through [Convex](https://convex.dev), so when the daily sync runs, every open browser tab watches the ranks shuffle at the same moment.

## What it does

The board tracks public X activity for an approved list of people over a rolling seven day window. No bots, no brands, just yappers.

- Two board modes: a general Yappers ranking by public engagement, and a Convex mentions mode ranked by Convex post count. A post is an original, quote, or reply from the last seven days; reposts are out. Convex mentions match the whole word convex in the post text, long post text, or a convex.dev link
- Expandable rows in Convex mentions mode that reveal the posts behind the numbers
- Top filter (30 / 60 / 100 / 150 / All) plus Load more, a board freshness chip, streak chips, and avatar anchored rank badges for the top 3
- Custom groups: admins can spotlight any circle (a team, a conference, a cohort) as its own leaderboard pill, with members added by handle or imported from a public X List. Each group gets a shareable `/?board=slug` link and shows up in `llms.txt` and `sitemap.md`
- Site branding settings: change the site title, community name, board name, header title, and logo from `/admin/settings` in one pass. Forks can retitle everything without touching code
- Sign in with X to request a spot; admins approve or reject from a review queue
- Bulk imports from pasted handles or a public X List
- A daily cron at 8:17 AM Pacific that refreshes every active profile in batches, so boards past 100 people never skip anyone
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
9. Run npm run check and confirm lint, typecheck, tests, and build all pass.

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
| `npm run test` | Runs the vitest suite: sync target paging and metric parsing |
| `npm run check` | Lint, typecheck, test, and build in one pass |
| `npm run deploy` | Deploys the frontend and backend together to Convex static hosting |

## Admin surfaces after you are allowlisted

| Path | What it is for |
| --- | --- |
| `/admin` | Board ops: add / archive / remove handles, imports, column and badge settings, the Convex mentions tab toggle |
| `/admin/groups` | Custom groups: create, rename, reorder, show or hide, internal admin only boards, member management, X List import |
| `/admin/settings` | Site branding: title, community name, board name, header title, logo, reset to defaults |
| `/admin/gifts` | Gift studio: campaigns, product shelf, Dispatches log, X DM delivery |
| `/admin/gift-lab` | Gift lab: named links for people off the board |
| `/admin/gifts/guide` | Plain language Gift studio walkthrough |
| `/admin/docs` | How admin access works and what each surface does |

## Custom groups

Groups are extra leaderboard pills next to Yappers and Convex mentions. Create one at `/admin/groups`, add people by X handle, or paste a public X List URL and import up to 100 members in one click. The list id is saved on the group, so re syncing later is one button.

How the pills behave:

- A group pill only renders on the public board when the group is visible and has at least one active member, so visitors never see a dead tab
- Groups rank with the standard Yappers scoring (engagements, then impressions, then posts)
- Every pill has its own link: `/?board=slug`. The slug comes from the group name and updates when you rename the group
- One person can sit in several groups; removing someone from a group never removes them from the main board
- Mark a board internal and only signed in admins see its pill (with a lock icon). Everyone else is blocked server side, and internal boards stay out of `llms.txt` and the sitemaps. Good for an internal team board
- Handles imported through a group that are not on the board yet are added to it, approved and active, and picked up by the next metrics sync
- Visible groups with members appear automatically in the live `llms.txt`, `sitemap.md`, and `sitemap.xml`

## Fork this board

Three tiers, from lightest to full removal.

**1. Rebrand from admin (no code changes).** Open `/admin/settings` (the gear icon in the admin nav) and change the site title, community name, board name, header title, and logo. Every field defaults to the shipped Friends of Convex look, and one save updates the header, the board heading, the browser tab title, the share text, and the discovery files together. Reset to defaults undoes everything.

**2. Hide the Convex mentions tab.** In `/admin` under Board settings, uncheck "Show the Convex mentions tab". The public board keeps the Yappers pill and any group pills; a direct `/?board=convex` link falls back to Yappers.

**3. Remove the Convex parts entirely (code changes).** The runtime settings above cover most of a fork. What stays hardcoded:

| Where | What to change |
| --- | --- |
| `index.html` | Page title, description, OpenGraph and JSON-LD meta tags |
| `public/favicon.png`, `public/og-friends-of-convex.png` | Favicon and the social preview image |
| `public/brand/` | Convex logo assets (the header logo is replaceable from admin; these files remain in the repo) |
| `src/pages/AboutPage.tsx` | Long form methodology prose written for Friends of Convex |
| `src/components/BuiltWithFooter.tsx` | Footer attribution and Convex social links |
| `convex/xSyncParsing.ts` | The Convex mention scan (only matters if you keep the mentions tab on) |
| `convex/slack.ts` | The Slack digest copy (optional feature, off unless configured) |
| Gift studio / Gift lab copy | Thank you card prose mentions Convex |

## Learn more

- [Convex docs](https://docs.convex.dev)
- [Convex Auth](https://labs.convex.dev/auth)
- [Convex components](https://www.convex.dev/components)
- [Convex agent mode](https://docs.convex.dev/cli/agent-mode)
- [X Developer Portal](https://developer.x.com)
- [files.md](files.md) for a map of every file in this repo
- [changelog.md](changelog.md) for what shipped and when
