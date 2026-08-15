# Mobile X login UX

Created: 2026-08-15 21:34 UTC
Last Updated: 2026-08-15 21:41 UTC
Status: Done

## Problem

On phones, tapping Continue with X can leave people stranded. Two paths fail:

1. Mobile Safari or Chrome opens `https://x.com/i/oauth2/authorize`, iOS
   Universal Links intercept the URL, and the X app opens. The person
   approves inside the app, but the callback lands in a browser context that
   never held the OAuth cookies. They come back signed out with no message.
2. Someone opens `/join` from a post inside the X app. The in-app WebView
   starts the OAuth flow in a sandboxed session, and the first attempt
   usually fails silently.

X never excluded `/i/oauth2/authorize` from its Apple App Site Association
file, so the interception is on X's side and cannot be fixed from this app.

## Root cause

The site correctly uses the web OAuth 2.0 Authorization Code flow with PKCE
through Convex Auth. The failure is UX, not auth: no in-app browser
detection, no guidance to stay in the browser, no message after a failed
round trip, and no busy state on the sign-in button.

On failure the Convex Auth callback redirects back to `redirectTo` with no
query parameter at all (verified in
`@convex-dev/auth/dist/server/implementation/index.js`), so failure must be
detected client side with a sessionStorage flag set before the redirect.

## Proposed solution

1. `src/lib/browserEnvironment.ts`: best-effort X in-app WebView detection
   from the user agent, a coarse-pointer mobile check, and sessionStorage
   flag helpers for sign-in attempts (wrapped in try/catch for private
   mode).
2. `JoinBoard`: when the visitor is signed out inside the X app browser,
   show open-in-Safari/Chrome instructions above a still-working button.
   On other mobile browsers show one hint line: stay in this browser. Add a
   busy state to Continue with X and set the attempt flag before
   redirecting. When the visitor returns unauthenticated with a fresh flag,
   show a retry message once.
3. `AdminGate`: same busy state, attempt flag, retry message, and a quiet
   mobile hint. No instruction block since admins are mostly on desktop.
4. `globals.css`: small styles for the instruction block and hint line
   using existing tokens.

No changes to `convex/auth.ts`, callbacks, scopes, `SITE_URL`, X app
console settings, share intents, or the gift sender OAuth flow.

## Files to change

- `src/lib/browserEnvironment.ts` (new)
- `src/components/JoinBoard.tsx`
- `src/components/AdminGate.tsx`
- `src/globals.css`

## Edge cases

- UA detection misfires: the button stays functional; only copy changes.
- User cancels on the X consent screen: returns with no param; the flag
  message covers it and clears after one render.
- Flag older than ten minutes: ignored and cleared.
- sessionStorage unavailable: helpers no-op, current behavior remains.
- Convex Auth is exchanging `?code=` on return: `isLoading` is true, so the
  retry message cannot fire early.

## Verification steps

1. `npm run check` (lint, tsc, build) passes.
2. Desktop `/join` and `/admin` sign-in states render unchanged.
3. Devtools UA override with `Twitter for iPhone` shows the in-app
   instructions on `/join`.
4. Setting the attempt flag manually and reloading signed out shows the
   retry message once, then it clears.

## References

- X authentication overview: https://docs.x.com/fundamentals/authentication/overview
- X OAuth 2.0 Authorization Code with PKCE: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
- X API overview: https://docs.x.com/x-api/overview
- Convex Auth OAuth configuration: https://labs.convex.dev/auth/config/oauth
- NextAuth issue on the X AASA interception: https://github.com/nextauthjs/next-auth/issues/5747

## Task completion log

- 2026-08-15 21:34 UTC Plan verified against a clean working tree; components unchanged since planning.
- 2026-08-15 21:37 UTC Helper, JoinBoard, AdminGate, and CSS changes landed. Switched failure detection from a setState-in-effect to a consume-once lazy useState initializer after the repo's react-hooks lint rejected the effect version; the failure message is now derived at render time.
- 2026-08-15 21:41 UTC Verified. `npm run check` passes. Browser: desktop `/join` and `/admin` unchanged; `Twitter for iPhone` UA shows the in-app instruction card with the button still enabled; a seeded attempt flag shows the retry message once, consumes the flag, and clears on the next load.
