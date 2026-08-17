import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./authz";

// Which metric columns the public leaderboard shows in each mode. Admins
// toggle these from Board settings; the board reads them live. A missing
// singleton doc means everything is visible.

const SETTINGS_KEY = "board";

const yappersColumnsValidator = v.object({
  posts: v.boolean(),
  engagements: v.boolean(),
  impressions: v.boolean(),
});

const convexColumnsValidator = v.object({
  convexPosts: v.boolean(),
  shareOfPosts: v.boolean(),
  convexImpressions: v.boolean(),
  convexEngagements: v.boolean(),
  weeklyChange: v.boolean(),
});

const displayValidator = v.object({
  yappersColumns: yappersColumnsValidator,
  convexColumns: convexColumnsValidator,
  showConvexTab: v.boolean(),
});

export const DEFAULT_DISPLAY = {
  yappersColumns: { posts: true, engagements: true, impressions: true },
  convexColumns: {
    convexPosts: true,
    shareOfPosts: true,
    convexImpressions: true,
    convexEngagements: true,
    weeklyChange: true,
  },
  showConvexTab: true,
};

export const getBoardDisplay = query({
  args: {},
  returns: displayValidator,
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("boardDisplaySettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    if (!settings) return DEFAULT_DISPLAY;
    return {
      yappersColumns: settings.yappersColumns,
      convexColumns: settings.convexColumns,
      // Settings saved before the field existed keep the pill visible.
      showConvexTab: settings.showConvexTab ?? true,
    };
  },
});

export const setBoardDisplay = mutation({
  args: {
    yappersColumns: yappersColumnsValidator,
    convexColumns: convexColumnsValidator,
    showConvexTab: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Never let a mode render with zero metric columns.
    if (!Object.values(args.yappersColumns).some(Boolean)) {
      throw new Error("Keep at least one column visible in the Yappers view.");
    }
    if (!Object.values(args.convexColumns).some(Boolean)) {
      throw new Error(
        "Keep at least one column visible in the Convex mentions view.",
      );
    }

    const existing = await ctx.db
      .query("boardDisplaySettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    const doc = {
      key: SETTINGS_KEY,
      yappersColumns: args.yappersColumns,
      convexColumns: args.convexColumns,
      showConvexTab: args.showConvexTab ?? existing?.showConvexTab ?? true,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.replace("boardDisplaySettings", existing._id, doc);
    } else {
      await ctx.db.insert("boardDisplaySettings", doc);
    }
    return null;
  },
});
