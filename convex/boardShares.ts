import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { BOARD_MAX } from "./boardLimits";
import { DEFAULT_DISPLAY } from "./boardSettings";
import { hasSyncedMetrics, loadBoardRows, type PublicLeaderboardRow } from "./profiles";
import { boardShareRowValidator } from "./validators";

// Board share cards. Post on X freezes the top of the tab the visitor is on
// into a boardShares document; /b/:id serves crawler meta for it and
// /og/board/:id.png serves the rendered card. The server picks the rows, so
// a share can never claim a ranking the board does not show.

export const SHARE_ROW_LIMIT = 5;

// Same pool the public board subscribes to. Yappers and Convex mentions pick
// their top rows by impressions before re-sorting, so a smaller pool could
// rank someone the board does not.
const BOARD_POOL = BOARD_MAX;

// Board ids match the `?board=` URL values the leaderboard uses.
export const YAPPERS_BOARD = "impressions";
export const CONVEX_BOARD = "convex";
export const LEGENDS_BOARD = "legends";

export type BoardShareRow = {
  rank: number | null;
  handle: string;
  displayName: string;
  profileImageUrl: string | null;
  value: number | null;
};

export type ShareKind = "ranked" | "legends";

// The value each tab ranks by. Legends have no metric on the card.
export type ShareMetric = "engagements" | "convexPosts" | "none";

// Turns the board's own row order into at most five card rows. Ranks follow
// the board: every unmuted, non-legend row takes the next number, and rows
// still waiting on their first X sync keep their place in the count but are
// left off the card so it never shows a fake zero.
export function buildShareRows(
  rows: Array<PublicLeaderboardRow>,
  metric: ShareMetric,
): Array<BoardShareRow> {
  const out: Array<BoardShareRow> = [];
  if (metric === "none") {
    for (const row of rows) {
      if (!row.legend) continue;
      out.push(toShareRow(row, null, null));
      if (out.length === SHARE_ROW_LIMIT) break;
    }
    return out;
  }
  let rank = 0;
  for (const row of rows) {
    if (row.muted || row.legend) continue;
    rank += 1;
    if (metric === "convexPosts") {
      const count = row.convexPostCount ?? 0;
      if (count <= 0) continue;
      out.push(toShareRow(row, rank, count));
    } else {
      // Engagement boards share the ranking only, never the raw numbers.
      if (!hasSyncedMetrics(row)) continue;
      out.push(toShareRow(row, rank, null));
    }
    if (out.length === SHARE_ROW_LIMIT) break;
  }
  return out;
}

function toShareRow(
  row: PublicLeaderboardRow,
  rank: number | null,
  value: number | null,
): BoardShareRow {
  return {
    rank,
    handle: row.handle,
    displayName: row.displayName,
    profileImageUrl: row.profileImageUrl,
    value,
  };
}

