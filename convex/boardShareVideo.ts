import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, mutation, query, type ActionCtx } from "./_generated/server";
import { requireAdmin } from "./authz";
import { buildBoardSnapshot } from "./boardShares";
import type { SiteBranding } from "./brandingDefaults";
import { boardShareRowValidator } from "./validators";

// Admin only ranking videos for board snapshots. The admin's browser renders
// the MP4 from the same SVG as the PNG card (src/lib/boardVideo.ts), uploads
// it to file storage, and attaches it to the boardShares doc. Every function
// here checks admin access on the server.

export const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

async function requireAdminAction(ctx: ActionCtx): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in with X to continue.");
  const isAdmin: boolean = await ctx.runQuery(internal.authz.isAdminUser, { userId });
  if (!isAdmin) throw new Error("This X account is not on the admin allowlist.");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

// Same avatar rule as the PNG renderer: the 400px variant, placeholder on
// any failure. Fetched here so the admin's canvas never loads a cross origin
// image and taints.
async function avatarDataUri(profileImageUrl: string | null): Promise<string | null> {
  if (!profileImageUrl) return null;
  try {
    const response = await fetch(profileImageUrl.replace("_normal", "_400x400"));
    if (!response.ok) return null;
    const mime = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim();
    if (!mime.startsWith("image/")) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

type ShareForRender = {
  _id: Id<"boardShares">;
  board: string;
  boardLabel: string;
  kind: "ranked" | "legends";
  metricLabel: string;
  rows: Array<{
    rank: number | null;
    handle: string;
    displayName: string;
    profileImageUrl: string | null;
    value: number | null;
  }>;
  dataAsOf: number | null;
  rankingDay: string | null;
};

const videoInputsValidator = v.object({
  shareId: v.id("boardShares"),
  board: v.string(),
  communityName: v.string(),
  boardName: v.string(),
  boardLabel: v.string(),
  kind: v.union(v.literal("ranked"), v.literal("legends")),
  metricLabel: v.string(),
  dataAsOf: v.union(v.number(), v.null()),
  rankingDay: v.union(v.string(), v.null()),
  rows: v.array(
    v.object({
      rank: v.union(v.number(), v.null()),
      handle: v.string(),
      displayName: v.string(),
      avatar: v.union(v.string(), v.null()),
      value: v.union(v.number(), v.null()),
    }),
  ),
});

// Frozen rows, branding, and avatars as data URIs: everything the browser
// needs to draw the frames.
export const getVideoInputs = action({
  args: { shareId: v.string() },
  returns: v.union(videoInputsValidator, v.null()),
  handler: async (ctx, args): Promise<Infer<typeof videoInputsValidator> | null> => {
    await requireAdminAction(ctx);
    const share: ShareForRender | null = await ctx.runQuery(
      internal.boardShares.getForRender,
      { shareId: args.shareId },
    );
    if (!share) return null;
    const [branding, avatars]: [SiteBranding, Array<string | null>] = await Promise.all([
      ctx.runQuery(internal.siteSettings.getSiteBrandingInternal, {}),
      Promise.all(share.rows.map((row) => avatarDataUri(row.profileImageUrl))),
    ]);
    return {
      shareId: share._id,
      board: share.board,
      communityName: branding.communityName,
      boardName: branding.boardName,
      boardLabel: share.boardLabel,
      kind: share.kind,
      metricLabel: share.metricLabel,
      dataAsOf: share.dataAsOf,
      rankingDay: share.rankingDay,
      rows: share.rows.map((row, index) => ({
        rank: row.rank,
        handle: row.handle,
        displayName: row.displayName,
        avatar: avatars[index] ?? null,
        value: row.value,
      })),
    };
  },
});

// The rows Make snapshot would freeze for this board and day, kept live so
// the admin sees today's ranking before anything is saved. `existingShareId`
// is set when an identical snapshot already exists.
export const previewSnapshot = query({
  args: { board: v.string(), day: v.optional(v.string()) },
  returns: v.union(
    v.object({
      boardLabel: v.string(),
      kind: v.union(v.literal("ranked"), v.literal("legends")),
      metricLabel: v.string(),
      rows: v.array(boardShareRowValidator),
      dataAsOf: v.union(v.number(), v.null()),
      rankingDay: v.union(v.string(), v.null()),
      existingShareId: v.union(v.id("boardShares"), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const snapshot = await buildBoardSnapshot(ctx, args.board, args.day ?? null);
    if (!snapshot) return null;
    return {
      boardLabel: snapshot.boardLabel,
      kind: snapshot.kind,
      metricLabel: snapshot.metricLabel,
      rows: snapshot.rows,
      dataAsOf: snapshot.dataAsOf,
      rankingDay: snapshot.rankingDay,
      existingShareId: snapshot.existingShareId,
    };
  },
});

export const generateVideoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// A bad upload is deleted and reported instead of thrown: a throw would roll
// back the delete along with everything else and leave the file in storage.
export const attachVideo = mutation({
  args: { shareId: v.id("boardShares"), storageId: v.id("_storage") },
  returns: v.union(
    v.object({ status: v.literal("attached"), videoRenderedAt: v.number() }),
    v.object({ status: v.literal("rejected"), reason: v.string() }),
  ),
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const reject = async (reason: string) => {
      await ctx.storage.delete(args.storageId);
      return { status: "rejected" as const, reason };
    };

    const file = await ctx.db.system.get("_storage", args.storageId);
    if (!file) return { status: "rejected" as const, reason: "The upload did not arrive. Try again." };
    if (file.contentType !== "video/mp4") return await reject("Only MP4 videos can be attached.");
    if (file.size > MAX_VIDEO_BYTES) return await reject("Videos must be 8 MB or smaller.");

    const share = await ctx.db.get("boardShares", args.shareId);
    if (!share) return await reject("That snapshot no longer exists.");
    if (share.videoStorageId && share.videoStorageId !== args.storageId) {
      await ctx.storage.delete(share.videoStorageId);
    }
    const videoRenderedAt = Date.now();
    await ctx.db.patch("boardShares", args.shareId, {
      videoStorageId: args.storageId,
      videoRenderedBy: viewer.xUserId,
      videoRenderedAt,
    });
    return { status: "attached" as const, videoRenderedAt };
  },
});

export const removeVideo = mutation({
  args: { shareId: v.id("boardShares") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const share = await ctx.db.get("boardShares", args.shareId);
    if (!share?.videoStorageId) return null;
    await ctx.storage.delete(share.videoStorageId);
    await ctx.db.patch("boardShares", args.shareId, {
      videoStorageId: undefined,
      videoRenderedBy: undefined,
      videoRenderedAt: undefined,
    });
    return null;
  },
});

// Video state for the snapshot open on the admin page.
export const getShareVideo = query({
  args: { shareId: v.id("boardShares") },
  returns: v.union(
    v.object({
      hasVideo: v.boolean(),
      videoRenderedAt: v.union(v.number(), v.null()),
      videoBytes: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const share = await ctx.db.get("boardShares", args.shareId);
    if (!share) return null;
    const file = share.videoStorageId
      ? await ctx.db.system.get("_storage", share.videoStorageId)
      : null;
    return {
      hasVideo: file !== null,
      videoRenderedAt: share.videoRenderedAt ?? null,
      videoBytes: file?.size ?? null,
    };
  },
});

const recentShareValidator = v.object({
  _id: v.id("boardShares"),
  _creationTime: v.number(),
  board: v.string(),
  boardLabel: v.string(),
  kind: v.union(v.literal("ranked"), v.literal("legends")),
  topHandles: v.array(v.string()),
  hasVideo: v.boolean(),
  videoRenderedAt: v.union(v.number(), v.null()),
  rankingDay: v.union(v.string(), v.null()),
});

function toRecentShare(share: Doc<"boardShares">) {
  return {
    _id: share._id,
    _creationTime: share._creationTime,
    board: share.board,
    boardLabel: share.boardLabel,
    kind: share.kind,
    topHandles: share.rows.slice(0, 3).map((row) => row.handle),
    hasVideo: share.videoStorageId !== undefined,
    videoRenderedAt: share.videoRenderedAt ?? null,
    rankingDay: share.rankingDay ?? null,
  };
}

// Every snapshot, newest first, public or admin made.
export const listRecent = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(recentShareValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("boardShares")
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(toRecentShare) };
  },
});
