import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { BOARD_MAX } from "../convex/boardLimits";
import schema from "../convex/schema";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

function makeProfile(index: number) {
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
    currentImpressions: index * 1_000,
    currentPosts: index,
    currentEngagements: index * 10,
    currentFollowers: index,
    lastSyncedAt: 1_000_000,
    addedAt: 1_000_000 + index,
    updatedAt: 1_000_000 + index,
  };
}

test("every active non-legend profile reaches the board past 250", async () => {
  const t = convexTest(schema, modules);
  const memberCount = 264;
  await t.run(async (ctx) => {
    for (let index = 0; index < memberCount; index += 1) {
      await ctx.db.insert("profiles", makeProfile(index));
    }
    // Legends carry the highest impressions, which is what used to push the
    // lowest members past the old 250 row read.
    for (let index = 0; index < 2; index += 1) {
      await ctx.db.insert("profiles", {
        ...makeProfile(10_000 + index),
        legendAt: 5_000_000 + index,
      });
    }
  });

  const board = await t.query(api.profiles.listLeaderboard, { limit: BOARD_MAX });
  expect(board.length).toBe(memberCount);
  expect(board.some((row) => row.handle === "yapper0")).toBe(true);

  const convexBoard = await t.query(api.profiles.listLeaderboard, {
    limit: BOARD_MAX,
    mode: "convex",
  });
  expect(convexBoard.length).toBe(memberCount);

  const legends = await t.query(api.profiles.listLeaderboard, {
    limit: BOARD_MAX,
    mode: "legends",
  });
  expect(legends.length).toBe(2);
});

test("a sync stores the Convex trend the board reads back", async () => {
  const t = convexTest(schema, modules);
  const profileId = await t.run(async (ctx) => {
    return await ctx.db.insert("profiles", makeProfile(1));
  });

  const day = 24 * 60 * 60 * 1000;
  const base = 100 * day;
  // Two weekly syncs with Convex posts, eight days apart.
  for (const [offset, convexPostCount] of [
    [0, 2],
    [8 * day, 5],
  ] as const) {
    await t.mutation(internal.profiles.recordSyncSuccess, {
      profileId,
      handle: "yapper1",
      displayName: "Yapper 1",
      bio: null,
      profileImageUrl: null,
      xUserId: "1",
      impressions: 10,
      postCount: 3,
      engagementCount: 4,
      followerCount: 5,
      windowStart: base + offset - 7 * day,
      windowEnd: base + offset,
      convexPostCount,
      convexImpressions: 7,
      convexEngagements: 8,
      convexPosts: [],
    });
  }

  const stored = await t.run(async (ctx) => await ctx.db.get("profiles", profileId));
  expect(stored?.convexWeeklyChange).toBe(3);
  expect(stored?.convexStreak).toBe(2);
  expect(stored?.convexPostsStored).toBe(0);

  const [row] = await t.query(api.profiles.listLeaderboard, {
    limit: BOARD_MAX,
    mode: "convex",
  });
  expect(row?.convexPostCount).toBe(5);
  expect(row?.convexWeeklyChange).toBe(3);
  expect(row?.convexStreak).toBe(2);
  expect(row?.convexScanned).toBe(true);
});
