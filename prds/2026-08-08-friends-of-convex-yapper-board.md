# Friends of Convex Yapper Board

- Created: 2026-08-08T07:21:29Z
- Status: Local build complete; auth and publication deferred
- Delivery: Local-first Codex Site with an accountless Convex Agent Mode backend

## Goal

Build a people-only leaderboard for Friends of Convex that ranks curated X accounts by public post impressions over a rolling seven-day window.

## Audience and jobs

- A Convex community member can see who is creating momentum, search the list, open an X profile, and share the board or an individual rank.
- A temporary unauthenticated administrator can add, archive, restore, and refresh X handles from `/admin` while the product is being built.
- A future authenticated administrator can protect the same route and mutations with Convex Auth without changing the leaderboard data model.

## Scope

- People only; no company list or company tabs.
- Realtime Convex-backed leaderboard and admin management.
- Rolling seven-day X metrics with daily scheduled refresh and manual refresh.
- Search, share/copy links, X share intent, active/inactive management, and footer pagination.
- `/about` methodology and a setup guide that separates browser configuration from Convex secrets.
- Cohere-inspired warm editorial visual system with a single coral signal accent.
- Responsive, keyboard-accessible states for loading, empty data, missing API key, success, and error.

## Data model

- `profiles`: curated X handles, public profile metadata, current seven-day totals, sync state, and active status.
- `snapshots`: dated metric snapshots for future rank-change and trend views.

## External services

- Convex owns durable data, queries, mutations, actions, and schedules.
- X API is optional during local setup. An app Bearer Token will live only in the Convex deployment environment.
- Context.dev is not required for the Friends of Convex board because the theme is fixed. Its API is documented as an optional future capability for branded editions.

## Security staging

- Phase 1: `/admin` and admin functions are intentionally open for local development and visibly labeled as such.
- Phase 2: add Convex Auth, require identity in admin functions, and protect the admin route before any public publication.
- X and Context.dev keys must never be added to Codex Sites public environment variables or browser code.

## Acceptance criteria

- Type-safe Convex validators and indexed queries pass a local Convex push.
- Add, archive, restore, and manual refresh flows work against local Convex data.
- Missing X credentials produce a useful status instead of a crash or fabricated metrics.
- Homepage search, share actions, profile links, and pagination work on desktop and mobile.
- Lint, TypeScript, production build, and project verification pass.
- Setup documentation explains the X API requirement, exact key location, local versus production configuration, auth follow-up, and publishing boundary.

## Deferred

- Convex Auth implementation.
- Public Codex Sites publication and Convex production deployment.
- Context.dev-powered multi-brand editions and TV mode.
- Historical charts beyond stored snapshots.
