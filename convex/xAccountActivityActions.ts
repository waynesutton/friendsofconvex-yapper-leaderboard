import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, env, type ActionCtx } from "./_generated/server";
import { hmacSha1Base64, randomToken } from "./giftCrypto";

const X_API = "https://api.x.com";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredEnv(name: keyof typeof env): string {
  const value = env[name];
  if (!value) throw new Error(`Add ${name} to this Convex deployment.`);
  return value;
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.title === "string") return payload.title;
  if (Array.isArray(payload.errors) && isRecord(payload.errors[0])) {
    return errorMessage(payload.errors[0], fallback);
  }
  return fallback;
}

function hasXError(payload: unknown, value: string): boolean {
  if (!isRecord(payload) || !Array.isArray(payload.errors)) return false;
  return payload.errors.some(
    (error) =>
      isRecord(error) &&
      (error.title === value || error.type === value || error.detail === value),
  );
}

async function requireAdminAction(ctx: ActionCtx): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in with X to continue.");
  const isAdmin: boolean = await ctx.runQuery(internal.authz.isAdminUser, {
    userId,
  });
  if (!isAdmin) throw new Error("This X account is not on the admin allowlist.");
}

function webhookUrl(): string {
  const origin = process.env.CONVEX_SITE_URL?.replace(/\/$/, "");
  if (!origin) throw new Error("CONVEX_SITE_URL is not configured.");
  const parsed = new URL(`${origin}/x-account-activity`);
  if (parsed.protocol !== "https:" || parsed.port) {
    throw new Error(
      "X Account Activity needs a public HTTPS Convex Cloud deployment without a custom port.",
    );
  }
  return parsed.toString();
}

type SetupResult = {
  webhookId: string;
  webhookUrl: string;
  senderXUserId: string;
  subscribed: boolean;
};

