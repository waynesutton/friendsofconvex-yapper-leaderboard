import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  type ActionCtx,
} from "./_generated/server";
import {
  decryptSecret,
  encryptSecret,
  randomToken,
  sha256Base64Url,
} from "./giftCrypto";

const FOURTHWALL_API = "https://api.fourthwall.com/open-api/v1.0";
const X_API = "https://api.x.com";
const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_DM_SCOPES = [
  "dm.read",
  "dm.write",
  "tweet.read",
  "users.read",
  "offline.access",
].join(" ");

type CampaignProfile = {
  profileId: Id<"profiles">;
  xUserId: string;
  handle: string;
  displayName: string;
  profileImageUrl: string | null;
  consentConfirmedAt: number;
  consentSource: "manual" | "x_account_activity";
  consentEventId: string | null;
};

type FourthwallGiftStatus =
  | "pending"
  | "available"
  | "redeemed"
  | "cancelled"
  | "error";

type FourthwallLink = {
  id: string;
  link: string;
  status: FourthwallGiftStatus;
};

type XTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  scope: string;
};

type SendGiftDmResult = {
  status: "sent" | "already_sent";
  dmEventId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.title === "string") return payload.title;
  // The X OAuth token endpoint reports failures as error and
  // error_description, so surface those instead of a bare status code.
  if (typeof payload.error_description === "string") {
    return typeof payload.error === "string"
      ? `${payload.error}: ${payload.error_description}`
      : payload.error_description;
  }
  if (typeof payload.error === "string") return payload.error;
  if (Array.isArray(payload.errors) && isRecord(payload.errors[0])) {
    return errorMessage(payload.errors[0], fallback);
  }
  return fallback;
}

async function requireAdminAction(ctx: ActionCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in with X to continue.");
  const isAdmin: boolean = await ctx.runQuery(internal.authz.isAdminUser, {
    userId,
  });
  if (!isAdmin) throw new Error("This X account is not on the admin allowlist.");
  return userId;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Add ${name} to this Convex deployment.`);
  return value;
}

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

function normalizeFourthwallStatus(value: unknown): FourthwallGiftStatus {
  if (typeof value !== "string") return "error";
  switch (value.toLowerCase()) {
    case "available":
      return "available";
    case "redeemed":
      return "redeemed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "pending":
      return "pending";
    default:
      return "error";
  }
}

function parseFourthwallPackage(payload: unknown): {
  packageId: string;
  links: FourthwallLink[];
} {
  if (!isRecord(payload) || typeof payload.packageId !== "string") {
    throw new Error("Fourthwall returned an invalid giveaway package.");
  }
  const rawLinks = Array.isArray(payload.giveawayLinks)
    ? payload.giveawayLinks
    : [];
  const links = rawLinks.map((raw): FourthwallLink => {
    if (
      !isRecord(raw) ||
      typeof raw.id !== "string" ||
      typeof raw.link !== "string"
    ) {
      throw new Error("Fourthwall returned an incomplete giveaway link.");
    }
    return {
      id: raw.id,
      link: raw.link,
      status: normalizeFourthwallStatus(raw.status),
    };
  });
  return { packageId: payload.packageId, links };
}

async function fourthwallRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${FOURTHWALL_API}${path}`, {
    ...init,
    headers: {
      Authorization: basicAuth(
        requiredEnv("FOURTHWALL_API_USERNAME"),
        requiredEnv("FOURTHWALL_API_PASSWORD"),
      ),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      errorMessage(
        payload,
        `Fourthwall request failed with status ${response.status}.`,
      ),
    );
  }
  return payload;
}

type ProductPreview = { productName: string; thumbnailUrl: string | null };

function imageUrl(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.transformedUrl === "string") return value.transformedUrl;
  if (typeof value.url === "string") return value.url;
  return null;
}

// Looks a product up on Fourthwall so a preset save can carry the real name
// and a thumbnail. A 404 is a hard "wrong ID" signal; anything else (missing
// credentials, network trouble) degrades to saving without a preview.
async function fetchProductPreview(
  productId: string,
): Promise<
  | { ok: true; preview: ProductPreview }
  | { ok: false; notFound: boolean; message: string }
