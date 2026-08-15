Created: 2026-08-15 10:44 UTC
Last Updated: 2026-08-15 10:50 UTC
Status: Done

# Agent Ready discovery files for the yapper board

## Problem

Search engines and AI agents have no machine readable map of Friends of Convex. There is no `llms.txt`, no markdown sitemap, and no robots or XML sitemap that stay current when a handle is added, archived, approved, or restored.

## Root cause

The app is a Convex static hosted SPA. Crawlers never run React. Discovery files have to be HTTP actions on the Convex site origin, generated from the same active profile index the public board uses.

## Proposed solution

Follow the VibeApps plus Agent Ready pattern.

1. Install `@waynesutton/agent-ready` with `@convex-dev/crons` and `@convex-dev/workpool`.
2. Let Agent Ready serve `agents.md`, `llms-full.txt`, status, readiness, RSS, and `/.well-known/agent-skills`.
3. Skip Agent Ready's `/llms.txt`, `/robots.txt`, and `/sitemap.xml` so this app can serve live copies.
4. Generate `/llms.txt`, `/sitemap.md`, `/sitemap.xml`, and `/robots.txt` from active public profiles on each request.
5. Link `llms.txt` and `sitemap.md` in the footer next to the open source credit.
6. Keep the floating Agent Ready widget hidden. Footer links are the human facing discovery path.

When an admin adds, archives, restores, imports, or reviews a handle, the next request to those files reflects the current board. No cache table. No extra X API calls.

## Files to change

- `package.json` and lockfile
- `convex/convex.config.ts`
- `convex/http.ts`
- `convex/siteDirectory.ts` (new, pure builders)
- `convex/siteFiles.ts` (new, directory query and HTTP actions)
- `convex/agentReady/content.ts` and `convex/agentReady/analytics.ts` (component wrappers)
- `agent-ready.config.json` (new)
- `llms.txt` (repo pointer, live files stay on the site origin)
- `src/components/BuiltWithFooter.tsx`
- `src/globals.css`
- `index.html`
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Pending and archived profiles stay off the files.
- Admin, gift pass, and gift share URLs stay out of sitemaps.
- Directory is capped at 250 people, matching the public board.
- Public URLs prefer `SITE_URL`, then `CONVEX_SITE_URL`, then the request origin.
- Exact discovery routes register before the static hosting catch all.
- Gift share OpenGraph routes keep their longer prefix.

## Verification steps

1. `npm run check` (lint, TypeScript, production build).
2. `GET /llms.txt` and `GET /sitemap.md` list current active handles.
3. Archive a handle, refetch, confirm it is gone. Restore it, confirm it returns.
4. Footer shows both file links next to the open source credit.
5. `GET /robots.txt` and `GET /sitemap.xml` mention the live discovery files.

## Task completion log

- 2026-08-15 10:44 UTC: PRD opened after reading VibeApps `siteDirectory.ts` / `http.ts` and the Agent Ready install guide.
- 2026-08-15 10:50 UTC: Live files verified on development. `GET /llms.txt` and `GET /sitemap.md` list the three active handles. `robots.txt`, `sitemap.xml`, `agents.md`, `llms-full.txt`, `llms-status`, `feed.xml`, and `llms-readiness` return 200. `npm run check` passed.
