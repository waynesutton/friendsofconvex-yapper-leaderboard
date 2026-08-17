import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { isAdminViewer, requireAdmin } from "./authz";
import { fetchXListPreview, requireAdminAction } from "./imports";
import { normalizeHandle, upsertImportedProfile } from "./profiles";
import { importEntryValidator } from "./validators";

// Admin-defined custom groups. Each visible group with at least one active
// member renders as an extra pill on the public leaderboard.

const MAX_GROUPS = 12;
const MAX_GROUP_MEMBERS = 250;
const GROUP_NAME_LIMIT = 40;
const GROUP_DESCRIPTION_LIMIT = 200;

// Slugs the board already uses for its built-in pills and URL params.
const RESERVED_SLUGS = new Set(["yappers", "convex", "impressions", "default"]);

export function slugifyGroupName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (!slug) {
    throw new Error("Give this group a name with at least one letter or number.");
  }
  return slug;
}

async function uniqueSlug(
  ctx: QueryCtx,
  name: string,
  excludeId?: Id<"groups">,
): Promise<string> {
  const base = slugifyGroupName(name);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const existing = await ctx.db
      .query("groups")
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique();
    if (!existing || existing._id === excludeId) return candidate;
  }
  throw new Error("Could not find a free slug for this group name.");
}

async function countMembers(
  ctx: QueryCtx,
  groupId: Id<"groups">,
): Promise<{ total: number; active: number }> {
  const memberships = await ctx.db
    .query("groupMemberships")
    .withIndex("by_group_and_added_at", (q) => q.eq("groupId", groupId))
    .take(MAX_GROUP_MEMBERS);
  let active = 0;
  for (const membership of memberships) {
    const profile = await ctx.db.get("profiles", membership.profileId);
    if (profile && profile.active) active += 1;
  }
  return { total: memberships.length, active };
}

const publicGroupValidator = v.object({
  _id: v.id("groups"),
  name: v.string(),
  slug: v.string(),
  description: v.union(v.string(), v.null()),
  memberCount: v.number(),
  // True only in rows returned to admin viewers; visitors never receive
  // internal groups at all.
  internal: v.boolean(),
});

