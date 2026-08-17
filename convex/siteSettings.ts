import { v } from "convex/values";
import {
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin } from "./authz";
import { DEFAULT_BRANDING, type SiteBranding } from "./brandingDefaults";

// Site branding singleton (key "site"). Every field is an optional override;
// missing fields fall back to DEFAULT_BRANDING so a fork that never opens
// settings ships the exact production look. Editing one field here flows
// through the header, board heading, page title, share text, and llms.txt.

const SETTINGS_KEY = "site";

const FIELD_LIMIT = 120;
const DESCRIPTION_LIMIT = 240;

export const brandingValidator = v.object({
  siteTitle: v.string(),
  siteDescription: v.string(),
  communityName: v.string(),
  boardName: v.string(),
  eyebrowText: v.string(),
  headerTitle: v.string(),
  logoUrl: v.union(v.string(), v.null()),
  hasCustomLogo: v.boolean(),
  customized: v.boolean(),
});

async function loadBranding(
  ctx: QueryCtx,
): Promise<SiteBranding & { hasCustomLogo: boolean; customized: boolean }> {
  const settings = await ctx.db
    .query("siteSettings")
    .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
    .unique();
  const logoUrl = settings?.logoStorageId
    ? await ctx.storage.getUrl(settings.logoStorageId)
    : null;
  const customized = Boolean(
    settings &&
      (settings.siteTitle ||
        settings.siteDescription ||
        settings.communityName ||
        settings.boardName ||
        settings.eyebrowText ||
        settings.headerTitle ||
        settings.logoStorageId),
  );
  return {
    siteTitle: settings?.siteTitle ?? DEFAULT_BRANDING.siteTitle,
    siteDescription:
      settings?.siteDescription ?? DEFAULT_BRANDING.siteDescription,
    communityName: settings?.communityName ?? DEFAULT_BRANDING.communityName,
    boardName: settings?.boardName ?? DEFAULT_BRANDING.boardName,
    eyebrowText: settings?.eyebrowText ?? DEFAULT_BRANDING.eyebrowText,
    headerTitle: settings?.headerTitle ?? DEFAULT_BRANDING.headerTitle,
    logoUrl: logoUrl ?? DEFAULT_BRANDING.logoUrl,
    hasCustomLogo: Boolean(settings?.logoStorageId && logoUrl),
    customized,
  };
}

// Public: the board, header, and join page read this live.
export const getSiteBranding = query({
  args: {},
  returns: brandingValidator,
  handler: async (ctx) => {
    return await loadBranding(ctx);
  },
});

// Same merge for the discovery file HTTP actions.
export const getSiteBrandingInternal = internalQuery({
  args: {},
  returns: brandingValidator,
  handler: async (ctx) => {
    return await loadBranding(ctx);
  },
});

function normalizeField(
  value: string | undefined,
  limit: number,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim().slice(0, limit);
  // An emptied input means "go back to the shipped default".
  return trimmed || undefined;
}

export const setSiteBranding = mutation({
  args: {
    siteTitle: v.optional(v.string()),
    siteDescription: v.optional(v.string()),
    communityName: v.optional(v.string()),
    boardName: v.optional(v.string()),
    eyebrowText: v.optional(v.string()),
    headerTitle: v.optional(v.string()),
    // null clears the uploaded logo and falls back to the built-in wordmark.
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();

    let logoStorageId = existing?.logoStorageId;
    if (args.logoStorageId !== undefined) {
      // Drop a replaced or cleared upload so storage does not accumulate.
      if (
        existing?.logoStorageId &&
        existing.logoStorageId !== args.logoStorageId
      ) {
        await ctx.storage.delete(existing.logoStorageId);
      }
      logoStorageId = args.logoStorageId ?? undefined;
    }

    // Omitted args keep their saved value; passed args are normalized where
    // an emptied string clears the override back to the shipped default.
    const doc = {
      key: SETTINGS_KEY,
      siteTitle:
        args.siteTitle === undefined
          ? existing?.siteTitle
          : normalizeField(args.siteTitle, FIELD_LIMIT),
      siteDescription:
        args.siteDescription === undefined
          ? existing?.siteDescription
          : normalizeField(args.siteDescription, DESCRIPTION_LIMIT),
      communityName:
        args.communityName === undefined
          ? existing?.communityName
          : normalizeField(args.communityName, FIELD_LIMIT),
      boardName:
        args.boardName === undefined
          ? existing?.boardName
          : normalizeField(args.boardName, FIELD_LIMIT),
      eyebrowText:
        args.eyebrowText === undefined
          ? existing?.eyebrowText
          : normalizeField(args.eyebrowText, FIELD_LIMIT),
      headerTitle:
        args.headerTitle === undefined
          ? existing?.headerTitle
          : normalizeField(args.headerTitle, FIELD_LIMIT),
      logoStorageId,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.replace("siteSettings", existing._id, doc);
    } else {
      await ctx.db.insert("siteSettings", doc);
    }
    return null;
  },
});

export const generateLogoUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// Removes every override and any uploaded logo, restoring the shipped look.
export const resetSiteBranding = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("siteSettings")
      .withIndex("by_key", (q) => q.eq("key", SETTINGS_KEY))
      .unique();
    if (!existing) return null;
    if (existing.logoStorageId) {
      await ctx.storage.delete(existing.logoStorageId);
    }
    await ctx.db.delete("siteSettings", existing._id);
    return null;
  },
});
