"use node";

import { v } from "convex/values";
import { api } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  BOTTOM_STRIPES,
  CONVEX_SYMBOL,
  OG_HEIGHT,
  OG_WIDTH,
  escapeXml,
  fitLabel,
} from "./ogArt";
import { avatarDataUri, renderPng, warmRenderer } from "./ogRenderKit";

// Renders the personalized 1200x630 OpenGraph PNG for a public gift share
// page. The art matches public/background-image-sidebar.svg: a solid #2A1E1D
// field with racing stripe lines sweeping along the bottom edge and rising
// toward the right. Text is left aligned in the solid field above the lines.
// Site-wide shares still use public/og-friends-of-convex.png from index.html.

// Left edge for the left-aligned text column in the solid field.
const FIELD_LEFT = 80;

function buildShareSvg(args: {
  handle: string;
  displayName: string;
  avatar: string | null;
}): string {
  const bigText = `@${args.handle}`;
  const bigSize = Math.min(96, Math.max(30, Math.floor(860 / (bigText.length * 0.62))));
  const displayName = fitLabel(args.displayName, 32);

  const avatarBlock = args.avatar
    ? `
      <clipPath id="avatar-clip"><circle cx="${FIELD_LEFT + 40}" cy="210" r="40" /></clipPath>
      <image href="${args.avatar}" x="${FIELD_LEFT}" y="170" width="80" height="80"
        preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)" />
      <circle cx="${FIELD_LEFT + 40}" cy="210" r="44" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
    `
    : `
      <circle cx="${FIELD_LEFT + 40}" cy="210" r="40" fill="rgba(255,255,255,0.08)" />
      <circle cx="${FIELD_LEFT + 40}" cy="210" r="44" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
      <text x="${FIELD_LEFT + 40}" y="224" text-anchor="middle" font-family="Inter" font-weight="700"
        font-size="36" fill="rgba(255,254,250,0.7)">@</text>
    `;

  return `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#2A1E1D" />
  ${BOTTOM_STRIPES}

  <g transform="translate(62, 38) scale(0.3)">${CONVEX_SYMBOL}</g>
  <text x="132" y="78" font-family="Inter" font-weight="700" font-size="18"
    letter-spacing="3.2" fill="#FFFEFA">FRIENDS OF CONVEX</text>

  ${avatarBlock}
  <text x="${FIELD_LEFT}" y="300" font-family="Inter" font-weight="700"
    font-size="22" fill="#FFFEFA">${escapeXml(displayName)}</text>
  <text x="${FIELD_LEFT}" y="328" font-family="Inter" font-weight="500"
    font-size="15" fill="rgba(255,254,250,0.62)">@${escapeXml(args.handle)}</text>

  <text x="${FIELD_LEFT - 4}" y="${448 + Math.floor(bigSize * 0.08)}" font-family="Inter"
    font-weight="700" font-size="${bigSize}" letter-spacing="${(-0.03 * bigSize).toFixed(1)}"
    fill="#FFFEFA">${escapeXml(bigText)}</text>
</svg>`;
}

type ShareCard = {
  handle: string;
  displayName: string;
  profileImageUrl: string | null;
  campaignTitle: string;
  redeemed: boolean;
};

export const renderShareImage = internalAction({
  args: { token: v.string() },
  returns: v.union(v.bytes(), v.null()),
  handler: async (ctx, args): Promise<ArrayBuffer | null> => {
    const card: ShareCard | null = await ctx.runQuery(api.gifts.getShareCard, {
      token: args.token,
    });
    if (!card) return null;

    const [, avatar] = await Promise.all([
      warmRenderer(),
      avatarDataUri(card.profileImageUrl),
    ]);

    return await renderPng(
      buildShareSvg({
        handle: card.handle,
        displayName: card.displayName,
        avatar,
      }),
    );
  },
});
