import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

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