const adminGroupValidator = v.object({
  _id: v.id("groups"),
  name: v.string(),
  slug: v.string(),
  description: v.union(v.string(), v.null()),
  visible: v.boolean(),
  internal: v.boolean(),
  order: v.number(),
  xListId: v.union(v.string(), v.null()),
  memberCount: v.number(),
  activeMemberCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const groupMemberValidator = v.object({
  membershipId: v.id("groupMemberships"),
  profileId: v.id("profiles"),
  handle: v.string(),
  displayName: v.string(),
  profileImageUrl: v.union(v.string(), v.null()),
  active: v.boolean(),
  syncStatus: v.union(
    v.literal("pending"),
    v.literal("synced"),
    v.literal("error"),
  ),
  addedAt: v.number(),
});

// Visible groups with at least one active member, in admin-defined order.
// The public board renders one pill per row. Internal boards are included
// only when the signed-in viewer is an admin, so visitors never learn they
// exist.
export const listPublic = query({
  args: {},
  returns: v.array(publicGroupValidator),
  handler: async (ctx) => {
    const viewerIsAdmin = await isAdminViewer(ctx);
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_order")
      .take(MAX_GROUPS * 2);
    const rows = [];
    for (const group of groups) {
      if (!group.visible) continue;
      const internal = group.internal ?? false;
      if (internal && !viewerIsAdmin) continue;
      const counts = await countMembers(ctx, group._id);
      if (counts.active === 0) continue;
      rows.push({
        _id: group._id,
        name: group.name,
        slug: group.slug,
        description: group.description ?? null,
        memberCount: counts.active,
        internal,
      });
    }
    return rows;
  },
});

export const listAdmin = query({
  args: {},
  returns: v.array(adminGroupValidator),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_order")
      .take(MAX_GROUPS * 2);
    const rows = [];
    for (const group of groups) {
      const counts = await countMembers(ctx, group._id);
      rows.push({
        _id: group._id,
        name: group.name,
        slug: group.slug,
        description: group.description ?? null,
        visible: group.visible,
        internal: group.internal ?? false,
        order: group.order,
        xListId: group.xListId ?? null,
        memberCount: counts.total,
        activeMemberCount: counts.active,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      });
    }
    return rows;
  },
});

export const listMembers = query({
  args: { groupId: v.id("groups") },
  returns: v.array(groupMemberValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const memberships = await ctx.db
      .query("groupMemberships")
      .withIndex("by_group_and_added_at", (q) => q.eq("groupId", args.groupId))
      .take(MAX_GROUP_MEMBERS);
    const rows = [];
    for (const membership of memberships) {
      const profile = await ctx.db.get("profiles", membership.profileId);
      if (!profile) continue;
      rows.push({
        membershipId: membership._id,
        profileId: profile._id,
        handle: profile.handle,
        displayName: profile.displayName,
        profileImageUrl: profile.profileImageUrl,
        active: profile.active,
        syncStatus: profile.syncStatus,
        addedAt: membership.addedAt,
      });
    }
    return rows;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("groups"),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim().slice(0, GROUP_NAME_LIMIT);
    if (!name) throw new Error("Give this group a name.");

    const existingGroups = await ctx.db
      .query("groups")
      .withIndex("by_order")
      .take(MAX_GROUPS + 1);
    if (existingGroups.length >= MAX_GROUPS) {
      throw new Error(`This board is capped at ${MAX_GROUPS} groups.`);
    }

    const slug = await uniqueSlug(ctx, name);
    const highestOrder = existingGroups.reduce(
      (max, group) => Math.max(max, group.order),
      0,
    );
    const now = Date.now();
    return await ctx.db.insert("groups", {
      name,
      slug,
      description: args.description?.trim().slice(0, GROUP_DESCRIPTION_LIMIT) || undefined,
      visible: true,
      order: highestOrder + 1,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    // null clears the field; undefined leaves it unchanged.
    description: v.optional(v.union(v.string(), v.null())),
    visible: v.optional(v.boolean()),
    internal: v.optional(v.boolean()),
    xListId: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found.");

    const patch: Partial<Doc<"groups">> = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim().slice(0, GROUP_NAME_LIMIT);
      if (!name) throw new Error("Give this group a name.");
      patch.name = name;
      // The slug follows the name so pill URLs stay readable. Old links fall
      // back to the default board, which is a safe miss.
      if (name !== group.name) {
        patch.slug = await uniqueSlug(ctx, name, group._id);
      }
    }
    if (args.description !== undefined) {
      patch.description =
        args.description === null
          ? undefined
          : args.description.trim().slice(0, GROUP_DESCRIPTION_LIMIT) || undefined;
    }
    if (args.visible !== undefined) patch.visible = args.visible;
    if (args.internal !== undefined) patch.internal = args.internal;
    if (args.xListId !== undefined) {
      patch.xListId = args.xListId === null ? undefined : args.xListId.trim() || undefined;
    }
    await ctx.db.patch("groups", args.groupId, patch);
    return null;
  },
});

// Swap order values with the neighbor in the chosen direction.
export const move = mutation({
  args: {
    groupId: v.id("groups"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_order")
      .take(MAX_GROUPS * 2);
    const index = groups.findIndex((group) => group._id === args.groupId);
    if (index === -1) throw new Error("Group not found.");
    const neighborIndex = args.direction === "up" ? index - 1 : index + 1;
    const neighbor = groups[neighborIndex];
    if (!neighbor) return null;
    const current = groups[index];
    await ctx.db.patch("groups", current._id, {
      order: neighbor.order,
      updatedAt: Date.now(),
    });
    await ctx.db.patch("groups", neighbor._id, {
      order: current.order,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// Deletes the group and its memberships. Profiles stay on the board.
export const remove = mutation({
  args: { groupId: v.id("groups") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const group = await ctx.db.get("groups", args.groupId);
    if (!group) return null;
    const memberships = await ctx.db
      .query("groupMemberships")
      .withIndex("by_group_and_added_at", (q) => q.eq("groupId", args.groupId))
      .collect();
    for (const membership of memberships) {
      await ctx.db.delete("groupMemberships", membership._id);
    }
    await ctx.db.delete("groups", args.groupId);
    return null;
  },
});

async function upsertMembership(
  ctx: MutationCtx,
  groupId: Id<"groups">,
  profileId: Id<"profiles">,
): Promise<boolean> {
  const existing = await ctx.db
    .query("groupMemberships")
    .withIndex("by_group_and_profile", (q) =>
      q.eq("groupId", groupId).eq("profileId", profileId),
    )
    .unique();
  if (existing) return false;
  await ctx.db.insert("groupMemberships", {
    groupId,
    profileId,
    addedAt: Date.now(),
  });
  return true;
}

// Adds a person to a group by handle. Creates the profile first (approved,
// active, pending sync) when the handle is not on the board yet, mirroring
// the admin "Add to the board" flow.
export const addMemberByHandle = mutation({
  args: {
    groupId: v.id("groups"),
    handle: v.string(),
  },
  returns: v.object({
    profileCreated: v.boolean(),
    added: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found.");

    const normalizedHandle = normalizeHandle(args.handle);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_normalized_handle", (q) =>
        q.eq("normalizedHandle", normalizedHandle),
      )
      .unique();

    let profileId: Id<"profiles">;
    let profileCreated = false;
    if (existing) {
      profileId = existing._id;
    } else {
      const now = Date.now();
      profileId = await ctx.db.insert("profiles", {
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
      profileCreated = true;
    }

    const added = await upsertMembership(ctx, args.groupId, profileId);
    return { profileCreated, added };
  },
});

export const addMemberProfile = mutation({
  args: {
    groupId: v.id("groups"),
    profileId: v.id("profiles"),
  },
  returns: v.object({ added: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found.");
    const profile = await ctx.db.get("profiles", args.profileId);
    if (!profile) throw new Error("Profile not found.");
    const added = await upsertMembership(ctx, args.groupId, args.profileId);
    return { added };
  },
});

export const removeMember = mutation({
  args: { membershipId: v.id("groupMemberships") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const membership = await ctx.db.get("groupMemberships", args.membershipId);
    if (!membership) return null;
    await ctx.db.delete("groupMemberships", args.membershipId);
    return null;
  },
});

export const getGroupForImport = internalQuery({
  args: { groupId: v.id("groups") },
  returns: v.union(
    v.object({
      name: v.string(),
      xListId: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const group = await ctx.db.get("groups", args.groupId);
    if (!group) return null;
    return { name: group.name, xListId: group.xListId ?? null };
  },
});

// Applies an X list preview to a group in one transaction: upserts profiles
// for valid entries, resolves already-on-board entries, and adds memberships.
// Idempotent, so re-running a list sync is safe.
export const commitListImport = internalMutation({
  args: {
    groupId: v.id("groups"),
    listId: v.string(),
    entries: v.array(importEntryValidator),
  },
  returns: v.object({
    createdProfiles: v.number(),
    addedMembers: v.number(),
    alreadyMembers: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args) => {
    const group = await ctx.db.get("groups", args.groupId);
    if (!group) throw new Error("Group not found.");

    let createdProfiles = 0;
    let addedMembers = 0;
    let alreadyMembers = 0;
    let skipped = 0;

    for (const entry of args.entries.slice(0, 100)) {
      if (!entry.xUserId) {
        skipped += 1;
        continue;
      }
      let profileId: Id<"profiles"> | null = null;
      if (entry.status === "valid") {
        const result = await upsertImportedProfile(
          ctx,
          { ...entry, xUserId: entry.xUserId },
          "x-list",
        );
        if (result.created) createdProfiles += 1;
        profileId = result.profileId;
      } else if (entry.status === "existing") {
        // Already on the board; membership only, no profile changes.
        const byId = await ctx.db
          .query("profiles")
          .withIndex("by_x_user_id", (q) => q.eq("xUserId", entry.xUserId))
          .unique();
        const profile =
          byId ??
          (await ctx.db
            .query("profiles")
            .withIndex("by_normalized_handle", (q) =>
              q.eq("normalizedHandle", entry.handle.toLowerCase()),
            )
            .unique());
        profileId = profile?._id ?? null;
      }
      if (!profileId) {
        skipped += 1;
        continue;
      }
      const added = await upsertMembership(ctx, args.groupId, profileId);
      if (added) {
        addedMembers += 1;
      } else {
        alreadyMembers += 1;
      }
    }

    await ctx.db.patch("groups", args.groupId, {
      xListId: args.listId,
      updatedAt: Date.now(),
    });
    return { createdProfiles, addedMembers, alreadyMembers, skipped };
  },
});

const listSyncResultValidator = v.object({
  listName: v.string(),
  totalMembers: v.number(),
  fetchedCount: v.number(),
  truncated: v.boolean(),
  createdProfiles: v.number(),
  addedMembers: v.number(),
  alreadyMembers: v.number(),
  skipped: v.number(),
});

// Imports or re-syncs group members from an X list. Pass urlOrId the first
// time; later runs can omit it and reuse the stored list id. New profiles
// pick up metrics on the next scheduled X sync.
export const syncFromXList = action({
  args: {
    groupId: v.id("groups"),
    urlOrId: v.optional(v.string()),
  },
  returns: listSyncResultValidator,
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);
    const group: { name: string; xListId: string | null } | null =
      await ctx.runQuery(internal.groups.getGroupForImport, {
        groupId: args.groupId,
      });
    if (!group) throw new Error("Group not found.");

    const source = args.urlOrId?.trim() || group.xListId;
    if (!source) {
      throw new Error(
        "Paste an X List URL or ID before syncing this group from a list.",
      );
    }

    const preview = await fetchXListPreview(ctx, source);
    const committed: {
      createdProfiles: number;
      addedMembers: number;
      alreadyMembers: number;
      skipped: number;
    } = await ctx.runMutation(internal.groups.commitListImport, {
      groupId: args.groupId,
      listId: preview.listId,
      entries: preview.entries,
    });

    return {
      listName: preview.name,
      totalMembers: preview.totalMembers,
      fetchedCount: preview.fetchedCount,
      truncated: preview.truncated,
      ...committed,
    };
  },
});
