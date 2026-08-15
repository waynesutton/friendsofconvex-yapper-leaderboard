import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const syncStatus = v.union(
  v.literal("pending"),
  v.literal("synced"),
  v.literal("error"),
);

const giftCampaignStatus = v.union(
  v.literal("provisioning"),
  v.literal("active"),
  v.literal("closed"),
  v.literal("error"),
);

const giftRecipientStatus = v.union(
  v.literal("provisioning"),
  v.literal("ready"),
  v.literal("sent"),
  v.literal("opened"),
  v.literal("revealed"),
  v.literal("redeemed"),
  v.literal("cancelled"),
  v.literal("error"),
);

const fourthwallGiftStatus = v.union(
  v.literal("pending"),
  v.literal("available"),
  v.literal("redeemed"),
  v.literal("cancelled"),
  v.literal("error"),
);

const giftIntentCommand = v.union(
  v.literal("gift"),
  v.literal("stop"),
  v.literal("ignored"),
);

// A post that matched the Convex mention scan, stored on the snapshot so the
// board can reveal the actual posts without extra X API calls.
const convexPost = v.object({
  postId: v.string(),
  url: v.string(),
  text: v.string(),
  postedAt: v.number(),
  impressions: v.number(),
  engagements: v.number(),
});

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    xUserId: v.optional(v.string()),
    xUsername: v.optional(v.string()),
    xDescription: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_x_user_id", ["xUserId"]),

  profiles: defineTable({
    handle: v.string(),
    normalizedHandle: v.string(),
    displayName: v.string(),
    bio: v.union(v.string(), v.null()),
    profileImageUrl: v.union(v.string(), v.null()),
    xUserId: v.union(v.string(), v.null()),
    active: v.boolean(),
    syncStatus,
    syncError: v.union(v.string(), v.null()),
    currentImpressions: v.number(),
    currentPosts: v.number(),
    currentEngagements: v.number(),
    currentFollowers: v.number(),
    lastSyncedAt: v.union(v.number(), v.null()),
    // Convex mention scan mirrors of the latest snapshot. Optional so profiles
    // synced before the feature stay valid; missing convexScannedAt means
    // "not scanned yet".
    currentConvexPosts: v.optional(v.number()),
    currentConvexImpressions: v.optional(v.number()),
    currentConvexEngagements: v.optional(v.number()),
    convexScannedAt: v.optional(v.number()),
    addedAt: v.number(),
    updatedAt: v.number(),
    membershipStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
    ),
    source: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("bulk"),
        v.literal("x-list"),
        v.literal("self-join"),
      ),
    ),
    authUserId: v.optional(v.id("users")),
    requestedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_normalized_handle", ["normalizedHandle"])
    .index("by_x_user_id", ["xUserId"])
    .index("by_active_and_current_impressions", [
      "active",
      "currentImpressions",
    ])
    .index("by_added_at", ["addedAt"])
    .index("by_membership_status_and_added_at", [
      "membershipStatus",
      "addedAt",
    ]),

  snapshots: defineTable({
    profileId: v.id("profiles"),
    windowStart: v.number(),
    windowEnd: v.number(),
    capturedAt: v.number(),
    impressions: v.number(),
    postCount: v.number(),
    engagementCount: v.number(),
    followerCount: v.number(),
    // Convex mention scan results. Optional so pre-feature snapshots load
    // without a migration.
    convexPostCount: v.optional(v.number()),
    convexImpressions: v.optional(v.number()),
    convexEngagements: v.optional(v.number()),
    convexPosts: v.optional(v.array(convexPost)),
  })
    .index("by_profile_id", ["profileId"])
    .index("by_profile_id_and_window_end", ["profileId", "windowEnd"]),

  // Singleton (key "board") controlling which metric columns the public
  // leaderboard shows in each mode. Missing doc means everything is visible.
  boardDisplaySettings: defineTable({
    key: v.string(),
    yappersColumns: v.object({
      posts: v.boolean(),
      engagements: v.boolean(),
      impressions: v.boolean(),
    }),
    convexColumns: v.object({
      convexPosts: v.boolean(),
      shareOfPosts: v.boolean(),
      convexImpressions: v.boolean(),
      convexEngagements: v.boolean(),
      weeklyChange: v.boolean(),
    }),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Saved Fourthwall product IDs so admins pick instead of pasting.
  giftProductPresets: defineTable({
    label: v.string(),
    fourthwallProductId: v.string(),
    // Filled from Fourthwall's Get Product endpoint when the save is verified.
    // Missing on presets saved before verification existed or when the lookup
    // failed for a network reason.
    productName: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_fourthwall_product_id", ["fourthwallProductId"]),

  // Custom badges for leaderboard ranks 1 to 3. Missing rows fall back to the
  // default medal emojis.
  rankBadges: defineTable({
    rank: v.number(),
    kind: v.union(v.literal("emoji"), v.literal("text"), v.literal("image")),
    value: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
    updatedAt: v.number(),
  }).index("by_rank", ["rank"]),

  giftCampaigns: defineTable({
    title: v.string(),
    fourthwallProductId: v.string(),
    fourthwallPackageId: v.union(v.string(), v.null()),
    status: giftCampaignStatus,
    createdByUserId: v.id("users"),
    portalExpiresAt: v.union(v.number(), v.null()),
    lastSyncedAt: v.union(v.number(), v.null()),
    syncError: v.union(v.string(), v.null()),
    // Set when an admin archives the dispatch; archived campaigns leave the
    // sidebar but stay in the Dispatches log until deleted.
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_status_and_created_at", ["status", "createdAt"]),

  giftRecipients: defineTable({
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
    fourthwallStatus: fourthwallGiftStatus,
    status: giftRecipientStatus,
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
  })
    .index("by_portal_token", ["portalToken"])
    .index("by_share_token", ["shareToken"])
    .index("by_campaign_id_and_created_at", ["campaignId", "createdAt"])
    .index("by_campaign_id_and_profile_id", ["campaignId", "profileId"])
    .index("by_fourthwall_gift_id", ["fourthwallGiftId"])
    .index("by_created_at", ["createdAt"])
    .index("by_x_user_id_and_created_at", ["xUserId", "createdAt"])
    .index("by_profile_id_and_created_at", ["profileId", "createdAt"])
    .searchIndex("search_handle", {
      searchField: "handle",
      filterFields: ["campaignId"],
    }),

  giftIntentStates: defineTable({
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
  })
    .index("by_x_user_id", ["xUserId"])
    .index("by_updated_at", ["updatedAt"]),

  xAccountActivityEvents: defineTable({
    eventId: v.string(),
    forUserId: v.string(),
    senderXUserId: v.string(),
    recipientXUserId: v.string(),
    command: giftIntentCommand,
    eventCreatedAt: v.union(v.number(), v.null()),
    matchedProfileId: v.union(v.id("profiles"), v.null()),
    consumedByRecipientId: v.optional(v.id("giftRecipients")),
    consumedAt: v.optional(v.number()),
    receivedAt: v.number(),
  })
    .index("by_event_id", ["eventId"])
    .index("by_sender_x_user_id_and_received_at", [
      "senderXUserId",
      "receivedAt",
    ])
    .index("by_received_at", ["receivedAt"]),

  xAccountActivityConfigs: defineTable({
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
  }).index("by_key", ["key"]),

  giftEvents: defineTable({
    campaignId: v.id("giftCampaigns"),
    recipientId: v.id("giftRecipients"),
    type: v.union(
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
    ),
    source: v.union(
      v.literal("admin"),
      v.literal("x"),
      v.literal("portal"),
      v.literal("fourthwall_webhook"),
      v.literal("fourthwall_sync"),
    ),
    detail: v.union(v.string(), v.null()),
    createdAt: v.number(),
  })
    .index("by_recipient_id_and_created_at", ["recipientId", "createdAt"])
    .index("by_campaign_id_and_created_at", ["campaignId", "createdAt"]),

  giftSenderConnections: defineTable({
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
  }).index("by_key", ["key"]),

  giftOAuthStates: defineTable({
    state: v.string(),
    codeVerifier: v.string(),
    adminUserId: v.id("users"),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_state", ["state"])
    .index("by_expires_at", ["expiresAt"]),

  giftWebhookEvents: defineTable({
    provider: v.literal("fourthwall"),
    eventId: v.string(),
    eventType: v.string(),
    giftId: v.union(v.string(), v.null()),
    orderId: v.union(v.string(), v.null()),
    receivedAt: v.number(),
  })
    .index("by_provider_and_event_id", ["provider", "eventId"])
    .index("by_received_at", ["receivedAt"]),
});
