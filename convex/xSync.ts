import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  type ActionCtx,
  internalAction,
} from "./_generated/server";
import { syncResultValidator } from "./validators";
import {
  isRecord,
  numberOrZero,
  parsePostPage,
  stringOrNull,
} from "./xSyncParsing";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const X_API_ORIGIN = "https://api.x.com";

// Cap stored Convex posts at the sync per page fetch limit.
const CONVEX_POST_STORE_LIMIT = 100;
const CONVEX_POST_TEXT_LIMIT = 200;

// How many profiles one listForSync page returns. Small enough that a batch
// plus its X API calls always fits the action deadline below.
const SYNC_BATCH_SIZE = 25;
// Leave headroom inside Convex's 10 minute action limit. When the deadline
// passes with pages remaining, the run continues in a scheduled action.
const SYNC_DEADLINE_MS = 8 * 60 * 1000;

type SyncTarget = {
  profileId: Id<"profiles">;
  handle: string;
};

type SyncResult = {
  status: "synced" | "missing_key" | "error";
  handle: string;
  impressions: number;
  postCount: number;
  message: string | null;
};

type XUser = {
  id: string;
  name: string;
  username: string;
  description: string | null;
  profileImageUrl: string | null;
  followerCount: number;
};

type StoredConvexPost = {
  postId: string;
  url: string;
  text: string;
  postedAt: number;
  impressions: number;
  engagements: number;
};

async function requireAdminAction(ctx: ActionCtx): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in with X to continue.");
  const isAdmin: boolean = await ctx.runQuery(internal.authz.isAdminUser, {
    userId,
  });
  if (!isAdmin) throw new Error("This X account is not on the admin allowlist.");
}

function getXError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.title === "string") return payload.title;
  if (Array.isArray(payload.errors) && isRecord(payload.errors[0])) {
    const firstError = payload.errors[0];
    if (typeof firstError.detail === "string") return firstError.detail;
    if (typeof firstError.message === "string") return firstError.message;
    if (typeof firstError.title === "string") return firstError.title;
  }
  return fallback;
}

async function requestX(url: URL, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getXError(payload, `X API request failed (${response.status}).`));
  }
  return payload;
}

function parseUser(payload: unknown): XUser {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error(getXError(payload, "X account not found."));
  }

  const data = payload.data;
  if (
    typeof data.id !== "string" ||
    typeof data.name !== "string" ||
    typeof data.username !== "string"
  ) {
    throw new Error("X returned an incomplete profile response.");
  }

  const publicMetrics = isRecord(data.public_metrics)
    ? data.public_metrics
    : {};

  return {
    id: data.id,
    name: data.name,
    username: data.username,
    description: stringOrNull(data.description),
    profileImageUrl: stringOrNull(data.profile_image_url),
    followerCount: numberOrZero(publicMetrics.followers_count),
  };
}

function startOfUtcDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

async function syncProfile(
  ctx: ActionCtx,
  target: SyncTarget,
): Promise<SyncResult> {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    const message = "Add X_BEARER_TOKEN to this Convex deployment to sync metrics.";
    await ctx.runMutation(internal.profiles.recordSyncFailure, {
      profileId: target.profileId,
      status: "pending",
      message,
    });
    return {
      status: "missing_key",
      handle: target.handle,
      impressions: 0,
      postCount: 0,
      message,
    };
  }

  try {
    const userUrl = new URL(
      `/2/users/by/username/${encodeURIComponent(target.handle)}`,
      X_API_ORIGIN,
    );
    userUrl.searchParams.set(
      "user.fields",
      "description,profile_image_url,public_metrics,protected",
    );
    const user = parseUser(await requestX(userUrl, token));

    const windowEnd = Date.now();
    const windowStart = windowEnd - SEVEN_DAYS_MS;
    let nextToken: string | null = null;
    let impressions = 0;
    let postCount = 0;
    let engagementCount = 0;
    let convexPostCount = 0;
    let convexImpressions = 0;
    let convexEngagements = 0;
    const convexPosts: Array<StoredConvexPost> = [];

    for (let page = 0; page < 10; page += 1) {
      const postsUrl = new URL(`/2/users/${user.id}/tweets`, X_API_ORIGIN);
      postsUrl.searchParams.set("start_time", new Date(windowStart).toISOString());
      postsUrl.searchParams.set("max_results", "100");
      // Replies count as posts, matching the posts number in X analytics.
      // Only reposts are excluded, and parsePostPage double checks that with
      // referenced_tweets because X's exclude filter has leaked before.
      postsUrl.searchParams.set("exclude", "retweets");
      postsUrl.searchParams.set(
        "tweet.fields",
        "created_at,public_metrics,text,referenced_tweets,note_tweet,entities",
      );
      if (nextToken) postsUrl.searchParams.set("pagination_token", nextToken);

      const pageResult = parsePostPage(await requestX(postsUrl, token));
      // Every metric below counts the same filtered set, so Posts,
      // Engagements, Impressions, and the Convex mention totals always
      // describe one consistent group of posts.
      const countedPosts = pageResult.posts.filter((post) => !post.isRepost);
      for (const post of countedPosts) {
        impressions += post.impressionCount;
        engagementCount += post.engagementCount;

        // The mention scan reuses this same fetch, so it costs zero extra
        // X API calls. mentionsConvex covers the post text, long form note
        // text, and expanded convex.dev links.
        if (post.mentionsConvex) {
          convexPostCount += 1;
          convexImpressions += post.impressionCount;
          convexEngagements += post.engagementCount;
          if (convexPosts.length < CONVEX_POST_STORE_LIMIT && post.id) {
            convexPosts.push({
              postId: post.id,
              url: `https://x.com/${user.username}/status/${post.id}`,
              text: post.text.slice(0, CONVEX_POST_TEXT_LIMIT),
              postedAt: post.createdAt,
              impressions: post.impressionCount,
              engagements: post.engagementCount,
            });
          }
        }
      }
      postCount += countedPosts.length;
      nextToken = pageResult.nextToken;
      if (!nextToken) break;
    }

    await ctx.runMutation(internal.profiles.recordSyncSuccess, {
      profileId: target.profileId,
      handle: user.username,
      displayName: user.name,
      bio: user.description,
      profileImageUrl: user.profileImageUrl,
      xUserId: user.id,
      impressions,
      postCount,
      engagementCount,
      followerCount: user.followerCount,
      windowStart,
      windowEnd: startOfUtcDay(windowEnd),
      convexPostCount,
      convexImpressions,
      convexEngagements,
      convexPosts,
    });

    return {
      status: "synced",
      handle: user.username,
      impressions,
      postCount,
      message: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "X sync failed.";
    await ctx.runMutation(internal.profiles.recordSyncFailure, {
      profileId: target.profileId,
      status: "error",
      message,
    });
    return {
      status: "error",
      handle: target.handle,
      impressions: 0,
      postCount: 0,
      message,
    };
  }
}

