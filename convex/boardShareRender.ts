"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { buildBoardCardSvg } from "./ogArt";
import { avatarDataUri, renderPng, warmRenderer } from "./ogRenderKit";

// Renders a board share card once and keeps it in file storage. Scheduled by
// createBoardShare to prewarm the card before X crawls it, and called by the
// image route on a miss. A card that already exists is returned as is.

type ShareForRender = {
  _id: Id<"boardShares">;
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
  imageStorageId: Id<"_storage"> | null;
};

export const renderAndStore = internalAction({
  args: { shareId: v.string() },
  returns: v.union(v.bytes(), v.null()),
  handler: async (ctx, args): Promise<ArrayBuffer | null> => {
    const share: ShareForRender | null = await ctx.runQuery(
      internal.boardShares.getForRender,
      { shareId: args.shareId },
    );
    if (!share) return null;

    if (share.imageStorageId) {
      const stored = await ctx.storage.get(share.imageStorageId);
      if (stored) return await stored.arrayBuffer();
    }

    const [, branding, avatars] = await Promise.all([
      warmRenderer(),
      ctx.runQuery(internal.siteSettings.getSiteBrandingInternal, {}),
      Promise.all(share.rows.map((row) => avatarDataUri(row.profileImageUrl))),
    ]);

    const png = await renderPng(
      buildBoardCardSvg({
        communityName: branding.communityName,
        boardLabel: share.boardLabel,
        kind: share.kind,
        metricLabel: share.metricLabel,
        dataAsOf: share.dataAsOf,
        rows: share.rows.map((row, index) => ({
          rank: row.rank,
          handle: row.handle,
          displayName: row.displayName,
          avatar: avatars[index] ?? null,
          value: row.value,
        })),
      }),
    );

    const storageId = await ctx.storage.store(
      new Blob([png], { type: "image/png" }),
    );
    await ctx.runMutation(internal.boardShares.saveImage, {
      shareId: share._id,
      storageId,
    });
    return png;
  },
});
