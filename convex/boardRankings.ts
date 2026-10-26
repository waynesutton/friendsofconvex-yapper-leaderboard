import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { isAdminViewer } from "./authz";
import { BOARD_MAX, CONVEX_BOARD, LEGENDS_BOARD, YAPPERS_BOARD } from "./boardLimits";
import { DEFAULT_DISPLAY } from "./boardSettings";
import { loadBoardRows, type PublicLeaderboardRow } from "./profiles";
import { isDayKey, isFriday, pacificDay, RANKING_HISTORY_DAYS, shiftDay } from "./rankingDays";
import { readSyncRun } from "./syncRuns";
import { publicLeaderboardRowValidator } from "./validators";

// Saved daily rankings. After every full board pass, each board's ranking is
// frozen under the Pacific day the pass started, and the board's day arrows
// read them back. No X API calls: the rows come from the numbers the sync
// already wrote, through the same loadBoardRows path the live board uses.

// Groups are capped at 12 in groups.ts; read a little past that.
const GROUP_SCAN_LIMIT = 50;

type RankingRow = Doc<"boardRankingRows">["rows"][number];

type RankedBoard = {
  boardLabel: string;
  mode: "default" | "convex";
  groupId?: Id<"groups">;
};

// Resolves a board id to what loadBoardRows needs. `trusted` (capture jobs)
// skips the visitor rules; otherwise hidden tabs, hidden groups, and
// internal groups for non admins resolve to null, matching the live board.
async function resolveRankedBoard(
  ctx: QueryCtx,
  board: string,
  options: { trusted: boolean },
): Promise<RankedBoard | null> {
  if (board === LEGENDS_BOARD) return null;
  if (board === YAPPERS_BOARD || board === CONVEX_BOARD) {
    if (!options.trusted) {
      const settings = await ctx.db
        .query("boardDisplaySettings")
        .withIndex("by_key", (q) => q.eq("key", "board"))
        .unique();
      const shown =
        board === YAPPERS_BOARD
          ? (settings?.showYappersTab ?? DEFAULT_DISPLAY.showYappersTab)
          : (settings?.showConvexTab ?? DEFAULT_DISPLAY.showConvexTab);
      if (!shown) return null;
    }
    return board === YAPPERS_BOARD
      ? { boardLabel: "Yappers", mode: "default" }
      : { boardLabel: "Convex mentions", mode: "convex" };
  }
  const group = await ctx.db
    .query("groups")
    .withIndex("by_slug", (q) => q.eq("slug", board))
    .first();
  if (!group) return null;
  if (!options.trusted) {
    if (!group.visible) return null;
    if ((group.internal ?? false) && !(await isAdminViewer(ctx))) return null;
  }
  return { boardLabel: group.name, mode: "default", groupId: group._id };
}

// Ranks follow the board: every unmuted row takes the next number, so muted
// group members keep their place below the divider with no rank.
export function toRankingRows(rows: Array<PublicLeaderboardRow>): Array<RankingRow> {
  const out: Array<RankingRow> = [];
  let rank = 0;
  for (const row of rows) {
    if (row.legend) continue;
    if (!row.muted) rank += 1;
    out.push({
      profileId: row._id,
      rank: row.muted ? null : rank,
      handle: row.handle,
      normalizedHandle: row.normalizedHandle,
      displayName: row.displayName,
      profileImageUrl: row.profileImageUrl,
      syncStatus: row.syncStatus,
      currentImpressions: row.currentImpressions,
      currentPosts: row.currentPosts,
      currentEngagements: row.currentEngagements,
      currentFollowers: row.currentFollowers,
      lastSyncedAt: row.lastSyncedAt,
      addedAt: row.addedAt,
      muted: row.muted,
      convexPostCount: row.convexPostCount,
      convexImpressions: row.convexImpressions,
      convexEngagements: row.convexEngagements,
      convexScanned: row.convexScanned,
      convexWeeklyChange: row.convexWeeklyChange,
      convexStreak: row.convexStreak,
    });
    if (out.length === BOARD_MAX) break;
  }
  return out;
}

