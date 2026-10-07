import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { buildShareRows, hashShareRows } from "../convex/boardShares";
import { buildBoardCardSvg } from "../convex/ogArt";
import type { PublicLeaderboardRow } from "../convex/profiles";
import schema from "../convex/schema";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

// createBoardShare schedules the Node render action. Fake timers keep it
// from firing, since it needs the deployed static assets.
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const SYNCED_AT = 1_790_000_000_000;

function makeProfile(index: number, overrides: Record<string, unknown> = {}) {
  return {
    handle: `yapper${index}`,
    normalizedHandle: `yapper${index}`,
    displayName: `Yapper ${index}`,
    bio: null,
    profileImageUrl: null,
    xUserId: null,
    active: true,
    syncStatus: "synced" as const,
    syncError: null,
    currentImpressions: index * 10_000,
    currentPosts: index,
    currentEngagements: index * 100,
    currentFollowers: index,
    lastSyncedAt: SYNCED_AT + index,
    addedAt: 1_000_000 + index,
    updatedAt: 1_000_000 + index,
    ...overrides,
  };
}

function boardRow(
  index: number,
  extra: Partial<PublicLeaderboardRow> = {},
): PublicLeaderboardRow {
  return {
    _id: `profile${index}` as Id<"profiles">,
    handle: `yapper${index}`,
    normalizedHandle: `yapper${index}`,
    displayName: `Yapper ${index}`,
    bio: null,
    profileImageUrl: null,
    syncStatus: "synced",
    currentImpressions: 0,
    currentPosts: 0,
    currentEngagements: 1_000 - index,
    currentFollowers: 0,
    lastSyncedAt: SYNCED_AT,
    addedAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

test("ranked rows follow board ranks and skip muted, legend, and unsynced rows", () => {
  const rows = buildShareRows(
    [
      boardRow(1),
      boardRow(2, { syncStatus: "pending", lastSyncedAt: null }),
      boardRow(3),
      boardRow(4, { muted: true }),
      boardRow(5, { legend: true }),
      boardRow(6),
      boardRow(7),
      boardRow(8),
      boardRow(9),
    ],
    "engagements",
  );
  expect(rows.map((row) => [row.rank, row.handle])).toEqual([
    [1, "yapper1"],
    [3, "yapper3"],
    [4, "yapper6"],
    [5, "yapper7"],
    [6, "yapper8"],
  ]);
  expect(rows.every((row) => row.value === null)).toBe(true);
});

test("Convex rows use mention count and drop people with none", () => {
  const rows = buildShareRows(
    [
      boardRow(1, { convexPostCount: 4 }),
      boardRow(2, { convexPostCount: 0 }),
      boardRow(3, { convexPostCount: 1 }),
    ],
    "convexPosts",
  );
  expect(rows.map((row) => [row.rank, row.value])).toEqual([
    [1, 4],
    [3, 1],
  ]);
});

test("Legends rows carry no rank or value", () => {
  const rows = buildShareRows(
    [boardRow(1, { legend: true }), boardRow(2), boardRow(3, { legend: true })],
    "none",
  );
  expect(rows).toEqual([
    expect.objectContaining({ handle: "yapper1", rank: null, value: null }),
    expect.objectContaining({ handle: "yapper3", rank: null, value: null }),
  ]);
});

test("the content hash is stable and moves with any row change", () => {
  const rows = buildShareRows([boardRow(1), boardRow(2)], "engagements");
  const base = { boardLabel: "Yappers", rows, dataAsOf: SYNCED_AT };
  expect(hashShareRows(base)).toBe(hashShareRows({ ...base, rows: [...rows] }));
  const bumped = rows.map((row, index) =>
    index === 0 ? { ...row, value: (row.value ?? 0) + 1 } : row,
  );
  expect(hashShareRows({ ...base, rows: bumped })).not.toBe(hashShareRows(base));
  expect(hashShareRows({ ...base, dataAsOf: SYNCED_AT + 1 })).not.toBe(
    hashShareRows(base),
  );
});

test("the card SVG escapes names and shows ranks", () => {
  const svg = buildBoardCardSvg({
    communityName: "Friends of Convex",
    boardLabel: "Yappers",
    kind: "ranked",
    metricLabel: "Engagements",
    dataAsOf: null,
    rows: [
      { rank: 1, handle: "a", displayName: "<script>", avatar: null, value: 12_345 },
    ],
  });
  expect(svg).toContain("&lt;script&gt;");
  expect(svg).not.toContain("<script>");
  expect(svg).toContain("12.3K");
  expect(svg).toContain("ENGAGEMENTS");
});

test("the card drops the metric column when no row has a number", () => {
  const svg = buildBoardCardSvg({
    communityName: "Friends of Convex",
    boardLabel: "Convex Team",
    kind: "ranked",
    metricLabel: "Engagements",
    dataAsOf: null,
    rows: [{ rank: 1, handle: "a", displayName: "Jamie", avatar: null, value: null }],
  });
  expect(svg).not.toContain("ENGAGEMENTS");
  expect(svg).toContain("Jamie");
});

test("repeat posts of an unchanged board reuse one share, a change makes a new one", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const out: Array<Id<"profiles">> = [];
    for (let index = 1; index <= 7; index += 1) {
      out.push(await ctx.db.insert("profiles", makeProfile(index)));
    }
    return out;
  });

  const first = await t.mutation(api.boardShares.createBoardShare, {
    board: "impressions",
  });
  const again = await t.mutation(api.boardShares.createBoardShare, {
    board: "impressions",
  });
  expect(first).not.toBeNull();
  expect(again).toBe(first);

  const share = await t.query(api.boardShares.getBoardShare, { shareId: first! });
  expect(share?.boardLabel).toBe("Yappers");
  expect(share?.rows).toHaveLength(5);
  expect(share?.rows[0]).toMatchObject({ rank: 1, handle: "yapper7", value: null });
  expect(share?.dataAsOf).toBe(SYNCED_AT + 7);

  await t.run(async (ctx) => {
    await ctx.db.patch("profiles", ids[0]!, { currentEngagements: 99_999 });
  });
  const changed = await t.mutation(api.boardShares.createBoardShare, {
    board: "impressions",
  });
  expect(changed).not.toBe(first);
  const changedShare = await t.query(api.boardShares.getBoardShare, {
    shareId: changed!,
  });
  expect(changedShare?.rows[0]?.handle).toBe("yapper1");
});

