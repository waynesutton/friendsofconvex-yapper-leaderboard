import { v } from "convex/values";
import { requireAdmin } from "./authz";
import {
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";

const intentStateValidator = v.object({
  _id: v.id("giftIntentStates"),
  _creationTime: v.number(),
  xUserId: v.string(),
  profileId: v.union(v.id("profiles"), v.null()),
  handle: v.union(v.string(), v.null()),
  state: v.union(v.literal("active"), v.literal("suppressed")),
  requestedAt: v.union(v.number(), v.null()),
  stoppedAt: v.union(v.number(), v.null()),
  latestEventId: v.string(),
  latestCommand: v.union(v.literal("gift"), v.literal("stop")),
  consumedGiftEventId: v.optional(v.string()),
  consumedGiftAt: v.optional(v.number()),
  consumedByRecipientId: v.optional(v.id("giftRecipients")),
  updatedAt: v.number(),
});

const accountActivityConfigValidator = v.object({
  _id: v.id("xAccountActivityConfigs"),
  _creationTime: v.number(),
  key: v.string(),
  webhookId: v.string(),
  webhookUrl: v.string(),
  senderXUserId: v.string(),
  registeredAt: v.number(),
  subscribedAt: v.union(v.number(), v.null()),
  lastValidatedAt: v.union(v.number(), v.null()),
  lastEventAt: v.union(v.number(), v.null()),
  lastError: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

export const listIntentsAdmin = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(intentStateValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 200), 1), 250);
    return await ctx.db
      .query("giftIntentStates")
      .withIndex("by_updated_at")
      .order("desc")
      .take(limit);
  },
});

export const getIntentForXUserId = internalQuery({
  args: { xUserId: v.string() },
  returns: v.union(intentStateValidator, v.null()),
  handler: async (ctx, args) =>
    await ctx.db
      .query("giftIntentStates")
      .withIndex("by_x_user_id", (q) => q.eq("xUserId", args.xUserId))
      .unique(),
});

export const getAccountActivityConfig = internalQuery({
  args: {},
  returns: v.union(accountActivityConfigValidator, v.null()),
  handler: async (ctx) =>
    await ctx.db
      .query("xAccountActivityConfigs")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique(),
});

export const saveAccountActivityConfig = internalMutation({
  args: {
    webhookId: v.string(),
    webhookUrl: v.string(),
    senderXUserId: v.string(),
    subscribed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("xAccountActivityConfigs")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch("xAccountActivityConfigs", existing._id, {
        webhookId: args.webhookId,
        webhookUrl: args.webhookUrl,
        senderXUserId: args.senderXUserId,
        subscribedAt: args.subscribed
          ? existing.subscribedAt ?? now
          : null,
        lastValidatedAt: now,
        lastError: null,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("xAccountActivityConfigs", {
        key: "primary",
        webhookId: args.webhookId,
        webhookUrl: args.webhookUrl,
        senderXUserId: args.senderXUserId,
        registeredAt: now,
        subscribedAt: args.subscribed ? now : null,
        lastValidatedAt: now,
        lastEventAt: null,
        lastError: null,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const recordAccountActivityError = internalMutation({
  args: { message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("xAccountActivityConfigs")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    if (!existing) return null;
    await ctx.db.patch("xAccountActivityConfigs", existing._id, {
      lastError: args.message.slice(0, 500),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const recordCrcValidation = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("xAccountActivityConfigs")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    if (!existing) return null;
    const now = Date.now();
    await ctx.db.patch("xAccountActivityConfigs", existing._id, {
      lastValidatedAt: now,
      lastError: null,
      updatedAt: now,
    });
    return null;
  },
});

export const applyInboundDm = internalMutation({
  args: {
    eventId: v.string(),
    forUserId: v.string(),
    senderXUserId: v.string(),
    recipientXUserId: v.string(),
    command: v.union(
      v.literal("gift"),
      v.literal("stop"),
      v.literal("ignored"),
    ),
    eventCreatedAt: v.union(v.number(), v.null()),
  },
  returns: v.union(
    v.literal("duplicate"),
    v.literal("wrong_sender"),
    v.literal("ignored"),
    v.literal("gift"),
    v.literal("stop"),
  ),
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("xAccountActivityEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (duplicate) return "duplicate" as const;

    const sender = await ctx.db
      .query("giftSenderConnections")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    if (!sender || sender.xUserId !== args.forUserId) {
      return "wrong_sender" as const;
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_x_user_id", (q) => q.eq("xUserId", args.senderXUserId))
      .unique();
    const receivedAt = Date.now();
    const commandAt = args.eventCreatedAt ?? receivedAt;
    await ctx.db.insert("xAccountActivityEvents", {
      ...args,
      matchedProfileId: profile?._id ?? null,
      receivedAt,
    });

    const config = await ctx.db
      .query("xAccountActivityConfigs")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    if (config) {
      await ctx.db.patch("xAccountActivityConfigs", config._id, {
        lastEventAt: receivedAt,
        lastError: null,
        updatedAt: receivedAt,
      });
    }
    if (args.command === "ignored") return "ignored" as const;

    const existing = await ctx.db
      .query("giftIntentStates")
      .withIndex("by_x_user_id", (q) => q.eq("xUserId", args.senderXUserId))
      .unique();
    const shouldApply =
      !existing ||
      commandAt > existing.updatedAt ||
      (commandAt === existing.updatedAt &&
        args.eventId.localeCompare(existing.latestEventId) > 0);
    if (shouldApply) {
      const nextIntent = {
        profileId: profile?._id ?? existing?.profileId ?? null,
        handle: profile?.handle ?? existing?.handle ?? null,
        state: args.command === "gift" ? ("active" as const) : ("suppressed" as const),
        requestedAt:
          args.command === "gift"
            ? commandAt
            : existing?.requestedAt ?? null,
        stoppedAt:
          args.command === "stop" ? commandAt : existing?.stoppedAt ?? null,
        latestEventId: args.eventId,
        latestCommand: args.command,
        updatedAt: commandAt,
      };
      if (existing) {
        await ctx.db.patch("giftIntentStates", existing._id, nextIntent);
      } else {
        await ctx.db.insert("giftIntentStates", {
          xUserId: args.senderXUserId,
          ...nextIntent,
        });
      }
    }
    if (!shouldApply) return args.command;

    const recipients = await ctx.db
      .query("giftRecipients")
      .withIndex("by_x_user_id_and_created_at", (q) =>
        q.eq("xUserId", args.senderXUserId),
      )
      .order("desc")
      .take(100);
    const eligibleRecipients = recipients.filter(
      (recipient) => recipient.sentAt === null,
    );
    await Promise.all(
      eligibleRecipients.flatMap((recipient) => {
        if (args.command === "stop" && recipient.dmSuppressedAt === null) {
          return [
            ctx.db.patch("giftRecipients", recipient._id, {
              dmSuppressedAt: commandAt,
              dmSuppressionSource: "x_account_activity" as const,
              updatedAt: receivedAt,
            }),
            ctx.db.insert("giftEvents", {
              campaignId: recipient.campaignId,
              recipientId: recipient._id,
              type: "suppressed" as const,
              source: "x" as const,
              detail: `Automatic STOP from X event ${args.eventId}`,
              createdAt: receivedAt,
            }),
          ];
        }
        return [];
      }),
    );
    return args.command;
  },
});
