import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

type AuthDbCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;

function adminIds(): Set<string> {
  return new Set(
    (process.env.ADMIN_X_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

async function xAccountForUser(ctx: AuthDbCtx, userId: Id<"users">) {
  return await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "twitter"),
    )
    .unique();
}

export async function getXViewer(ctx: AuthDbCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const account = await xAccountForUser(ctx, userId);
  if (!account) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_x_user_id", (q) =>
      q.eq("xUserId", account.providerAccountId),
    )
    .unique();

  return {
    userId,
    xUserId: account.providerAccountId,
    xUsername: user?.xUsername ?? "",
    name: user?.name ?? "X member",
    image: user?.image ?? null,
  };
}

// Non-throwing admin check for public queries that show extra rows to
// admins (for example internal group pills) without failing for visitors.
export async function isAdminViewer(ctx: AuthDbCtx): Promise<boolean> {
  const viewer = await getXViewer(ctx);
  return viewer !== null && adminIds().has(viewer.xUserId);
}

export async function requireAdmin(ctx: AuthDbCtx) {
  const viewer = await getXViewer(ctx);
  if (!viewer) throw new Error("Sign in with X to continue.");
  if (!adminIds().has(viewer.xUserId)) {
    throw new Error("This X account is not on the admin allowlist.");
  }
  return viewer;
}

const viewerValidator = v.object({
  authenticated: v.boolean(),
  authConfigured: v.boolean(),
  adminConfigured: v.boolean(),
  isAdmin: v.boolean(),
  userId: v.union(v.id("users"), v.null()),
  xUserId: v.union(v.string(), v.null()),
  xUsername: v.union(v.string(), v.null()),
  name: v.union(v.string(), v.null()),
  image: v.union(v.string(), v.null()),
});

export const viewer = query({
  args: {},
  returns: viewerValidator,
  handler: async (ctx) => {
    const xViewer = await getXViewer(ctx);
    return {
      authenticated: xViewer !== null,
      authConfigured: Boolean(
        process.env.AUTH_TWITTER_ID && process.env.AUTH_TWITTER_SECRET,
      ),
      adminConfigured: adminIds().size > 0,
      isAdmin: xViewer ? adminIds().has(xViewer.xUserId) : false,
      userId: xViewer?.userId ?? null,
      xUserId: xViewer?.xUserId ?? null,
      xUsername: xViewer?.xUsername || null,
      name: xViewer?.name ?? null,
      image: xViewer?.image ?? null,
    };
  },
});

export const isAdminUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const account = await xAccountForUser(ctx, args.userId);
    return account ? adminIds().has(account.providerAccountId) : false;
  },
});
