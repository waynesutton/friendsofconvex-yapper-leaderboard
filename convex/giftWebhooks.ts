import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { completeXSenderConnection } from "./giftActions";
import { hmacSha256Base64, timingSafeEqual } from "./giftCrypto";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function appRedirect(params: Record<string, string>): Response {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) return new Response("SITE_URL is not configured.", { status: 500 });
  const destination = new URL("/admin/gifts", siteUrl);
  for (const [key, value] of Object.entries(params)) {
    destination.searchParams.set(key, value);
  }
  return Response.redirect(destination, 302);
}

export const xDmCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return appRedirect({ xDmError: "access_denied" });
  if (!code || !state) return appRedirect({ xDmError: "missing_callback_data" });
  try {
    await completeXSenderConnection(ctx, { code, state });
    return appRedirect({ xConnected: "1" });
  } catch (error) {
    console.error("X sender OAuth callback failed", error);
    return appRedirect({ xDmError: "connection_failed" });
  }
});

export const fourthwallWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.FOURTHWALL_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Fourthwall webhook secret is not configured.", {
      status: 503,
    });
  }
  const signature = request.headers.get("X-Fourthwall-Hmac-SHA256");
  if (!signature) return new Response("Missing signature.", { status: 401 });
  const rawBody = await request.text();
  const expected = await hmacSha256Base64(rawBody, secret);
  if (!timingSafeEqual(expected, signature)) {
    return new Response("Invalid signature.", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }
  if (
    !isRecord(payload) ||
    typeof payload.id !== "string" ||
    typeof payload.type !== "string"
  ) {
    return new Response("Invalid Fourthwall event.", { status: 400 });
  }
  const data = isRecord(payload.data) ? payload.data : null;
  const source = data && isRecord(data.source) ? data.source : null;
  const giftId = source && typeof source.giftId === "string" ? source.giftId : null;
  const orderId = data && typeof data.id === "string" ? data.id : null;

  await ctx.runMutation(internal.gifts.applyFourthwallOrder, {
    eventId: payload.id,
    eventType: payload.type,
    giftId,
    orderId,
  });
  return Response.json({ received: true }, { status: 200 });
});
