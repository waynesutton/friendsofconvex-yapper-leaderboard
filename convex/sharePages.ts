import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { YAPPERS_BOARD } from "./boardLimits";
import { formatDayLabel } from "./rankingDays";

// Crawler friendly share pages. The app is a Vite SPA served by the static
// hosting component, so X and other crawlers never run React. These routes
// fetch the built index.html shell and rewrite the OpenGraph and Twitter meta
// tags with the recipient data before responding. Browsers still receive the
// full SPA and render the normal share page.

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Replace an existing meta tag (which may span multiple lines in the built
// HTML) or append one before </head> if it does not exist yet.
function setMetaTag(
  html: string,
  attr: "property" | "name",
  key: string,
  content: string,
): string {
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  const pattern = new RegExp(`<meta\\s[^>]*${attr}="${escapeRegExp(key)}"[^>]*>`);
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `${tag}\n  </head>`);
}

function setCanonical(html: string, href: string): string {
  const tag = `<link rel="canonical" href="${escapeHtml(href)}" />`;
  const pattern = /<link\s[^>]*rel="canonical"[^>]*>/;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `${tag}\n  </head>`);
}

function setTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
}

function tokenFromPath(pathname: string, prefix: string): string {
  const raw = pathname.slice(prefix.length).replace(/\/+$/, "");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// GET /gift/share/:token — the public share page with personalized meta tags.
export const giftSharePage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const token = tokenFromPath(url.pathname, "/gift/share/");

  // The static hosting component serves the SPA shell at the site root.
  const shellUrl = (process.env.CONVEX_SITE_URL ?? origin).replace(/\/$/, "");
  const shellResponse = await fetch(`${shellUrl}/`);
  if (!shellResponse.ok) {
    return new Response("The site shell is not available yet.", { status: 503 });
  }
  let html = await shellResponse.text();

  const card = token
    ? await ctx.runQuery(api.gifts.getShareCard, { token })
    : null;

  if (card) {
    const title = `@${card.handle} is a Friend of Convex`;
    const description = card.redeemed
      ? `A community thank you for @${card.handle}. Gift received. ${card.campaignTitle}.`
      : `A community thank you for @${card.handle}. ${card.campaignTitle}.`;
    const pageUrl = `${origin}/gift/share/${encodeURIComponent(token)}`;
    const imageUrl = `${origin}/og/gift/${encodeURIComponent(token)}.png`;

    html = setTitle(html, title);
    html = setMetaTag(html, "name", "description", description);
    html = setMetaTag(html, "property", "og:title", title);
    html = setMetaTag(html, "property", "og:description", description);
    html = setMetaTag(html, "property", "og:url", pageUrl);
    html = setMetaTag(html, "property", "og:image", imageUrl);
    html = setMetaTag(html, "name", "twitter:title", title);
    html = setMetaTag(html, "name", "twitter:description", description);
    html = setMetaTag(html, "name", "twitter:image", imageUrl);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});

// GET /legends/:handle — the legend page with per person meta tags so the X
// card names them instead of repeating the generic board title. The image
// stays the shipped site OpenGraph art; no per person PNG is rendered.
// Also answers on the pre-rename /retired/ prefix so links already posted on
// X keep their card; the app redirects those to /legends/ in the browser.
export const legendSharePage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const prefix = url.pathname.startsWith("/retired/") ? "/retired/" : "/legends/";
  const handle = tokenFromPath(url.pathname, prefix);

  const shellUrl = (process.env.CONVEX_SITE_URL ?? origin).replace(/\/$/, "");
  const shellResponse = await fetch(`${shellUrl}/`);
  if (!shellResponse.ok) {
    return new Response("The site shell is not available yet.", { status: 503 });
  }
  let html = await shellResponse.text();

  const legend = handle
    ? await ctx.runQuery(api.profiles.getLegend, { handle })
    : null;

  if (legend) {
    const title = `@${legend.handle}, undefeated legend`;
    const description =
      legend.legendNote ??
      `@${legend.handle} left the board on top. Nobody could catch them.`;
    const pageUrl = `${origin}/legends/${encodeURIComponent(legend.handle.toLowerCase())}`;
    const imageUrl = `${origin}/og-friends-of-convex.png`;

    html = setTitle(html, title);
    html = setMetaTag(html, "name", "description", description);
    html = setMetaTag(html, "property", "og:title", title);
    html = setMetaTag(html, "property", "og:description", description);
    html = setMetaTag(html, "property", "og:url", pageUrl);
    html = setMetaTag(html, "property", "og:image", imageUrl);
    html = setMetaTag(html, "name", "twitter:title", title);
    html = setMetaTag(html, "name", "twitter:description", description);
    html = setMetaTag(html, "name", "twitter:image", imageUrl);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});

