import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  hmacSha1Base64,
  hmacSha256Base64,
  timingSafeEqual,
} from "../convex/giftCrypto.ts";
import {
  detectGiftCommand,
  hasAvailableGiftRequest,
  parseInboundDirectMessages,
} from "../convex/xAccountActivityPayload.ts";

assert.equal(detectGiftCommand("GIFT"), "gift");
assert.equal(detectGiftCommand(" gift please"), "gift");
assert.equal(detectGiftCommand("STOP"), "stop");
assert.equal(detectGiftCommand("unsubscribe me"), "stop");
assert.equal(detectGiftCommand("cancel"), "stop");
assert.equal(detectGiftCommand("end now"), "stop");
assert.equal(detectGiftCommand("quit"), "stop");
assert.equal(detectGiftCommand("hello"), "ignored");

const availableGiftIntent = {
  state: "active",
  latestCommand: "gift",
  requestedAt: 1723152000000,
  latestEventId: "gift-2",
};
assert.equal(hasAvailableGiftRequest(availableGiftIntent), true);
assert.equal(
  hasAvailableGiftRequest({
    ...availableGiftIntent,
    consumedGiftEventId: "gift-2",
  }),
  false,
);
assert.equal(
  hasAvailableGiftRequest({
    ...availableGiftIntent,
    state: "suppressed",
    latestCommand: "stop",
  }),
  false,
);

const payload = {
  for_user_id: "sender-account",
  direct_message_events: [
    {
      type: "message_create",
      id: "inbound-gift",
      created_timestamp: "1723152000000",
      message_create: {
        target: { recipient_id: "sender-account" },
        sender_id: "recipient-account",
        message_data: { text: "GIFT please" },
      },
    },
    {
      type: "message_create",
      id: "outbound-message",
      created_timestamp: "1723152000001",
      message_create: {
        target: { recipient_id: "recipient-account" },
        sender_id: "sender-account",
        message_data: { text: "Your gift is ready" },
      },
    },
  ],
};

assert.deepEqual(parseInboundDirectMessages(payload), [
  {
    eventId: "inbound-gift",
    forUserId: "sender-account",
    senderXUserId: "recipient-account",
    recipientXUserId: "sender-account",
    command: "gift",
    eventCreatedAt: 1723152000000,
  },
]);
assert.deepEqual(parseInboundDirectMessages({ direct_message_events: [] }), []);
assert.deepEqual(parseInboundDirectMessages(null), []);

const secret = "consumer-secret";
const body = JSON.stringify(payload);
const expectedSha256 = createHmac("sha256", secret)
  .update(body)
  .digest("base64");
const actualSha256 = await hmacSha256Base64(body, secret);
assert.equal(actualSha256, expectedSha256);
assert.equal(timingSafeEqual(`sha256=${actualSha256}`, `sha256=${expectedSha256}`), true);
assert.equal(timingSafeEqual(`sha256=${actualSha256}`, "sha256=incorrect"), false);

const oauthBase = "POST&https%3A%2F%2Fapi.x.com&oauth_consumer_key%3Dkey";
const expectedSha1 = createHmac("sha1", "consumer&token")
  .update(oauthBase)
  .digest("base64");
assert.equal(await hmacSha1Base64(oauthBase, "consumer&token"), expectedSha1);

console.log("X Account Activity parser and signature checks passed.");