> {
  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(
      `${FOURTHWALL_API}/products/${encodeURIComponent(productId)}`,
      {
        headers: {
          Authorization: basicAuth(
            requiredEnv("FOURTHWALL_API_USERNAME"),
            requiredEnv("FOURTHWALL_API_PASSWORD"),
          ),
        },
      },
    );
    payload = await response.json().catch(() => null);
  } catch (error) {
    return {
      ok: false,
      notFound: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not reach Fourthwall to load the product preview.",
    };
  }
  if (response.status === 404) {
    return {
      ok: false,
      notFound: true,
      message:
        "Fourthwall could not find this product ID. Copy it again from your Fourthwall dashboard.",
    };
  }
  if (!response.ok || !isRecord(payload)) {
    return {
      ok: false,
      notFound: false,
      message: errorMessage(
        payload,
        `Fourthwall product lookup failed with status ${response.status}.`,
      ),
    };
  }
  const productName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : "Fourthwall product";
  const thumbnailUrl =
    imageUrl(payload.thumbnailImage) ??
    (Array.isArray(payload.images) ? imageUrl(payload.images[0]) : null);
  return { ok: true, preview: { productName, thumbnailUrl } };
}

// Saves a labeled Fourthwall product to the shelf. Verifies the ID against
// Fourthwall first so typos never reach a campaign, and stores the product
// name plus thumbnail for previews in the studio.
export const saveProductPreset = action({
  args: { label: v.string(), fourthwallProductId: v.string() },
  returns: v.object({
    presetId: v.id("giftProductPresets"),
    productName: v.union(v.string(), v.null()),
    previewWarning: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const userId = await requireAdminAction(ctx);
    const label = args.label.trim();
    const productId = args.fourthwallProductId.trim();
    if (!label) throw new Error("Give this product a short label.");
    if (!productId) throw new Error("Paste the Fourthwall product ID first.");

    const lookup = await fetchProductPreview(productId);
    if (!lookup.ok && lookup.notFound) throw new Error(lookup.message);
    const preview = lookup.ok ? lookup.preview : null;

    const presetId: Id<"giftProductPresets"> = await ctx.runMutation(
      internal.gifts.upsertProductPreset,
      {
        label,
        fourthwallProductId: productId,
        productName: preview?.productName,
        thumbnailUrl: preview?.thumbnailUrl ?? undefined,
        createdByUserId: userId,
      },
    );
    return {
      presetId,
      productName: preview?.productName ?? null,
      previewWarning: lookup.ok ? null : lookup.message,
    };
  },
});

function callbackUrl(): string {
  const siteOrigin = requiredEnv("CONVEX_SITE_URL").replace(/\/$/, "");
  return `${siteOrigin}/x-dm/callback`;
}

function frontendUrl(): string {
  const value = requiredEnv("SITE_URL").replace(/\/$/, "");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("SITE_URL must use HTTPS outside local development.");
  }
  return value;
}

function parseXTokenSet(payload: unknown, fallbackScope: string): XTokenSet {
  if (!isRecord(payload) || typeof payload.access_token !== "string") {
    throw new Error(errorMessage(payload, "X did not return an access token."));
  }
  const expiresIn =
    typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in)
      ? payload.expires_in
      : 7200;
  return {
    accessToken: payload.access_token,
    refreshToken:
      typeof payload.refresh_token === "string" ? payload.refresh_token : null,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: typeof payload.scope === "string" ? payload.scope : fallbackScope,
  };
}

async function exchangeXToken(body: URLSearchParams): Promise<XTokenSet> {
  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(
        requiredEnv("AUTH_TWITTER_ID"),
        requiredEnv("AUTH_TWITTER_SECRET"),
      ),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      errorMessage(payload, `X OAuth failed with status ${response.status}.`),
    );
  }
  return parseXTokenSet(payload, X_DM_SCOPES);
}