// Board URL for a board id; the default Yappers board has no board param.
// A saved day adds ?day= so the link opens that day's ranking.
function liveBoardUrl(origin: string, board: string, day: string | null = null): string {
  const params = new URLSearchParams();
  if (board !== YAPPERS_BOARD) params.set("board", board);
  if (day) params.set("day", day);
  const query = params.toString();
  return query ? `${origin}/?${query}` : `${origin}/`;
}

// Weekly archive URL for a weekly top 10 share, scrolled to its board.
function weeklyUrl(origin: string, board: string, week: string): string {
  const params = new URLSearchParams({ week, board });
  return `${origin}/weekly?${params.toString()}`;
}

type MetaTag = { attr: "property" | "name"; key: string; content: string };

export type BoardShareMetaInput = {
  _id: string;
  board: string;
  boardLabel: string;
  kind: "ranked" | "legends";
  rows: Array<{ rank: number | null; handle: string }>;
  videoStorageId: string | null;
  videoRenderedAt: number | null;
  rankingDay?: string | null;
  period?: "week" | null;
};

export type BoardShareMeta = {
  title: string;
  canonical: string;
  // Applied before the canonical link, then `tags` after it.
  headTags: Array<MetaTag>;
  tags: Array<MetaTag>;
};

// Crawler tags for a board snapshot. og:video only appears once an admin
// attaches a video, and twitter:card is never touched: it stays
// summary_large_image from the shell, because X does not play og:video and
// player cards are approval gated.
export function boardShareMeta(
  share: BoardShareMetaInput,
  origin: string,
  branding: { communityName: string; boardName: string },
): BoardShareMeta {
  const boardTitle = `${branding.communityName} ${branding.boardName}`;
  const legends = share.kind === "legends";
  const day = share.rankingDay ?? null;
  const week = !legends && day !== null && share.period === "week";
  const title = legends
    ? `Legends of the ${boardTitle}`
    : week && day
      ? `Top ${share.rows.length} on ${share.boardLabel}, week ending ${formatDayLabel(day)} | ${boardTitle}`
      : day
        ? `Top ${share.rows.length} on ${share.boardLabel}, ${formatDayLabel(day)} | ${boardTitle}`
        : `Top ${share.rows.length} on ${share.boardLabel} | ${boardTitle}`;
  const leaders = share.rows
    .slice(0, 3)
    .map((row) => (legends ? `@${row.handle}` : `${row.rank}. @${row.handle}`))
    .join(", ");
  const description = legends
    ? `${leaders} left the board undefeated.`
    : week && day
      ? `${leaders} led ${share.boardLabel} on the ${boardTitle} for the week ending ${formatDayLabel(day, true)}.`
      : day
        ? `${leaders} led ${share.boardLabel} on the ${boardTitle} on ${formatDayLabel(day, true)}.`
        : `${leaders} lead ${share.boardLabel} on the ${boardTitle}.`;
  const pageUrl = `${origin}/b/${encodeURIComponent(share._id)}`;
  const imageUrl = `${origin}/og/board/${encodeURIComponent(share._id)}.png`;
  const imageAlt = `${share.boardLabel} leaderboard: ${share.rows
    .map((row) => `@${row.handle}`)
    .join(", ")}`;

  const tags: Array<MetaTag> = [
    { attr: "property", key: "og:title", content: title },
    { attr: "property", key: "og:description", content: description },
    { attr: "property", key: "og:url", content: pageUrl },
    { attr: "property", key: "og:image", content: imageUrl },
    { attr: "property", key: "og:image:alt", content: imageAlt },
    { attr: "name", key: "twitter:title", content: title },
    { attr: "name", key: "twitter:description", content: description },
    { attr: "name", key: "twitter:image", content: imageUrl },
    { attr: "name", key: "twitter:image:alt", content: imageAlt },
  ];
  if (share.videoStorageId !== null) {
    const videoUrl = boardShareVideoUrl(origin, share._id, share.videoRenderedAt);
    tags.push(
      { attr: "property", key: "og:video", content: videoUrl },
      { attr: "property", key: "og:video:url", content: videoUrl },
      { attr: "property", key: "og:video:secure_url", content: videoUrl },
      { attr: "property", key: "og:video:type", content: "video/mp4" },
      { attr: "property", key: "og:video:width", content: "1200" },
      { attr: "property", key: "og:video:height", content: "630" },
    );
  }

  return {
    title,
    canonical: week && day ? weeklyUrl(origin, share.board, day) : liveBoardUrl(origin, share.board, day),
    headTags: [
      { attr: "name", key: "description", content: description },
      { attr: "name", key: "robots", content: "noindex" },
    ],
    tags,
  };
}

// The ?v= stamp changes when a video is replaced, so chat apps and caches
// fetch the new file even though the path stays the same.
export function boardShareVideoUrl(
  origin: string,
  shareId: string,
  videoRenderedAt: number | null,
): string {
  const base = `${origin}/v/board/${encodeURIComponent(shareId)}.mp4`;
  return videoRenderedAt === null ? base : `${base}?v=${videoRenderedAt}`;
}

