# X join, imports, and admin auth

- Created: 2026-08-08T09:12:24Z
- Status: Completed 2026-08-08T09:53:32Z
- Auth: Convex Auth with X OAuth only

## Goal

Let an administrator add many people safely and let a person join the Friends of Convex board through a verified X account. Protect every admin read, write, and sync action with the same backend allowlist.

## Product flows

- Bulk paste accepts comma-, whitespace-, or newline-separated X handles, normalizes duplicates, validates up to 100 usernames per X request, previews errors, and imports valid people idempotently.
- X List import accepts a List URL or numeric List ID, previews the first 100 members, reports when the List is larger, and imports only after confirmation.
- `/join` provides one public share URL. A visitor signs in with X, confirms the matched account, and creates one pending membership request.
- `/admin` shows pending requests first and lets an allowlisted admin approve, reject, archive, restore, or sync profiles.
- Existing active profiles remain approved through compatibility defaults.

## Data and authorization

- Add Convex Auth tables to the existing schema.
- Add optional `membershipStatus`, `source`, `authUserId`, `requestedAt`, and `reviewedAt` fields to `profiles` so existing documents remain valid.
- Add indexes for stable X user ID and membership-status lookups.
- Treat an existing profile without `membershipStatus` as approved when it is active.
- Read the signed-in identity inside Convex functions. Never accept identity or admin status from the browser.
- Match administrators against `ADMIN_X_USER_IDS`, a comma-separated Convex environment variable containing stable numeric X user IDs.
- Self-join can create or reactivate only the X account attached to the current Convex Auth session.

## X and Convex Auth integration

- Use `@convex-dev/auth` and the X OAuth provider from Auth.js.
- Request only `tweet.read` and `users.read` for sign-in.
- Keep `AUTH_TWITTER_ID`, `AUTH_TWITTER_SECRET`, JWT keys, the admin allowlist, and `X_BEARER_TOKEN` in Convex environment variables.
- Use `X_BEARER_TOKEN` for batch username validation, X List member lookup, and public metric sync.
- Leave X write scopes disabled because the app manages its own leaderboard rather than changing an X List.

## Acceptance criteria

- Bulk paste handles duplicates, invalid handles, missing users, partial X errors, and a missing API key without creating fake data.
- X List import accepts supported URLs, paginates with an explicit member cap, and reports partial or failed imports.
- `/join` shows clear missing-configuration, signed-out, signed-in, pending, approved, and rejected states.
- `/admin` UI and every admin Convex function reject signed-out or non-allowlisted callers.
- Setup documentation gives a non-developer one ordered path for X developer setup, local and production callback URLs, every Convex environment variable, admin ID discovery, verification, and failure recovery.
- Lint, TypeScript, production build, local Convex push, and security review pass.
