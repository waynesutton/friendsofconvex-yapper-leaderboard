import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { getXViewer, requireAdmin } from "./authz";
import {
  convexPostValidator,
  importEntryValidator,
  profileValidator,
  publicLeaderboardRowValidator,
  syncStatusValidator,
  syncTargetValidator,
} from "./validators";

const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,50}$/;

function normalizeHandle(value: string): string {
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  if (!HANDLE_PATTERN.test(normalized)) {
    throw new Error(
      "Enter a valid X handle using only letters, numbers, or underscores.",
    );
  }
  return normalized;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STREAK_LOOKBACK_WEEKS = 12;
const SNAPSHOT_HISTORY_LIMIT = 90;

type ConvexLeaderboardRow = Doc<"profiles"> & {
  convexPostCount: number;
  convexImpressions: number;
  convexEngagements: number;
  convexScanned: boolean;
  convexPostsStored: number;
  convexWeeklyChange: number | null;
  convexStreak: number;
};

// Internal row shape used while building the board. The public query maps
// these down to the projected shape before returning.
type LeaderboardRow = Doc<"profiles"> & {
  convexPostCount?: number;
  convexImpressions?: number;
  convexEngagements?: number;
  convexScanned?: boolean;
  convexPostsStored?: number;
  convexWeeklyChange?: number | null;
  convexStreak?: number;
};

// The projected row the public board receives. Raw profile docs stay server
// side; internal fields (authUserId, syncError, membership review metadata)
// never leave the deployment through this query.
export type PublicLeaderboardRow = {
  _id: Id<"profiles">;
  handle: string;
  normalizedHandle: string;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  syncStatus: Doc<"profiles">["syncStatus"];
  currentImpressions: number;
  currentPosts: number;
  currentEngagements: number;
  currentFollowers: number;
  lastSyncedAt: number | null;
  addedAt: number;
  updatedAt: number;
  convexPostCount?: number;
  convexImpressions?: number;
  convexEngagements?: number;
  convexScanned?: boolean;
  convexPostsStored?: number;
  convexWeeklyChange?: number | null;
  convexStreak?: number;
};

function toPublicLeaderboardRow(row: LeaderboardRow): PublicLeaderboardRow {
  return {
    _id: row._id,
    handle: row.handle,
    normalizedHandle: row.normalizedHandle,
    displayName: row.displayName,
    bio: row.bio,
    profileImageUrl: row.profileImageUrl,
    syncStatus: row.syncStatus,
    currentImpressions: row.currentImpressions,
    currentPosts: row.currentPosts,
    currentEngagements: row.currentEngagements,
    currentFollowers: row.currentFollowers,
    lastSyncedAt: row.lastSyncedAt,
    addedAt: row.addedAt,
    updatedAt: row.updatedAt,
    convexPostCount: row.convexPostCount,
    convexImpressions: row.convexImpressions,
    convexEngagements: row.convexEngagements,
    convexScanned: row.convexScanned,
    convexPostsStored: row.convexPostsStored,
    convexWeeklyChange: row.convexWeeklyChange,
    convexStreak: row.convexStreak,
  };
}

// Builds the Convex mentions ranking from the same active profile index as the
// default board plus each profile's snapshot history (per profile index, no
// table scans). Every time comparison anchors to snapshot timestamps so the
// query stays deterministic and cacheable.
async function buildConvexLeaderboard(
  ctx: QueryCtx,
  limit: number,
): Promise<Array<ConvexLeaderboardRow>> {
  const profiles = await ctx.db
    .query("profiles")
    .withIndex("by_active_and_current_impressions", (q) =>
      q.eq("active", true),
    )
    .order("desc")
    .take(limit);

  const rows: Array<ConvexLeaderboardRow> = [];
  for (const profile of profiles) {
    const history = await ctx.db
      .query("snapshots")
      .withIndex("by_profile_id_and_window_end", (q) =>
        q.eq("profileId", profile._id),
      )
      .order("desc")
      .take(SNAPSHOT_HISTORY_LIMIT);
    const latest = history[0];
    const scanned = latest !== undefined && latest.convexPostCount !== undefined;

    // Weekly change: latest scan count minus the closest scanned snapshot at
    // least seven days older, anchored to the latest snapshot's window end.
    let weeklyChange: number | null = null;
    if (latest && scanned) {
      const prior = history.find(
        (snapshot) =>
          snapshot.windowEnd <= latest.windowEnd - WEEK_MS &&
          snapshot.convexPostCount !== undefined,
      );
      if (prior) {
        weeklyChange =
          (latest.convexPostCount ?? 0) - (prior.convexPostCount ?? 0);
      }
    }

    // Streak: consecutive seven day buckets, walking back from the latest
    // snapshot time, that contain a snapshot with at least one Convex post.
    let streak = 0;
    if (latest && scanned) {
      for (let week = 0; week < STREAK_LOOKBACK_WEEKS; week += 1) {
        const bucketEnd = latest.windowEnd - week * WEEK_MS;
        const bucket = history.filter(
          (snapshot) =>
            snapshot.windowEnd > bucketEnd - WEEK_MS &&
            snapshot.windowEnd <= bucketEnd,
        );
        if (bucket.length === 0) break;
        if (!bucket.some((snapshot) => (snapshot.convexPostCount ?? 0) >= 1)) {
          break;
        }
        streak += 1;
      }
    }

    rows.push({
      ...profile,
      convexPostCount: latest?.convexPostCount ?? 0,
      convexImpressions: latest?.convexImpressions ?? 0,
      convexEngagements: latest?.convexEngagements ?? 0,
      convexScanned: scanned,
      convexPostsStored: latest?.convexPosts?.length ?? 0,
      convexWeeklyChange: weeklyChange,
      convexStreak: streak,
    });
  }

  rows.sort(
    (left, right) =>
      right.convexPostCount - left.convexPostCount ||
      right.convexImpressions - left.convexImpressions ||
      right.convexEngagements - left.convexEngagements ||
      right.currentImpressions - left.currentImpressions,
  );
  return rows;
}

export const listLeaderboard = query({
  args: {
    limit: v.optional(v.number()),
    mode: v.optional(v.union(v.literal("default"), v.literal("convex"))),
  },
  returns: v.array(publicLeaderboardRowValidator),
  handler: async (ctx, args): Promise<Array<PublicLeaderboardRow>> => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 200), 1), 250);
    if (args.mode === "convex") {
      const rows = await buildConvexLeaderboard(ctx, limit);
      return rows.map(toPublicLeaderboardRow);
    }
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_active_and_current_impressions", (q) =>
        q.eq("active", true),
      )
      .order("desc")
      .take(limit);
    // Canonical Yappers rank is engagement, not impressions. The frontend
    // assigns rank numbers and top 3 badges from this array's order, so the
    // sort here is what keeps badges correct after every sync or import.
    // Profiles awaiting their first X sync sort after rows with real metrics.
    profiles.sort((left, right) => {
      const leftGroup = left.syncStatus === "synced" ? 0 : 1;
      const rightGroup = right.syncStatus === "synced" ? 0 : 1;
      return (
        leftGroup - rightGroup ||
        right.currentEngagements - left.currentEngagements ||
        right.currentImpressions - left.currentImpressions ||
        right.currentPosts - left.currentPosts ||
        left.addedAt - right.addedAt
      );
    });
    return profiles.map(toPublicLeaderboardRow);
  },
});

