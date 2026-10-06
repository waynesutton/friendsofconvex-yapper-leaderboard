# Interface design system

Saved 2026-10-02 07:38 UTC. Source of truth for tokens is `src/globals.css`; this file records the decisions and the patterns worth reusing.

## Direction

A broadcast studio scoreboard for Friends of Convex. Warm paper, dark ink, one coral signal color. The board is a live ranking people check on their phone between posts, so it should read fast, feel fun, and never look like a generic admin template.

- Two themes. `convex` is the default (`html[data-theme="convex"]`): cream grid paper, a dark ink header bar, racing stripe accents. `studio` is the base stylesheet: warmer paper, flatter surfaces.
- One accent. `--signal-coral` marks the active thing (active tab, focus, rank highlight). Green and red only carry status.
- Type: Geist for body, Inter for display, Geist Mono for kickers, labels, and numbers.

## Tokens

- Text: `--broadcast-ink`, `--broadcast-ink-soft`, `--caption-ink`, `--quiet-ink`.
- Surfaces: `--studio-paper`, `--studio-paper-deep`, `--studio-sheet`, `--control-inset` for inputs.
- Borders: `--line-whisper`, `--line-standard`, `--line-emphasis`. Low opacity rgba, never solid hex.
- Radius: `--radius-small`, `--radius-medium`, `--radius-large`. Pills and icon buttons use 999px.
- Layout: `--page-gutter` (clamp 20 to 72px), `--page-width` 1400px, `--header-width` 1680px. The header runs wider than the page on purpose.

## Depth

Borders first. Cards and panels use a `--line-standard` border on `--studio-sheet`. Shadows stay subtle and are turned off where a transparent list sits on the page (the board card list in the convex theme).

## Breakpoints

- 1000px and below: the board switches from a grid table to labeled cards.
- 761px to 1000px: cards sit in a two column grid. Full width items (header, dividers, expanded posts panel, empty state) span `1 / -1`.
- 760px and below: phone layout. Public nav collapses into the hamburger, pills become a swipe row.
- 520px and below: share buttons and Sign out go icon only, with accessible names kept on the element.

## Patterns

### Horizontal swipe strip

Used for the admin tab row and the phone board pills. Reuse it for any set of peer destinations that can outgrow the screen.

- `display: flex; flex-wrap: nowrap; overflow-x: auto;` with the scrollbar hidden.
- Bleed to the screen edge on phones: `margin-inline: calc(var(--page-gutter) * -1)` and padding back to the gutter.
- Keep the active item visible with `useScrollActiveIntoView(ref, activeSelector, activeKey)` from `src/lib/useScrollActiveIntoView.ts`. It moves the strip sideways only, never the page, and respects reduced motion.
- `scroll-snap` on phone pills, label width capped (200px) with ellipsis.

### Admin tab row

- Second header row, `order: 3; flex: 1 0 100%`, so it always sits under the brand row.
- Links are `NavLink` with `end`, so nested routes like `/admin/gifts/guide` light only one tab and get `aria-current`.
- 44px tall, active state is a coral inset bottom box shadow, hover uses `--line-standard`. Settings is pushed right with `margin-left: auto`.
- Admins never get the hamburger; the strip replaces it.

### Board toolbar (two rows)

- Row one: kicker left (`flex: 1 1 auto`, chips wrap inside it), tools right on one nowrap line. Row two: pills alone.
- Search is an icon circle that opens into a 44px inset pill (280px, min 170px) and shrinks before anything wraps. Tool buttons never wrap or shrink. While search is open, share buttons fold to icon circles at every width above 760px; from 761px to 1000px they are always icon only.
- Phones: tools take a full row under the kicker; an open search gets its own line with a 16px input.

### Board cards

- The table becomes transparent; each `.table-row` is a card with a `--line-standard` border and `--radius-medium`.
- `.table-row-group { display: contents }` lets the tablet grid place cards from inside row groups.
- Every metric in a card carries its own label row, since the column header is hidden.

### Touch targets

Icon buttons, pills, tabs, and Sign out are at least 44px tall on touch layouts.
