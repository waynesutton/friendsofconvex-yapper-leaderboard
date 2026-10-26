import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin } from "./authz";
import { CONVEX_BOARD, YAPPERS_BOARD } from "./boardLimits";
import { DEFAULT_DISPLAY } from "./boardSettings";
import { buildBoardSnapshot, insertBoardShare } from "./boardShares";
import { isDayKey } from "./rankingDays";
import { boardShareRowValidator } from "./validators";

// Weekly top 10. Every saved daily ranking already covers the last 7 days,
// so a week is one saved day frozen at 10 rows. Fridays capture on their own
// after the morning ranking save; admins can capture any saved day by hand.
// The frozen rows live on a normal boardShares doc (period "week"), so the
// card, /b link, and video all reuse the share pipeline. weeklyTops keeps one
// pointer per board per week.

// Groups are capped at 12 in groups.ts; read a little past that, plus the
// two built in boards.
const BOARD_SCAN_LIMIT = 52;
// Bounds the week list. 14 boards a week keeps about 35 weeks in view.
const WEEK_POINTER_SCAN = 500;
// Bounds the saved day list on the admin page (7 days of history, 14 boards).
const DAY_SCAN_LIMIT = 200;

// Freezes one board's saved day as that week's top 10 and points the week
// at it. Null when the board is internal, hidden, empty, or has no saved
// ranking that day. Repeat captures of an unchanged day reuse the share.
async function captureBoardWeekImpl(
  ctx: MutationCtx,
  board: string,
  day: string,
): Promise<Id<"boardShares"> | null> {
  if (!isDayKey(day)) return null;
  const snapshot = await buildBoardSnapshot(ctx, board, day, { period: "week" });
  if (!snapshot) return null;
  const shareId = await insertBoardShare(ctx, snapshot);

  const now = Date.now();
  const existing = await ctx.db
    .query("weeklyTops")
    .withIndex("by_week_of_and_board", (q) => q.eq("weekOf", day).eq("board", snapshot.board))
    .unique();
  if (existing) {
    await ctx.db.patch("weeklyTops", existing._id, {
      boardLabel: snapshot.boardLabel,
      shareId,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("weeklyTops", {
      board: snapshot.board,
      boardLabel: snapshot.boardLabel,
      weekOf: day,
      shareId,
      updatedAt: now,
    });
  }
  return shareId;
}

// Every board with a saved ranking that day, captured in one transaction.
// Each board reads one saved rows doc, so this stays small.
async function captureWeekImpl(ctx: MutationCtx, day: string): Promise<number> {
  if (!isDayKey(day)) return 0;
  const rankings = await ctx.db
    .query("boardRankings")
    .withIndex("by_day", (q) => q.eq("day", day))
    .take(BOARD_SCAN_LIMIT);
  let captured = 0;
  for (const ranking of rankings) {
    if (await captureBoardWeekImpl(ctx, ranking.board, day)) captured += 1;
  }
  return captured;
}

// Scheduled by boardRankings.captureBoard after a Friday save.
export const captureBoardWeek = internalMutation({
  args: { board: v.string(), day: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await captureBoardWeekImpl(ctx, args.board, args.day);
    return null;
  },
});

// CLI: `npx convex run weeklyTops:captureWeek '{"day":"2026-10-23"}'`.
export const captureWeek = internalMutation({
  args: { day: v.string() },
  returns: v.object({ captured: v.number() }),
  handler: async (ctx, args) => {
    return { captured: await captureWeekImpl(ctx, args.day) };
  },
});

// The Capture week button on /admin/weekly.
export const captureWeekNow = mutation({
  args: { day: v.string() },
  returns: v.object({ captured: v.number() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return { captured: await captureWeekImpl(ctx, args.day) };
  },
});

// Saved days an admin can capture as a week, newest first, with whether a
// week already exists for that day.
export const listCapturableDays = query({
  args: {},
  returns: v.array(
    v.object({ day: v.string(), boardCount: v.number(), captured: v.boolean() }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rankings = await ctx.db
      .query("boardRankings")
      .withIndex("by_day")
      .order("desc")
      .take(DAY_SCAN_LIMIT);
    const counts = new Map<string, number>();
    for (const ranking of rankings) {
      counts.set(ranking.day, (counts.get(ranking.day) ?? 0) + 1);
    }
    const out: Array<{ day: string; boardCount: number; captured: boolean }> = [];
    for (const [day, boardCount] of counts) {
      const week = await ctx.db
        .query("weeklyTops")
        .withIndex("by_week_of_and_board", (q) => q.eq("weekOf", day))
        .first();
      out.push({ day, boardCount, captured: week !== null });
    }
    return out;
  },
});

// Every captured week, newest first.
export const listWeeks = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const pointers = await ctx.db
      .query("weeklyTops")
      .withIndex("by_week_of_and_board")
      .order("desc")
      .take(WEEK_POINTER_SCAN);
    const weeks: Array<string> = [];
    for (const pointer of pointers) {
      if (weeks[weeks.length - 1] !== pointer.weekOf) weeks.push(pointer.weekOf);
    }
    return weeks;
  },
});

const weeklyBoardValidator = v.object({
  board: v.string(),
  boardLabel: v.string(),
  shareId: v.id("boardShares"),
  kind: v.union(v.literal("ranked"), v.literal("legends")),
  metricLabel: v.string(),
  rows: v.array(boardShareRowValidator),
  dataAsOf: v.union(v.number(), v.null()),
  hasVideo: v.boolean(),
});

type WeeklyBoard = {
  board: string;
  boardLabel: string;
  shareId: Id<"boardShares">;
  kind: "ranked" | "legends";
  metricLabel: string;
  rows: Doc<"boardShares">["rows"];
  dataAsOf: number | null;
  hasVideo: boolean;
};

// Live visibility for the week page: a tab or group hidden after the week
// was captured drops off, and groups read their current name and order.
async function visibleBoards(
  ctx: QueryCtx,
): Promise<Map<string, { label: string; order: number }>> {
  const settings = await ctx.db
    .query("boardDisplaySettings")
    .withIndex("by_key", (q) => q.eq("key", "board"))
    .unique();
  const boards = new Map<string, { label: string; order: number }>();
  if (settings?.showYappersTab ?? DEFAULT_DISPLAY.showYappersTab) {
    boards.set(YAPPERS_BOARD, { label: "Yappers", order: -2 });
  }
  if (settings?.showConvexTab ?? DEFAULT_DISPLAY.showConvexTab) {
    boards.set(CONVEX_BOARD, { label: "Convex mentions", order: -1 });
  }
  const groups = await ctx.db.query("groups").withIndex("by_order").take(BOARD_SCAN_LIMIT);
  for (const group of groups) {
    if (!group.visible || (group.internal ?? false)) continue;
    boards.set(group.slug, { label: group.name, order: group.order });
  }
  return boards;
}

// One week's top 10 for every visible board, in pill order.
export const getWeek = query({
  args: { week: v.string() },
  returns: v.union(
    v.object({ weekOf: v.string(), boards: v.array(weeklyBoardValidator) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (!isDayKey(args.week)) return null;
    const pointers = await ctx.db
      .query("weeklyTops")
      .withIndex("by_week_of_and_board", (q) => q.eq("weekOf", args.week))
      .take(BOARD_SCAN_LIMIT);
    if (pointers.length === 0) return null;
    const visible = await visibleBoards(ctx);
    const entries: Array<{ order: number; board: WeeklyBoard }> = [];
    for (const pointer of pointers) {
      const live = visible.get(pointer.board);
      if (!live) continue;
      const share = await ctx.db.get("boardShares", pointer.shareId);
      if (!share) continue;
      entries.push({
        order: live.order,
        board: {
          board: pointer.board,
          boardLabel: live.label,
          shareId: share._id,
          kind: share.kind,
          metricLabel: share.metricLabel,
          rows: share.rows,
          dataAsOf: share.dataAsOf,
          hasVideo: share.videoStorageId !== undefined,
        },
      });
    }
    entries.sort((a, b) => a.order - b.order);
    return { weekOf: args.week, boards: entries.map((entry) => entry.board) };
  },
});
