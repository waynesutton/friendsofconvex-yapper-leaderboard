import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  env,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireAdmin } from "./authz";
import { hasAvailableGiftRequest } from "./xAccountActivityPayload";

export const giftCampaignStatusValidator = v.union(
  v.literal("provisioning"),
  v.literal("active"),
  v.literal("closed"),
  v.literal("error"),
);

export const giftRecipientStatusValidator = v.union(
  v.literal("provisioning"),
  v.literal("ready"),
  v.literal("sent"),
  v.literal("opened"),
  v.literal("revealed"),
  v.literal("redeemed"),
  v.literal("cancelled"),
  v.literal("error"),
);

export const fourthwallGiftStatusValidator = v.union(
  v.literal("pending"),
  v.literal("available"),
  v.literal("redeemed"),
  v.literal("cancelled"),
  v.literal("error"),
);

const giftCampaignValidator = v.object({
  _id: v.id("giftCampaigns"),
  _creationTime: v.number(),
  title: v.string(),
  fourthwallProductId: v.string(),
  fourthwallPackageId: v.union(v.string(), v.null()),
  status: giftCampaignStatusValidator,
  createdByUserId: v.id("users"),
  portalExpiresAt: v.union(v.number(), v.null()),
  lastSyncedAt: v.union(v.number(), v.null()),
  syncError: v.union(v.string(), v.null()),
  archivedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const giftRecipientValidator = v.object({
  _id: v.id("giftRecipients"),
  _creationTime: v.number(),
  campaignId: v.id("giftCampaigns"),
  profileId: v.id("profiles"),
  xUserId: v.string(),
  handle: v.string(),
  displayName: v.string(),
  profileImageUrl: v.union(v.string(), v.null()),
  portalToken: v.string(),
  shareToken: v.string(),
  fourthwallGiftId: v.union(v.string(), v.null()),
  fourthwallUrl: v.union(v.string(), v.null()),
  fourthwallStatus: fourthwallGiftStatusValidator,
  status: giftRecipientStatusValidator,
  consentConfirmedAt: v.number(),
  consentConfirmedByUserId: v.id("users"),
  consentSource: v.optional(
    v.union(v.literal("manual"), v.literal("x_account_activity")),
  ),
  consentEventId: v.optional(v.string()),
  giftNumber: v.optional(v.number()),
  dmSuppressedAt: v.union(v.number(), v.null()),
  dmSuppressionSource: v.optional(
    v.union(v.literal("admin"), v.literal("x_account_activity")),
  ),
  sendAttemptedAt: v.union(v.number(), v.null()),
  sentAt: v.union(v.number(), v.null()),
  xDmEventId: v.union(v.string(), v.null()),
  xDmConversationId: v.union(v.string(), v.null()),
  deliveryError: v.union(v.string(), v.null()),
  openedAt: v.union(v.number(), v.null()),
  revealedAt: v.union(v.number(), v.null()),
  fourthwallClickedAt: v.union(v.number(), v.null()),
  redeemedAt: v.union(v.number(), v.null()),
  revokedAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const giftEventTypeValidator = v.union(
  v.literal("created"),
  v.literal("link_ready"),
  v.literal("send_attempted"),
  v.literal("sent"),
  v.literal("send_failed"),
  v.literal("opened"),
  v.literal("revealed"),
  v.literal("fourthwall_clicked"),
  v.literal("redeemed"),
  v.literal("cancelled"),
  v.literal("suppressed"),
  v.literal("unsuppressed"),
);

const giftEventSourceValidator = v.union(
  v.literal("admin"),
  v.literal("x"),
  v.literal("portal"),
  v.literal("fourthwall_webhook"),
  v.literal("fourthwall_sync"),
);

const senderConnectionValidator = v.object({
  _id: v.id("giftSenderConnections"),
  _creationTime: v.number(),
  key: v.string(),
  xUserId: v.string(),
  username: v.string(),
  displayName: v.string(),
  encryptedAccessToken: v.string(),
  encryptedRefreshToken: v.union(v.string(), v.null()),
  accessTokenExpiresAt: v.number(),
  scope: v.string(),
  connectedByUserId: v.id("users"),
  connectedAt: v.number(),
  updatedAt: v.number(),
});

const campaignProfileValidator = v.object({
  profileId: v.id("profiles"),
  xUserId: v.string(),
  handle: v.string(),
  displayName: v.string(),
  profileImageUrl: v.union(v.string(), v.null()),
  consentConfirmedAt: v.number(),
  consentSource: v.union(
    v.literal("manual"),
    v.literal("x_account_activity"),
  ),
  consentEventId: v.union(v.string(), v.null()),
});

const fourthwallLinkValidator = v.object({
  id: v.string(),
  link: v.string(),
  status: fourthwallGiftStatusValidator,
});

const giftHistoryItemValidator = v.object({
  recipientId: v.id("giftRecipients"),
  campaignId: v.id("giftCampaigns"),
  campaignTitle: v.string(),
  profileId: v.id("profiles"),
  xUserId: v.string(),
  handle: v.string(),
  giftNumber: v.number(),
  status: giftRecipientStatusValidator,
  sentAt: v.union(v.number(), v.null()),
  redeemedAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
});

export const listCampaignsAdmin = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(giftCampaignValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 30), 1), 100);
    return await ctx.db
      .query("giftCampaigns")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

// Archive or restore a dispatch. Archived campaigns leave the sidebar but
// stay in the Dispatches log with their data intact.
export const setCampaignArchived = mutation({
  args: { campaignId: v.id("giftCampaigns"), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaign = await ctx.db.get("giftCampaigns", args.campaignId);
    // Idempotent: archiving a deleted campaign is a no-op.
    if (!campaign) return null;
    await ctx.db.patch("giftCampaigns", args.campaignId, {
      archivedAt: args.archived ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Permanently delete a dispatch: its gift events, recipients (which kills
// their pass and share pages), then the campaign itself.
export const deleteCampaignAdmin = mutation({
  args: { campaignId: v.id("giftCampaigns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaign = await ctx.db.get("giftCampaigns", args.campaignId);
    // Idempotent: deleting an already removed campaign is fine.
    if (!campaign) return null;
    const events = await ctx.db
      .query("giftEvents")
      .withIndex("by_campaign_id_and_created_at", (q) =>
        q.eq("campaignId", args.campaignId),
      )
      .collect();
    for (const event of events) {
      await ctx.db.delete("giftEvents", event._id);
    }
    const recipients = await ctx.db
      .query("giftRecipients")
      .withIndex("by_campaign_id_and_created_at", (q) =>
        q.eq("campaignId", args.campaignId),
      )
      .collect();
    for (const recipient of recipients) {
      await ctx.db.delete("giftRecipients", recipient._id);
    }
    await ctx.db.delete("giftCampaigns", args.campaignId);
    return null;
  },
});

export const listRecipientsAdmin = query({
  args: {
    campaignId: v.id("giftCampaigns"),
    limit: v.optional(v.number()),
  },
  returns: v.array(giftRecipientValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 100), 1), 250);
    return await ctx.db
      .query("giftRecipients")
      .withIndex("by_campaign_id_and_created_at", (q) =>
        q.eq("campaignId", args.campaignId),
      )
      .order("desc")
      .take(limit);
  },
});

// Full text search over a campaign's recipients by handle. Prefix matching on
// the last term gives typeahead behavior while the admin types.
export const searchRecipientsAdmin = query({
  args: {
    campaignId: v.id("giftCampaigns"),
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(giftRecipientValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const term = args.searchTerm.trim().replace(/^@/, "");
    if (!term) return [];
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 100);
    return await ctx.db
      .query("giftRecipients")
      .withSearchIndex("search_handle", (q) =>
        q.search("handle", term).eq("campaignId", args.campaignId),
      )
      .take(limit);
  },
});

const productPresetValidator = v.object({
  _id: v.id("giftProductPresets"),
  _creationTime: v.number(),
  label: v.string(),
  fourthwallProductId: v.string(),
  productName: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
  createdByUserId: v.id("users"),
  createdAt: v.number(),
});

export const listProductPresetsAdmin = query({
  args: {},
  returns: v.array(productPresetValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("giftProductPresets")
      .withIndex("by_created_at")
      .order("desc")
      .take(50);
  },
});

// Written by the giftActions.saveProductPreset action after it looks the
// product up on Fourthwall. Saving the same ID again updates label, name,
// and thumbnail instead of duplicating.
export const upsertProductPreset = internalMutation({
  args: {
    label: v.string(),
    fourthwallProductId: v.string(),
    productName: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    createdByUserId: v.id("users"),
  },
  returns: v.id("giftProductPresets"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("giftProductPresets")
      .withIndex("by_fourthwall_product_id", (q) =>
        q.eq("fourthwallProductId", args.fourthwallProductId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch("giftProductPresets", existing._id, {
        label: args.label,
        productName: args.productName,
        thumbnailUrl: args.thumbnailUrl,
      });
      return existing._id;
    }
    return await ctx.db.insert("giftProductPresets", {
      label: args.label,
      fourthwallProductId: args.fourthwallProductId,
      productName: args.productName,
      thumbnailUrl: args.thumbnailUrl,
      createdByUserId: args.createdByUserId,
      createdAt: Date.now(),
    });
  },
});

export const deleteProductPreset = mutation({
  args: { presetId: v.id("giftProductPresets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const preset = await ctx.db.get("giftProductPresets", args.presetId);
    // Idempotent: deleting an already removed preset is fine.
    if (preset) await ctx.db.delete("giftProductPresets", args.presetId);
    return null;
  },
});

export const listRecentGiftHistoryAdmin = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(giftHistoryItemValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 250), 1), 250);
    const recipients = await ctx.db
      .query("giftRecipients")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
    return await Promise.all(
      recipients.map(async (recipient) => {
        const campaign = await ctx.db.get("giftCampaigns", recipient.campaignId);
        return {
          recipientId: recipient._id,
          campaignId: recipient.campaignId,
          campaignTitle: campaign?.title ?? "Deleted campaign",
          profileId: recipient.profileId,
          xUserId: recipient.xUserId,
          handle: recipient.handle,
          giftNumber: recipient.giftNumber ?? 1,
          status: recipient.status,
          sentAt: recipient.sentAt,
          redeemedAt: recipient.redeemedAt,
          createdAt: recipient.createdAt,
        };
      }),
    );
  },
});

export const listRecipientEventsAdmin = query({
  args: {
    recipientId: v.id("giftRecipients"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("giftEvents"),
      _creationTime: v.number(),
      campaignId: v.id("giftCampaigns"),
      recipientId: v.id("giftRecipients"),
      type: giftEventTypeValidator,
      source: giftEventSourceValidator,
      detail: v.union(v.string(), v.null()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 100);
    return await ctx.db
      .query("giftEvents")
      .withIndex("by_recipient_id_and_created_at", (q) =>
        q.eq("recipientId", args.recipientId),
      )
      .order("desc")
      .take(limit);
  },
});

export const getConfigurationAdmin = query({
  args: {},
  returns: v.object({
    fourthwallConfigured: v.boolean(),
    xDmOAuthConfigured: v.boolean(),
    accountActivityConfigured: v.boolean(),
    webhookConfigured: v.boolean(),
    siteUrlConfigured: v.boolean(),
    sender: v.union(
      v.object({
        xUserId: v.string(),
        username: v.string(),
        displayName: v.string(),
        scope: v.string(),
        accessTokenExpiresAt: v.number(),
        connectedAt: v.number(),
      }),
      v.null(),
    ),
    accountActivity: v.union(
      v.object({
        webhookId: v.string(),
        webhookUrl: v.string(),
        senderXUserId: v.string(),
        subscribedAt: v.union(v.number(), v.null()),
        lastValidatedAt: v.union(v.number(), v.null()),
        lastEventAt: v.union(v.number(), v.null()),
        lastError: v.union(v.string(), v.null()),
      }),
      v.null(),
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [sender, accountActivity] = await Promise.all([
      ctx.db
        .query("giftSenderConnections")
        .withIndex("by_key", (q) => q.eq("key", "primary"))
        .unique(),
      ctx.db
        .query("xAccountActivityConfigs")
        .withIndex("by_key", (q) => q.eq("key", "primary"))
        .unique(),
    ]);
    return {
      fourthwallConfigured: Boolean(
        process.env.FOURTHWALL_API_USERNAME &&
          process.env.FOURTHWALL_API_PASSWORD,
      ),
      xDmOAuthConfigured: Boolean(
        process.env.AUTH_TWITTER_ID &&
          process.env.AUTH_TWITTER_SECRET &&
          process.env.X_DM_TOKEN_ENCRYPTION_KEY,
      ),
      accountActivityConfigured: Boolean(
        env.X_BEARER_TOKEN &&
          env.X_API_KEY &&
          env.X_API_SECRET &&
          env.X_ACCOUNT_ACTIVITY_ACCESS_TOKEN &&
          env.X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET,
      ),
      webhookConfigured: Boolean(process.env.FOURTHWALL_WEBHOOK_SECRET),
      siteUrlConfigured: Boolean(process.env.SITE_URL),
      sender: sender
        ? {
            xUserId: sender.xUserId,
            username: sender.username,
            displayName: sender.displayName,
            scope: sender.scope,
            accessTokenExpiresAt: sender.accessTokenExpiresAt,
            connectedAt: sender.connectedAt,
          }
        : null,
      accountActivity: accountActivity
        ? {
            webhookId: accountActivity.webhookId,
            webhookUrl: accountActivity.webhookUrl,
            senderXUserId: accountActivity.senderXUserId,
            subscribedAt: accountActivity.subscribedAt,
            lastValidatedAt: accountActivity.lastValidatedAt,
            lastEventAt: accountActivity.lastEventAt,
            lastError: accountActivity.lastError,
          }
        : null,
    };
  },
});

const closedPortalValidator = v.object({
  state: v.literal("closed"),
  reason: v.union(
    v.literal("invalid"),
    v.literal("expired"),
    v.literal("revoked"),
    v.literal("cancelled"),
  ),
  handle: v.union(v.string(), v.null()),
  campaignTitle: v.union(v.string(), v.null()),
});

const activePortalValidator = v.object({
  state: v.literal("active"),
  handle: v.string(),
  displayName: v.string(),
  profileImageUrl: v.union(v.string(), v.null()),
  campaignTitle: v.string(),
  status: giftRecipientStatusValidator,
  portalExpiresAt: v.union(v.number(), v.null()),
  redeemedAt: v.union(v.number(), v.null()),
  revealed: v.boolean(),
  fourthwallUrl: v.union(v.string(), v.null()),
  shareToken: v.string(),
});

export const getPortal = query({
  args: { token: v.string(), now: v.number() },
  returns: v.union(closedPortalValidator, activePortalValidator),
  handler: async (ctx, args) => {
    const recipient = await ctx.db
      .query("giftRecipients")
      .withIndex("by_portal_token", (q) => q.eq("portalToken", args.token))
      .unique();
    if (!recipient) {
      return {
        state: "closed" as const,
        reason: "invalid" as const,
        handle: null,
        campaignTitle: null,
      };
    }

    const campaign = await ctx.db.get("giftCampaigns", recipient.campaignId);
    if (!campaign) {
      return {
        state: "closed" as const,
        reason: "invalid" as const,
        handle: null,
        campaignTitle: null,
      };
    }
    if (recipient.revokedAt !== null) {
      return {
        state: "closed" as const,
        reason: "revoked" as const,
        handle: recipient.handle,
        campaignTitle: campaign.title,
      };
    }
    if (campaign.portalExpiresAt !== null && campaign.portalExpiresAt <= args.now) {
      return {
        state: "closed" as const,
        reason: "expired" as const,
        handle: recipient.handle,
        campaignTitle: campaign.title,
      };
    }
    if (recipient.status === "cancelled") {
      return {
        state: "closed" as const,
        reason: "cancelled" as const,
        handle: recipient.handle,
        campaignTitle: campaign.title,
      };
    }

    return {
      state: "active" as const,
      handle: recipient.handle,
      displayName: recipient.displayName,
      profileImageUrl: recipient.profileImageUrl,
      campaignTitle: campaign.title,
      status: recipient.status,
      portalExpiresAt: campaign.portalExpiresAt,
      redeemedAt: recipient.redeemedAt,
      revealed: recipient.revealedAt !== null,
      fourthwallUrl:
        recipient.revealedAt !== null ? recipient.fourthwallUrl : null,
      shareToken: recipient.shareToken,
    };
  },
});

export const getShareCard = query({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      handle: v.string(),
      displayName: v.string(),
      profileImageUrl: v.union(v.string(), v.null()),
      campaignTitle: v.string(),
      redeemed: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const recipient = await ctx.db
      .query("giftRecipients")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();
    if (!recipient) return null;
    const campaign = await ctx.db.get("giftCampaigns", recipient.campaignId);
    if (!campaign) return null;
    return {
      handle: recipient.handle,
      displayName: recipient.displayName,
      profileImageUrl: recipient.profileImageUrl,
      campaignTitle: campaign.title,
      redeemed: recipient.status === "redeemed",
    };
  },
});

async function activeRecipientForToken(
  ctx: MutationCtx,
  token: string,
): Promise<Doc<"giftRecipients">> {
  const recipient = await ctx.db
    .query("giftRecipients")
    .withIndex("by_portal_token", (q) => q.eq("portalToken", token))
    .unique();
  if (!recipient) throw new Error("This gift pass is not valid.");
  const campaign = await ctx.db.get("giftCampaigns", recipient.campaignId);
  if (!campaign) throw new Error("This gift campaign is no longer available.");
  const now = Date.now();
  if (recipient.revokedAt !== null) throw new Error("This gift pass was revoked.");
  if (campaign.portalExpiresAt !== null && campaign.portalExpiresAt <= now) {
    throw new Error("This gift pass has expired.");
  }
  if (recipient.status === "cancelled") {
    throw new Error("This Fourthwall gift was cancelled.");
  }
  return recipient;
}

export const recordOpen = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipient = await activeRecipientForToken(ctx, args.token);
    if (recipient.openedAt !== null) return null;
    const now = Date.now();
    await ctx.db.patch("giftRecipients", recipient._id, {
      openedAt: now,
      status:
        recipient.status === "ready" || recipient.status === "sent"
          ? "opened"
          : recipient.status,
      updatedAt: now,
    });
    await ctx.db.insert("giftEvents", {
      campaignId: recipient.campaignId,
      recipientId: recipient._id,
      type: "opened",
      source: "portal",
      detail: null,
      createdAt: now,
    });
    return null;
  },
});

export const reveal = mutation({
  args: { token: v.string() },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const recipient = await activeRecipientForToken(ctx, args.token);
    if (!recipient.fourthwallUrl) {
      throw new Error("Your Fourthwall gift link is not ready yet.");
    }
    if (recipient.revealedAt === null) {
      const now = Date.now();
      await ctx.db.patch("giftRecipients", recipient._id, {
        revealedAt: now,
        status:
          recipient.status === "redeemed" ? "redeemed" : "revealed",
        updatedAt: now,
      });
      await ctx.db.insert("giftEvents", {
        campaignId: recipient.campaignId,
        recipientId: recipient._id,
        type: "revealed",
        source: "portal",
        detail: null,
        createdAt: now,
      });
    }
    return { url: recipient.fourthwallUrl };
  },
});

export const recordFourthwallClick = mutation({
  args: { token: v.string() },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const recipient = await activeRecipientForToken(ctx, args.token);
    if (!recipient.fourthwallUrl || recipient.revealedAt === null) {
      throw new Error("Reveal your gift before opening Fourthwall.");
    }
    if (recipient.fourthwallClickedAt === null) {
      const now = Date.now();
      await Promise.all([
        ctx.db.patch("giftRecipients", recipient._id, {
          fourthwallClickedAt: now,
          updatedAt: now,
        }),
        ctx.db.insert("giftEvents", {
          campaignId: recipient.campaignId,
          recipientId: recipient._id,
          type: "fourthwall_clicked",
          source: "portal",
          detail: null,
          createdAt: now,
        }),
      ]);
    }
    return { url: recipient.fourthwallUrl };
  },
});

