import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import { requireAdmin } from "./authz";
import { parseXUser, requestX, requireAdminAction } from "./imports";
import { upsertImportedProfile } from "./profiles";
import { isRecord, isSpendCapError } from "./xSyncParsing";

const X_API_ORIGIN = "https://api.x.com";
const STATE_KEY = "convex";
// Override with MENTION_TARGET_HANDLE on a fork that tracks another account.
const DEFAULT_TARGET_HANDLE = "convex";
const DAY_MS = 24 * 60 * 60 * 1000;
export const MENTION_WINDOW_MS = 30 * DAY_MS;
const POST_RETENTION_MS = 35 * DAY_MS;
export const QUEUE_THRESHOLD = 2;
// X caps the mentions timeline at the 800 most recent posts (8 pages of 100).
const MAX_PAGES = 8;
const POST_TEXT_LIMIT = 200;
// Bounded counts: nobody needs an exact number past this to be queued.
const COUNT_CAP = 100;
const RECOUNT_BATCH = 100;
const PRUNE_BATCH = 500;
const QUEUE_COUNT_CAP = 1000;
// Recommended schedule: fresh enough for a review queue, 6x fewer X requests
// than hourly, and roughly 40x headroom under X's 800 mention cap per run.
export const DEFAULT_INTERVAL_HOURS = 6;
// Cron runs drift by seconds; the grace keeps a 6 hour schedule from slipping
// to 7 hours when the last scan finished a little after the hour.
const SCAN_GRACE_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const intervalHoursValidator = v.union(v.literal(1), v.literal(4), v.literal(6));
type IntervalHours = typeof intervalHoursValidator.type;

// Pure due check for the hourly cron. Exported for tests.
export function isScanDue(
  lastScannedAt: number | null,
  intervalHours: IntervalHours,
  now: number,
): boolean {
  if (lastScannedAt === null) return true;
  return now - lastScannedAt >= intervalHours * HOUR_MS - SCAN_GRACE_MS;
}

const candidateStatus = v.union(
  v.literal("watching"),
  v.literal("queued"),
  v.literal("added"),
  v.literal("dismissed"),
);

const listStatus = v.union(
  v.literal("queued"),
  v.literal("added"),
  v.literal("dismissed"),
);

const mentionPostInput = v.object({
  postId: v.string(),
  authorXUserId: v.string(),
  text: v.string(),
  url: v.string(),
  postedAt: v.number(),
});

const mentionAuthorInput = v.object({
  xUserId: v.string(),
  handle: v.string(),
  displayName: v.string(),
  profileImageUrl: v.union(v.string(), v.null()),
  bio: v.union(v.string(), v.null()),
  followerCount: v.number(),
});

type MentionPostInput = typeof mentionPostInput.type;
type MentionAuthorInput = typeof mentionAuthorInput.type;

const queueRowValidator = v.object({
  _id: v.id("mentionCandidates"),
  xUserId: v.string(),
  handle: v.string(),
  displayName: v.string(),
  profileImageUrl: v.union(v.string(), v.null()),
  bio: v.union(v.string(), v.null()),
  followerCount: v.number(),
  recentMentionCount: v.number(),
  lastMentionAt: v.number(),
  status: candidateStatus,
  reviewedAt: v.union(v.number(), v.null()),
  lastPosts: v.array(
    v.object({
      postId: v.string(),
      url: v.string(),
      text: v.string(),
      postedAt: v.number(),
    }),
  ),
});

const scanResultValidator = v.object({
  status: v.union(
    v.literal("ok"),
    v.literal("missing_key"),
    v.literal("error"),
    v.literal("disabled"),
    v.literal("not_due"),
  ),
  pages: v.number(),
  postsRead: v.number(),
  newPosts: v.number(),
  message: v.union(v.string(), v.null()),
});

type ScanResult = typeof scanResultValidator.type;

type ScanState = {
  targetHandle: string;
  targetXUserId: string | null;
  sinceId: string | null;
  lastScannedAt: number | null;
  enabled: boolean;
  intervalHours: IntervalHours;
};

