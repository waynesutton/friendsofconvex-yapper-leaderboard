import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";

async function requireAdminAction(ctx: ActionCtx): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in with X to continue.");
  const isAdmin: boolean = await ctx.runQuery(internal.authz.isAdminUser, {
    userId,
  });
  if (!isAdmin) throw new Error("This X account is not on the admin allowlist.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type DigestRow = {
  handle: string;
  displayName: string;
  convexPostCount: number;
  totalPosts: number;
  convexImpressions: number;
  convexStreak: number;
};

type DigestResult = { ok: boolean; message: string };

// Posts the top Convex yappers to Slack. Needs SLACK_BOT_TOKEN plus either
// SLACK_DIGEST_CHANNEL or a channel override argument.
export const postConvexDigest = action({
  args: {
    channel: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<DigestResult> => {
    await requireAdminAction(ctx);

    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) {
      return {
        ok: false,
        message: "Add SLACK_BOT_TOKEN to this Convex deployment first.",
      };
    }
    const channel = args.channel?.trim() || process.env.SLACK_DIGEST_CHANNEL;
    if (!channel) {
      return {
        ok: false,
        message:
          "Set SLACK_DIGEST_CHANNEL in Convex or pass a channel override.",
      };
    }

    const rows: Array<DigestRow> = await ctx.runQuery(
      internal.profiles.listTopConvexYappers,
      { limit: Math.min(Math.max(Math.floor(args.limit ?? 10), 1), 25) },
    );
    if (rows.length === 0 || rows.every((row) => row.convexPostCount === 0)) {
      return {
        ok: false,
        message: "No Convex posts recorded yet. Run a rescan first.",
      };
    }

    const lines = rows.map((row, index) => {
      const streak =
        row.convexStreak >= 2 ? `, ${row.convexStreak}w streak` : "";
      return `${index + 1}. @${row.handle}: ${row.convexPostCount} Convex ${
        row.convexPostCount === 1 ? "post" : "posts"
      } (${row.convexPostCount} of ${row.totalPosts}), ${row.convexImpressions.toLocaleString(
        "en-US",
      )} impressions${streak}`;
    });
    const text = ["*Convex yappers digest*", ...lines].join("\n");

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!isRecord(payload) || payload.ok !== true) {
      const error =
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `status ${response.status}`;
      return { ok: false, message: `Slack rejected the digest: ${error}.` };
    }
    return { ok: true, message: `Digest posted to ${channel}.` };
  },
});
