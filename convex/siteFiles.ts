import { v } from "convex/values";
import { httpAction, internalQuery, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { SiteBranding } from "./brandingDefaults";
import { compareYapperRows } from "./profiles";
import {
  DIRECTORY_CAP,
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapMd,
  buildSitemapXml,
  type PublicDirectory,
} from "./siteDirectory";

const personValidator = v.object({
  handle: v.string(),
  displayName: v.string(),
  currentImpressions: v.number(),
  currentPosts: v.number(),
  currentEngagements: v.number(),
  currentConvexPosts: v.union(v.number(), v.null()),
  addedAt: v.number(),
  updatedAt: v.number(),
});

const directoryGroupValidator = v.object({
  name: v.string(),
  slug: v.string(),
  description: v.union(v.string(), v.null()),
  memberHandles: v.array(v.string()),
});

const directoryValidator = v.object({
  people: v.array(personValidator),
  groups: v.array(directoryGroupValidator),
  newestUpdatedAt: v.union(v.number(), v.null()),
});

// Active public board members, same index and cap as the leaderboard.
export const listPublicDirectory = internalQuery({
  args: {},
  returns: directoryValidator,
  handler: async (ctx): Promise<PublicDirectory> => {
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_active_and_current_impressions", (q) =>
        q.eq("active", true),
      )
      .order("desc")
      .take(DIRECTORY_CAP);

    // Canonical board order, mirroring profiles.listLeaderboard: synced rows
    // first, then engagements with impressions, posts, and join date as tie
    // breakers, so sitemap.md numbering matches the homepage ranking.
    profiles.sort(compareYapperRows);

    let newestUpdatedAt: number | null = null;
    const people = profiles.map((profile) => {
      if (newestUpdatedAt === null || profile.updatedAt > newestUpdatedAt) {
        newestUpdatedAt = profile.updatedAt;
      }
      return {
        handle: profile.handle,
        displayName: profile.displayName,
        currentImpressions: profile.currentImpressions,
        currentPosts: profile.currentPosts,
        currentEngagements: profile.currentEngagements,
        currentConvexPosts: profile.currentConvexPosts ?? null,
        addedAt: profile.addedAt,
        updatedAt: profile.updatedAt,
      };
    });

    // Visible public groups with at least one active member, matching the
    // pills the board renders to visitors. Internal (admin only) boards
    // never enter the discovery files. Members list in board rank order.
    const groupDocs = await ctx.db.query("groups").withIndex("by_order").take(24);
    const groups = [];
    for (const group of groupDocs) {
      if (!group.visible || group.internal) continue;
      const memberships = await ctx.db
        .query("groupMemberships")
        .withIndex("by_group_and_added_at", (q) => q.eq("groupId", group._id))
        .take(DIRECTORY_CAP);
      const members = [];
      for (const membership of memberships) {
        const profile = await ctx.db.get("profiles", membership.profileId);
        if (profile && profile.active) members.push(profile);
      }
      if (members.length === 0) continue;
      members.sort(compareYapperRows);
      groups.push({
        name: group.name,
        slug: group.slug,
        description: group.description ?? null,
        memberHandles: members.map((member) => member.handle),
      });
    }

    return { people, groups, newestUpdatedAt };
  },
});

function publicSiteOrigin(request: Request): string {
  const fromEnv = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return new URL(request.url).origin.replace(/\/$/, "");
}

function discoveryHeaders(
  contentType: string,
  origin: string,
): Record<string, string> {
  return {
    "content-type": contentType,
    "cache-control":
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    "access-control-allow-origin": "*",
    "content-signal": "search=yes, ai-train=yes, ai-input=yes",
    link: `<${origin}/llms.txt>; rel="describedby"; type="text/plain", <${origin}/sitemap.md>; rel="alternate"; type="text/markdown", <${origin}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
  };
}

type DiscoveryKind = "robots" | "llms" | "sitemapMd" | "sitemapXml";

async function serveLiveDirectoryFile(
  ctx: ActionCtx,
  request: Request,
  kind: DiscoveryKind,
): Promise<Response> {
  const origin = publicSiteOrigin(request);
  const directory: PublicDirectory = await ctx.runQuery(
    internal.siteFiles.listPublicDirectory,
    {},
  );
  const branding: SiteBranding & {
    hasCustomLogo: boolean;
    customized: boolean;
  } = await ctx.runQuery(internal.siteSettings.getSiteBrandingInternal, {});

  if (kind === "robots") {
    return new Response(buildRobotsTxt(origin, branding), {
      status: 200,
      headers: discoveryHeaders("text/plain; charset=utf-8", origin),
    });
  }
  if (kind === "llms") {
    return new Response(buildLlmsTxt(directory, origin, branding), {
      status: 200,
      headers: discoveryHeaders("text/plain; charset=utf-8", origin),
    });
  }
  if (kind === "sitemapMd") {
    return new Response(buildSitemapMd(directory, origin, branding), {
      status: 200,
      headers: discoveryHeaders("text/markdown; charset=utf-8", origin),
    });
  }
  return new Response(buildSitemapXml(directory, origin), {
    status: 200,
    headers: discoveryHeaders("application/xml; charset=utf-8", origin),
  });
}

export const serveRobotsTxt = httpAction(async (ctx, request) => {
  return await serveLiveDirectoryFile(ctx, request, "robots");
});

export const serveLlmsTxt = httpAction(async (ctx, request) => {
  return await serveLiveDirectoryFile(ctx, request, "llms");
});

export const serveSitemapMd = httpAction(async (ctx, request) => {
  return await serveLiveDirectoryFile(ctx, request, "sitemapMd");
});

export const serveSitemapXml = httpAction(async (ctx, request) => {
  return await serveLiveDirectoryFile(ctx, request, "sitemapXml");
});