function targetHandle(): string {
  const handle = process.env.MENTION_TARGET_HANDLE?.trim().replace(/^@+/, "");
  return handle ? handle.toLowerCase() : DEFAULT_TARGET_HANDLE;
}

export type MentionPage = {
  posts: Array<MentionPostInput>;
  authors: Array<MentionAuthorInput>;
  newestId: string | null;
  nextToken: string | null;
};

// Pure parse of one mentions timeline page. Drops posts by the target
// account itself and posts whose author was not expanded (protected or
// suspended accounts).
export function parseMentionPage(
  payload: unknown,
  targetXUserId: string,
): MentionPage {
  const empty: MentionPage = {
    posts: [],
    authors: [],
    newestId: null,
    nextToken: null,
  };
  if (!isRecord(payload)) return empty;

  const meta = isRecord(payload.meta) ? payload.meta : {};
  const includes = isRecord(payload.includes) ? payload.includes : {};
  const users = new Map<string, MentionAuthorInput>();
  if (Array.isArray(includes.users)) {
    for (const value of includes.users) {
      const user = parseXUser(value);
      if (!user) continue;
      users.set(user.id, {
        xUserId: user.id,
        handle: user.username,
        displayName: user.name,
        profileImageUrl: user.profileImageUrl,
        bio: user.description,
        followerCount: user.followerCount,
      });
    }
  }

  const posts: Array<MentionPostInput> = [];
  const authorIds = new Set<string>();
  const data = Array.isArray(payload.data) ? payload.data : [];
  for (const item of data) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id : null;
    const authorId = typeof item.author_id === "string" ? item.author_id : null;
    if (!id || !authorId || authorId === targetXUserId) continue;
    const author = users.get(authorId);
    if (!author) continue;
    const createdAt =
      typeof item.created_at === "string" ? Date.parse(item.created_at) : NaN;
    posts.push({
      postId: id,
      authorXUserId: authorId,
      text: (typeof item.text === "string" ? item.text : "").slice(
        0,
        POST_TEXT_LIMIT,
      ),
      url: `https://x.com/${author.handle}/status/${id}`,
      postedAt: Number.isFinite(createdAt) ? createdAt : 0,
    });
    authorIds.add(authorId);
  }

  return {
    posts,
    authors: [...authorIds].flatMap((id) => {
      const author = users.get(id);
      return author ? [author] : [];
    }),
    newestId: typeof meta.newest_id === "string" ? meta.newest_id : null,
    nextToken: typeof meta.next_token === "string" ? meta.next_token : null,
  };
}

// ----- Scan state -----

export const getScanState = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      targetHandle: v.string(),
      targetXUserId: v.union(v.string(), v.null()),
      sinceId: v.union(v.string(), v.null()),
      lastScannedAt: v.union(v.number(), v.null()),
      enabled: v.boolean(),
      intervalHours: intervalHoursValidator,
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const state = await ctx.db
      .query("mentionScanState")
      .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
      .unique();
    if (!state) return null;
    return {
      targetHandle: state.targetHandle,
      targetXUserId: state.targetXUserId,
      sinceId: state.sinceId,
      lastScannedAt: state.lastScannedAt,
      enabled: state.enabled ?? true,
      intervalHours: state.intervalHours ?? DEFAULT_INTERVAL_HOURS,
    };
  },
});

