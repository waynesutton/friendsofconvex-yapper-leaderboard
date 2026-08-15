# Production URLs and Sites registration

Created: 2026-08-09 10:03 UTC
Last Updated: 2026-08-09 10:11 UTC
Status: Done

## Problem

The application works locally, but the setup documentation mixes local and production examples and does not state the app's verified Sites registration state. The operator needs the exact production Convex origins, X callbacks, webhook URLs, final Sites route map, and the reason this project is absent from ChatGPT Sites.

## Root cause

- `.openai/hosting.json` contains no `project_id`, so the folder is a local Sites project rather than a registered Site.
- The current Sites account does not contain a Friends of Convex Yapper Board project.
- No Sites version has been saved or deployed, so there is no confirmed `current_live_url` to use as production `SITE_URL`.
- The project is linked to Convex team `cvx-devx`, project `convex-yappers`, with production deployment `agile-spaniel-476`, but production environment values and functions have not been completed.
- The existing guide asks for the final frontend URL before explaining the early Site registration and first private deployment needed to obtain it.

## Proposed solution

1. Add a verified current-state section that distinguishes local files, Sites registration, saved version, publication, Convex development, and Convex production.
2. Document the exact current production Convex client and HTTP Actions origins.
3. List every exact X callback and public webhook URL derived from the deployed routes.
4. Make the final `.chatgpt.site` origin explicitly pending until Sites registration and deployment returns `current_live_url`.
5. Reorder production instructions so the Site is registered early, Convex is deployed only after target-specific approval, the Site is first deployed privately, and the confirmed live origin is then used for `SITE_URL` and the X website URL.
6. Update the protected in-app guide with the same state and URL map without changing its visual design.
7. Preserve local instructions as a separate development path; prohibit localhost in every production X, Sites, Convex, and webhook setting.

## Files to change

- `SETUP_GUIDE.md`
- `fourthwall-setup.md`
- `app/admin/setup/page.tsx`
- `task.md`
- `changelog.md`
- `files.md`
- `prds/lessons.md`

## Edge cases

- The user may choose a different Convex team or project before production. The guide must say to stop and replace every `agile-spaniel-476` URL if that happens.
- A requested Sites slug may be unavailable. The guide must not claim a final `.chatgpt.site` URL until the Sites connector confirms it.
- Site registration does not mean a version was saved or published.
- A successful Sites deployment must still be confirmed by a matching nonempty `get_site.current_live_url`.
- X callbacks use the Convex `.site` origin; `SITE_URL` and the X website URL use the final `.chatgpt.site` origin.
- Account Activity and Fourthwall webhooks require public HTTPS and cannot use localhost.
- The Site should be public for open `/join` access, but changing Sites access requires explicit user authorization.

## Verification

- Confirm `.openai/hosting.json` contains the exact `project_id` returned by
  Sites and that `get_site` resolves the same record.
- Confirm every documented callback path exists in `convex/http.ts` or Convex Auth routing.
- Search production sections for `localhost` and ensure any match is an explicit prohibition or development-only note.
- Run lint, TypeScript, and the production build.
- Confirm the protected setup page compiles.

## Task completion log

- 2026-08-09 10:03 UTC: Verified the local Sites manifest, Sites account listing, current Convex target, production deployment URL, and HTTP route map. No Site registration, access change, Convex production deployment, or Sites publication was performed.
- 2026-08-09 10:11 UTC: Updated the standalone and protected setup guides, Fourthwall handoff, task list, changelog, file map, and project lessons with the verified lifecycle and exact production URL map.
- 2026-08-09 10:11 UTC: Passed ESLint, TypeScript, the Vinext production build, X Account Activity regression tests, route checks, and the unregistered hosting-manifest assertion.
- 2026-08-09 10:33 UTC: Registered the Site, deployed the approved Convex production backend, configured the hosted production Convex URL, published owner-only, and confirmed `https://friends-of-convex-yappers.waynesutton.chatgpt.site` as `current_live_url`.
- 2026-08-09 10:38 UTC: Prepared the final URL-aware version 3, reconfirmed the canonical URL and owner-only access, passed the production browser-bundle scan, and verified the public production leaderboard query. Full app-level browser QA remains pending because the private Sites gate requires the owner's ChatGPT sign-in and production X/Auth secrets are not configured yet.
