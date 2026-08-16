# Project lessons

## 2026-08-09 — Fix the selected runtime, not the package tree

When `predev` reports an unsupported Node version, repeated `npm install` runs
cannot resolve it because npm does not replace the terminal's Node executable.
Inspect `which -a node`, `node --version`, and shell startup files first. If the
user asks for the issue to be fixed, install the supported Node release, update
the active shell PATH, and verify `npm run dev` from a brand-new login shell.

Vinext font behavior can also differ between Node patch releases and worker
runners. Keep Space Grotesk on Vinext's dynamic default loader and verify the
rendered homepage, rather than relying only on a successful production build.

## 2026-08-09 — A Sites-ready folder is not a registered or published Site

A local `.openai/hosting.json` file with no `project_id` does not create an
entry in ChatGPT Sites. Treat the lifecycle as four separate states: local
project, registered Site, saved version, and published deployment. Register
once, persist the returned `project_id`, confirm it with both `get_site` and
`list_sites`, then save and deploy a version. Do not claim a live URL until the
deployment succeeds and the matching `get_site.current_live_url` is nonempty.

Keep production origins distinct. Browser clients use the production
`.convex.cloud` URL, OAuth callbacks and webhooks use `.convex.site`, and
public pages plus `SITE_URL` use the exact deployed `.chatgpt.site` origin.
Never derive or invent that final origin from a requested slug.

## 2026-08-15 — Convex cron strings are UTC, not Pacific

`crons.cron()` schedules in UTC. 8 AM Pacific is `15:00` UTC during PDT and
`16:00` UTC during PST. Keep the minute off `:00`. This board uses `17 15 * * *`
so the daily X refresh lands at 8:17 AM Pacific in daylight time.
Docs: https://docs.convex.dev/scheduling/cron-jobs

## 2026-08-16 — A public number needs its definition next to it

When someone says a metric is "way off", check the definition before the
pipeline. The board's numbers matched the X API exactly; what was wrong was that
"Posts" and "Engagements" are words readers already have their own meanings for.
A resync would have proved nothing.

Two rules that came out of it:

1. Any number shown to the public gets its formula reachable from the same
   screen. A tooltip on the column header, plus a link for the breakpoint where
   the header is hidden.
2. Do not trust an upstream API's filter parameter to mean what it says. X's
   `exclude=replies` still returns self-thread replies, so the timeline had to be
   filtered again locally on `referenced_tweets`. Verify a filter by counting
   what actually came back, not by reading the query string.

Also: whenever UI copy repeats a schedule, treat it as a duplicate of the cron
string and check both. The hero said 08:00 UTC while the cron ran at 15:17 UTC.

