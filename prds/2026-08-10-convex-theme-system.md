# Convex-inspired theme system

- Created: `2026-08-10T02:11:37Z`
- Status: In progress

## Goal

Make a new Convex.dev-inspired visual theme the default across the Friends of
Convex site while preserving the existing warm studio design as a complete,
selectable alternate theme.

## Product requirements

- Add a compact, accessible theme switcher to the public header.
- Use `Convex` and `Studio` as clear user-facing theme names.
- Persist the visitor's selection locally and avoid a theme flash on reload.
- Use the supplied official Convex logo files and racing-line artwork.
- Apply the new theme to the leaderboard, About, Join, Admin, Setup, Gift
  Studio, private gift pass, and public share-card routes.
- Preserve all current data, auth, leaderboard sorting, sharing, pagination,
  admin, gift, and webhook behavior.
- Keep the existing studio theme available without visual regressions.

## Visual direction

- Default theme: dark plum and cream editorial bands inspired by Convex.dev.
- Signature: orange, red, magenta, and yellow racing lines used as structural
  framing rather than decoration on every card.
- Typography: heavy grotesk display, calm sans body, compact mono labels.
- Depth: flat section composition with raised dark tool and data surfaces.
- Controls: pill actions, visible focus states, 44px minimum hit targets.
- Motion: short interface feedback only, with reduced-motion support.

## Accessibility and responsive requirements

- The theme control must expose its current state and next action.
- Both themes must maintain readable contrast and visible keyboard focus.
- The header must remain usable at 320px without hiding primary destinations.
- Data tables must retain the existing compact mobile sort controls.
- Theme selection must work when local storage is unavailable.

## Verification

- Run lint, TypeScript, and the production Vinext build.
- Verify both theme values render on every route through static route review.
- Check the header and core leaderboard at desktop and mobile widths.
- Confirm no visible copy uses the banned word `tracked`.
- Do not publish until fresh public deployment approval is received.