// Back to the shape the board renders. Bios come from the live rows on the
// client, and stored Convex posts only exist for the latest snapshot, so a
// saved day never offers the post expansion.
function toBoardRow(row: RankingRow, capturedAt: number): PublicLeaderboardRow {
  return {
    _id: row.profileId,
    handle: row.handle,
    normalizedHandle: row.normalizedHandle,
    displayName: row.displayName,
    bio: null,
    profileImageUrl: row.profileImageUrl,
    syncStatus: row.syncStatus,
    currentImpressions: row.currentImpressions,
    currentPosts: row.currentPosts,
    currentEngagements: row.currentEngagements,
    currentFollowers: row.currentFollowers,
    lastSyncedAt: row.lastSyncedAt,
    addedAt: row.addedAt,
    updatedAt: capturedAt,
    muted: row.muted,
    convexPostCount: row.convexPostCount,
    convexImpressions: row.convexImpressions,
    convexEngagements: row.convexEngagements,
    convexScanned: row.convexScanned,
    convexPostsStored: 0,
    convexWeeklyChange: row.convexWeeklyChange,
    convexStreak: row.convexStreak,
  };
}

export type SavedRanking = {
  board: string;
  boardLabel: string;
  day: string;
  capturedAt: number;
  dataAsOf: number;
  rows: Array<PublicLeaderboardRow>;
};

// One saved day for a visitor, or null when the board is not visible to
// them or nothing was saved that day. Shared with board shares.
export async function readSavedRanking(
  ctx: QueryCtx,
  board: string,
  day: string,
): Promise<SavedRanking | null> {
  if (!isDayKey(day)) return null;
  const resolved = await resolveRankedBoard(ctx, board, { trusted: false });
  if (!resolved) return null;
  const ranking = await ctx.db
    .query("boardRankings")
    .withIndex("by_board_and_day", (q) => q.eq("board", board).eq("day", day))
    .unique();
  if (!ranking) return null;
  const rows = await ctx.db.get("boardRankingRows", ranking.rowsId);
  if (!rows) return null;
  return {
    board,
    // The live name, so a renamed group reads the same as its pill.
    boardLabel: resolved.boardLabel,
    day,
    capturedAt: ranking.capturedAt,
    dataAsOf: ranking.dataAsOf,
    rows: rows.rows.map((row) => toBoardRow(row, ranking.capturedAt)),
  };
}

// Fans out one capture per board so each transaction reads one board, then
// prunes days past the history window.
export const captureAll = internalMutation({
  args: { runStartedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const day = pacificDay(args.runStartedAt);
    const boards: Array<string> = [YAPPERS_BOARD, CONVEX_BOARD];
    const groups = await ctx.db.query("groups").withIndex("by_order").take(GROUP_SCAN_LIMIT);
    for (const group of groups) {
      if (group.visible) boards.push(group.slug);
    }
    for (const board of boards) {
      await ctx.scheduler.runAfter(0, internal.boardRankings.captureBoard, {
        board,
        day,
        dataAsOf: args.runStartedAt,
      });
    }

    const cutoff = shiftDay(pacificDay(Date.now()), -RANKING_HISTORY_DAYS);
    const stale = await ctx.db
      .query("boardRankings")
      .withIndex("by_day", (q) => q.lt("day", cutoff))
      .take(200);
    for (const ranking of stale) {
      await ctx.db.delete("boardRankingRows", ranking.rowsId);
      await ctx.db.delete("boardRankings", ranking._id);
    }
    return null;
  },
});