async function xBearerRequest(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(`${X_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requiredEnv("X_BEARER_TOKEN")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      errorMessage(payload, `X request failed with status ${response.status}.`),
    );
  }
  return payload;
}

function oauthPercentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

async function oauth1Authorization(
  method: "POST",
  url: string,
): Promise<string> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: requiredEnv("X_API_KEY"),
    oauth_nonce: randomToken(18),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: requiredEnv("X_ACCOUNT_ACTIVITY_ACCESS_TOKEN"),
    oauth_version: "1.0",
  };
  const parameterString = Object.entries(oauthParams)
    .map(([key, value]) => [oauthPercentEncode(key), oauthPercentEncode(value)])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey
        ? leftValue.localeCompare(rightValue)
        : leftKey.localeCompare(rightKey),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signatureBase = [
    method,
    oauthPercentEncode(url),
    oauthPercentEncode(parameterString),
  ].join("&");
  const signingKey = `${oauthPercentEncode(requiredEnv("X_API_SECRET"))}&${oauthPercentEncode(requiredEnv("X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET"))}`;
  oauthParams.oauth_signature = await hmacSha1Base64(signatureBase, signingKey);
  return `OAuth ${Object.entries(oauthParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, value]) =>
        `${oauthPercentEncode(key)}="${oauthPercentEncode(value)}"`,
    )
    .join(", ")}`;
}

function parseWebhookList(payload: unknown): Array<{
  id: string;
  url: string;
  valid: boolean;
}> {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return [];
  return payload.data.flatMap((row) =>
    isRecord(row) &&
    typeof row.id === "string" &&
    typeof row.url === "string" &&
    typeof row.valid === "boolean"
      ? [{ id: row.id, url: row.url, valid: row.valid }]
      : [],
  );
}

function parseCreatedWebhook(payload: unknown): {
  id: string;
  url: string;
  valid: boolean;
} {
  if (
    !isRecord(payload) ||
    !isRecord(payload.data) ||
    typeof payload.data.id !== "string" ||
    typeof payload.data.url !== "string" ||
    typeof payload.data.valid !== "boolean"
  ) {
    throw new Error("X returned an invalid webhook registration response.");
  }
  return {
    id: payload.data.id,
    url: payload.data.url,
    valid: payload.data.valid,
  };
}

function subscriptionIncludes(payload: unknown, xUserId: string): boolean {
  if (
    !isRecord(payload) ||
    !isRecord(payload.data) ||
    !Array.isArray(payload.data.subscriptions)
  ) {
    return false;
  }
  return payload.data.subscriptions.some(
    (row) => isRecord(row) && row.user_id === xUserId,
  );
}

export const setup = action({
  args: {},
  returns: v.object({
    webhookId: v.string(),
    webhookUrl: v.string(),
    senderXUserId: v.string(),
    subscribed: v.boolean(),
  }),
  handler: async (ctx): Promise<SetupResult> => {
    await requireAdminAction(ctx);
    const sender: Doc<"giftSenderConnections"> | null = await ctx.runQuery(
      internal.gifts.getSenderConnection,
      {},
    );
    if (!sender) throw new Error("Connect the dedicated X sender first.");
    requiredEnv("X_API_KEY");
    requiredEnv("X_API_SECRET");
    requiredEnv("X_ACCOUNT_ACTIVITY_ACCESS_TOKEN");
    requiredEnv("X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET");
    const url = webhookUrl();

    try {
      const listed = parseWebhookList(await xBearerRequest("/2/webhooks"));
      let webhook = listed.find((candidate) => candidate.url === url);
      if (!webhook) {
        webhook = parseCreatedWebhook(
          await xBearerRequest("/2/webhooks", {
            method: "POST",
            body: JSON.stringify({ url }),
          }),
        );
      } else if (!webhook.valid) {
        await xBearerRequest(`/2/webhooks/${encodeURIComponent(webhook.id)}`, {
          method: "PUT",
        });
        webhook = { ...webhook, valid: true };
      }
      if (!webhook.valid) throw new Error("X did not validate the webhook.");

      await ctx.runMutation(
        internal.xAccountActivity.saveAccountActivityConfig,
        {
          webhookId: webhook.id,
          webhookUrl: webhook.url,
          senderXUserId: sender.xUserId,
          subscribed: false,
        },
      );

      const subscriptionUrl = `${X_API}/2/account_activity/webhooks/${encodeURIComponent(webhook.id)}/subscriptions/all`;
      const subscriptionResponse = await fetch(subscriptionUrl, {
        method: "POST",
        headers: {
          Authorization: await oauth1Authorization("POST", subscriptionUrl),
        },
      });
      const subscriptionPayload: unknown = await subscriptionResponse
        .json()
        .catch(() => null);
      if (
        !subscriptionResponse.ok &&
        !hasXError(subscriptionPayload, "DuplicateSubscriptionFailed")
      ) {
        throw new Error(
          errorMessage(
            subscriptionPayload,
            `X subscription failed with status ${subscriptionResponse.status}.`,
          ),
        );
      }

      const subscriptions = await xBearerRequest(
        `/2/account_activity/webhooks/${encodeURIComponent(webhook.id)}/subscriptions/all/list`,
      );
      const subscribed = subscriptionIncludes(subscriptions, sender.xUserId);
      if (!subscribed) {
        throw new Error(
          "X subscribed a different account. Regenerate the OAuth 1.0a access token and secret for the dedicated sender account.",
        );
      }
      await ctx.runMutation(
        internal.xAccountActivity.saveAccountActivityConfig,
        {
          webhookId: webhook.id,
          webhookUrl: webhook.url,
          senderXUserId: sender.xUserId,
          subscribed: true,
        },
      );
      return {
        webhookId: webhook.id,
        webhookUrl: webhook.url,
        senderXUserId: sender.xUserId,
        subscribed: true,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "X Account Activity setup failed.";
      await ctx.runMutation(
        internal.xAccountActivity.recordAccountActivityError,
        { message },
      );
      throw new Error(message);
    }
  },
});