export const setDmSuppressed = mutation({
  args: {
    recipientId: v.id("giftRecipients"),
    suppressed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const recipient = await ctx.db.get("giftRecipients", args.recipientId);
    if (!recipient) throw new Error("Gift recipient not found.");
    const alreadySuppressed = recipient.dmSuppressedAt !== null;
    if (alreadySuppressed === args.suppressed) return null;
    const now = Date.now();
    await Promise.all([
      ctx.db.patch("giftRecipients", recipient._id, {
        dmSuppressedAt: args.suppressed ? now : null,
        dmSuppressionSource: args.suppressed ? "admin" : undefined,
        updatedAt: now,
      }),
      ctx.db.insert("giftEvents", {
        campaignId: recipient.campaignId,
        recipientId: recipient._id,
        type: args.suppressed ? "suppressed" : "unsuppressed",
        source: "admin",
        detail: null,
        createdAt: now,
      }),
    ]);
    return null;
  },
});

export const revokePortal = mutation({
  args: { recipientId: v.id("giftRecipients") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const recipient = await ctx.db.get("giftRecipients", args.recipientId);
    if (!recipient || recipient.revokedAt !== null) return null;
    const now = Date.now();
    await ctx.db.patch("giftRecipients", recipient._id, { revokedAt: now, updatedAt: now });
    return null;
  },
});