type RefreshTotals = {
  processed: number;
  synced: number;
  failed: number;
};

type SyncPage = {
  targets: Array<SyncTarget>;
  continueCursor: string;
  isDone: boolean;
};

// Drains listForSync pages from the given cursor. Sequential requests keep
// the integration comfortably below X rate limits. Stops early when the
// action deadline nears so the caller can schedule a continuation instead of
// timing out; every active profile still gets exactly one attempt per run.
async function syncBatchesFrom(
  ctx: ActionCtx,
  startCursor: string | null,
  totals: RefreshTotals,
): Promise<{ nextCursor: string | null }> {
  const startedAt = Date.now();
  let cursor: string | null = startCursor;
  for (;;) {
    const page: SyncPage = await ctx.runQuery(internal.profiles.listForSync, {
      cursor,
      numItems: SYNC_BATCH_SIZE,
    });
    for (const target of page.targets) {
      const result = await syncProfile(ctx, target);
      totals.processed += 1;
      if (result.status === "synced") totals.synced += 1;
      else totals.failed += 1;
    }
    if (page.isDone) return { nextCursor: null };
    cursor = page.continueCursor;
    if (Date.now() - startedAt > SYNC_DEADLINE_MS) {
      return { nextCursor: cursor };
    }
  }
}

async function syncAllProfiles(ctx: ActionCtx): Promise<{
  processed: number;
  synced: number;
  failed: number;
  missingKey: boolean;
  remainderScheduled: boolean;
}> {
  if (!process.env.X_BEARER_TOKEN) {
    return {
      processed: 0,
      synced: 0,
      failed: 0,
      missingKey: true,
      remainderScheduled: false,
    };
  }

  const totals: RefreshTotals = { processed: 0, synced: 0, failed: 0 };
  const { nextCursor } = await syncBatchesFrom(ctx, null, totals);
  if (nextCursor !== null) {
    await ctx.scheduler.runAfter(0, internal.xSync.refreshAllContinuation, {
      cursor: nextCursor,
      ...totals,
    });
  }

  return {
    ...totals,
    missingKey: false,
    remainderScheduled: nextCursor !== null,
  };
}

export const refreshOne = action({
  args: { profileId: v.id("profiles") },
  returns: syncResultValidator,
  handler: async (ctx, args): Promise<SyncResult> => {
    await requireAdminAction(ctx);
    const target: SyncTarget | null = await ctx.runQuery(
      internal.profiles.getForSync,
      { profileId: args.profileId },
    );
    if (!target) {
      return {
        status: "error" as const,
        handle: "unknown",
        impressions: 0,
        postCount: 0,
        message: "This profile is inactive or no longer exists.",
      };
    }
    return await syncProfile(ctx, target);
  },
});

const refreshAllResultValidator = v.object({
  processed: v.number(),
  synced: v.number(),
  failed: v.number(),
  missingKey: v.boolean(),
  remainderScheduled: v.boolean(),
});

export const refreshAll = action({
  args: {},
  returns: refreshAllResultValidator,
  handler: async (ctx) => {
    await requireAdminAction(ctx);
    return await syncAllProfiles(ctx);
  },
});

export const refreshAllScheduled = internalAction({
  args: {},
  returns: refreshAllResultValidator,
  handler: async (ctx) => await syncAllProfiles(ctx),
});

// Picks up a refresh that ran out of action time, resuming from the stored
// cursor with the running totals. Reschedules itself until every active
// profile has been attempted once.
export const refreshAllContinuation = internalAction({
  args: {
    cursor: v.string(),
    processed: v.number(),
    synced: v.number(),
    failed: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const totals: RefreshTotals = {
      processed: args.processed,
      synced: args.synced,
      failed: args.failed,
    };
    const { nextCursor } = await syncBatchesFrom(ctx, args.cursor, totals);
    if (nextCursor !== null) {
      await ctx.scheduler.runAfter(0, internal.xSync.refreshAllContinuation, {
        cursor: nextCursor,
        ...totals,
      });
      return null;
    }
    console.log(
      `refreshAll complete: ${totals.synced} synced, ${totals.failed} failed, ${totals.processed} processed.`,
    );
    return null;
  },
});