// Stored Convex posts from a profile's latest snapshot, loaded on row expand
// so the main leaderboard payload stays small.
export const getConvexPosts = query({
  args: { profileId: v.id("profiles") },
  returns: v.union(
    v.object({
      scanned: v.boolean(),
      posts: v.array(convexPostValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("profiles", args.profileId);
    if (!profile || !profile.active) return null;
    const latest = await ctx.db
      .query("snapshots")
      .withIndex("by_profile_id_and_window_end", (q) =>
        q.eq("profileId", args.profileId),
      )
      .order("desc")
      .first();
    if (!latest || latest.convexPostCount === undefined) {
      return { scanned: false, posts: [] };
    }
    return { scanned: true, posts: latest.convexPosts ?? [] };
  },
});

// Feeds the Slack digest with the same ranking the board shows.
export const listTopConvexYappers = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      handle: v.string(),
      displayName: v.string(),
      convexPostCount: v.number(),
      totalPosts: v.number(),
      convexImpressions: v.number(),
      convexStreak: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit), 1), 25);
    const rows = await buildConvexLeaderboard(ctx, 250);
    return rows.slice(0, limit).map((row) => ({
      handle: row.handle,
      displayName: row.displayName,
      convexPostCount: row.convexPostCount,
      totalPosts: row.currentPosts,
      convexImpressions: row.convexImpressions,
      convexStreak: row.convexStreak,
    }));
  },
});