export const profilesForCampaign = internalQuery({
  args: {
    profileIds: v.array(v.id("profiles")),
    manualConsentConfirmed: v.boolean(),
    manualConfirmedAt: v.number(),
  },
  returns: v.array(campaignProfileValidator),
  handler: async (ctx, args) => {
    if (args.profileIds.length < 1 || args.profileIds.length > 50) {
      throw new Error("Choose between 1 and 50 gift recipients.");
    }
    if (new Set(args.profileIds).size !== args.profileIds.length) {
      throw new Error("Each recipient can only be selected once.");
    }
    const profiles = await Promise.all(
      args.profileIds.map((profileId) => ctx.db.get("profiles", profileId)),
    );
    const campaignProfiles = await Promise.all(
      profiles.map(async (profile, index) => {
        if (!profile) throw new Error("A selected profile no longer exists.");
        if (!profile.active || profile.membershipStatus === "rejected") {
          throw new Error(`@${profile.handle} is not an approved active profile.`);
        }
        if (!profile.xUserId) {
          throw new Error(
            `@${profile.handle} needs an X sync before it can receive a DM.`,
          );
        }
        const intent = await ctx.db
          .query("giftIntentStates")
          .withIndex("by_x_user_id", (q) => q.eq("xUserId", profile.xUserId!))
          .unique();
        if (intent?.state === "suppressed") {
          throw new Error(
            `@${profile.handle} sent STOP. Ask them to send GIFT again before creating a pass.`,
          );
        }
        const hasAvailableAutomaticConsent = hasAvailableGiftRequest(intent);
        if (!hasAvailableAutomaticConsent && !args.manualConsentConfirmed) {
          throw new Error(
            `@${profile.handle} needs a fresh GIFT request for this delivery. Confirm a new manual request or wait for the next webhook event.`,
          );
        }
        return {
          profileId: args.profileIds[index],
          xUserId: profile.xUserId,
          handle: profile.handle,
          displayName: profile.displayName,
          profileImageUrl: profile.profileImageUrl,
          consentConfirmedAt: hasAvailableAutomaticConsent
            ? (intent?.requestedAt ?? args.manualConfirmedAt)
            : args.manualConfirmedAt,
          consentSource: hasAvailableAutomaticConsent
            ? ("x_account_activity" as const)
            : ("manual" as const),
          consentEventId: hasAvailableAutomaticConsent
            ? (intent?.latestEventId ?? null)
            : null,
        };
      }),
    );
    if (
      new Set(campaignProfiles.map((profile) => profile.xUserId)).size !==
      campaignProfiles.length
    ) {
      throw new Error("Each X account can only receive one gift per campaign.");
    }
    return campaignProfiles;
  },
});

