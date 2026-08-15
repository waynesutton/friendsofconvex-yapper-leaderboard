# Dev and production auth/X setup

Created: 2026-08-15 06:42 UTC
Last Updated: 2026-08-15 07:15 UTC
Status: Done

## Problem

The application code and routes are deployed, but X sign-in, admin access, and X-backed imports are not configured on either live Convex deployment. The existing X development and production apps have app-only Bearer Tokens but do not yet have OAuth 2.0 user authentication settings.

## Root cause

- Development deployment `ceaseless-bobcat-587` has no environment variables.
- Production deployment `agile-spaniel-476` has only `SITE_URL`.
- X apps `yappers-dev` and `yappers-app-prod` show OAuth 2.0 as not set up.
- The first admin must sign in through X before the app can derive the account's stable numeric X ID.

## Proposed solution

1. Configure the existing X development app as a confidential web app with the exact development callback.
2. Configure the existing X production app as a confidential web app with the exact custom-domain callbacks.
3. Generate separate Convex Auth signing-key pairs for development and production.
4. Set the matching auth, X, admin, and Bearer Token values on each exact Convex deployment without exposing secrets in source or logs.
5. Sign in as `@waynesutton`, derive the stable numeric X ID, and use it for `ADMIN_X_USER_IDS` on both deployments.
6. Verify sign-in, admin authorization, X profile lookup, deep routes, and both live origins. Do not submit an operator-only join request or add the admin to the production board unless separately requested.

The supplied email `wayne@convex.dev` is not an admin credential in this X-only auth design; it is recorded for operator context but will not be added to an unsupported email/password flow.

## Files to change

- `prds/2026-08-15-dev-production-auth-x-setup.md`
- `docs/SETUP_GUIDE.md` only if the verified live workflow differs from the current guide
- `task.md`
- `changelog.md`
- `files.md`

No application or Convex schema change is planned unless live verification exposes a real code defect.

## Edge cases

- Do not confuse the development and production deployments or reuse signing keys.
- Keep production callbacks on `https://friendsofconvex.dev`, not the default production `.convex.site` origin.
- Keep the development callback on `https://ceaseless-bobcat-587.convex.site`.
- Never print or commit X secrets, Bearer Tokens, private keys, or deployment keys.
- Do not replace an existing admin allowlist entry if one appears during setup.
- X callback URLs require exact matching and no trailing slash.
- Browser login, 2FA, CAPTCHA, or one-time secret-generation confirmations may require operator handoff.

## Verification steps

- Confirm environment-variable names separately on dev and production.
- Run lint, TypeScript, the X Account Activity regression suite, and the production build with Node 24.
- Complete X sign-in on both `/join` routes.
- Confirm `@waynesutton` is authenticated and allowlisted on both `/admin` routes.
- Preview `@waynesutton` through the X import lookup without writing a production profile.
- Direct-load `/about` on both live origins to verify SPA fallback.
- Recheck final Convex environment-variable names without printing values.

## Task completion log

- 2026-08-15 06:42 UTC — Audited the local project, the setup guide, the live Convex environment-variable names, and the existing X development/production apps. No external configuration changed yet.
- 2026-08-15 07:15 UTC — Configured separate confidential X OAuth apps and Bearer Tokens, generated separate Convex Auth signing pairs, set all seven required environment-variable names on both deployments, and allowlisted the stable numeric ID for `@waynesutton`.
- 2026-08-15 07:15 UTC — Verified production and development X sign-in, admin access, and profile lookup. Production backend deployment and development static upload passed; dev `/`, `/join`, and `/about` return `200`, and production `/about` loads directly.
- 2026-08-15 07:15 UTC — `npm run check` and `npm run test:x-account-activity` passed under Node 24. Replaced the last visible `tracked` import status with `Already on this board.`
