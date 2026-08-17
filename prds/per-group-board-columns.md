# Per group leaderboard column settings

Created: 2026-08-17 05:52 UTC
Last Updated: 2026-08-17 05:58 UTC
Status: Done

## Problem

Every group board shows the same Posts / Engagements / Impressions columns
picked in the global Board settings "Yappers view columns" fieldset. An admin
cannot show impressions on the Convex Team board while keeping the public
Yappers board on posts only.

## Root cause

Group boards reuse the yappers table markup, and `Leaderboard.tsx` reads one
global `display.yappersColumns` for every non Convex board.

## Proposed solution

An optional `columns` object on the group document
(`{ posts, engagements, impressions }` booleans). Missing means inherit the
global Yappers view columns, so existing groups change nothing and no
migration runs. Each group card in `/admin/groups` gets a "Board columns"
fieldset styled like Board settings, with a "Use board defaults" reset that
clears the override. The public board resolves the active group's override
before falling back to the global setting.

## Files to change

- `convex/schema.ts` — optional `columns` object on `groups`.
- `convex/groups.ts` — `columns` in the public and admin validators and list
  queries; `update` accepts `columns` (null clears, at least one column must
  stay on, same rule as the global setting).
- `src/components/Leaderboard.tsx` — group mode uses
  `activeGroup.columns ?? display.yappersColumns`.
- `src/components/GroupsPanel.tsx` — Board columns fieldset per group card
  with the defaults reset.
- `src/pages/AdminDocsPage.tsx` — one line in the Groups section.

## Edge cases

- All three toggles off: rejected server side with the same message pattern
  as Board settings; the card shows the error in its feedback line.
- Changing the global yappers columns still updates every group without an
  override, since inheritance resolves at read time.
- Sorting by a column a group hides falls back to rank order through the
  existing `sortKeyVisibility` logic, which now reads the resolved columns.
- The Convex mentions board is untouched; overrides only apply to the
  yappers style table that group boards render.

## Verification

- `npx tsc --noEmit` and `npx vitest run` clean.
- `npx convex dev` pushes the schema without a migration.
- Manual: toggle a column on one group, confirm the group board reflows and
  the Yappers board does not; reset to defaults and confirm inheritance.

## Task completion log

- 2026-08-17 05:52 UTC — PRD written, implementation started.
- 2026-08-17 05:58 UTC — Schema, groups mutation and queries, Leaderboard
  resolution, GroupsPanel fieldset, admin docs line, and docs sync done.
  `npx tsc --noEmit` and `npx vitest run` (27 tests) clean; Convex push ready.
