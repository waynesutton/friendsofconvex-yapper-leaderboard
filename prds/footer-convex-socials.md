# Footer Convex socials and open source credit

Created: 2026-08-15 09:27 UTC
Last Updated: 2026-08-15 09:35 UTC
Status: Done

## Problem

The footer GitHub icon points at this board's repo. Convex community links are missing. There is no quiet credit for the open source board itself.

## Proposed solution

Keep Built with Cursor + Convex on the left. Add a small gray "open source yapper board" link to `https://github.com/waynesutton/friendsofconvex-yapper-leaderboard`.

On the right, keep Methodology and Join the board. Add a social icon cluster next to GitHub:

- Convex → https://www.convex.dev/
- X → https://x.com/convex
- LinkedIn → https://www.linkedin.com/company/convex-dev
- YouTube → https://www.youtube.com/@convex-dev
- Discord → https://www.convex.dev/community
- GitHub → https://github.com/get-convex

Use Phosphor brand icons for X, LinkedIn, YouTube, Discord, and GitHub. Phosphor has no Convex mark, so use the official `public/convex/symbol-color.svg` at the same 16px size.

## Files to change

- `src/components/BuiltWithFooter.tsx`
- `src/globals.css`
- `public/built-with/convex-mark.svg` (new)
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Dark Convex footer: source line stays quieter than body footer text; colorful Convex mark does not invert.
- Mobile: text links may stack; social icons stay in a horizontal row with 44px hit areas.
- Icon-only links need aria-labels.

## Verification

- Visual check in Studio and Convex themes, desktop and 375px.
- Confirm each URL and the left repo credit.
- `npm run check`

## Task completion log

- 2026-08-15 09:27 UTC — PRD opened.
- 2026-08-15 09:35 UTC — Footer shipped and verified in both themes. `npm run check` passed.
