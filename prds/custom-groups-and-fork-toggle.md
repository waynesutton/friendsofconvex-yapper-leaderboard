# Custom groups, fork toggle, site branding, and X list import

Status: shipped
Created: 2026-08-16 22:45 UTC
Updated: 2026-08-16 22:45 UTC

## Problem

The public board had exactly two hardcoded pills, Yappers and Convex mentions.
There was no way to spotlight a subset of the board (a team, a conference, a
cohort) as its own view. Forks could not hide the Convex mentions tab or
retitle the site without editing source. The Friends of Convex name, header
title, and logo were spread across components, so a rebrand meant a code hunt.

## Requirements

### Custom groups

- Admins create, rename, describe, reorder, show or hide, and delete groups at
  `/admin/groups`. All mutations sit behind the stable ID admin allowlist.
- Membership is many to many. One person can sit in several groups. Removing a
  member from a group never touches their board profile. Deleting a profile
  deletes its memberships. Deleting a group deletes its memberships only.
- Members are added by X handle. Handles not on the board yet are created as
  approved, active profiles with source `x-list` style provenance and are
  picked up by the normal metrics sync.
- Each group can save a public X List id. `syncFromXList` fetches up to 100
  members through the existing app Bearer Token import path, creates missing
  profiles, and upserts memberships. Idempotent and safe to run repeatedly.
  Manual button only; no cron (X List member reads are rate limited to 75
  requests per 15 minutes).
- Group slugs are generated from the name, unique, and never collide with the
  reserved values `impressions` and `convex`. Renaming regenerates the slug.

### Public board pills

- Board selection is `impressions`, `convex`, or a group slug, synced to a
  `?board=` URL parameter so every pill is linkable.
- A group pill renders only when the group is visible and has at least one
  active member. Group views rank with the standard Yappers comparator
  (engagements, impressions, posts) and reuse the Yappers columns, search,
  top filter, and expanded rows.
- The Convex mentions pill renders only while `showConvexTab` is true in board
  display settings (default true; missing field means true, so existing
  deployments do not change). A direct `?board=convex` link with the tab off
  falls back to Yappers.
- The pill strip handles N pills with equal lanes, a sliding thumb, label
  truncation, and horizontal scroll on small screens.

### Site branding

- A `siteSettings` singleton (key `site`) stores optional overrides:
  `siteTitle`, `siteDescription`, `communityName`, `boardName`, `eyebrowText`,
  `headerTitle`, `logoStorageId`. Missing fields fall back to shipped defaults
  in `convex/brandingDefaults.ts`, so an untouched deploy renders exactly the
  production look.
- `getSiteBranding` (public) merges saved values over defaults and resolves
  the logo URL from storage. `setSiteBranding`, `generateLogoUploadUrl`, and
  `resetSiteBranding` require admin. Omitted args keep saved values; an
  emptied field clears back to its default. Replaced or removed logos are
  deleted from storage.
- `/admin/settings` (gear icon in the admin nav) shows a live preview, text
  fields with the defaults as placeholders, PNG or SVG logo upload, and a two
  step reset to defaults.
- Branding flows into the site header lockup, the board heading and share
  text, the document title, the join page copy, and the llms.txt, sitemap.md,
  and robots.txt builders. Static `index.html` meta, favicon, and OG image
  remain manual edits documented in the README fork section.

### Discovery files

- `listPublicDirectory` returns visible groups with active members sorted by
  the board comparator. `buildLlmsTxt` and `buildSitemapMd` add a Groups
  section (name, description, member handles, board link). `buildSitemapXml`
  adds `/?board=slug` URLs. No groups means byte identical output to before.

## Non goals (deferred)

- Scheduled X list re-sync cron
- Per group column settings or group specific Slack digests
- Accent color theming
- Runtime OpenGraph meta (needs SSR or an edge rewrite)

## Verification

- `npx tsc --noEmit` and `npx vitest run` clean.
- Fresh deploy with no groups and untouched settings renders identical board,
  header, and discovery files.
- Toggling the Convex tab off removes the pill and `?board=convex` falls back.
- Creating a group, importing an X list, and renaming it updates the pill,
  counts, slug, llms.txt, and sitemap.md.
- Changing the community name and logo updates the header, board heading,
  document title, share text, and llms.txt in one save; reset restores the
  shipped defaults and deletes the uploaded logo.
