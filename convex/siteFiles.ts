import { v } from "convex/values";
import { httpAction, internalQuery, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
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

const directoryValidator = v.object({
  people: v.array(personValidator),
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

    return { people, newestUpdatedAt };
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

  if (kind === "robots") {
    return new Response(buildRobotsTxt(origin), {
      status: 200,
      headers: discoveryHeaders("text/plain; charset=utf-8", origin),
    });
  }
  if (kind === "llms") {
    return new Response(buildLlmsTxt(directory, origin), {
      status: 200,
      headers: discoveryHeaders("text/plain; charset=utf-8", origin),
    });
  }
  if (kind === "sitemapMd") {
    return new Response(buildSitemapMd(directory, origin), {
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
