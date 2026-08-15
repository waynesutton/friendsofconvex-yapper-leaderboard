export type AccountActivityCommand = "gift" | "stop" | "ignored";

export type ParsedInboundDm = {
  eventId: string;
  forUserId: string;
  senderXUserId: string;
  recipientXUserId: string;
  command: AccountActivityCommand;
  eventCreatedAt: number | null;
};

type GiftIntentSnapshot = {
  state: "active" | "suppressed";
  latestCommand: "gift" | "stop";
  requestedAt: number | null;
  latestEventId: string;
  consumedGiftEventId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function detectGiftCommand(text: string): AccountActivityCommand {
  const firstWord = text.trim().toUpperCase().match(/^[A-Z]+/)?.[0] ?? "";
  if (firstWord === "GIFT") return "gift";
  if (
    firstWord === "STOP" ||
    firstWord === "UNSUBSCRIBE" ||
    firstWord === "CANCEL" ||
    firstWord === "END" ||
    firstWord === "QUIT"
  ) {
    return "stop";
  }
  return "ignored";
}

export function hasAvailableGiftRequest(
  intent: GiftIntentSnapshot | null,
): boolean {
  return Boolean(
    intent?.state === "active" &&
      intent.latestCommand === "gift" &&
      intent.requestedAt !== null &&
      intent.latestEventId !== intent.consumedGiftEventId,
  );
}

export function parseInboundDirectMessages(payload: unknown): ParsedInboundDm[] {
  if (!isRecord(payload) || typeof payload.for_user_id !== "string") {
    return [];
  }
  const forUserId = payload.for_user_id;
  if (!Array.isArray(payload.direct_message_events)) return [];

  const events: ParsedInboundDm[] = [];
  for (const rawEvent of payload.direct_message_events) {
    if (
      !isRecord(rawEvent) ||
      rawEvent.type !== "message_create" ||
      typeof rawEvent.id !== "string" ||
      !isRecord(rawEvent.message_create)
    ) {
      continue;
    }
    const messageCreate = rawEvent.message_create;
    const target = isRecord(messageCreate.target) ? messageCreate.target : null;
    const messageData = isRecord(messageCreate.message_data)
      ? messageCreate.message_data
      : null;
    if (
      !target ||
      typeof target.recipient_id !== "string" ||
      typeof messageCreate.sender_id !== "string" ||
      !messageData ||
      typeof messageData.text !== "string"
    ) {
      continue;
    }

    // Account Activity includes both sent and received DMs. Only inbound
    // messages addressed to the subscribed sender account can change consent.
    if (
      target.recipient_id !== forUserId ||
      messageCreate.sender_id === forUserId
    ) {
      continue;
    }
    const createdTimestamp =
      typeof rawEvent.created_timestamp === "string"
        ? Number(rawEvent.created_timestamp)
        : Number.NaN;
    events.push({
      eventId: rawEvent.id,
      forUserId,
      senderXUserId: messageCreate.sender_id,
      recipientXUserId: target.recipient_id,
      command: detectGiftCommand(messageData.text),
      eventCreatedAt: Number.isFinite(createdTimestamp)
        ? createdTimestamp
        : null,
    });
  }
  return events;
}