export const createProvisioningCampaign = internalMutation({
  args: {
    title: v.string(),
    fourthwallProductId: v.string(),
    createdByUserId: v.id("users"),
    portalExpiresAt: v.union(v.number(), v.null()),
    profiles: v.array(campaignProfileValidator),
    portalTokens: v.array(v.string()),
    shareTokens: v.array(v.string()),
  },
  returns: v.object({
    campaignId: v.id("giftCampaigns"),
    recipientIds: v.array(v.id("giftRecipients")),
  }),
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const productId = args.fourthwallProductId.trim();
    if (!title || title.length > 100) {
      throw new Error("Campaign title must be between 1 and 100 characters.");
    }
    if (!productId || productId.length > 120) {
      throw new Error("Enter a valid Fourthwall product ID.");
    }
    if (
      args.profiles.length !== args.portalTokens.length ||
      args.profiles.length !== args.shareTokens.length
    ) {
      throw new Error("Every gift recipient needs private and public tokens.");
    }
    const now = Date.now();
    const campaignId = await ctx.db.insert("giftCampaigns", {
      title,
      fourthwallProductId: productId,
      fourthwallPackageId: null,
      status: "provisioning",
      createdByUserId: args.createdByUserId,
      portalExpiresAt: args.portalExpiresAt,
      lastSyncedAt: null,
      syncError: null,
      createdAt: now,
      updatedAt: now,
    });
    const recipientIds = await Promise.all(
      args.profiles.map(async (profile, index) => {
        let intentToConsume: Doc<"giftIntentStates"> | null = null;
        let eventToConsume: Doc<"xAccountActivityEvents"> | null = null;
        if (profile.consentSource === "x_account_activity") {
          if (!profile.consentEventId) {
            throw new Error(`@${profile.handle} is missing its X consent event.`);
          }
          intentToConsume = await ctx.db
            .query("giftIntentStates")
            .withIndex("by_x_user_id", (q) => q.eq("xUserId", profile.xUserId))
            .unique();
          if (
            !intentToConsume ||
            intentToConsume.state !== "active" ||
            intentToConsume.latestCommand !== "gift" ||
            intentToConsume.latestEventId !== profile.consentEventId ||
            intentToConsume.consumedGiftEventId === profile.consentEventId
          ) {
            throw new Error(
              `@${profile.handle}'s GIFT request was already used or changed. Ask for a fresh GIFT before creating another delivery.`,
            );
          }
          eventToConsume = await ctx.db
            .query("xAccountActivityEvents")
            .withIndex("by_event_id", (q) =>
              q.eq("eventId", profile.consentEventId!),
            )
            .unique();
          if (
            !eventToConsume ||
            eventToConsume.command !== "gift" ||
            eventToConsume.senderXUserId !== profile.xUserId ||
            eventToConsume.consumedByRecipientId
          ) {
            throw new Error(
              `@${profile.handle}'s X consent event is unavailable or already linked to another gift.`,
            );
          }
        }
        const previousGifts = await ctx.db
          .query("giftRecipients")
          .withIndex("by_x_user_id_and_created_at", (q) =>
            q.eq("xUserId", profile.xUserId),
          )
          .order("desc")
          .take(250);
        const highestRecordedNumber = previousGifts.reduce(
          (highest, recipient) =>
            Math.max(highest, recipient.giftNumber ?? 0),
          0,
        );
        const giftNumber =
          Math.max(previousGifts.length, highestRecordedNumber) + 1;
        const recipientId = await ctx.db.insert("giftRecipients", {
          campaignId,
          profileId: profile.profileId,
          xUserId: profile.xUserId,
          handle: profile.handle,
          displayName: profile.displayName,
          profileImageUrl: profile.profileImageUrl,
          portalToken: args.portalTokens[index],
          shareToken: args.shareTokens[index],
          fourthwallGiftId: null,
          fourthwallUrl: null,
          fourthwallStatus: "pending",
          status: "provisioning",
          consentConfirmedAt: profile.consentConfirmedAt,
          consentConfirmedByUserId: args.createdByUserId,
          consentSource: profile.consentSource,
          consentEventId: profile.consentEventId ?? undefined,
          giftNumber,
          dmSuppressedAt: null,
          dmSuppressionSource: undefined,
          sendAttemptedAt: null,
          sentAt: null,
          xDmEventId: null,
          xDmConversationId: null,
          deliveryError: null,
          openedAt: null,
          revealedAt: null,
          fourthwallClickedAt: null,
          redeemedAt: null,
          revokedAt: null,
          createdAt: now + index,
          updatedAt: now,
        });
        if (intentToConsume) {
          await ctx.db.patch("giftIntentStates", intentToConsume._id, {
            consumedGiftEventId: profile.consentEventId!,
            consumedGiftAt: now,
            consumedByRecipientId: recipientId,
          });
        }
        if (eventToConsume) {
          await ctx.db.patch("xAccountActivityEvents", eventToConsume._id, {
            consumedByRecipientId: recipientId,
            consumedAt: now,
          });
        }
        await ctx.db.insert("giftEvents", {
          campaignId,
          recipientId,
          type: "created",
          source:
            profile.consentSource === "x_account_activity" ? "x" : "admin",
          detail:
            profile.consentSource === "x_account_activity"
              ? `Gift #${giftNumber}: automatic GIFT consent from X event ${profile.consentEventId}`
              : `Gift #${giftNumber}: admin confirmed a new inbound X gift request.`,
          createdAt: now,
        });
        return recipientId;
      }),
    );
    return { campaignId, recipientIds };
  },
});

