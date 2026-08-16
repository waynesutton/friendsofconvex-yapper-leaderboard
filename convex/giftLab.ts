import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireAdmin } from "./authz";
import { fourthwallGiftStatusValidator } from "./gifts";

// Gift lab links live 7 days when the admin checks the expiry box, matching
// the studio's hard cap. Unchecked links never expire.
export const GIFT_LAB_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const giftLabStatusValidator = v.union(
  v.literal("provisioning"),
  v.literal("ready"),
  v.literal("opened"),
  v.literal("revealed"),
  v.literal("redeemed"),
  v.literal("cancelled"),
  v.literal("error"),
);

const giftLabLinkValidator = v.object({
  _id: v.id("giftLabLinks"),
  _creationTime: v.number(),
  fullName: v.string(),
  token: v.string(),
  fourthwallProductId: v.string(),
  fourthwallPackageId: v.union(v.string(), v.null()),
  fourthwallGiftId: v.union(v.string(), v.null()),
  fourthwallUrl: v.union(v.string(), v.null()),
  fourthwallStatus: fourthwallGiftStatusValidator,
  status: giftLabStatusValidator,
  expiresAt: v.union(v.number(), v.null()),
  createdByUserId: v.id("users"),
  openedAt: v.union(v.number(), v.null()),
  revealedAt: v.union(v.number(), v.null()),
  fourthwallClickedAt: v.union(v.number(), v.null()),
  redeemedAt: v.union(v.number(), v.null()),
  revokedAt: v.union(v.number(), v.null()),
  syncError: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// Lab link plus the shelf's product name so the log reads like the studio.
const giftLabListItemValidator = v.object({
  ...giftLabLinkValidator.fields,
  productName: v.union(v.string(), v.null()),
});

export const listLinksAdmin = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(giftLabListItemValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 200);
    const links = await ctx.db
      .query("giftLabLinks")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
    return await Promise.all(
      links.map(async (link) => {
        const preset = await ctx.db
          .query("giftProductPresets")
          .withIndex("by_fourthwall_product_id", (q) =>
            q.eq("fourthwallProductId", link.fourthwallProductId),
          )
          .unique();
        return { ...link, productName: preset?.productName ?? preset?.label ?? null };
      }),
    );
  },
});

// Closes the link without deleting it. Idempotent.
export const revokeLinkAdmin = mutation({
  args: { labLinkId: v.id("giftLabLinks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const link = await ctx.db.get("giftLabLinks", args.labLinkId);
    if (!link || link.revokedAt !== null) return null;
    const now = Date.now();
    await ctx.db.patch("giftLabLinks", args.labLinkId, {
      revokedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

// Permanently removes the link; the recipient page dies with it. Idempotent.
export const deleteLinkAdmin = mutation({
  args: { labLinkId: v.id("giftLabLinks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const link = await ctx.db.get("giftLabLinks", args.labLinkId);
    if (link) await ctx.db.delete("giftLabLinks", args.labLinkId);
    return null;
  },
});

const closedLabPortalValidator = v.object({
  state: v.literal("closed"),
  reason: v.union(
    v.literal("invalid"),
    v.literal("expired"),
    v.literal("revoked"),
    v.literal("cancelled"),
  ),
  fullName: v.union(v.string(), v.null()),
});

const activeLabPortalValidator = v.object({
  state: v.literal("active"),
  fullName: v.string(),
  status: giftLabStatusValidator,
  expiresAt: v.union(v.number(), v.null()),
  redeemedAt: v.union(v.number(), v.null()),
  revealed: v.boolean(),
});

// Recipient page state. Like gifts.getPortal, the private Fourthwall URL
// never travels through this query; the reveal mutations return it with
// server time expiry checks. The client supplied now only feeds the display.
export const getLabPortal = query({
  args: { token: v.string(), now: v.number() },
  returns: v.union(closedLabPortalValidator, activeLabPortalValidator),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("giftLabLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (!link) {
      return { state: "closed" as const, reason: "invalid" as const, fullName: null };
    }
    if (link.revokedAt !== null) {
      return { state: "closed" as const, reason: "revoked" as const, fullName: link.fullName };
    }
    // Redeemed links keep their thank-you view even after the cutoff.
    const expired = link.expiresAt !== null && link.expiresAt <= args.now;
    if (expired && link.status !== "redeemed") {
      return { state: "closed" as const, reason: "expired" as const, fullName: link.fullName };
    }
    if (link.status === "cancelled") {
      return { state: "closed" as const, reason: "cancelled" as const, fullName: link.fullName };
    }
    return {
      state: "active" as const,
      fullName: link.fullName,
      status: link.status,
      expiresAt: link.expiresAt,
      redeemedAt: link.redeemedAt,
      revealed: link.revealedAt !== null,
    };
  },
});

// Shared guard for the recipient mutations: token must resolve to an open
// link, with expiry enforced on server time.
async function activeLabLinkForToken(
  ctx: MutationCtx,
  token: string,
): Promise<Doc<"giftLabLinks">> {
  const link = await ctx.db
    .query("giftLabLinks")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!link) throw new Error("This gift link is not valid.");
  if (link.revokedAt !== null) throw new Error("This gift link was closed.");
  if (link.expiresAt !== null && link.expiresAt <= Date.now()) {
    throw new Error("This gift link has expired.");
  }
  if (link.status === "cancelled") {
    throw new Error("This Fourthwall gift was cancelled.");
  }
  return link;
}

export const recordLabOpen = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await activeLabLinkForToken(ctx, args.token);
    if (link.openedAt !== null) return null;
    const now = Date.now();
    await ctx.db.patch("giftLabLinks", link._id, {
      openedAt: now,
      status: link.status === "ready" ? "opened" : link.status,
      updatedAt: now,
    });
    return null;
  },
});

export const revealLab = mutation({
  args: { token: v.string() },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const link = await activeLabLinkForToken(ctx, args.token);
    if (!link.fourthwallUrl) {
      throw new Error("Your Fourthwall gift link is not ready yet.");
    }
    if (link.revealedAt === null) {
      const now = Date.now();
      await ctx.db.patch("giftLabLinks", link._id, {
        revealedAt: now,
        status: link.status === "redeemed" ? "redeemed" : "revealed",
        updatedAt: now,
      });
    }
    return { url: link.fourthwallUrl };
  },
});

export const recordLabFourthwallClick = mutation({
  args: { token: v.string() },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const link = await activeLabLinkForToken(ctx, args.token);
    if (!link.fourthwallUrl || link.revealedAt === null) {
      throw new Error("Reveal your gift before opening Fourthwall.");
    }
    if (link.fourthwallClickedAt === null) {
      const now = Date.now();
      await ctx.db.patch("giftLabLinks", link._id, {
        fourthwallClickedAt: now,
        updatedAt: now,
      });
    }
    return { url: link.fourthwallUrl };
  },
});