// Writes the scan result. `sinceId` only advances after a full successful
// scan, so a failed run rereads the same posts next time (deduped on insert).
export const saveScanState = internalMutation({
  args: {
    targetHandle: v.string(),
    targetXUserId: v.union(v.string(), v.null()),
    sinceId: v.optional(v.union(v.string(), v.null())),
    lastError: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const state = await ctx.db
      .query("mentionScanState")
      .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
      .unique();
    // A changed target handle restarts the cursor.
    const targetChanged = state !== null && state.targetHandle !== args.targetHandle;
    const sinceId =
      args.sinceId !== undefined
        ? args.sinceId
        : targetChanged
          ? null
          : (state?.sinceId ?? null);

    if (!state) {
      await ctx.db.insert("mentionScanState", {
        key: STATE_KEY,
        targetHandle: args.targetHandle,
        targetXUserId: args.targetXUserId,
        sinceId,
        firstScannedAt: args.lastError === null ? now : null,
        lastScannedAt: now,
        lastError: args.lastError,
        updatedAt: now,
      });
      return null;
    }
    await ctx.db.patch("mentionScanState", state._id, {
      targetHandle: args.targetHandle,
      targetXUserId: args.targetXUserId,
      sinceId,
      firstScannedAt:
        targetChanged || state.firstScannedAt === null
          ? args.lastError === null
            ? now
            : null
          : state.firstScannedAt,
      lastScannedAt: now,
      lastError: args.lastError,
      updatedAt: now,
    });
    return null;
  },
});

// ----- Recording mentions -----

async function countRecentMentions(
  ctx: MutationCtx,
  xUserId: string,
  now: number,
): Promise<{ count: number; lastMentionAt: number }> {
  const recent = await ctx.db
    .query("mentionPosts")
    .withIndex("by_author_x_user_id_and_posted_at", (q) =>
      q.eq("authorXUserId", xUserId).gte("postedAt", now - MENTION_WINDOW_MS),
    )
    .order("desc")
    .take(COUNT_CAP);
  if (recent[0]) return { count: recent.length, lastMentionAt: recent[0].postedAt };
  const latest = await ctx.db
    .query("mentionPosts")
    .withIndex("by_author_x_user_id_and_posted_at", (q) =>
      q.eq("authorXUserId", xUserId),
    )
    .order("desc")
    .first();
  return { count: 0, lastMentionAt: latest?.postedAt ?? 0 };
}

function nextStatus(
  current: Doc<"mentionCandidates">["status"] | null,
  count: number,
  onBoard: boolean,
): Doc<"mentionCandidates">["status"] {
  if (onBoard || current === "added") return "added";
  if (current === "dismissed") return "dismissed";
  return count >= QUEUE_THRESHOLD ? "queued" : "watching";
}

async function isOnBoard(ctx: MutationCtx, xUserId: string): Promise<boolean> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_x_user_id", (q) => q.eq("xUserId", xUserId))
    .first();
  return profile !== null;
}

async function recordMentionsImpl(
  ctx: MutationCtx,
  posts: Array<MentionPostInput>,
  authors: Array<MentionAuthorInput>,
): Promise<number> {
  const now = Date.now();
  let inserted = 0;
  for (const post of posts) {
    const existing = await ctx.db
      .query("mentionPosts")
      .withIndex("by_post_id", (q) => q.eq("postId", post.postId))
      .unique();
    if (existing) continue;
    await ctx.db.insert("mentionPosts", post);
    inserted += 1;
  }

  for (const author of authors) {
    const { count, lastMentionAt } = await countRecentMentions(
      ctx,
      author.xUserId,
      now,
    );
    const onBoard = await isOnBoard(ctx, author.xUserId);
    const candidate = await ctx.db
      .query("mentionCandidates")
      .withIndex("by_x_user_id", (q) => q.eq("xUserId", author.xUserId))
      .unique();
    const fields = {
      handle: author.handle,
      normalizedHandle: author.handle.toLowerCase(),
      displayName: author.displayName,
      profileImageUrl: author.profileImageUrl,
      bio: author.bio,
      followerCount: author.followerCount,
      recentMentionCount: count,
      lastMentionAt,
      status: nextStatus(candidate?.status ?? null, count, onBoard),
      updatedAt: now,
    };
    if (candidate) {
      await ctx.db.patch("mentionCandidates", candidate._id, fields);
    } else {
      await ctx.db.insert("mentionCandidates", {
        xUserId: author.xUserId,
        reviewedAt: null,
        ...fields,
      });
    }
  }
  return inserted;
}

