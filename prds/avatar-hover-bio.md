# Avatar bio peek

Created: 2026-08-16 19:31 UTC
Last Updated: 2026-08-16 19:42 UTC
Status: Done

## Problem

The leaderboard shows a face, a name, and numbers. The X bio for every yapper is already synced and already on every public row (`bio` in `profiles.listLeaderboard`), but the board never renders it. There is no way to learn who a person is without leaving for X.

## Proposed solution

An avatar only hover peek: hover or focus the 44px profile photo and a small studio call sheet card opens with the person's bio, follower count, and an Open on X link. Frontend only. No schema, sync, or query changes.

Design direction: broadcast call sheet, not an X profile clone.

- Coral tally ring plus a small scale on the avatar signals the face is live
- Card on `--studio-sheet` in both themes with `--line-emphasis` border and the metric bubble shadow family
- Name strong, handle in caption ink, bio in 13px body clamped to 3 lines
- `@mentions` and raw URLs in the bio are coral links
- Footer: followers in Geist Mono (only when synced) and an Open on X text link
- No location, website, joined date, following count, or birthday

Interaction copies the `MetricInfo` disclosure pattern with link support:

- Open: 280ms hover delay, immediate on focus, tap toggles for touch
- Close: 120ms mouse leave grace (pointer can reach the card), Escape, outside pointer, scroll
- One open peek at a time (`peekId` state on the leaderboard)
- `position: fixed` from the avatar rect so `.leaderboard-table { overflow: hidden }` cannot clip it; flips above near the viewport bottom and shifts left near the right edge
- Card stays in the DOM next to the avatar so Tab order is avatar, card links, next row

## Files to change

- `src/components/ProfilePeek.tsx` (new): trigger button wrapping `ProfileAvatar` plus the fixed position card
- `src/components/Leaderboard.tsx`: swap the bare `ProfileAvatar` in `.avatar-stack` for `ProfilePeek`; add `peekId` state
- `src/globals.css`: `.profile-peek*` styles with studio tokens, theme safe in both themes
- `task.md`, `changelog.md`, `files.md`

## Edge cases

- Empty bio or pending sync: card still shows name, handle, and Open on X; no fake metadata
- Long bios clamp at 3 lines; the row never grows
- Rank 1 to 3 medals sit outside the trigger hit target
- Convex mode row expand button unchanged
- First and last visible rows: card flips above when there is no room below
- Reduced motion: global rule zeroes the transitions, ring still shows
- Keyboard: avatar is a button with `aria-expanded`; Escape closes

## Verification steps

- Hover an avatar: ring then card with the real bio after ~280ms
- Move the pointer onto the card without it closing; links work
- Tap toggles on a narrow viewport
- Tab to an avatar opens the card; Escape closes; Tab reaches the card links
- Both themes render the cream card
- Empty bio row and unsynced row degrade cleanly
- `npx tsc --noEmit` and `npm run lint` pass

## Task completion log

- 2026-08-16 19:31 UTC — PRD opened.
- 2026-08-16 19:35 UTC — `ProfilePeek.tsx` built, wired into `Leaderboard.tsx`, call sheet styles added to `globals.css`. Positioning writes to the card's style in a layout effect (no state) to satisfy the react-hooks set-state-in-effect lint rule.
- 2026-08-16 19:42 UTC — Verified in the browser: card contents with coral bio links, viewport bounds on first and last rows, one card at a time, Escape close, both themes, empty bio fallback, no console errors. `npx tsc --noEmit` and `npm run lint` pass. Docs synced.