// Written by giftActions.createLabLink before the Fourthwall call so a
// provisioning failure still leaves an inspectable row.
export const createProvisioningLabLink = internalMutation({
  args: {
    fullName: v.string(),
    fourthwallProductId: v.string(),
    token: v.string(),
    expiresAt: v.union(v.number(), v.null()),
    createdByUserId: v.id("users"),
  },
  returns: v.id("giftLabLinks"),
  handler: async (ctx, args) => {
    const fullName = args.fullName.trim();
    const productId = args.fourthwallProductId.trim();
    if (!fullName || fullName.length > 80) {
      throw new Error("Enter the person's full name (up to 80 characters).");
    }
    if (!productId || productId.length > 120) {
      throw new Error("Enter a valid Fourthwall product ID.");
    }
    const now = Date.now();
    return await ctx.db.insert("giftLabLinks", {
      fullName,
      token: args.token,
      fourthwallProductId: productId,
      fourthwallPackageId: null,
      fourthwallGiftId: null,
      fourthwallUrl: null,
      fourthwallStatus: "pending",
      status: "provisioning",
      expiresAt: args.expiresAt,
      createdByUserId: args.createdByUserId,
      openedAt: null,
      revealedAt: null,
      fourthwallClickedAt: null,
      redeemedAt: null,
      revokedAt: null,
      syncError: null,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const finalizeLabLink = internalMutation({
  args: {
    labLinkId: v.id("giftLabLinks"),
    packageId: v.string(),
    giftId: v.string(),
    url: v.string(),
    fourthwallStatus: fourthwallGiftStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await ctx.db.get("giftLabLinks", args.labLinkId);
    if (!link) throw new Error("Gift lab link not found.");
    if (link.status !== "provisioning") return null;
    await ctx.db.patch("giftLabLinks", args.labLinkId, {
      fourthwallPackageId: args.packageId,
      fourthwallGiftId: args.giftId,
      fourthwallUrl: args.url,
      fourthwallStatus: args.fourthwallStatus,
      status: args.fourthwallStatus === "available" ? "ready" : "error",
      syncError: null,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const markLabLinkError = internalMutation({
  args: { labLinkId: v.id("giftLabLinks"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("giftLabLinks", args.labLinkId, {
      status: "error",
      syncError: args.message.slice(0, 500),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getLabLinkForSync = internalQuery({
  args: { labLinkId: v.id("giftLabLinks") },
  returns: v.union(giftLabLinkValidator, v.null()),
  handler: async (ctx, args) => await ctx.db.get("giftLabLinks", args.labLinkId),
});

// Applies the latest Fourthwall giveaway status after a manual check.
export const applyLabLinkStatus = internalMutation({
  args: {
    labLinkId: v.id("giftLabLinks"),
    fourthwallStatus: fourthwallGiftStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await ctx.db.get("giftLabLinks", args.labLinkId);
    if (!link) return null;
    const now = Date.now();
    const patch: Partial<Doc<"giftLabLinks">> = {
      fourthwallStatus: args.fourthwallStatus,
      syncError: null,
      updatedAt: now,
    };
    if (args.fourthwallStatus === "redeemed") {
      patch.status = "redeemed";
      patch.redeemedAt = link.redeemedAt ?? now;
    } else if (args.fourthwallStatus === "cancelled") {
      patch.status = "cancelled";
    }
    await ctx.db.patch("giftLabLinks", args.labLinkId, patch);
    return null;
  },
});
