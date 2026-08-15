# Friends of Convex yapper leaderboard

A people only, seven day X leaderboard for the Friends of Convex community. Post about Convex, climb the board, earn a badge. That is the whole game.

![Friends of Convex Yapper Leader Board](public/og-friends-of-convex.png)

Live at [friendsofconvex.dev](https://friendsofconvex.dev). Everything on the board updates in realtime through [Convex](https://convex.dev), so when the daily sync runs, every open browser tab watches the ranks shuffle at the same moment.

## What it does

The board tracks public X activity for an approved list of people over a rolling seven day window. No bots, no brands, just yappers.

- Two board modes: a general Yappers ranking by impressions, and a Convex mentions mode that only counts posts that mention Convex
- Expandable rows in Convex mentions mode that reveal the posts behind the numbers
- Streak chips and avatar anchored rank badges for the top 3, with a sparkle on first place
- Sign in with X to request a spot; admins approve or reject from a review queue
- Bulk imports from pasted handles or a public X List
- A daily cron that refreshes metrics every morning at 8 AM Pacific
- Admin controlled board columns, custom rank badges, and an optional Slack digest
- An optional gift studio that sends Fourthwall gift links to yappers over X DM, with consent first delivery and a personalized share card rendered as a 1200 by 630 PNG on the backend
- Two themes, live `llms.txt` and `sitemap.md` files that rebuild whenever the board changes, and OpenGraph cards for sharing

## The stack

| Layer | What runs it |
| --- | --- |
| Frontend | React 19, Vite, react router, TypeScript, Tailwind CSS 4 |
| Backend | Convex queries, mutations, actions, HTTP actions, and crons |
| Auth | [Convex Auth](https://labs.convex.dev/auth) with X OAuth 2.0 |
| Hosting | [@convex-dev/static-hosting](https://www.convex.dev/components/static-hosting) serving the SPA from the Convex HTTP Actions origin |
| X data | App only Bearer Token for profiles, Lists, posts, and metrics |
| Gifts (optional) | Fourthwall giveaway links plus a dedicated X DM sender |

## What you need to set it up

- Node.js 22.13 or newer (the repo pins Node 24 in `.nvmrc`)
- A free [Convex](https://convex.dev) account, created automatically the first time you run `npx convex dev`
- An X developer app with OAuth 2.0 credentials for sign in
- An X API Bearer Token for reading public profiles and posts
- Optional: Fourthwall credentials and a second X app if you want the gift studio

The required Convex environment values are `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, `ADMIN_X_USER_IDS`, and `X_BEARER_TOKEN`. The full walkthrough, including the exact X callback URLs and the first admin flow, lives in [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

## One prompt setup with a coding agent

Fork this repo, open it in Cursor, Claude Code, or any coding agent, and paste this prompt. Cloud agents should run Convex in [agent mode](https://docs.convex.dev/cli/agent-mode) so they get an isolated deployment.

```text
Set up my fork of the Friends of Convex yapper leaderboard so it runs locally.

Read docs/SETUP_GUIDE.md first and follow it. Then:

1. Confirm Node.js 22.13 or newer is active, then run npm install.
2. Start the Convex backend with npx convex dev. If you are a cloud coding
   agent, run CONVEX_AGENT_MODE=anonymous npx convex dev instead.
3. Run npm run auth:keys, then set JWT_PRIVATE_KEY and JWKS on the dev
   deployment with npx convex env set.
4. Set SITE_URL to http://localhost:5174 on the dev deployment.
5. Ask me for my X OAuth 2.0 Client ID and Client Secret, then set
   AUTH_TWITTER_ID and AUTH_TWITTER_SECRET. Remind me to register the
   callback URL shown in docs/SETUP_GUIDE.md on my X app.
6. Ask me for my X API Bearer Token and set X_BEARER_TOKEN.
7. Start the frontend with npm run dev, then walk me through signing in
   at /join with my X account.
8. After I sign in, read my numeric X user id from the users table and
   set ADMIN_X_USER_IDS to it so I can open /admin.
9. Run npm run check and confirm lint, typecheck, and build all pass.

Skip the Fourthwall gift studio and X Account Activity webhooks for now;
they are optional and documented in docs/. Use the Convex docs at
https://docs.convex.dev if anything about Convex is unclear.
```

## Run it by hand

```bash
npm install
npx convex dev        # starts the backend, writes VITE_CONVEX_URL to .env.local
npm run dev           # starts the site at http://localhost:5174
```

Useful scripts:

| Command | What it does |
| --- | --- |
| `npm run auth:keys` | Generates the Convex Auth JWT key pair |
| `npm run check` | Lint, typecheck, and build in one pass |
| `npm run deploy` | Deploys the frontend and backend together to Convex static hosting |

## Learn more

- [Convex docs](https://docs.convex.dev)
- [Convex Auth](https://labs.convex.dev/auth)
- [Convex components](https://www.convex.dev/components)
- [Convex agent mode](https://docs.convex.dev/cli/agent-mode)
- [files.md](files.md) for a map of every file in this repo
- [changelog.md](changelog.md) for what shipped and when
