import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { formatDayLabel, isDayKey, pacificDay, shiftDay } from "../convex/rankingDays";
import schema from "../convex/schema";
import { asXUser } from "./asXUser";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

const OWNER_X_ID = "owner-1";
const previousAdmins = process.env.ADMIN_X_USER_IDS;

// Oct 24, 2026, 8:17 AM PDT: a normal daily board pass.
const PASS_STARTED = Date.UTC(2026, 9, 24, 15, 17);
const PASS_DAY = "2026-10-24";

// Fake timers keep the board share render action (Node, needs deployed
// assets) from firing; capture jobs are drained by hand.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(PASS_STARTED + 60_000);
  process.env.ADMIN_X_USER_IDS = OWNER_X_ID;
});

afterEach(() => {
  vi.useRealTimers();
  process.env.ADMIN_X_USER_IDS = previousAdmins;
});

function makeProfile(index: number, overrides: Record<string, unknown> = {}) {
  return {
    handle: `yapper${index}`,
    normalizedHandle: `yapper${index}`,
    displayName: `Yapper ${index}`,
    bio: `Bio ${index}`,
    profileImageUrl: null,
    xUserId: null,
    active: true,
    syncStatus: "synced" as const,
    syncError: null,
    currentImpressions: index * 10_000,
    currentPosts: index,
    currentEngagements: index * 100,
    currentFollowers: index,
    lastSyncedAt: PASS_STARTED,
    addedAt: 1_000_000 + index,
    updatedAt: 1_000_000 + index,
    ...overrides,
  };
}

type Seeded = {
  profiles: Array<Id<"profiles">>;
};

// Four yappers, a public group with one muted member, and an internal group.
async function seed(t: TestConvex<typeof schema>): Promise<Seeded> {
  return await t.run(async (ctx) => {
    const profiles: Array<Id<"profiles">> = [];
    for (let index = 1; index <= 4; index += 1) {
      profiles.push(await ctx.db.insert("profiles", makeProfile(index)));
    }
    const crew = await ctx.db.insert("groups", {
      name: "Crew",
      slug: "crew",
      visible: true,
      order: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    await ctx.db.insert("groupMemberships", { groupId: crew, profileId: profiles[0]!, addedAt: 0 });
    await ctx.db.insert("groupMemberships", {
      groupId: crew,
      profileId: profiles[3]!,
      muted: true,
      addedAt: 0,
    });
    await ctx.db.insert("groupMemberships", { groupId: crew, profileId: profiles[1]!, addedAt: 0 });
    const team = await ctx.db.insert("groups", {
      name: "Team",
      slug: "team",
      visible: true,
      internal: true,
      order: 1,
      createdAt: 0,
      updatedAt: 0,
    });
    await ctx.db.insert("groupMemberships", { groupId: team, profileId: profiles[2]!, addedAt: 0 });
    return { profiles };
  });
}

async function capture(t: TestConvex<typeof schema>, runStartedAt = PASS_STARTED) {
  await t.mutation(internal.boardRankings.captureAll, { runStartedAt });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

describe("Pacific day keys", () => {
  test("follow the Pacific calendar across both DST changes", () => {
    // Spring forward, Mar 8 2026: 23:59 PST the night before, 01:59 PST after.
    expect(pacificDay(Date.UTC(2026, 2, 8, 7, 59))).toBe("2026-03-07");
    expect(pacificDay(Date.UTC(2026, 2, 8, 9, 59))).toBe("2026-03-08");
    // Fall back, Nov 1 2026: 23:59 PDT the night before, then 23:59 PST.
    expect(pacificDay(Date.UTC(2026, 10, 1, 6, 59))).toBe("2026-10-31");
    expect(pacificDay(Date.UTC(2026, 10, 1, 7, 30))).toBe("2026-11-01");
    expect(pacificDay(Date.UTC(2026, 10, 2, 7, 59))).toBe("2026-11-01");
  });

  test("shift, validate, and label", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(isDayKey("2026-10-24")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("Oct 24")).toBe(false);
    expect(formatDayLabel("2026-10-24")).toBe("Sat, Oct 24");
    expect(formatDayLabel("2026-10-24", true)).toBe("Sat, Oct 24, 2026");
  });
});

test("a capture saves every board under the pass day, ranked like the live board", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  await capture(t);

  const boards = await t.run(async (ctx) =>
    (await ctx.db.query("boardRankings").collect()).map((ranking) => ranking.board).sort(),
  );
  expect(boards).toEqual(["convex", "crew", "impressions", "team"]);

  const live = await t.query(api.profiles.listLeaderboard, { limit: 100 });
  const saved = await t.query(api.boardRankings.getRanking, {
    board: "impressions",
    day: PASS_DAY,
  });
  expect(saved?.dataAsOf).toBe(PASS_STARTED);
  expect(saved?.rows.map((row) => row.handle)).toEqual(live.map((row) => row.handle));
  // Bios stay out of the saved copy; the board merges them back.
  expect(saved?.rows.every((row) => row.bio === null)).toBe(true);
  expect(saved?.rows.every((row) => row.convexPostsStored === 0)).toBe(true);

  // Muted group members keep their row below the ranking, with no rank.
  const crew = await t.query(api.boardRankings.getRanking, { board: "crew", day: PASS_DAY });
  expect(crew?.rows.map((row) => [row.handle, row.muted ?? false])).toEqual([
    ["yapper2", false],
    ["yapper1", false],
    ["yapper4", true],
  ]);
  const stored = await t.run(async (ctx) => {
    const ranking = await ctx.db
      .query("boardRankings")
      .withIndex("by_board_and_day", (q) => q.eq("board", "crew").eq("day", PASS_DAY))
      .unique();
    return (await ctx.db.get("boardRankingRows", ranking!.rowsId))!.rows;
  });
  expect(stored.map((row) => row.rank)).toEqual([1, 2, null]);
});

test("internal group days are captured but only admins can read them", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  await capture(t);

  expect(await t.query(api.boardRankings.getRanking, { board: "team", day: PASS_DAY })).toBeNull();
  expect(await t.query(api.boardRankings.listDays, { board: "team" })).toEqual([]);

  const admin = await asXUser(t, OWNER_X_ID);
  const saved = await admin.query(api.boardRankings.getRanking, { board: "team", day: PASS_DAY });
  expect(saved?.rows.map((row) => row.handle)).toEqual(["yapper3"]);

  // Share links are public, so even admins cannot freeze an internal day.
  expect(
    await admin.mutation(api.boardShares.createBoardShare, { board: "team", day: PASS_DAY }),
  ).toBeNull();
});