// Saves one board for one day. A later pass on the same day (an admin Sync
// everyone) replaces the earlier copy instead of adding a second one.
export const captureBoard = internalMutation({
  args: { board: v.string(), day: v.string(), dataAsOf: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isDayKey(args.day)) return null;
    const resolved = await resolveRankedBoard(ctx, args.board, { trusted: true });
    if (!resolved) return null;
    const rows = toRankingRows(
      await loadBoardRows(ctx, {
        limit: BOARD_MAX,
        mode: resolved.mode,
        groupId: resolved.groupId,
        trusted: true,
      }),
    );
    if (rows.length === 0) return null;

    const now = Date.now();
    const existing = await ctx.db
      .query("boardRankings")
      .withIndex("by_board_and_day", (q) => q.eq("board", args.board).eq("day", args.day))
      .unique();
    if (existing) {
      await ctx.db.patch("boardRankingRows", existing.rowsId, { rows });
      await ctx.db.patch("boardRankings", existing._id, {
        boardLabel: resolved.boardLabel,
        capturedAt: now,
        dataAsOf: args.dataAsOf,
        rowCount: rows.length,
      });
    } else {
      const rowsId = await ctx.db.insert("boardRankingRows", {
        board: args.board,
        day: args.day,
        rows,
      });
      await ctx.db.insert("boardRankings", {
        board: args.board,
        boardLabel: resolved.boardLabel,
        day: args.day,
        capturedAt: now,
        dataAsOf: args.dataAsOf,
        rowCount: rows.length,
        rowsId,
      });
    }
    // Friday's ranking is the week: freeze it as the weekly top 10. Runs
    // after this save commits, so it reads the finished numbers. Internal
    // and hidden boards are refused inside the capture.
    if (isFriday(args.day)) {
      await ctx.scheduler.runAfter(0, internal.weeklyTops.captureBoardWeek, {
        board: args.board,
        day: args.day,
      });
    }
    return null;
  },
});

// CLI seed: `npx convex run boardRankings:captureNow` saves today's boards
// from the last finished pass (or now, before the first tracked pass).
export const captureNow = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const run = await readSyncRun(ctx);
    await ctx.scheduler.runAfter(0, internal.boardRankings.captureAll, {
      runStartedAt: run?.lastFinishedRunStartedAt ?? Date.now(),
    });
    return null;
  },
});

// Drops a permanently removed profile from every saved day. Ranks stay as
// they were captured.
export const scrubProfile = internalMutation({
  args: { profileId: v.id("profiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const rankings = await ctx.db.query("boardRankings").withIndex("by_day").take(500);
    for (const ranking of rankings) {
      const saved = await ctx.db.get("boardRankingRows", ranking.rowsId);
      if (!saved) continue;
      const rows = saved.rows.filter((row) => row.profileId !== args.profileId);
      if (rows.length === saved.rows.length) continue;
      await ctx.db.patch("boardRankingRows", saved._id, { rows });
      await ctx.db.patch("boardRankings", ranking._id, { rowCount: rows.length });
    }
    return null;
  },
});

const savedDayValidator = v.object({
  day: v.string(),
  capturedAt: v.number(),
  dataAsOf: v.number(),
  rowCount: v.number(),
});

// Every saved day for a board, newest first. Light: metadata only. Queries
// never read the clock, so today's copy comes back too and the board drops
// it, since today is the live board.
export const listDays = query({
  args: { board: v.string() },
  returns: v.array(savedDayValidator),
  handler: async (ctx, args) => {
    const board = args.board.trim().slice(0, 80);
    if (!(await resolveRankedBoard(ctx, board, { trusted: false }))) return [];
    const rankings = await ctx.db
      .query("boardRankings")
      .withIndex("by_board_and_day", (q) => q.eq("board", board))
      .order("desc")
      .take(RANKING_HISTORY_DAYS + 2);
    return rankings.map((ranking) => ({
      day: ranking.day,
      capturedAt: ranking.capturedAt,
      dataAsOf: ranking.dataAsOf,
      rowCount: ranking.rowCount,
    }));
  },
});

// One saved day's rows in the live board's shape, or null.
export const getRanking = query({
  args: { board: v.string(), day: v.string() },
  returns: v.union(
    v.object({
      board: v.string(),
      boardLabel: v.string(),
      day: v.string(),
      capturedAt: v.number(),
      dataAsOf: v.number(),
      rows: v.array(publicLeaderboardRowValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args): Promise<SavedRanking | null> => {
    return await readSavedRanking(ctx, args.board.trim().slice(0, 80), args.day);
  },
});
