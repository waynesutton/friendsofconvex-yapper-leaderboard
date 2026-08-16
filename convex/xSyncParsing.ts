// Pure parsing for the X sync. No Convex imports so vitest can exercise the
// counting rules directly, with no network and no deployment.

// Whole word match: "Convex", "convex.", and "convex.dev" count because the
// dot is a word boundary; "convexity" does not.
export const CONVEX_MENTION_PATTERN = /\bconvex\b/i;

export type XPost = {
  id: string;
  text: string;
  createdAt: number;
  impressionCount: number;
  engagementCount: number;
  isRepost: boolean;
  // True when the whole word "convex" appears in the top level text, the
  // long form note text, or any expanded / unwound URL and its card copy.
  mentionsConvex: boolean;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Only reposts are dropped from the board. Replies count as posts, matching
// the posts number people see in their own X analytics. X's
// `exclude=retweets` query parameter is not trusted alone because `exclude`
// has shipped surprising gaps before (self-thread replies leaked through
// `exclude=replies`).
export function isRepost(referencedTweets: unknown): boolean {
  if (!Array.isArray(referencedTweets)) return false;
  return referencedTweets.some(
    (reference) => isRecord(reference) && reference.type === "retweeted",
  );
}

// Builds the searchable text for the Convex mention scan: post text, long
// form note text, and every URL entity's expanded form plus its card title
// and description. This is how a `t.co` wrapped convex.dev link still counts.
export function buildConvexHaystack(record: Record<string, unknown>): string {
  const parts: Array<string> = [];
  const text = stringOrNull(record.text);
  if (text) parts.push(text);

  const noteTweet = isRecord(record.note_tweet) ? record.note_tweet : {};
  const noteText = stringOrNull(noteTweet.text);
  if (noteText) parts.push(noteText);

  const entities = isRecord(record.entities) ? record.entities : {};
  const urls = Array.isArray(entities.urls) ? entities.urls : [];
  for (const url of urls) {
    if (!isRecord(url)) continue;
    for (const field of [
      url.expanded_url,
      url.unwound_url,
      url.display_url,
      url.title,
      url.description,
    ]) {
      const value = stringOrNull(field);
      if (value) parts.push(value);
    }
  }

  return parts.join("\n");
}

// Prefer the long form note text for display so expandable rows show the
// words that actually matched, not a truncated teaser.
export function fullPostText(record: Record<string, unknown>): string {
  const noteTweet = isRecord(record.note_tweet) ? record.note_tweet : {};
  return stringOrNull(noteTweet.text) ?? stringOrNull(record.text) ?? "";
}

export function parsePostPage(payload: unknown): {
  posts: Array<XPost>;
  nextToken: string | null;
} {
  if (!isRecord(payload)) {
    throw new Error("X returned an invalid posts response.");
  }

  const data = Array.isArray(payload.data) ? payload.data : [];
  const posts = data.map((post): XPost => {
    const record = isRecord(post) ? post : {};
    const metrics = isRecord(record.public_metrics)
      ? record.public_metrics
      : {};
    const engagementCount =
      numberOrZero(metrics.like_count) +
      numberOrZero(metrics.retweet_count) +
      numberOrZero(metrics.reply_count) +
      numberOrZero(metrics.quote_count) +
      numberOrZero(metrics.bookmark_count);
    const createdAtRaw = stringOrNull(record.created_at);
    const createdAt = createdAtRaw ? Date.parse(createdAtRaw) : Number.NaN;
    return {
      id: stringOrNull(record.id) ?? "",
      text: fullPostText(record),
      createdAt: Number.isFinite(createdAt) ? createdAt : 0,
      impressionCount: numberOrZero(metrics.impression_count),
      engagementCount,
      isRepost: isRepost(record.referenced_tweets),
      mentionsConvex: CONVEX_MENTION_PATTERN.test(buildConvexHaystack(record)),
    };
  });

  const meta = isRecord(payload.meta) ? payload.meta : {};
  return { posts, nextToken: stringOrNull(meta.next_token) };
}