test("a second pass on the same day replaces the copy instead of adding one", async () => {
  const t = convexTest(schema, modules);
  const { profiles } = await seed(t);
  await capture(t);
  await t.run(async (ctx) => {
    await ctx.db.patch("profiles", profiles[0]!, { currentEngagements: 99_999 });
  });
  await capture(t, PASS_STARTED + 3 * 60 * 60 * 1000);

  const counts = await t.run(async (ctx) => ({
    rankings: (await ctx.db.query("boardRankings").collect()).length,
    rows: (await ctx.db.query("boardRankingRows").collect()).length,
  }));
  expect(counts).toEqual({ rankings: 4, rows: 4 });
  const saved = await t.query(api.boardRankings.getRanking, {
    board: "impressions",
    day: PASS_DAY,
  });
  expect(saved?.rows[0]?.handle).toBe("yapper1");
});

test("days past the 7 day window are pruned, and listDays is newest first", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  // Nine daily passes, Oct 16 through Oct 24.
  for (let back = 8; back >= 0; back -= 1) {
    const started = PASS_STARTED - back * 24 * 60 * 60 * 1000;
    vi.setSystemTime(started + 60_000);
    await capture(t, started);
  }

  const days = await t.query(api.boardRankings.listDays, { board: "impressions" });
  expect(days.map((entry) => entry.day)).toEqual([
    "2026-10-24",
    "2026-10-23",
    "2026-10-22",
    "2026-10-21",
    "2026-10-20",
    "2026-10-19",
    "2026-10-18",
    "2026-10-17",
  ]);
  const orphanRows = await t.run(async (ctx) => {
    const rankings = await ctx.db.query("boardRankings").collect();
    const rows = await ctx.db.query("boardRankingRows").collect();
    return rows.length - rankings.length;
  });
  expect(orphanRows).toBe(0);
  expect(
    await t.query(api.boardRankings.getRanking, { board: "impressions", day: "2026-10-16" }),
  ).toBeNull();
});

test("hidden tabs and bad days read as nothing", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  await capture(t);
  await t.run(async (ctx) => {
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
      updatedAt: 0,
    });
  });
  expect(
    await t.query(api.boardRankings.getRanking, { board: "impressions", day: PASS_DAY }),
  ).toBeNull();
  expect(await t.query(api.boardRankings.getRanking, { board: "convex", day: "nope" })).toBeNull();
  expect(
    await t.query(api.boardRankings.getRanking, { board: "legends", day: PASS_DAY }),
  ).toBeNull();
});

test("a past day share freezes the saved rows and carries the day", async () => {
  const t = convexTest(schema, modules);
  const { profiles } = await seed(t);
  await capture(t);
  // The live board moves on after the save.
  await t.run(async (ctx) => {
    await ctx.db.patch("profiles", profiles[0]!, { currentEngagements: 99_999 });
  });

  const dayShare = await t.mutation(api.boardShares.createBoardShare, {
    board: "impressions",
    day: PASS_DAY,
  });
  expect(dayShare?.topHandles).toEqual(["yapper4", "yapper3", "yapper2"]);
  const share = await t.query(api.boardShares.getBoardShare, { shareId: dayShare!.shareId });
  expect(share?.rankingDay).toBe(PASS_DAY);
  expect(share?.dataAsOf).toBe(PASS_STARTED);

  const liveShare = await t.mutation(api.boardShares.createBoardShare, { board: "impressions" });
  expect(liveShare?.shareId).not.toBe(dayShare?.shareId);
  expect(liveShare?.topHandles[0]).toBe("yapper1");
  const live = await t.query(api.boardShares.getBoardShare, { shareId: liveShare!.shareId });
  expect(live?.rankingDay).toBeNull();

  expect(
    await t.mutation(api.boardShares.createBoardShare, { board: "impressions", day: "2026-10-01" }),
  ).toBeNull();
});

test("removing a profile scrubs it from every saved day", async () => {
  const t = convexTest(schema, modules);
  const { profiles } = await seed(t);
  await capture(t);

  const admin = await asXUser(t, OWNER_X_ID);
  await admin.mutation(api.profiles.remove, { profileId: profiles[0]! });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const saved = await t.query(api.boardRankings.getRanking, {
    board: "impressions",
    day: PASS_DAY,
  });
  expect(saved?.rows.map((row) => row.handle)).toEqual(["yapper4", "yapper3", "yapper2"]);
  const crew = await t.query(api.boardRankings.getRanking, { board: "crew", day: PASS_DAY });
  expect(crew?.rows.some((row) => row.handle === "yapper1")).toBe(false);
});
