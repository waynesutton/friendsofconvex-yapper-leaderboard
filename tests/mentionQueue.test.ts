import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import {
  isScanDue,
  MENTION_WINDOW_MS,
  parseMentionPage,
} from "../convex/mentionQueue";
import schema from "../convex/schema";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

const ADMIN_X_ID = "900001";
const DAY_MS = 24 * 60 * 60 * 1000;
const previousAdmins = process.env.ADMIN_X_USER_IDS;

beforeEach(() => {
  process.env.ADMIN_X_USER_IDS = ADMIN_X_ID;
});

afterEach(() => {
  process.env.ADMIN_X_USER_IDS = previousAdmins;
});

function author(index: number) {
  return {
    xUserId: `author-${index}`,
    handle: `fan${index}`,
    displayName: `Fan ${index}`,
    profileImageUrl: null,
    bio: null,
    followerCount: index * 10,
  };
}

function post(authorIndex: number, postId: string, postedAt: number) {
  return {
    postId,
    authorXUserId: `author-${authorIndex}`,
    text: `Shipping with @convex ${postId}`,
    url: `https://x.com/fan${authorIndex}/status/${postId}`,
    postedAt,
  };
}

// Signed in admin client: Convex Auth reads the user id from the subject and
// the stable X id from the twitter authAccounts row.
async function asAdmin(t: TestConvex<typeof schema>) {
  const subject = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { xUserId: ADMIN_X_ID });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "twitter",
      providerAccountId: ADMIN_X_ID,
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + DAY_MS,
    });
    return `${userId}|${sessionId}`;
  });
  return t.withIdentity({ subject });
}

async function candidateFor(t: TestConvex<typeof schema>, index: number) {
  return await t.run(
    async (ctx) =>
      await ctx.db
        .query("mentionCandidates")
        .withIndex("by_x_user_id", (q) => q.eq("xUserId", `author-${index}`))
        .unique(),
  );
}

test("two mentions queue a person, one mention only watches them", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.mentionQueue.recordMentions, {
    posts: [post(1, "p1", now - DAY_MS), post(1, "p2", now), post(2, "p3", now)],
    authors: [author(1), author(2)],
  });

  expect((await candidateFor(t, 1))?.status).toBe("queued");
  expect((await candidateFor(t, 1))?.recentMentionCount).toBe(2);
  expect((await candidateFor(t, 2))?.status).toBe("watching");
});

test("duplicate post ids are ignored", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const first = await t.mutation(internal.mentionQueue.recordMentions, {
    posts: [post(1, "p1", now)],
    authors: [author(1)],
  });
  const second = await t.mutation(internal.mentionQueue.recordMentions, {
    posts: [post(1, "p1", now)],
    authors: [author(1)],
  });

  expect(first).toBe(1);
  expect(second).toBe(0);
  expect((await candidateFor(t, 1))?.status).toBe("watching");
});

test("people already on the board go straight to added", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.run(async (ctx) => {
    await ctx.db.insert("profiles", {
      handle: "fan1",
      normalizedHandle: "fan1",
      displayName: "Fan 1",
      bio: null,
      profileImageUrl: null,
      xUserId: "author-1",
      active: true,
      syncStatus: "synced",
      syncError: null,
      currentImpressions: 0,
      currentPosts: 0,
      currentEngagements: 0,
      currentFollowers: 0,
      lastSyncedAt: null,
      addedAt: now,
      updatedAt: now,
    });
  });
  await t.mutation(internal.mentionQueue.recordMentions, {
    posts: [post(1, "p1", now), post(1, "p2", now)],
    authors: [author(1)],
  });
  expect((await candidateFor(t, 1))?.status).toBe("added");
});

test("the daily recount demotes someone whose mention aged out", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.mentionQueue.recordMentions, {
    posts: [post(1, "p1", now), post(1, "p2", now - DAY_MS)],
    authors: [author(1)],
  });
  expect((await candidateFor(t, 1))?.status).toBe("queued");

  // Push the older mention past the 30 day window.
  await t.run(async (ctx) => {
    const old = await ctx.db
      .query("mentionPosts")
      .withIndex("by_post_id", (q) => q.eq("postId", "p2"))
      .unique();
    if (old) {
      await ctx.db.patch("mentionPosts", old._id, {
        postedAt: now - MENTION_WINDOW_MS - DAY_MS,
      });
    }
  });
  await t.mutation(internal.mentionQueue.recountWindow, { cursor: null });

  const candidate = await candidateFor(t, 1);
  expect(candidate?.status).toBe("watching");
  expect(candidate?.recentMentionCount).toBe(1);
});

test("add to board creates the profile once and is safe to repeat", async () => {
  const t = convexTest(schema, modules);
  const admin = await asAdmin(t);
  const now = Date.now();
  await t.mutation(internal.mentionQueue.recordMentions, {
    posts: [post(1, "p1", now), post(1, "p2", now)],
    authors: [author(1)],
  });
  const candidate = await candidateFor(t, 1);
  if (!candidate) throw new Error("candidate missing");

  const first = await admin.mutation(api.mentionQueue.addToBoard, {
    candidateId: candidate._id,
  });
  const second = await admin.mutation(api.mentionQueue.addToBoard, {
    candidateId: candidate._id,
  });

  expect(first.created).toBe(true);
  expect(second.created).toBe(false);
  expect(second.profileId).toBe(first.profileId);
  const profile = await t.run(
    async (ctx) => await ctx.db.get("profiles", first.profileId),
  );
  expect(profile?.source).toBe("mention-queue");
  expect(profile?.active).toBe(true);
  expect((await candidateFor(t, 1))?.status).toBe("added");
});