export const recordMentions = internalMutation({
  args: {
    posts: v.array(mentionPostInput),
    authors: v.array(mentionAuthorInput),
  },
  returns: v.number(),
  handler: async (ctx, args) =>
    await recordMentionsImpl(ctx, args.posts, args.authors),
});

// ----- Scanning X -----

async function resolveTargetId(handle: string, token: string): Promise<string> {
  const url = new URL(
    `/2/users/by/username/${encodeURIComponent(handle)}`,
    X_API_ORIGIN,
  );
  const payload = await requestX(url, token);
  const user = isRecord(payload) ? parseXUser(payload.data) : null;
  if (!user) throw new Error(`X did not return an account for @${handle}.`);
  return user.id;
}

// `force` is the Scan now button: it skips the schedule check but still
// respects the admin off switch.
async function scanImpl(ctx: ActionCtx, force: boolean): Promise<ScanResult> {
  const handle = targetHandle();
  const token = process.env.X_BEARER_TOKEN;
  const state: ScanState | null = await ctx.runQuery(
    internal.mentionQueue.getScanState,
    {},
  );
  if (state && !state.enabled) {
    return {
      status: "disabled",
      pages: 0,
      postsRead: 0,
      newPosts: 0,
      message: "Mention scans are turned off. Turn them on in Automatic scans.",
    };
  }
  if (
    !force &&
    state &&
    !isScanDue(state.lastScannedAt, state.intervalHours, Date.now())
  ) {
    return { status: "not_due", pages: 0, postsRead: 0, newPosts: 0, message: null };
  }
  const sameTarget = state?.targetHandle === handle;
  let targetXUserId = sameTarget ? (state?.targetXUserId ?? null) : null;

  if (!token) {
    const message = "Add X_BEARER_TOKEN to this Convex deployment to scan mentions.";
    await ctx.runMutation(internal.mentionQueue.saveScanState, {
      targetHandle: handle,
      targetXUserId,
      lastError: message,
    });
    return { status: "missing_key", pages: 0, postsRead: 0, newPosts: 0, message };
  }

  let pages = 0;
  let postsRead = 0;
  let newPosts = 0;
  try {
    targetXUserId ??= await resolveTargetId(handle, token);
    const sinceId = sameTarget ? (state?.sinceId ?? null) : null;
    let newestId: string | null = null;
    let nextToken: string | null = null;

    for (; pages < MAX_PAGES; ) {
      const url = new URL(`/2/users/${targetXUserId}/mentions`, X_API_ORIGIN);
      url.searchParams.set("max_results", "100");
      // since_id reads only posts newer than the last full scan; the first
      // scan backfills the rolling window instead.
      if (sinceId) url.searchParams.set("since_id", sinceId);
      else {
        url.searchParams.set(
          "start_time",
          new Date(Date.now() - MENTION_WINDOW_MS).toISOString(),
        );
      }
      url.searchParams.set("tweet.fields", "created_at,author_id");
      url.searchParams.set("expansions", "author_id");
      url.searchParams.set(
        "user.fields",
        "description,profile_image_url,public_metrics",
      );
      if (nextToken) url.searchParams.set("pagination_token", nextToken);

      const page = parseMentionPage(await requestX(url, token), targetXUserId);
      pages += 1;
      newestId ??= page.newestId;
      postsRead += page.posts.length;
      if (page.posts.length > 0) {
        newPosts += await ctx.runMutation(internal.mentionQueue.recordMentions, {
          posts: page.posts,
          authors: page.authors,
        });
      }
      nextToken = page.nextToken;
      if (!nextToken) break;
    }

    await ctx.runMutation(internal.mentionQueue.saveScanState, {
      targetHandle: handle,
      targetXUserId,
      sinceId: newestId ?? sinceId,
      lastError: null,
    });
    return { status: "ok", pages, postsRead, newPosts, message: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mention scan failed.";
    if (isSpendCapError(message)) {
      console.warn(`Mention scan stopped: ${message}`);
    }
    await ctx.runMutation(internal.mentionQueue.saveScanState, {
      targetHandle: handle,
      targetXUserId,
      lastError: message,
    });
    return { status: "error", pages, postsRead, newPosts, message };
  }
}

// Called by the hourly cron. Off or not due returns before any X request,
// so the admin chosen interval is what decides X usage.
export const scanScheduled = internalAction({
  args: {},
  returns: scanResultValidator,
  handler: async (ctx): Promise<ScanResult> => await scanImpl(ctx, false),
});

export const scanNow = action({
  args: {},
  returns: scanResultValidator,
  handler: async (ctx): Promise<ScanResult> => {
    await requireAdminAction(ctx);
    return await scanImpl(ctx, true);
  },
});

// Admin on/off switch and schedule. Creates the state doc on first save.
export const setScanSettings = mutation({
  args: {
    enabled: v.boolean(),
    intervalHours: intervalHoursValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const state = await ctx.db
      .query("mentionScanState")
      .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
      .unique();
    if (state) {
      await ctx.db.patch("mentionScanState", state._id, {
        enabled: args.enabled,
        intervalHours: args.intervalHours,
        updatedAt: now,
      });
      return null;
    }
    await ctx.db.insert("mentionScanState", {
      key: STATE_KEY,
      targetHandle: targetHandle(),
      targetXUserId: null,
      sinceId: null,
      firstScannedAt: null,
      lastScannedAt: null,
      lastError: null,
      enabled: args.enabled,
      intervalHours: args.intervalHours,
      updatedAt: now,
    });
    return null;
  },
});

// ----- Rolling window upkeep -----

// Recounts queued people so anyone whose mentions aged out of the 30 day
// window drops back to watching. Pages through itself, then prunes old posts.
export const recountWindow = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const result = await ctx.db
      .query("mentionCandidates")
      .withIndex("by_status_and_last_mention_at", (q) => q.eq("status", "queued"))
      .paginate({ cursor: args.cursor, numItems: RECOUNT_BATCH });
    for (const candidate of result.page) {
      const { count, lastMentionAt } = await countRecentMentions(
        ctx,
        candidate.xUserId,
        now,
      );
      if (
        count === candidate.recentMentionCount &&
        lastMentionAt === candidate.lastMentionAt
      ) {
        continue;
      }
      await ctx.db.patch("mentionCandidates", candidate._id, {
        recentMentionCount: count,
        lastMentionAt,
        status: count >= QUEUE_THRESHOLD ? "queued" : "watching",
        updatedAt: now,
      });
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.mentionQueue.recountWindow, {
        cursor: result.continueCursor,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.mentionQueue.pruneOldPosts, {});
    }
    return null;
  },
});