// Synchronous 53 bit string hash (cyrb53). Only used to dedupe identical
// snapshots, never for security.
function cyrb53(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function hashShareRows(args: {
  boardLabel: string;
  rows: Array<BoardShareRow>;
  dataAsOf: number | null;
}): string {
  return cyrb53(JSON.stringify([args.boardLabel, args.dataAsOf, args.rows]));
}

type ResolvedBoard = {
  boardLabel: string;
  kind: ShareKind;
  metric: ShareMetric;
  metricLabel: string;
  rows: Array<PublicLeaderboardRow>;
};

// Resolves a board id the same way the public board does, and refuses
// anything a visitor could not see: hidden tabs, hidden or internal groups.
async function resolveBoard(
  ctx: QueryCtx,
  board: string,
): Promise<ResolvedBoard | null> {
  const settings = await ctx.db
    .query("boardDisplaySettings")
    .withIndex("by_key", (q) => q.eq("key", "board"))
    .unique();
  const showYappersTab = settings?.showYappersTab ?? DEFAULT_DISPLAY.showYappersTab;
  const showConvexTab = settings?.showConvexTab ?? DEFAULT_DISPLAY.showConvexTab;

  if (board === YAPPERS_BOARD) {
    if (!showYappersTab) return null;
    return {
      boardLabel: "Yappers",
      kind: "ranked",
      metric: "engagements",
      metricLabel: "Engagements",
      rows: await loadBoardRows(ctx, { limit: BOARD_POOL }),
    };
  }
  if (board === CONVEX_BOARD) {
    if (!showConvexTab) return null;
    return {
      boardLabel: "Convex mentions",
      kind: "ranked",
      metric: "convexPosts",
      metricLabel: "Convex posts",
      rows: await loadBoardRows(ctx, { limit: BOARD_POOL, mode: "convex" }),
    };
  }
  if (board === LEGENDS_BOARD) {
    return {
      boardLabel: "Legends",
      kind: "legends",
      metric: "none",
      metricLabel: "Undefeated",
      rows: await loadBoardRows(ctx, { limit: BOARD_POOL, mode: "legends" }),
    };
  }
  const group: Doc<"groups"> | null = await ctx.db
    .query("groups")
    .withIndex("by_slug", (q) => q.eq("slug", board))
    .first();
  if (!group || !group.visible || (group.internal ?? false)) return null;
  return {
    boardLabel: group.name,
    kind: "ranked",
    metric: "engagements",
    metricLabel: "Engagements",
    rows: await loadBoardRows(ctx, { limit: BOARD_POOL, groupId: group._id }),
  };
}

// Newest successful sync among the frozen people, for the card's as-of line.
function newestSync(
  source: Array<PublicLeaderboardRow>,
  rows: Array<BoardShareRow>,
): number | null {
  const handles = new Set(rows.map((row) => row.handle));
  let newest: number | null = null;
  for (const row of source) {
    if (!handles.has(row.handle) || row.lastSyncedAt === null) continue;
    newest = newest === null ? row.lastSyncedAt : Math.max(newest, row.lastSyncedAt);
  }
  return newest;
}

// How many handles the post text names, taken from the frozen card rows.
export const SHARE_TEXT_HANDLES = 3;

// Freezes the active tab and returns the share id plus the top handles for
// the post text, or null when the tab is empty or not public. Repeat calls
// with an unchanged ranking return the existing id, so the X card URL stays
// stable and the table stays small.
export const createBoardShare = mutation({
  args: { board: v.string() },
  returns: v.union(
    v.object({ shareId: v.id("boardShares"), topHandles: v.array(v.string()) }),
    v.null(),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{ shareId: Id<"boardShares">; topHandles: Array<string> } | null> => {
    const board = args.board.trim().slice(0, 80);
    if (!board) return null;
    const resolved = await resolveBoard(ctx, board);
    if (!resolved) return null;

    const rows = buildShareRows(resolved.rows, resolved.metric);
    if (rows.length === 0) return null;
    const dataAsOf = newestSync(resolved.rows, rows);
    const contentHash = hashShareRows({
      boardLabel: resolved.boardLabel,
      rows,
      dataAsOf,
    });
    const topHandles = rows
      .slice(0, SHARE_TEXT_HANDLES)
      .map((row) => row.handle);

    const existing = await ctx.db
      .query("boardShares")
      .withIndex("by_board_and_content_hash", (q) =>
        q.eq("board", board).eq("contentHash", contentHash),
      )
      .first();
    if (existing) return { shareId: existing._id, topHandles };

    const shareId = await ctx.db.insert("boardShares", {
      board,
      boardLabel: resolved.boardLabel,
      kind: resolved.kind,
      metricLabel: resolved.metricLabel,
      rows,
      dataAsOf,
      contentHash,
    });
    // Prewarm the card so X's crawler gets a stored PNG on its first fetch.
    await ctx.scheduler.runAfter(0, internal.boardShareRender.renderAndStore, {
      shareId,
    });
    return { shareId, topHandles };
  },
});

const publicShareValidator = v.object({
  _id: v.id("boardShares"),
  board: v.string(),
  boardLabel: v.string(),
  kind: v.union(v.literal("ranked"), v.literal("legends")),
  metricLabel: v.string(),
  rows: v.array(boardShareRowValidator),
  dataAsOf: v.union(v.number(), v.null()),
});

// Public read for the /b/:id redirect page and the crawler meta tags. Takes
// a raw string because the id comes straight from a URL path.
export const getBoardShare = query({
  args: { shareId: v.string() },
  returns: v.union(publicShareValidator, v.null()),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("boardShares", args.shareId);
    if (!id) return null;
    const share = await ctx.db.get("boardShares", id);
    if (!share) return null;
    return {
      _id: share._id,
      board: share.board,
      boardLabel: share.boardLabel,
      kind: share.kind,
      metricLabel: share.metricLabel,
      rows: share.rows,
      dataAsOf: share.dataAsOf,
    };
  },
});

// Snapshot plus the stored image id, for the image route and the renderer.
export const getForRender = internalQuery({
  args: { shareId: v.string() },
  returns: v.union(
    publicShareValidator.extend({
      imageStorageId: v.union(v.id("_storage"), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("boardShares", args.shareId);
    if (!id) return null;
    const share = await ctx.db.get("boardShares", id);
    if (!share) return null;
    return {
      _id: share._id,
      board: share.board,
      boardLabel: share.boardLabel,
      kind: share.kind,
      metricLabel: share.metricLabel,
      rows: share.rows,
      dataAsOf: share.dataAsOf,
      imageStorageId: share.imageStorageId ?? null,
    };
  },
});

// Saves the rendered PNG. If two renders raced, the first one wins and the
// duplicate file is deleted so storage never leaks orphans.
export const saveImage = internalMutation({
  args: { shareId: v.id("boardShares"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const share = await ctx.db.get("boardShares", args.shareId);
    if (!share || share.imageStorageId !== undefined) {
      await ctx.storage.delete(args.storageId);
      return null;
    }
    await ctx.db.patch("boardShares", args.shareId, {
      imageStorageId: args.storageId,
    });
    return null;
  },
});
