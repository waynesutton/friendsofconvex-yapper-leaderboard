import { describe, expect, test } from "vitest";
import {
  buildConvexHaystack,
  isRepost,
  parsePostPage,
} from "../convex/xSyncParsing";

// Minimal X API v2 post shape used by the sync.
function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "1",
    text: "hello world",
    created_at: "2026-08-15T12:00:00.000Z",
    public_metrics: {
      like_count: 3,
      retweet_count: 2,
      reply_count: 1,
      quote_count: 1,
      bookmark_count: 1,
      impression_count: 500,
    },
    ...overrides,
  };
}

describe("post classification", () => {
  test("original post counts", () => {
    const { posts } = parsePostPage({ data: [makePost()] });
    expect(posts[0]?.isRepost).toBe(false);
  });

  test("quote post counts", () => {
    const { posts } = parsePostPage({
      data: [
        makePost({ referenced_tweets: [{ type: "quoted", id: "9" }] }),
      ],
    });
    expect(posts[0]?.isRepost).toBe(false);
  });

  test("reply counts as a post", () => {
    const { posts } = parsePostPage({
      data: [
        makePost({ referenced_tweets: [{ type: "replied_to", id: "9" }] }),
      ],
    });
    expect(posts[0]?.isRepost).toBe(false);
  });

  test("repost is excluded", () => {
    expect(isRepost([{ type: "retweeted", id: "9" }])).toBe(true);
    const { posts } = parsePostPage({
      data: [
        makePost({ referenced_tweets: [{ type: "retweeted", id: "9" }] }),
      ],
    });
    expect(posts[0]?.isRepost).toBe(true);
  });
});

describe("engagement and impression fields", () => {
  test("engagements sum likes, reposts, replies, quotes, and bookmarks", () => {
    const { posts } = parsePostPage({ data: [makePost()] });
    expect(posts[0]?.engagementCount).toBe(3 + 2 + 1 + 1 + 1);
    expect(posts[0]?.impressionCount).toBe(500);
  });

  test("missing metrics count as zero instead of breaking the sync", () => {
    const { posts } = parsePostPage({
      data: [makePost({ public_metrics: { like_count: 4 } })],
    });
    expect(posts[0]?.engagementCount).toBe(4);
    expect(posts[0]?.impressionCount).toBe(0);
  });
});

describe("Convex mention matching", () => {
  test("matches the whole word in the top level text", () => {
    const { posts } = parsePostPage({
      data: [makePost({ text: "shipping with Convex today" })],
    });
    expect(posts[0]?.mentionsConvex).toBe(true);
  });

  test("matches inside a reply", () => {
    const { posts } = parsePostPage({
      data: [
        makePost({
          text: "convex makes this easy",
          referenced_tweets: [{ type: "replied_to", id: "9" }],
        }),
      ],
    });
    expect(posts[0]?.mentionsConvex).toBe(true);
    expect(posts[0]?.isRepost).toBe(false);
  });

  test("matches long form note text beyond the preview", () => {
    const { posts } = parsePostPage({
      data: [
        makePost({
          text: "a long story about backends...",
          note_tweet: { text: "...and that is why Convex won the bake off." },
        }),
      ],
    });
    expect(posts[0]?.mentionsConvex).toBe(true);
    // Display text prefers the full note text.
    expect(posts[0]?.text).toContain("bake off");
  });

  test("matches an expanded convex.dev link behind a t.co wrapper", () => {
    const { posts } = parsePostPage({
      data: [
        makePost({
          text: "check this out https://t.co/abc123",
          entities: {
            urls: [
              {
                url: "https://t.co/abc123",
                expanded_url: "https://convex.dev/components",
              },
            ],
          },
        }),
      ],
    });
    expect(posts[0]?.mentionsConvex).toBe(true);
  });

  test("matches a link card title when the URL hides the name", () => {
    const haystack = buildConvexHaystack({
      text: "great read https://t.co/xyz",
      entities: {
        urls: [
          {
            url: "https://t.co/xyz",
            expanded_url: "https://stack.example.com/post/123",
            title: "Why we moved to Convex",
          },
        ],
      },
    });
    expect(/\bconvex\b/i.test(haystack)).toBe(true);
  });

  test("does not match convexity", () => {
    const { posts } = parsePostPage({
      data: [makePost({ text: "the convexity of this curve is wild" })],
    });
    expect(posts[0]?.mentionsConvex).toBe(false);
  });

  test("does not match an unrelated post", () => {
    const { posts } = parsePostPage({
      data: [makePost({ text: "good morning to everyone" })],
    });
    expect(posts[0]?.mentionsConvex).toBe(false);
  });
});

describe("page parsing", () => {
  test("returns the pagination token", () => {
    const page = parsePostPage({
      data: [makePost()],
      meta: { next_token: "abc" },
    });
    expect(page.nextToken).toBe("abc");
  });

  test("throws on a non object payload", () => {
    expect(() => parsePostPage(null)).toThrow();
  });
});
