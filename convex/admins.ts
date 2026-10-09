import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { ownerXUserIds, requireAdmin } from "./authz";
import { parseXUser, requestX, requireAdminAction } from "./imports";
import { isRecord } from "./xSyncParsing";

// Granted admins are capped so the list query stays bounded.
const MAX_GRANTS = 50;
const SEARCH_LIMIT = 8;
const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const X_USER_ID = /^\d{1,20}$/;

const adminRowValidator = v.object({
  xUserId: v.string(),
  tier: v.union(v.literal("owner"), v.literal("granted")),
  grantId: v.union(v.id("adminGrants"), v.null()),
  handle: v.union(v.string(), v.null()),
  displayName: v.union(v.string(), v.null()),
  profileImageUrl: v.union(v.string(), v.null()),
  grantedAt: v.union(v.number(), v.null()),
  grantedByHandle: v.union(v.string(), v.null()),
  isYou: v.boolean(),
});

// One person the admin can promote, from the board or from an X lookup.
// A board row with no synced X ID has `xUserId: null` and needs a lookup.
const candidateValidator = v.object({
  xUserId: v.union(v.string(), v.null()),
  handle: v.string(),
  displayName: v.string(),
  profileImageUrl: v.union(v.string(), v.null()),
  source: v.union(v.literal("board"), v.literal("x")),
});

// Accepts "name", "@name", or an x.com / twitter.com profile link.
export function cleanHandle(value: string): string {
  const trimmed = value.trim().split(/[?#]/, 1)[0] ?? "";
  const fromUrl = trimmed.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/i)?.[1];
  const handle = (fromUrl ?? trimmed.replace(/^@+/, "")).trim();
  if (!X_HANDLE.test(handle)) {
    throw new Error("Enter an X handle: 1 to 15 letters, numbers, or underscores.");
  }
  return handle;
}

// Best known name and avatar for an owner ID, from the board or a past sign in.
async function identityForXUserId(ctx: QueryCtx, xUserId: string) {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_x_user_id", (q) => q.eq("xUserId", xUserId))
    .first();
  if (profile) {
    return {
      handle: profile.handle,
      displayName: profile.displayName,
      profileImageUrl: profile.profileImageUrl,
    };
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_x_user_id", (q) => q.eq("xUserId", xUserId))
    .first();
  return {
    handle: user?.xUsername || null,
    displayName: user?.name ?? null,
    profileImageUrl: user?.image ?? null,
  };
}

export const list = query({
  args: {},
  returns: v.object({
    admins: v.array(adminRowValidator),
    maxGrants: v.number(),
  }),
  handler: async (ctx) => {
    const viewer = await requireAdmin(ctx);
    const owners = ownerXUserIds();

    const ownerRows = await Promise.all(
      [...owners].map(async (xUserId) => ({
        xUserId,
        tier: "owner" as const,
        grantId: null,
        ...(await identityForXUserId(ctx, xUserId)),
        grantedAt: null,
        grantedByHandle: null,
        isYou: xUserId === viewer.xUserId,
      })),
    );

    const grants = await ctx.db
      .query("adminGrants")
      .withIndex("by_granted_at")
      .order("desc")
      .take(MAX_GRANTS);
    // An owner who was also granted shows once, as an owner.
    const grantRows = grants
      .filter((grant) => !owners.has(grant.xUserId))
      .map((grant) => ({
        xUserId: grant.xUserId,
        tier: "granted" as const,
        grantId: grant._id,
        handle: grant.handle,
        displayName: grant.displayName,
        profileImageUrl: grant.profileImageUrl,
        grantedAt: grant.grantedAt,
        grantedByHandle: grant.grantedByHandle,
        isYou: grant.xUserId === viewer.xUserId,
      }));

    return { admins: [...ownerRows, ...grantRows], maxGrants: MAX_GRANTS };
  },
});

// Board profiles matching a handle prefix or a display name.
export const searchCandidates = query({
  args: { term: v.string() },
  returns: v.array(candidateValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const raw = args.term.trim().slice(0, 80);
    if (!raw) return [];

    const found = new Map<Id<"profiles">, Doc<"profiles">>();
    const handlePrefix = raw.replace(/^@+/, "").toLowerCase();
    if (/^[a-z0-9_]{1,15}$/.test(handlePrefix)) {
      const byHandle = await ctx.db
        .query("profiles")
        .withIndex("by_normalized_handle", (q) =>
          q
            .gte("normalizedHandle", handlePrefix)
            .lt("normalizedHandle", `${handlePrefix}\uffff`),
        )
        .take(SEARCH_LIMIT);
      for (const profile of byHandle) found.set(profile._id, profile);
    }
    if (!raw.startsWith("@") && raw.length >= 2) {
      const byName = await ctx.db
        .query("profiles")
        .withSearchIndex("search_display_name", (q) => q.search("displayName", raw))
        .take(SEARCH_LIMIT);
      for (const profile of byName) found.set(profile._id, profile);
    }

    return [...found.values()].slice(0, SEARCH_LIMIT).map((profile) => ({
      xUserId: profile.xUserId,
      handle: profile.handle,
      displayName: profile.displayName,
      profileImageUrl: profile.profileImageUrl,
      source: "board" as const,
    }));
  },
});

// Resolves any public X handle to its numeric ID so people who are not on
// the board can still be made admins.
export const lookupHandle = action({
  args: { handle: v.string() },
  returns: candidateValidator,
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);
    const handle = cleanHandle(args.handle);
    const token = process.env.X_BEARER_TOKEN;
    if (!token) {
      throw new Error(
        "Looking up a handle needs X_BEARER_TOKEN on this deployment. Pick someone already on the board instead.",
      );
    }
    const url = new URL(
      `/2/users/by/username/${encodeURIComponent(handle)}`,
      "https://api.x.com",
    );
    url.searchParams.set("user.fields", "profile_image_url");
    const payload = await requestX(url, token);
    const user = isRecord(payload) ? parseXUser(payload.data) : null;
    if (!user) throw new Error(`X has no public account for @${handle}.`);
    return {
      xUserId: user.id,
      handle: user.username,
      displayName: user.name,
      profileImageUrl: user.profileImageUrl,
      source: "x" as const,
    };
  },
});

