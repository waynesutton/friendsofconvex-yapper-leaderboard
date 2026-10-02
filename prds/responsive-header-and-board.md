# Responsive header and board

Created: 2026-10-02 07:30 UTC
Last Updated: 2026-10-02 07:35 UTC
Status: Done

## Problem

- The admin header packs seven links, a gear, the admin chip, Sign out, and the theme toggle into the 1400px page width. Labels wrap onto two lines ("Board ops", "Mention queue") from about 1200px to 1440px, below 1200px everything hides behind a hamburger, and no link shows which page you are on.
- Tablet (761px to 1000px): the board hides the column header but keeps a fixed width grid. Numbers lose their labels, and the Convex view (about 764px of tracks) is clipped by `overflow: hidden`.
- Phones: up to four pills squeeze into equal lanes and truncate ("Convex men…"); five or more wrap into a stack of rows before the board starts.
- Phones: the share toolbar wraps into two rows, the kicker row does not wrap, the convex theme draws a shadow box around the transparent card list, and the last card loses its bottom border.

## Proposed solution

- Header bar stretches to a wider `--header-width` (1680px) in both themes.
- Admin: row one is brand plus identity chip, Sign out, and theme. Row two is a tab strip of every admin page plus Settings, using `NavLink` for an active underline and `aria-current`. It scrolls sideways on narrow screens and keeps the active tab in view, so admins never need the hamburger. The public header keeps its hamburger under 760px.
- The menu open state is keyed to the path, which removes the set state in effect lint error in `SiteHeader.tsx`.
- Board under 1000px uses cards. Tablet shows them in two columns; phones in one.
- Phones: pills become one swipeable row that bleeds to the screen edge, with the active pill scrolled into view. The share toolbar fits one row; under 520px the buttons go icon only with accessible names.

## Files to change

- `src/components/SiteHeader.tsx`, `src/components/Leaderboard.tsx`, `src/globals.css`

## Edge cases

- `/admin/gifts` and `/admin/gifts/guide`: both use `end` matching so only one tab lights up.
- Expanded Convex posts panel, section dividers, and the empty state span both tablet columns.
- Scrolling the active pill or tab into view only moves the strip sideways, never the page.

## Verification

- [x] Browser check at 390px, 820px, and 1440px. No horizontal page overflow at any width, two card columns on tablet, a swipeable pill row on phones, and the active nav link is marked. The admin tab row was checked by injecting its markup, since this browser has no admin session.
- [x] `npx tsc --noEmit`, eslint on touched files, `npx vitest run` (43 passing), `npm run build`.
- [ ] Signed in admin pass on a real phone and in the Studio theme.

## Task completion log

- 2026-10-02 07:30 UTC: PRD written.
- 2026-10-02 07:35 UTC: Header, board cards, phone controls, and the scroll into view hook shipped and verified.