export const pruneOldPosts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const old = await ctx.db
      .query("mentionPosts")
      .withIndex("by_posted_at", (q) =>
        q.lt("postedAt", Date.now() - POST_RETENTION_MS),
      )
      .take(PRUNE_BATCH);
    for (const post of old) {
      await ctx.db.delete("mentionPosts", post._id);
    }
    if (old.length === PRUNE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.mentionQueue.pruneOldPosts, {});
    }
    return null;
  },
});

// ----- Admin queue -----

export const listQueue = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(listStatus),
  },
  returns: paginationResultValidator(queueRowValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const status = args.status ?? "queued";
    const result = await ctx.db
      .query("mentionCandidates")
      .withIndex("by_status_and_last_mention_at", (q) => q.eq("status", status))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      result.page.map(async (candidate) => {
        const lastPosts = await ctx.db
          .query("mentionPosts")
          .withIndex("by_author_x_user_id_and_posted_at", (q) =>
            q.eq("authorXUserId", candidate.xUserId),
          )
          .order("desc")
          .take(2);
        return {
          _id: candidate._id,
          xUserId: candidate.xUserId,
          handle: candidate.handle,
          displayName: candidate.displayName,
          profileImageUrl: candidate.profileImageUrl,
          bio: candidate.bio,
          followerCount: candidate.followerCount,
          recentMentionCount: candidate.recentMentionCount,
          lastMentionAt: candidate.lastMentionAt,
          status: candidate.status,
          reviewedAt: candidate.reviewedAt,
          lastPosts: lastPosts.map((post) => ({
            postId: post.postId,
            url: post.url,
            text: post.text,
            postedAt: post.postedAt,
          })),
        };
      }),
    );
    return { ...result, page };
  },
});