async function insertGrant(
  ctx: MutationCtx,
  person: {
    xUserId: string;
    handle: string;
    displayName: string;
    profileImageUrl: string | null;
  },
  grantedBy: { userId: Id<"users">; xUsername: string },
): Promise<"granted" | "already"> {
  if (!X_USER_ID.test(person.xUserId)) {
    throw new Error("That X account has no valid numeric ID. Look it up on X first.");
  }
  const handle = cleanHandle(person.handle);
  if (ownerXUserIds().has(person.xUserId)) return "already";

  const existing = await ctx.db
    .query("adminGrants")
    .withIndex("by_x_user_id", (q) => q.eq("xUserId", person.xUserId))
    .first();
  if (existing) return "already";

  const current = await ctx.db.query("adminGrants").take(MAX_GRANTS);
  if (current.length >= MAX_GRANTS) {
    throw new Error(`The admin list is full (${MAX_GRANTS}). Remove someone first.`);
  }

  await ctx.db.insert("adminGrants", {
    xUserId: person.xUserId,
    handle,
    displayName: person.displayName.trim().slice(0, 80) || `@${handle}`,
    profileImageUrl: person.profileImageUrl,
    grantedByUserId: grantedBy.userId,
    grantedByHandle: grantedBy.xUsername || null,
    grantedAt: Date.now(),
  });
  return "granted";
}

export const grant = mutation({
  args: {
    xUserId: v.string(),
    handle: v.string(),
    displayName: v.string(),
    profileImageUrl: v.union(v.string(), v.null()),
  },
  returns: v.union(v.literal("granted"), v.literal("already")),
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    return await insertGrant(ctx, args, viewer);
  },
});

export const revoke = mutation({
  args: { grantId: v.id("adminGrants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const viewer = await requireAdmin(ctx);
    const grant = await ctx.db.get("adminGrants", args.grantId);
    if (!grant) return null;
    if (grant.xUserId === viewer.xUserId) {
      throw new Error("You can't remove your own admin access. Ask another admin to do it.");
    }
    await ctx.db.delete("adminGrants", args.grantId);
    return null;
  },
});