test("the queue pages past 30 rows, newest mention first", async () => {
  const t = convexTest(schema, modules);
  const admin = await asAdmin(t);
  const now = Date.now();
  const total = 35;
  for (let index = 0; index < total; index += 1) {
    await t.mutation(internal.mentionQueue.recordMentions, {
      posts: [
        post(index, `a${index}`, now - index * 60_000),
        post(index, `b${index}`, now - DAY_MS - index * 60_000),
      ],
      authors: [author(index)],
    });
  }

  const first = await admin.query(api.mentionQueue.listQueue, {
    paginationOpts: { numItems: 30, cursor: null },
  });
  expect(first.page).toHaveLength(30);
  expect(first.isDone).toBe(false);
  expect(first.page[0]?.handle).toBe("fan0");
  expect(first.page[0]?.lastPosts).toHaveLength(2);
  const dates = first.page.map((row) => row.lastMentionAt);
  expect([...dates].sort((a, b) => b - a)).toEqual(dates);

  const second = await admin.query(api.mentionQueue.listQueue, {
    paginationOpts: { numItems: 30, cursor: first.continueCursor },
  });
  expect(second.page).toHaveLength(total - 30);
  expect(second.isDone).toBe(true);
});

test("the queue is admin only", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.query(api.mentionQueue.listQueue, {
      paginationOpts: { numItems: 30, cursor: null },
    }),
  ).rejects.toThrow();
});

test("parseMentionPage keeps expanded authors and drops the target's own posts", () => {
  const page = parseMentionPage(
    {
      data: [
        { id: "1", author_id: "u1", text: "hi @convex", created_at: "2026-09-30T10:00:00.000Z" },
        { id: "2", author_id: "target", text: "thanks!", created_at: "2026-09-30T11:00:00.000Z" },
        { id: "3", author_id: "hidden", text: "protected", created_at: "2026-09-30T12:00:00.000Z" },
      ],
      includes: {
        users: [
          { id: "u1", username: "fan", name: "Fan", public_metrics: { followers_count: 12 } },
          { id: "target", username: "convex", name: "Convex" },
        ],
      },
      meta: { newest_id: "3", next_token: "next" },
    },
    "target",
  );

  expect(page.posts.map((item) => item.postId)).toEqual(["1"]);
  expect(page.posts[0]?.url).toBe("https://x.com/fan/status/1");
  expect(page.authors).toEqual([
    {
      xUserId: "u1",
      handle: "fan",
      displayName: "Fan",
      profileImageUrl: null,
      bio: null,
      followerCount: 12,
    },
  ]);
  expect(page.newestId).toBe("3");
  expect(page.nextToken).toBe("next");
});

test("isScanDue honors the interval with a small grace for cron drift", () => {
  const hour = 60 * 60 * 1000;
  const last = 1_000_000_000;
  expect(isScanDue(null, 6, last)).toBe(true);
  expect(isScanDue(last, 6, last + 5 * hour)).toBe(false);
  expect(isScanDue(last, 6, last + 6 * hour - 2 * 60 * 1000)).toBe(true);
  expect(isScanDue(last, 1, last + hour)).toBe(true);
  expect(isScanDue(last, 4, last + 3 * hour)).toBe(false);
});

test("settings default to on every 6 hours and save for admins only", async () => {
  const t = convexTest(schema, modules);
  const admin = await asAdmin(t);

  const before = await admin.query(api.mentionQueue.getScanStatus, {});
  expect(before.enabled).toBe(true);
  expect(before.intervalHours).toBe(6);

  await admin.mutation(api.mentionQueue.setScanSettings, {
    enabled: true,
    intervalHours: 1,
  });
  const after = await admin.query(api.mentionQueue.getScanStatus, {});
  expect(after.intervalHours).toBe(1);

  await expect(
    t.mutation(api.mentionQueue.setScanSettings, { enabled: false, intervalHours: 6 }),
  ).rejects.toThrow();
});

test("scheduled scans skip X when the feature is off or not due", async () => {
  const t = convexTest(schema, modules);
  const admin = await asAdmin(t);

  await admin.mutation(api.mentionQueue.setScanSettings, {
    enabled: false,
    intervalHours: 6,
  });
  const off = await t.action(internal.mentionQueue.scanScheduled, {});
  expect(off.status).toBe("disabled");
  const manual = await admin.action(api.mentionQueue.scanNow, {});
  expect(manual.status).toBe("disabled");

  await admin.mutation(api.mentionQueue.setScanSettings, {
    enabled: true,
    intervalHours: 6,
  });
  await t.run(async (ctx) => {
    const state = await ctx.db.query("mentionScanState").unique();
    if (state) {
      await ctx.db.patch("mentionScanState", state._id, { lastScannedAt: Date.now() });
    }
  });
  const early = await t.action(internal.mentionQueue.scanScheduled, {});
  expect(early.status).toBe("not_due");
  expect(early.postsRead).toBe(0);
});