test("hidden tabs, hidden groups, internal groups, and empty boards are refused", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const profileId = await ctx.db.insert("profiles", makeProfile(1));
    const now = 1_000;
    for (const [slug, visible, internal] of [
      ["secret", true, true],
      ["drafts", false, false],
    ] as const) {
      const groupId = await ctx.db.insert("groups", {
        name: slug,
        slug,
        visible,
        internal,
        order: 0,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("groupMemberships", { groupId, profileId, addedAt: now });
    }
    await ctx.db.insert("boardDisplaySettings", {
      key: "board",
      yappersColumns: { posts: true, engagements: true, impressions: true },
      convexColumns: {
        convexPosts: true,
        shareOfPosts: true,
        convexImpressions: true,
        convexEngagements: true,
        weeklyChange: true,
      },
      showYappersTab: false,
      showConvexTab: true,
      updatedAt: now,
    });
  });

  for (const board of ["impressions", "secret", "drafts", "no-such-board", "legends", "convex"]) {
    expect(await t.mutation(api.boardShares.createBoardShare, { board })).toBeNull();
  }
  expect(
    await t.query(api.boardShares.getBoardShare, { shareId: "not-an-id" }),
  ).toBeNull();
});

test("group, Convex mentions, and Legends boards each freeze their own story", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const champ = await ctx.db.insert("profiles", makeProfile(1));
    const runnerUp = await ctx.db.insert("profiles", makeProfile(2));
    await ctx.db.insert("profiles", makeProfile(3, { legendAt: 5_000 }));
    await ctx.db.insert("snapshots", {
      profileId: champ,
      windowStart: 0,
      windowEnd: SYNCED_AT,
      capturedAt: SYNCED_AT,
      impressions: 0,
      postCount: 0,
      engagementCount: 0,
      followerCount: 0,
      convexPostCount: 3,
      convexImpressions: 0,
      convexEngagements: 0,
    });
    const groupId = await ctx.db.insert("groups", {
      name: "Champions",
      slug: "champions",
      visible: true,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    await ctx.db.insert("groupMemberships", { groupId, profileId: champ, addedAt: 0 });
    await ctx.db.insert("groupMemberships", { groupId, profileId: runnerUp, addedAt: 0 });
  });

  const groupShare = await t.query(api.boardShares.getBoardShare, {
    shareId: (await t.mutation(api.boardShares.createBoardShare, { board: "champions" }))!,
  });
  expect(groupShare?.boardLabel).toBe("Champions");
  expect(groupShare?.rows.map((row) => row.handle)).toEqual(["yapper2", "yapper1"]);

  const convexShare = await t.query(api.boardShares.getBoardShare, {
    shareId: (await t.mutation(api.boardShares.createBoardShare, { board: "convex" }))!,
  });
  expect(convexShare?.metricLabel).toBe("Convex posts");
  expect(convexShare?.rows).toEqual([
    expect.objectContaining({ rank: 1, handle: "yapper1", value: 3 }),
  ]);

  const legendShare = await t.query(api.boardShares.getBoardShare, {
    shareId: (await t.mutation(api.boardShares.createBoardShare, { board: "legends" }))!,
  });
  expect(legendShare?.kind).toBe("legends");
  expect(legendShare?.rows).toEqual([
    expect.objectContaining({ handle: "yapper3", rank: null, value: null }),
  ]);
});
