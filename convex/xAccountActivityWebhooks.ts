import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { hmacSha256Base64, timingSafeEqual } from "./giftCrypto";
import { parseInboundDirectMessages } from "./xAccountActivityPayload";

export const accountActivityCrc = httpAction(async (ctx, request) => {
  const crcToken = new URL(request.url).searchParams.get("crc_token");
  if (!crcToken) return new Response("Missing crc_token.", { status: 400 });
  if (!env.X_API_SECRET) {
    return new Response("X API secret is not configured.", { status: 503 });
  }
  const responseToken = `sha256=${await hmacSha256Base64(
    crcToken,
    env.X_API_SECRET,
  )}`;
  await ctx.runMutation(internal.xAccountActivity.recordCrcValidation, {});
  return Response.json({ response_token: responseToken });
});

export const accountActivityEvents = httpAction(async (ctx, request) => {
  if (!env.X_API_SECRET) {
    return new Response("X API secret is not configured.", { status: 503 });
  }
  const signature = request.headers.get("x-twitter-webhooks-signature");
  if (!signature) return new Response("Missing signature.", { status: 401 });

  const rawBody = await request.text();
  const expected = `sha256=${await hmacSha256Base64(
    rawBody,
    env.X_API_SECRET,
  )}`;
  if (!timingSafeEqual(expected, signature)) {
    return new Response("Invalid signature.", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }

  const events = parseInboundDirectMessages(payload);
  const results: Array<
    "duplicate" | "wrong_sender" | "ignored" | "gift" | "stop"
  > = await Promise.all(
    events.map((event) =>
      ctx.runMutation(internal.xAccountActivity.applyInboundDm, event),
    ),
  );
  return Response.json({
    received: true,
    inboundDmEvents: events.length,
    appliedCommands: results.filter(
      (result) => result === "gift" || result === "stop",
    ).length,
  });
});