async function getXSender(accessToken: string): Promise<{
  id: string;
  username: string;
  name: string;
}> {
  const response = await fetch(`${X_API}/2/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !isRecord(payload) ||
    !isRecord(payload.data) ||
    typeof payload.data.id !== "string" ||
    typeof payload.data.username !== "string" ||
    typeof payload.data.name !== "string"
  ) {
    throw new Error(
      errorMessage(payload, "X did not return the sender account profile."),
    );
  }
  return {
    id: payload.data.id,
    username: payload.data.username,
    name: payload.data.name,
  };
}

export const createCampaign = action({
  args: {
    title: v.string(),
    fourthwallProductId: v.string(),
    profileIds: v.array(v.id("profiles")),
    portalDays: v.number(),
    consentConfirmed: v.boolean(),
  },
  returns: v.object({
    campaignId: v.id("giftCampaigns"),
    recipientCount: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    campaignId: Id<"giftCampaigns">;
    recipientCount: number;
  }> => {
    const userId = await requireAdminAction(ctx);
    // Gift links live at most seven days; giftLinkExpiresAt caps older
    // campaigns the same way at read time.
    const portalDays = Math.floor(args.portalDays);
    if (portalDays < 1 || portalDays > 7) {
      throw new Error("Gift links expire after at most 7 days.");
    }
    const profiles: CampaignProfile[] = await ctx.runQuery(
      internal.gifts.profilesForCampaign,
      {
        profileIds: args.profileIds,
        manualConsentConfirmed: args.consentConfirmed,
        manualConfirmedAt: Date.now(),
      },
    );
    const portalTokens = profiles.map(() => randomToken(32));
    const shareTokens = profiles.map(() => randomToken(24));
    const pending: {
      campaignId: Id<"giftCampaigns">;
      recipientIds: Id<"giftRecipients">[];
    } = await ctx.runMutation(internal.gifts.createProvisioningCampaign, {
      title: args.title,
      fourthwallProductId: args.fourthwallProductId,
      createdByUserId: userId,
      portalExpiresAt: Date.now() + portalDays * 24 * 60 * 60 * 1000,
      profiles,
      portalTokens,
      shareTokens,
    });

    try {
      const provisioned = parseFourthwallPackage(
        await fourthwallRequest("/giveaway-links", {
          method: "POST",
          body: JSON.stringify({
            productId: args.fourthwallProductId.trim(),
            number: profiles.length,
          }),
        }),
      );
      if (provisioned.links.length !== profiles.length) {
        throw new Error(
          `Fourthwall returned ${provisioned.links.length} links for ${profiles.length} recipients.`,
        );
      }
      await ctx.runMutation(internal.gifts.finalizeCampaign, {
        campaignId: pending.campaignId,
        packageId: provisioned.packageId,
        links: provisioned.links,
      });
      return {
        campaignId: pending.campaignId,
        recipientCount: profiles.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fourthwall provisioning failed.";
      await ctx.runMutation(internal.gifts.markCampaignError, {
        campaignId: pending.campaignId,
        message,
      });
      throw new Error(message);
    }
  },
});

// Gift lab: mint one Fourthwall giveaway link for a named person who is not
// on the board. No profile, no consent flow, no DM. The admin copies the
// generated /gift/for/:token link and shares it directly.
export const createLabLink = action({
  args: {
    fullName: v.string(),
    fourthwallProductId: v.string(),
    expires: v.boolean(),
  },
  returns: v.object({
    labLinkId: v.id("giftLabLinks"),
    token: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    labLinkId: Id<"giftLabLinks">;
    token: string;
  }> => {
    const userId = await requireAdminAction(ctx);
    const token = randomToken(32);
    // Checked box means the studio's 7 day life; unchecked never expires.
    const expiresAt = args.expires
      ? Date.now() + 7 * 24 * 60 * 60 * 1000
      : null;
    const labLinkId: Id<"giftLabLinks"> = await ctx.runMutation(
      internal.giftLab.createProvisioningLabLink,
      {
        fullName: args.fullName,
        fourthwallProductId: args.fourthwallProductId,
        token,
        expiresAt,
        createdByUserId: userId,
      },
    );
    try {
      const provisioned = parseFourthwallPackage(
        await fourthwallRequest("/giveaway-links", {
          method: "POST",
          body: JSON.stringify({
            productId: args.fourthwallProductId.trim(),
            number: 1,
          }),
        }),
      );
      const link = provisioned.links[0];
      if (!link || provisioned.links.length !== 1) {
        throw new Error(
          `Fourthwall returned ${provisioned.links.length} links instead of 1.`,
        );
      }
      await ctx.runMutation(internal.giftLab.finalizeLabLink, {
        labLinkId,
        packageId: provisioned.packageId,
        giftId: link.id,
        url: link.link,
        fourthwallStatus: link.status,
      });
      return { labLinkId, token };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Fourthwall provisioning failed.";
      await ctx.runMutation(internal.giftLab.markLabLinkError, {
        labLinkId,
        message,
      });
      throw new Error(message);
    }
  },
});

// Manual Fourthwall status check for one lab link, mirroring syncCampaign.
// The signed order webhook usually flips redemption automatically; this is
// the on-demand fallback.
export const syncLabLink = action({
  args: { labLinkId: v.id("giftLabLinks") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireAdminAction(ctx);
    const link = await ctx.runQuery(internal.giftLab.getLabLinkForSync, {
      labLinkId: args.labLinkId,
    });
    if (!link?.fourthwallPackageId) {
      throw new Error("This link does not have a Fourthwall package yet.");
    }
    const packageResult = parseFourthwallPackage(
      await fourthwallRequest(
        `/giveaway-links/packages/${encodeURIComponent(link.fourthwallPackageId)}`,
      ),
    );
    const match = packageResult.links.find(
      (candidate) => candidate.id === link.fourthwallGiftId,
    );
    if (!match) {
      throw new Error("Fourthwall did not return this gift link's status.");
    }
    await ctx.runMutation(internal.giftLab.applyLabLinkStatus, {
      labLinkId: args.labLinkId,
      fourthwallStatus: match.status,
    });
    return null;
  },
});

export const syncCampaign = action({
  args: { campaignId: v.id("giftCampaigns") },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args): Promise<{ updated: number }> => {
    await requireAdminAction(ctx);
    const campaign = await ctx.runQuery(internal.gifts.getCampaignForSync, {
      campaignId: args.campaignId,
    });
    if (!campaign?.fourthwallPackageId) {
      throw new Error("This campaign does not have a Fourthwall package yet.");
    }
    const packageResult = parseFourthwallPackage(
      await fourthwallRequest(
        `/giveaway-links/packages/${encodeURIComponent(campaign.fourthwallPackageId)}`,
      ),
    );
    return await ctx.runMutation(internal.gifts.applyFourthwallStatuses, {
      campaignId: args.campaignId,
      links: packageResult.links.map((link) => ({
        id: link.id,
        status: link.status,
      })),
    });
  },
});

export const beginXSenderConnection = action({
  args: {},
  returns: v.object({ authorizationUrl: v.string() }),
  handler: async (ctx) => {
    const adminUserId = await requireAdminAction(ctx);
    const state = randomToken(32);
    const codeVerifier = randomToken(48);
    await ctx.runMutation(internal.gifts.createOAuthState, {
      state,
      codeVerifier,
      adminUserId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const url = new URL(X_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", requiredEnv("AUTH_TWITTER_ID"));
    url.searchParams.set("redirect_uri", callbackUrl());
    url.searchParams.set("scope", X_DM_SCOPES);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", await sha256Base64Url(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
    return { authorizationUrl: url.toString() };
  },
});

export async function completeXSenderConnection(
  ctx: ActionCtx,
  args: { code: string; state: string },
): Promise<void> {
  const stored = await ctx.runMutation(internal.gifts.consumeOAuthState, {
    state: args.state,
  });
  if (!stored) throw new Error("The X sender connection expired. Start again.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: callbackUrl(),
    code_verifier: stored.codeVerifier,
  });
  const tokens = await exchangeXToken(body);
  if (!tokens.refreshToken) {
    throw new Error(
      "X did not return a refresh token. Confirm offline.access is approved.",
    );
  }
  const sender = await getXSender(tokens.accessToken);
  const encryptionKey = requiredEnv("X_DM_TOKEN_ENCRYPTION_KEY");
  await ctx.runMutation(internal.gifts.upsertSenderConnection, {
    xUserId: sender.id,
    username: sender.username,
    displayName: sender.name,
    encryptedAccessToken: await encryptSecret(tokens.accessToken, encryptionKey),
    encryptedRefreshToken: await encryptSecret(
      tokens.refreshToken,
      encryptionKey,
    ),
    accessTokenExpiresAt: tokens.expiresAt,
    scope: tokens.scope,
    connectedByUserId: stored.adminUserId,
  });
}

async function validSenderAccessToken(ctx: ActionCtx): Promise<string> {
  const connection = await ctx.runQuery(internal.gifts.getSenderConnection, {});
  if (!connection) throw new Error("Connect the X sender account first.");
  const encryptionKey = requiredEnv("X_DM_TOKEN_ENCRYPTION_KEY");
  if (connection.accessTokenExpiresAt > Date.now() + 60_000) {
    return await decryptSecret(connection.encryptedAccessToken, encryptionKey);
  }
  if (!connection.encryptedRefreshToken) {
    throw new Error("Reconnect the X sender account to refresh DM access.");
  }
  const currentRefreshToken = await decryptSecret(
    connection.encryptedRefreshToken,
    encryptionKey,
  );
  // X access tokens expire after 2 hours, so every send after that window
  // refreshes first. A rejected refresh means the stored token is stale or
  // revoked, and only a fresh authorization fixes it.
  let refreshed: XTokenSet;
  try {
    refreshed = await exchangeXToken(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: currentRefreshToken,
        client_id: requiredEnv("AUTH_TWITTER_ID"),
      }),
    );
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "X OAuth refresh failed.";
    throw new Error(
      `X rejected the stored sender token (${reason}) Click Reconnect sender in the gift studio, then retry this send.`,
    );
  }
  const refreshToken = refreshed.refreshToken ?? currentRefreshToken;
  await ctx.runMutation(internal.gifts.updateSenderTokens, {
    encryptedAccessToken: await encryptSecret(
      refreshed.accessToken,
      encryptionKey,
    ),
    encryptedRefreshToken: await encryptSecret(refreshToken, encryptionKey),
    accessTokenExpiresAt: refreshed.expiresAt,
    scope: refreshed.scope,
  });
  return refreshed.accessToken;
}

export const sendGiftDm = action({
  args: { recipientId: v.id("giftRecipients") },
  returns: v.object({
    status: v.union(v.literal("sent"), v.literal("already_sent")),
    dmEventId: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args): Promise<SendGiftDmResult> => {
    await requireAdminAction(ctx);
    const recipient: Doc<"giftRecipients"> | null = await ctx.runQuery(
      internal.gifts.getRecipientForSend,
      { recipientId: args.recipientId },
    );
    if (!recipient) throw new Error("Gift recipient not found.");
    if (recipient.sentAt !== null) {
      return { status: "already_sent" as const, dmEventId: recipient.xDmEventId };
    }
    const intent = await ctx.runQuery(
      internal.xAccountActivity.getIntentForXUserId,
      { xUserId: recipient.xUserId },
    );
    if (intent?.state === "suppressed") {
      throw new Error(
        "This recipient sent STOP. Wait for a new provider-verified GIFT request before sending.",
      );
    }
    if (recipient.dmSuppressedAt !== null) {
      throw new Error("This recipient is marked as opted out of X DMs.");
    }
    if (!recipient.consentConfirmedAt) {
      throw new Error("Confirm the recipient's inbound X request first.");
    }
    if (!recipient.fourthwallUrl || recipient.status === "provisioning") {
      throw new Error("The Fourthwall gift link is not ready yet.");
    }
    await ctx.runMutation(internal.gifts.recordSendAttempt, {
      recipientId: recipient._id,
    });
    try {
      const accessToken = await validSenderAccessToken(ctx);
      const [latestIntent, latestRecipient] = await Promise.all([
        ctx.runQuery(internal.xAccountActivity.getIntentForXUserId, {
          xUserId: recipient.xUserId,
        }),
        ctx.runQuery(internal.gifts.getRecipientForSend, {
          recipientId: recipient._id,
        }),
      ]);
      if (latestIntent?.state === "suppressed") {
        throw new Error(
          "Send cancelled because a newer STOP event was detected.",
        );
      }
      if (!latestRecipient) throw new Error("Gift recipient no longer exists.");
      if (latestRecipient.dmSuppressedAt !== null) {
        throw new Error(
          "Send cancelled because this recipient is currently opted out.",
        );
      }
      const portalUrl = `${frontendUrl()}/gift/${recipient.portalToken}`;
      const text =
        `Your Friends of Convex gift #${recipient.giftNumber ?? 1} is ready. Your personal gift pass is ${portalUrl}\n\n` +
        "The pass expires 7 days after it was issued, so grab it soon. " +
        "The page clearly links to Fourthwall for redemption. Reply STOP if you do not want another message.";
      const response = await fetch(
        `${X_API}/2/dm_conversations/with/${encodeURIComponent(recipient.xUserId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        },
      );
      const payload: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !isRecord(payload) ||
        !isRecord(payload.data) ||
        typeof payload.data.dm_event_id !== "string" ||
        typeof payload.data.dm_conversation_id !== "string"
      ) {
        throw new Error(
          errorMessage(payload, `X DM failed with status ${response.status}.`),
        );
      }
      await ctx.runMutation(internal.gifts.recordSendSuccess, {
        recipientId: recipient._id,
        dmEventId: payload.data.dm_event_id,
        dmConversationId: payload.data.dm_conversation_id,
      });
      return { status: "sent" as const, dmEventId: payload.data.dm_event_id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "X DM failed.";
      await ctx.runMutation(internal.gifts.recordSendFailure, {
        recipientId: recipient._id,
        message,
      });
      throw new Error(message);
    }
  },
});