export const listAdmin = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(profileValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 200), 1), 250);
    return await ctx.db
      .query("profiles")
      .withIndex("by_added_at")
      .order("desc")
      .take(limit);
  },
});

export const getSetupStatus = query({
  args: {},
  returns: v.object({
    xApiConfigured: v.boolean(),
    authEnabled: v.boolean(),
    adminAllowlistConfigured: v.boolean(),
    adminMode: v.literal("convex-auth"),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return {
      xApiConfigured: Boolean(process.env.X_BEARER_TOKEN),
      authEnabled: Boolean(
        process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET,
      ),
      adminAllowlistConfigured: Boolean(process.env.ADMIN_X_USER_IDS),
      adminMode: "convex-auth" as const,
    };
  },
});

export const add = mutation({
  args: { handle: v.string() },
  returns: v.object({
    profileId: v.id("profiles"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const normalizedHandle = normalizeHandle(args.handle);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_normalized_handle", (q) =>
        q.eq("normalizedHandle", normalizedHandle),
      )
      .unique();

    if (existing) {
      if (!existing.active) {
        await ctx.db.patch("profiles", existing._id, {
          active: true,
          syncError: null,
          updatedAt: Date.now(),
        });
      }
      return { profileId: existing._id, created: false };
    }

    const now = Date.now();
    const profileId = await ctx.db.insert("profiles", {
      handle: normalizedHandle,
      normalizedHandle,
      displayName: `@${normalizedHandle}`,
      bio: null,
      profileImageUrl: null,
      xUserId: null,
      active: true,
      syncStatus: "pending",
      syncError: null,
      currentImpressions: 0,
      currentPosts: 0,
      currentEngagements: 0,
      currentFollowers: 0,
      lastSyncedAt: null,
      addedAt: now,
      updatedAt: now,
      membershipStatus: "approved",
      source: "manual",
      reviewedAt: now,
    });

    return { profileId, created: true };
  },
});

export const setActive = mutation({
  args: {
    profileId: v.id("profiles"),
    active: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch("profiles", args.profileId, {
      active: args.active,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Permanently deletes a profile and its snapshot history. Gift ledger rows
// keep their own copies of the handle and display name, so gift history
// survives the removal. Idempotent: removing an already deleted profile is
// a no-op.
export const remove = mutation({
  args: { profileId: v.id("profiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await ctx.db.get("profiles", args.profileId);
    if (!profile) return null;

    const snapshots = await ctx.db
      .query("snapshots")
      .withIndex("by_profile_id", (q) => q.eq("profileId", args.profileId))
      .collect();
    for (const snapshot of snapshots) {
      await ctx.db.delete("snapshots", snapshot._id);
    }
    await ctx.db.delete("profiles", args.profileId);
    return null;
  },
});

const membershipStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

export const getMyMembership = query({
  args: {},
  returns: v.union(
    v.object({
      profileId: v.id("profiles"),
      handle: v.string(),
      displayName: v.string(),
      status: membershipStatusValidator,
      active: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const viewer = await getXViewer(ctx);
    if (!viewer) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_x_user_id", (q) => q.eq("xUserId", viewer.xUserId))
      .unique();
    if (!profile) return null;

    return {
      profileId: profile._id,
      handle: profile.handle,
      displayName: profile.displayName,
      status:
        profile.membershipStatus ??
        (profile.active ? ("approved" as const) : ("rejected" as const)),
      active: profile.active,
    };
  },
});

export const requestToJoin = mutation({
  args: {},
  returns: v.object({
    profileId: v.id("profiles"),
    status: membershipStatusValidator,
  }),
  handler: async (ctx): Promise<{
    profileId: Id<"profiles">;
    status: "pending" | "approved" | "rejected";
  }> => {
    const viewer = await getXViewer(ctx);
    if (!viewer || !viewer.xUsername) {
      throw new Error("Sign in with X before requesting to join.");
    }

    const normalizedHandle = normalizeHandle(viewer.xUsername);
    const byXUserId = await ctx.db
      .query("profiles")
      .withIndex("by_x_user_id", (q) => q.eq("xUserId", viewer.xUserId))
      .unique();
    const existing =
      byXUserId ??
      (await ctx.db
        .query("profiles")
        .withIndex("by_normalized_handle", (q) =>
          q.eq("normalizedHandle", normalizedHandle),
        )
        .unique());
    const now = Date.now();

    if (existing) {
      const status =
        existing.membershipStatus ??
        (existing.active ? ("approved" as const) : ("pending" as const));
      if (status === "approved") {
        return { profileId: existing._id, status };
      }
      await ctx.db.patch("profiles", existing._id, {
        handle: viewer.xUsername,
        normalizedHandle,
        displayName: viewer.name,
        profileImageUrl: viewer.image,
        xUserId: viewer.xUserId,
        authUserId: viewer.userId,
        membershipStatus: "pending",
        source: "self-join",
        requestedAt: now,
        active: false,
        updatedAt: now,
      });
      return { profileId: existing._id, status: "pending" };
    }

    const profileId = await ctx.db.insert("profiles", {
      handle: viewer.xUsername,
      normalizedHandle,
      displayName: viewer.name,
      bio: null,
      profileImageUrl: viewer.image,
      xUserId: viewer.xUserId,
      active: false,
      syncStatus: "pending",
      syncError: null,
      currentImpressions: 0,
      currentPosts: 0,
      currentEngagements: 0,
      currentFollowers: 0,
      lastSyncedAt: null,
      addedAt: now,
      updatedAt: now,
      membershipStatus: "pending",
      source: "self-join",
      authUserId: viewer.userId,
      requestedAt: now,
    });
    return { profileId, status: "pending" };
  },
});

export const reviewMembership = mutation({
  args: {
    profileId: v.id("profiles"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch("profiles", args.profileId, {
      membershipStatus: args.decision,
      active: args.decision === "approved",
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const findExistingForImport = internalQuery({
  args: {
    people: v.array(
      v.object({
        handle: v.string(),
        xUserId: v.string(),
      }),
    ),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const existing = new Set<string>();
    for (const person of args.people.slice(0, 100)) {
      const byId = await ctx.db
        .query("profiles")
        .withIndex("by_x_user_id", (q) => q.eq("xUserId", person.xUserId))
        .unique();
      const byHandle = byId
        ? null
        : await ctx.db
            .query("profiles")
            .withIndex("by_normalized_handle", (q) =>
              q.eq("normalizedHandle", person.handle.toLowerCase()),
            )
            .unique();
      if (byId || byHandle) existing.add(person.xUserId);
    }
    return [...existing];
  },
});

export const importPrepared = internalMutation({
  args: {
    entries: v.array(importEntryValidator),
    source: v.union(v.literal("bulk"), v.literal("x-list")),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const entry of args.entries.slice(0, 100)) {
      if (entry.status !== "valid" || !entry.xUserId) {
        skipped += 1;
        continue;
      }
      const normalizedHandle = normalizeHandle(entry.handle);
      const byId = await ctx.db
        .query("profiles")
        .withIndex("by_x_user_id", (q) => q.eq("xUserId", entry.xUserId))
        .unique();
      const existing =
        byId ??
        (await ctx.db
          .query("profiles")
          .withIndex("by_normalized_handle", (q) =>
            q.eq("normalizedHandle", normalizedHandle),
          )
          .unique());
      const now = Date.now();

      if (existing) {
        await ctx.db.patch("profiles", existing._id, {
          handle: entry.handle,
          normalizedHandle,
          displayName: entry.displayName,
          bio: entry.bio,
          profileImageUrl: entry.profileImageUrl,
          xUserId: entry.xUserId,
          currentFollowers: entry.followerCount,
          membershipStatus: "approved",
          source: args.source,
          active: true,
          reviewedAt: now,
          updatedAt: now,
        });
        updated += 1;
        continue;
      }

      await ctx.db.insert("profiles", {
        handle: entry.handle,
        normalizedHandle,
        displayName: entry.displayName,
        bio: entry.bio,
        profileImageUrl: entry.profileImageUrl,
        xUserId: entry.xUserId,
        active: true,
        syncStatus: "pending",
        syncError: null,
        currentImpressions: 0,
        currentPosts: 0,
        currentEngagements: 0,
        currentFollowers: entry.followerCount,
        lastSyncedAt: null,
        addedAt: now,
        updatedAt: now,
        membershipStatus: "approved",
        source: args.source,
        reviewedAt: now,
      });
      created += 1;
    }
    return { created, updated, skipped };
  },
});

export const getForSync = internalQuery({
  args: { profileId: v.id("profiles") },
  returns: v.union(syncTargetValidator, v.null()),
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("profiles", args.profileId);
    if (!profile || !profile.active) return null;
    return { profileId: profile._id, handle: profile.handle };
  },
});

// Sync targets are paged in join order (addedAt), never score order. The old
// version read the impressions index ascending with a 100 row cap, so a board
// past 100 people silently skipped its highest-impression profiles every run.
export const listForSync = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
  },
  returns: v.object({
    targets: v.array(syncTargetValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(Math.floor(args.numItems), 1), 200);
    const page = await ctx.db
      .query("profiles")
      .withIndex("by_active_and_added_at", (q) => q.eq("active", true))
      .paginate({ cursor: args.cursor, numItems });
    return {
      targets: page.page.map((profile) => ({
        profileId: profile._id,
        handle: profile.handle,
      })),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const recordSyncFailure = internalMutation({
  args: {
    profileId: v.id("profiles"),
    status: syncStatusValidator,
    message: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch("profiles", args.profileId, {
      syncStatus: args.status,
      syncError: args.message.slice(0, 280),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const recordSyncSuccess = internalMutation({
  args: {
    profileId: v.id("profiles"),
    handle: v.string(),
    displayName: v.string(),
    bio: v.union(v.string(), v.null()),
    profileImageUrl: v.union(v.string(), v.null()),
    xUserId: v.string(),
    impressions: v.number(),
    postCount: v.number(),
    engagementCount: v.number(),
    followerCount: v.number(),
    windowStart: v.number(),
    windowEnd: v.number(),
    convexPostCount: v.number(),
    convexImpressions: v.number(),
    convexEngagements: v.number(),
    convexPosts: v.array(convexPostValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const capturedAt = Date.now();
    await ctx.db.patch("profiles", args.profileId, {
      handle: args.handle,
      normalizedHandle: args.handle.toLowerCase(),
      displayName: args.displayName,
      bio: args.bio,
      profileImageUrl: args.profileImageUrl,
      xUserId: args.xUserId,
      syncStatus: "synced",
      syncError: null,
      currentImpressions: args.impressions,
      currentPosts: args.postCount,
      currentEngagements: args.engagementCount,
      currentFollowers: args.followerCount,
      currentConvexPosts: args.convexPostCount,
      currentConvexImpressions: args.convexImpressions,
      currentConvexEngagements: args.convexEngagements,
      convexScannedAt: capturedAt,
      lastSyncedAt: capturedAt,
      updatedAt: capturedAt,
    });

    const existingSnapshot = await ctx.db
      .query("snapshots")
      .withIndex("by_profile_id_and_window_end", (q) =>
        q.eq("profileId", args.profileId).eq("windowEnd", args.windowEnd),
      )
      .unique();

    const snapshot = {
      profileId: args.profileId,
      windowStart: args.windowStart,
      windowEnd: args.windowEnd,
      capturedAt,
      impressions: args.impressions,
      postCount: args.postCount,
      engagementCount: args.engagementCount,
      followerCount: args.followerCount,
      convexPostCount: args.convexPostCount,
      convexImpressions: args.convexImpressions,
      convexEngagements: args.convexEngagements,
      convexPosts: args.convexPosts,
    };

    if (existingSnapshot) {
      await ctx.db.patch("snapshots", existingSnapshot._id, snapshot);
    } else {
      await ctx.db.insert("snapshots", snapshot);
    }
    return null;
  },
});