export const getScanStatus = query({
  args: {},
  returns: v.object({
    targetHandle: v.string(),
    xApiConfigured: v.boolean(),
    firstScannedAt: v.union(v.number(), v.null()),
    lastScannedAt: v.union(v.number(), v.null()),
    lastError: v.union(v.string(), v.null()),
    queuedCount: v.number(),
    queuedCountCapped: v.boolean(),
    enabled: v.boolean(),
    intervalHours: intervalHoursValidator,
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const state = await ctx.db
      .query("mentionScanState")
      .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
      .unique();
    const queued = await ctx.db
      .query("mentionCandidates")
      .withIndex("by_status_and_last_mention_at", (q) => q.eq("status", "queued"))
      .take(QUEUE_COUNT_CAP);
    return {
      targetHandle: state?.targetHandle ?? targetHandle(),
      xApiConfigured: Boolean(process.env.X_BEARER_TOKEN),
      firstScannedAt: state?.firstScannedAt ?? null,
      lastScannedAt: state?.lastScannedAt ?? null,
      lastError: state?.lastError ?? null,
      queuedCount: queued.length,
      queuedCountCapped: queued.length === QUEUE_COUNT_CAP,
      enabled: state?.enabled ?? true,
      intervalHours: state?.intervalHours ?? DEFAULT_INTERVAL_HOURS,
    };
  },
});

// Adds a queued person to the main board and schedules their first metrics
// sync. Safe to call twice: an already added candidate returns its profile.
export const addToBoard = mutation({
  args: { candidateId: v.id("mentionCandidates") },
  returns: v.object({
    profileId: v.id("profiles"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const candidate = await ctx.db.get("mentionCandidates", args.candidateId);
    if (!candidate) throw new Error("This person is no longer in the queue.");

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_x_user_id", (q) => q.eq("xUserId", candidate.xUserId))
      .first();
    let profileId: Id<"profiles">;
    let created = false;
    if (existing && existing.active) {
      profileId = existing._id;
    } else {
      const result = await upsertImportedProfile(
        ctx,
        {
          handle: candidate.handle,
          xUserId: candidate.xUserId,
          displayName: candidate.displayName,
          bio: candidate.bio,
          profileImageUrl: candidate.profileImageUrl,
          followerCount: candidate.followerCount,
        },
        "mention-queue",
      );
      profileId = result.profileId;
      created = result.created;
      await ctx.scheduler.runAfter(0, internal.xSync.refreshOneInternal, {
        profileId,
      });
    }

    const now = Date.now();
    await ctx.db.patch("mentionCandidates", candidate._id, {
      status: "added",
      reviewedAt: now,
      updatedAt: now,
    });
    return { profileId, created };
  },
});

export const dismiss = mutation({
  args: { candidateId: v.id("mentionCandidates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    await ctx.db.patch("mentionCandidates", args.candidateId, {
      status: "dismissed",
      reviewedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const restore = mutation({
  args: { candidateId: v.id("mentionCandidates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const candidate = await ctx.db.get("mentionCandidates", args.candidateId);
    if (!candidate) return null;
    const now = Date.now();
    const { count, lastMentionAt } = await countRecentMentions(
      ctx,
      candidate.xUserId,
      now,
    );
    await ctx.db.patch("mentionCandidates", candidate._id, {
      recentMentionCount: count,
      lastMentionAt,
      status: count >= QUEUE_THRESHOLD ? "queued" : "watching",
      reviewedAt: null,
      updatedAt: now,
    });
    return null;
  },
});