export const finalizeCampaign = internalMutation({
  args: {
    campaignId: v.id("giftCampaigns"),
    packageId: v.string(),
    links: v.array(fourthwallLinkValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get("giftCampaigns", args.campaignId);
    if (!campaign) throw new Error("Gift campaign not found.");
    if (campaign.status === "active") return null;
    const recipients = await ctx.db
      .query("giftRecipients")
      .withIndex("by_campaign_id_and_created_at", (q) =>
        q.eq("campaignId", args.campaignId),
      )
      .order("asc")
      .take(50);
    if (recipients.length !== args.links.length) {
      throw new Error("Fourthwall returned an unexpected number of links.");
    }
    const now = Date.now();
    await Promise.all([
      ctx.db.patch("giftCampaigns", campaign._id, {
        fourthwallPackageId: args.packageId,
        status: "active",
        syncError: null,
        updatedAt: now,
      }),
      ...recipients.flatMap((recipient, index) => [
        ctx.db.patch("giftRecipients", recipient._id, {
          fourthwallGiftId: args.links[index].id,
          fourthwallUrl: args.links[index].link,
          fourthwallStatus: args.links[index].status,
          status:
            args.links[index].status === "available" ? "ready" : "error",
          updatedAt: now,
        }),
        ctx.db.insert("giftEvents", {
          campaignId: campaign._id,
          recipientId: recipient._id,
          type: "link_ready",
          source: "admin",
          detail: null,
          createdAt: now,
        }),
      ]),
    ]);
    return null;
  },
});

export const markCampaignError = internalMutation({
  args: { campaignId: v.id("giftCampaigns"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("giftCampaigns", args.campaignId, {
      status: "error",
      syncError: args.message.slice(0, 500),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getCampaignForSync = internalQuery({
  args: { campaignId: v.id("giftCampaigns") },
  returns: v.union(giftCampaignValidator, v.null()),
  handler: async (ctx, args) =>
    await ctx.db.get("giftCampaigns", args.campaignId),
});

export const getRecipientForSend = internalQuery({
  args: { recipientId: v.id("giftRecipients") },
  returns: v.union(giftRecipientValidator, v.null()),
  handler: async (ctx, args) =>
    await ctx.db.get("giftRecipients", args.recipientId),
});

export const recordSendAttempt = internalMutation({
  args: { recipientId: v.id("giftRecipients") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get("giftRecipients", args.recipientId);
    if (!recipient) throw new Error("Gift recipient not found.");
    const now = Date.now();
    await Promise.all([
      ctx.db.patch("giftRecipients", recipient._id, {
        sendAttemptedAt: now,
        deliveryError: null,
        updatedAt: now,
      }),
      ctx.db.insert("giftEvents", {
        campaignId: recipient.campaignId,
        recipientId: recipient._id,
        type: "send_attempted",
        source: "x",
        detail: null,
        createdAt: now,
      }),
    ]);
    return null;
  },
});

export const recordSendSuccess = internalMutation({
  args: {
    recipientId: v.id("giftRecipients"),
    dmEventId: v.string(),
    dmConversationId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get("giftRecipients", args.recipientId);
    if (!recipient) throw new Error("Gift recipient not found.");
    if (recipient.sentAt !== null) return null;
    const now = Date.now();
    await Promise.all([
      ctx.db.patch("giftRecipients", recipient._id, {
        sentAt: now,
        status: "sent",
        xDmEventId: args.dmEventId,
        xDmConversationId: args.dmConversationId,
        deliveryError: null,
        updatedAt: now,
      }),
      ctx.db.insert("giftEvents", {
        campaignId: recipient.campaignId,
        recipientId: recipient._id,
        type: "sent",
        source: "x",
        detail: `X DM event ${args.dmEventId}`,
        createdAt: now,
      }),
    ]);
    return null;
  },
});

export const recordSendFailure = internalMutation({
  args: { recipientId: v.id("giftRecipients"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get("giftRecipients", args.recipientId);
    if (!recipient) return null;
    const now = Date.now();
    await Promise.all([
      ctx.db.patch("giftRecipients", recipient._id, {
        deliveryError: args.message.slice(0, 500),
        updatedAt: now,
      }),
      ctx.db.insert("giftEvents", {
        campaignId: recipient.campaignId,
        recipientId: recipient._id,
        type: "send_failed",
        source: "x",
        detail: args.message.slice(0, 500),
        createdAt: now,
      }),
    ]);
    return null;
  },
});

export const createOAuthState = internalMutation({
  args: {
    state: v.string(),
    codeVerifier: v.string(),
    adminUserId: v.id("users"),
    expiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("giftOAuthStates", {
      ...args,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const consumeOAuthState = internalMutation({
  args: { state: v.string() },
  returns: v.union(
    v.object({
      codeVerifier: v.string(),
      adminUserId: v.id("users"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("giftOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
    if (!row) return null;
    await ctx.db.delete("giftOAuthStates", row._id);
    if (row.expiresAt <= Date.now()) return null;
    return { codeVerifier: row.codeVerifier, adminUserId: row.adminUserId };
  },
});

export const getSenderConnection = internalQuery({
  args: {},
  returns: v.union(senderConnectionValidator, v.null()),
  handler: async (ctx) =>
    await ctx.db
      .query("giftSenderConnections")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique(),
});

export const upsertSenderConnection = internalMutation({
  args: {
    xUserId: v.string(),
    username: v.string(),
    displayName: v.string(),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.union(v.string(), v.null()),
    accessTokenExpiresAt: v.number(),
    scope: v.string(),
    connectedByUserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("giftSenderConnections")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch("giftSenderConnections", existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert("giftSenderConnections", {
        key: "primary",
        ...args,
        connectedAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const updateSenderTokens = internalMutation({
  args: {
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.union(v.string(), v.null()),
    accessTokenExpiresAt: v.number(),
    scope: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("giftSenderConnections")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    if (!existing) throw new Error("Connect the X sender account first.");
    await ctx.db.patch("giftSenderConnections", existing._id, { ...args, updatedAt: Date.now() });
    return null;
  },
});

export const applyFourthwallStatuses = internalMutation({
  args: {
    campaignId: v.id("giftCampaigns"),
    links: v.array(
      v.object({ id: v.string(), status: fourthwallGiftStatusValidator }),
    ),
  },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args) => {
    let updated = 0;
    const now = Date.now();
    for (const link of args.links) {
      const recipient = await ctx.db
        .query("giftRecipients")
        .withIndex("by_fourthwall_gift_id", (q) =>
          q.eq("fourthwallGiftId", link.id),
        )
        .unique();
      if (!recipient || recipient.campaignId !== args.campaignId) continue;
      if (recipient.fourthwallStatus === link.status) continue;
      const patch: Partial<Doc<"giftRecipients">> = {
        fourthwallStatus: link.status,
        updatedAt: now,
      };
      let eventType: "redeemed" | "cancelled" | null = null;
      if (link.status === "redeemed") {
        patch.status = "redeemed";
        patch.redeemedAt = recipient.redeemedAt ?? now;
        eventType = "redeemed";
      } else if (link.status === "cancelled") {
        patch.status = "cancelled";
        eventType = "cancelled";
      }
      await ctx.db.patch("giftRecipients", recipient._id, patch);
      if (eventType) {
        await ctx.db.insert("giftEvents", {
          campaignId: recipient.campaignId,
          recipientId: recipient._id,
          type: eventType,
          source: "fourthwall_sync",
          detail: null,
          createdAt: now,
        });
      }
      updated += 1;
    }
    await ctx.db.patch("giftCampaigns", args.campaignId, {
      lastSyncedAt: now,
      syncError: null,
      updatedAt: now,
    });
    return { updated };
  },
});

export const applyFourthwallOrder = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    giftId: v.union(v.string(), v.null()),
    orderId: v.union(v.string(), v.null()),
  },
  returns: v.object({ duplicate: v.boolean(), matched: v.boolean() }),
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("giftWebhookEvents")
      .withIndex("by_provider_and_event_id", (q) =>
        q.eq("provider", "fourthwall").eq("eventId", args.eventId),
      )
      .unique();
    if (duplicate) return { duplicate: true, matched: false };
    const now = Date.now();
    await ctx.db.insert("giftWebhookEvents", {
      provider: "fourthwall",
      eventId: args.eventId,
      eventType: args.eventType,
      giftId: args.giftId,
      orderId: args.orderId,
      receivedAt: now,
    });
    if (args.eventType !== "ORDER_PLACED") {
      return { duplicate: false, matched: false };
    }
    if (!args.giftId) return { duplicate: false, matched: false };
    const recipient = await ctx.db
      .query("giftRecipients")
      .withIndex("by_fourthwall_gift_id", (q) =>
        q.eq("fourthwallGiftId", args.giftId),
      )
      .unique();
    if (!recipient) return { duplicate: false, matched: false };
    if (recipient.status !== "redeemed") {
      await Promise.all([
        ctx.db.patch("giftRecipients", recipient._id, {
          fourthwallStatus: "redeemed",
          status: "redeemed",
          redeemedAt: now,
          updatedAt: now,
        }),
        ctx.db.insert("giftEvents", {
          campaignId: recipient.campaignId,
          recipientId: recipient._id,
          type: "redeemed",
          source: "fourthwall_webhook",
          detail: args.orderId ? `Fourthwall order ${args.orderId}` : null,
          createdAt: now,
        }),
      ]);
    }
    return { duplicate: false, matched: true };
  },
});
