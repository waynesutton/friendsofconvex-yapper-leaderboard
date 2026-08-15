import { v } from "convex/values";

export const syncStatusValidator = v.union(
  v.literal("pending"),
  v.literal("synced"),
  v.literal("error"),
);

export const profileValidator = v.object({
  _id: v.id("profiles"),
  _creationTime: v.number(),
  handle: v.string(),
  normalizedHandle: v.string(),
  displayName: v.string(),
  bio: v.union(v.string(), v.null()),
  profileImageUrl: v.union(v.string(), v.null()),
  xUserId: v.union(v.string(), v.null()),
  active: v.boolean(),
  syncStatus: syncStatusValidator,
  syncError: v.union(v.string(), v.null()),
  currentImpressions: v.number(),
  currentPosts: v.number(),
  currentEngagements: v.number(),
  currentFollowers: v.number(),
  lastSyncedAt: v.union(v.number(), v.null()),
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
});

export const importStatusValidator = v.union(
  v.literal("valid"),
  v.literal("existing"),
  v.literal("invalid"),
  v.literal("not-found"),
  v.literal("duplicate"),
);

export const importEntryValidator = v.object({
  input: v.string(),
  handle: v.string(),
  xUserId: v.union(v.string(), v.null()),
  displayName: v.string(),
  bio: v.union(v.string(), v.null()),
  profileImageUrl: v.union(v.string(), v.null()),
  followerCount: v.number(),
  status: importStatusValidator,
  message: v.union(v.string(), v.null()),
});

export const syncTargetValidator = v.object({
  profileId: v.id("profiles"),
  handle: v.string(),
});

export const syncResultValidator = v.object({
  status: v.union(
    v.literal("synced"),
    v.literal("missing_key"),
    v.literal("error"),
  ),
  handle: v.string(),
  impressions: v.number(),
  postCount: v.number(),
  message: v.union(v.string(), v.null()),
});

export const convexPostValidator = v.object({
  postId: v.string(),
  url: v.string(),
  text: v.string(),
  postedAt: v.number(),
  impressions: v.number(),
  engagements: v.number(),
});

// Public board projection: only the fields the leaderboard renders. The
// public query must never return raw profile docs, which carry internal
// fields like authUserId, syncError, and membership review metadata.
export const publicLeaderboardRowValidator = v.object({
  _id: v.id("profiles"),
  handle: v.string(),
  normalizedHandle: v.string(),
  displayName: v.string(),
  bio: v.union(v.string(), v.null()),
  profileImageUrl: v.union(v.string(), v.null()),
  syncStatus: syncStatusValidator,
  currentImpressions: v.number(),
  currentPosts: v.number(),
  currentEngagements: v.number(),
  currentFollowers: v.number(),
  lastSyncedAt: v.union(v.number(), v.null()),
  addedAt: v.number(),
  updatedAt: v.number(),
  // Convex mode extras, optional so the default mode can omit them.
  convexPostCount: v.optional(v.number()),
  convexImpressions: v.optional(v.number()),
  convexEngagements: v.optional(v.number()),
  convexScanned: v.optional(v.boolean()),
  convexPostsStored: v.optional(v.number()),
  convexWeeklyChange: v.optional(v.union(v.number(), v.null())),
  convexStreak: v.optional(v.number()),
});

export const rankBadgeValidator = v.object({
  rank: v.number(),
  kind: v.union(v.literal("emoji"), v.literal("text"), v.literal("image")),
  value: v.string(),
  imageUrl: v.union(v.string(), v.null()),
  isDefault: v.boolean(),
});