// GET /b/:id — a frozen board share. Crawlers get the snapshot title,
// description, and card image; browsers get the SPA, which forwards to the
// live board. Snapshots are noindex with a canonical pointing at the live
// board, so they never compete with it in search. robots.txt must keep
// allowing /b/ because X's crawler honors it.
export const boardSharePage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const shareId = tokenFromPath(url.pathname, "/b/");

  const shellUrl = (process.env.CONVEX_SITE_URL ?? origin).replace(/\/$/, "");
  const shellResponse = await fetch(`${shellUrl}/`);
  if (!shellResponse.ok) {
    return new Response("The site shell is not available yet.", { status: 503 });
  }
  let html = await shellResponse.text();

  const share = shareId
    ? await ctx.runQuery(internal.boardShares.getForRender, { shareId })
    : null;

  if (share) {
    const branding = await ctx.runQuery(
      internal.siteSettings.getSiteBrandingInternal,
      {},
    );
    const meta = boardShareMeta(share, origin, branding);
    html = setTitle(html, meta.title);
    for (const tag of meta.headTags) html = setMetaTag(html, tag.attr, tag.key, tag.content);
    html = setCanonical(html, meta.canonical);
    for (const tag of meta.tags) html = setMetaTag(html, tag.attr, tag.key, tag.content);
  }

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Snapshots never change once created.
      "Cache-Control": share ? "public, max-age=86400" : "public, max-age=300",
    },
  });
});

// GET /og/board/:id.png — the board share card. Serves the stored PNG, or
// renders and stores it on a miss. Unknown ids get the default site art.
export const boardShareImage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const shareId = tokenFromPath(url.pathname, "/og/board/").replace(/\.png$/, "");
  // no-store so the CDN never pins a failed render: the next crawl retries.
  const fallback = () =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${url.origin}/og-friends-of-convex.png`,
        "Cache-Control": "no-store",
      },
    });

  const share = shareId
    ? await ctx.runQuery(internal.boardShares.getForRender, { shareId })
    : null;
  if (!share) return fallback();

  const headers = {
    "Content-Type": "image/png",
    // The snapshot is frozen, so its card never changes.
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  if (share.imageStorageId) {
    const stored = await ctx.storage.get(share.imageStorageId);
    if (stored) return new Response(stored, { status: 200, headers });
  }

  try {
    const png = await ctx.runAction(internal.boardShareRender.renderAndStore, {
      shareId: share._id,
    });
    if (!png) return fallback();
    return new Response(png, { status: 200, headers });
  } catch (error) {
    console.error("Board share render failed", {
      shareId: share._id,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback();
  }
});

// Parses a single `bytes=` range. null means serve the whole file; "invalid"
// means the range starts past the end (416). Multi range requests get the
// whole file.
export function parseByteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startText, endText] = match;
  if (startText === "" && endText === "") return null;
  if (startText === "") {
    const suffix = Number(endText);
    if (suffix === 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(startText);
  if (start >= size) return "invalid";
  const end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);
  if (end < start) return "invalid";
  return { start, end };
}

// GET /v/board/:id.mp4 — the ranking video an admin attached to a snapshot.
// Only ever serves attached files; everything else is a 404. Range requests
// get 206, which Safari and iMessage need before they play anything.
export const boardShareVideo = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const shareId = tokenFromPath(url.pathname, "/v/board/").replace(/\.mp4$/, "");
  const notFound = () =>
    new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  const share = shareId
    ? await ctx.runQuery(internal.boardShares.getForRender, { shareId })
    : null;
  if (!share?.videoStorageId) return notFound();
  const video = await ctx.storage.get(share.videoStorageId);
  if (!video) return notFound();

  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    // A replaced video gets a new ?v= stamp, so the bytes behind one URL
    // never change.
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  const range = parseByteRange(request.headers.get("Range"), video.size);
  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${video.size}` },
    });
  }
  if (range) {
    return new Response(video.slice(range.start, range.end + 1), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${range.start}-${range.end}/${video.size}`,
        "Content-Length": String(range.end - range.start + 1),
      },
    });
  }
  return new Response(video, {
    status: 200,
    headers: { ...headers, "Content-Length": String(video.size) },
  });
});

// GET /og/gift/:token.png — the personalized 1200x630 share image.
export const giftShareImage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const token = tokenFromPath(url.pathname, "/og/gift/").replace(/\.png$/, "");

  const png = token
    ? await ctx.runAction(internal.giftShareRender.renderShareImage, { token })
    : null;

  if (!png) {
    // Unknown token: fall back to the default site OpenGraph image.
    return Response.redirect(`${url.origin}/og-friends-of-convex.png`, 302);
  }

  return new Response(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Redemption can flip the status line, so cache for one hour only.
      "Cache-Control": "public, max-age=3600",
    },
  });
});
