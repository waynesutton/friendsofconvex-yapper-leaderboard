import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./authz";
import { rankBadgeValidator } from "./validators";

// Default medals for ranks 1 to 3 when no custom badge is saved.
const DEFAULT_BADGES: Record<number, string> = {
  1: "\u{1F947}",
  2: "\u{1F948}",
  3: "\u{1F949}",
};

const rankValidator = v.union(v.literal(1), v.literal(2), v.literal(3));
const badgeKindValidator = v.union(
  v.literal("emoji"),
  v.literal("text"),
  v.literal("image"),
);

const BADGE_TEXT_LIMIT = 12;

export const listRankBadges = query({
  args: {},
  returns: v.array(rankBadgeValidator),
  handler: async (ctx) => {
    const badges = [];
    for (const rank of [1, 2, 3]) {
      const custom = await ctx.db
        .query("rankBadges")
        .withIndex("by_rank", (q) => q.eq("rank", rank))
        .unique();
      if (!custom) {
        badges.push({
          rank,
          kind: "emoji" as const,
          value: DEFAULT_BADGES[rank] ?? "",
          imageUrl: null,
          isDefault: true,
        });
        continue;
      }
      const imageUrl = custom.imageStorageId
        ? await ctx.storage.getUrl(custom.imageStorageId)
        : null;
      badges.push({
        rank,
        kind: custom.kind,
        value: custom.value,
        imageUrl,
        isDefault: false,
      });
    }
    return badges;
  },
});

export const generateBadgeUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setRankBadge = mutation({
  args: {
    rank: rankValidator,
    kind: badgeKindValidator,
    value: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const value = (args.value ?? "").trim();
    if (args.kind === "image" && !args.imageStorageId) {
      throw new Error("Upload a PNG or SVG before saving an image badge.");
    }
    if (args.kind !== "image" && !value) {
      throw new Error("Enter an emoji or short text for this badge.");
    }
    if (args.kind === "text" && value.length > BADGE_TEXT_LIMIT) {
      throw new Error(`Badge text is capped at ${BADGE_TEXT_LIMIT} characters.`);
    }

    const existing = await ctx.db
      .query("rankBadges")
      .withIndex("by_rank", (q) => q.eq("rank", args.rank))
      .unique();

    // Drop a replaced uploaded image so storage does not accumulate.
    if (
      existing?.imageStorageId &&
      existing.imageStorageId !== args.imageStorageId
    ) {
      await ctx.storage.delete(existing.imageStorageId);
    }

    const doc = {
      rank: args.rank,
      kind: args.kind,
      value: args.kind === "image" ? "" : value,
      imageStorageId: args.kind === "image" ? args.imageStorageId : undefined,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.replace("rankBadges", existing._id, doc);
    } else {
      await ctx.db.insert("rankBadges", doc);
    }
    return null;
  },
});

export const clearRankBadge = mutation({
  args: { rank: rankValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("rankBadges")
      .withIndex("by_rank", (q) => q.eq("rank", args.rank))
      .unique();
    if (!existing) return null;
    if (existing.imageStorageId) {
      await ctx.storage.delete(existing.imageStorageId);
    }
    await ctx.db.delete("rankBadges", existing._id);
    return null;
  },
});
