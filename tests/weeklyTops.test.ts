import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { isFriday } from "../convex/rankingDays";
import schema from "../convex/schema";
import { asXUser } from "./asXUser";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

const OWNER_X_ID = "owner-1";
const previousAdmins = process.env.ADMIN_X_USER_IDS;
const DAY_MS = 24 * 60 * 60 * 1000;

// Fri, Oct 23, 2026, 8:17 AM PDT: the Friday board pass.
const FRIDAY_PASS = Date.UTC(2026, 9, 23, 15, 17);
const FRIDAY = "2026-10-23";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FRIDAY_PASS + 60_000);
  process.env.ADMIN_X_USER_IDS = OWNER_X_ID;
  // The card prewarm render fetches renderer assets from static hosting,
  // which tests do not have. A failed prewarm only means the image route
  // renders on its first fetch.
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in tests")));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  process.env.ADMIN_X_USER_IDS = previousAdmins;
});

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
    currentImpressions: index * 10_000,
    currentPosts: index,
    currentEngagements: index * 100,
    currentFollowers: index,
    lastSyncedAt: FRIDAY_PASS,
    currentConvexPosts: index % 4,
    convexScannedAt: FRIDAY_PASS,
    convexStreak: 1,
    addedAt: 1_000_000 + index,
    updatedAt: 1_000_000 + index,
  };
}

// Twelve yappers, a public group, an internal group, and a hidden group.
async function seed(t: TestConvex<typeof schema>): Promise<Array<Id<"profiles">>> {
  return await t.run(async (ctx) => {
    const profiles: Array<Id<"profiles">> = [];
    for (let index = 1; index <= 12; index += 1) {
      profiles.push(await ctx.db.insert("profiles", makeProfile(index)));
    }
    const groups = [
      { name: "Crew", slug: "crew", visible: true, internal: false },
      { name: "Team", slug: "team", visible: true, internal: true },
      { name: "Drafts", slug: "drafts", visible: false, internal: false },
    ];
    for (const [order, group] of groups.entries()) {
      const groupId = await ctx.db.insert("groups", { ...group, order, createdAt: 0, updatedAt: 0 });
      for (const profileId of profiles.slice(0, 3)) {
        await ctx.db.insert("groupMemberships", { groupId, profileId, addedAt: 0 });
      }
    }
    return profiles;
  });
}

async function pass(t: TestConvex<typeof schema>, runStartedAt: number) {
  vi.setSystemTime(runStartedAt + 60_000);
  await t.mutation(internal.boardRankings.captureAll, { runStartedAt });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
}

async function pointers(t: TestConvex<typeof schema>) {
  return await t.run(async (ctx) => await ctx.db.query("weeklyTops").collect());
}

test("isFriday reads the weekday from the day key", () => {
  expect(isFriday("2026-10-23")).toBe(true);
  expect(isFriday("2026-10-24")).toBe(false);
  expect(isFriday("2026-10-30")).toBe(true);
  expect(isFriday("nope")).toBe(false);
});

test("the Friday pass freezes a top 10 for every public board", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  await pass(t, FRIDAY_PASS);

  expect(await t.query(api.weeklyTops.listWeeks, {})).toEqual([FRIDAY]);
  const week = await t.query(api.weeklyTops.getWeek, { week: FRIDAY });
  // Pill order; internal and hidden groups never get a weekly card.
  expect(week?.boards.map((board) => board.board)).toEqual(["impressions", "convex", "crew"]);

  const yappers = week!.boards[0]!;
  expect(yappers.rows).toHaveLength(10);
  expect(yappers.rows[0]?.handle).toBe("yapper12");
  expect(yappers.rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  expect(yappers.dataAsOf).toBe(FRIDAY_PASS);

  const share = await t.query(api.boardShares.getBoardShare, { shareId: yappers.shareId });
  expect(share?.period).toBe("week");
  expect(share?.rankingDay).toBe(FRIDAY);

  // The regular share of the same saved day stays a separate top 5.
  const dayShare = await t.mutation(api.boardShares.createBoardShare, {
    board: "impressions",
    day: FRIDAY,
  });
  expect(dayShare?.shareId).not.toBe(yappers.shareId);
  const day = await t.query(api.boardShares.getBoardShare, { shareId: dayShare!.shareId });
  expect(day?.rows).toHaveLength(5);
  expect(day?.period).toBeNull();
});

test("other days never capture a week on their own", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  await pass(t, FRIDAY_PASS + DAY_MS);
  expect(await pointers(t)).toEqual([]);
  expect(await t.query(api.weeklyTops.listWeeks, {})).toEqual([]);
});

test("a second Friday pass moves the week to the new numbers", async () => {
  const t = convexTest(schema, modules);
  const profiles = await seed(t);
  await pass(t, FRIDAY_PASS);
  const before = await t.query(api.weeklyTops.getWeek, { week: FRIDAY });

  await t.run(async (ctx) => {
    await ctx.db.patch("profiles", profiles[0]!, { currentEngagements: 99_999 });
  });
  await pass(t, FRIDAY_PASS + 3 * 60 * 60 * 1000);

  expect(await pointers(t)).toHaveLength(3);
  const after = await t.query(api.weeklyTops.getWeek, { week: FRIDAY });
  expect(after?.boards[0]?.rows[0]?.handle).toBe("yapper1");
  expect(after?.boards[0]?.shareId).not.toBe(before?.boards[0]?.shareId);
  // The link already posted keeps working.
  const old = await t.query(api.boardShares.getBoardShare, {
    shareId: before!.boards[0]!.shareId,
  });
  expect(old?.rows[0]?.handle).toBe("yapper12");
});

test("admins can capture any saved day by hand; visitors cannot", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  const saturday = "2026-10-24";
  await pass(t, FRIDAY_PASS + DAY_MS);

  await expect(t.mutation(api.weeklyTops.captureWeekNow, { day: saturday })).rejects.toThrow();
  await expect(t.query(api.weeklyTops.listCapturableDays, {})).rejects.toThrow();

  const admin = await asXUser(t, OWNER_X_ID);
  expect(await admin.query(api.weeklyTops.listCapturableDays, {})).toEqual([
    { day: saturday, boardCount: 4, captured: false },
  ]);
  expect(await admin.mutation(api.weeklyTops.captureWeekNow, { day: saturday })).toEqual({
    captured: 3,
  });
  // Unchanged rows reuse the same shares.
  const first = await t.query(api.weeklyTops.getWeek, { week: saturday });
  await admin.mutation(api.weeklyTops.captureWeekNow, { day: saturday });
  const again = await t.query(api.weeklyTops.getWeek, { week: saturday });
  expect(again?.boards.map((board) => board.shareId)).toEqual(
    first?.boards.map((board) => board.shareId),
  );
  expect(await admin.query(api.weeklyTops.listCapturableDays, {})).toEqual([
    { day: saturday, boardCount: 4, captured: true },
  ]);
  expect(await admin.mutation(api.weeklyTops.captureWeekNow, { day: "2026-09-01" })).toEqual({
    captured: 0,
  });
  expect(await t.mutation(internal.weeklyTops.captureWeek, { day: "bad" })).toEqual({
    captured: 0,
  });
});

test("weeks outlive the 7 day ranking history and list newest first", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  // Friday Oct 23 through Friday Oct 30, then nine more days.
  for (let offset = 0; offset <= 16; offset += 1) {
    await pass(t, FRIDAY_PASS + offset * DAY_MS);
  }

  expect(await t.query(api.weeklyTops.listWeeks, {})).toEqual(["2026-11-06", "2026-10-30", FRIDAY]);
  expect(
    await t.query(api.boardRankings.getRanking, { board: "impressions", day: FRIDAY }),
  ).toBeNull();
  const week = await t.query(api.weeklyTops.getWeek, { week: FRIDAY });
  expect(week?.boards[0]?.rows).toHaveLength(10);
});

test("a board hidden after capture drops off the week page", async () => {
  const t = convexTest(schema, modules);
  await seed(t);
  await pass(t, FRIDAY_PASS);
  await t.run(async (ctx) => {
    const crew = await ctx.db
      .query("groups")
      .withIndex("by_slug", (q) => q.eq("slug", "crew"))
      .unique();
    await ctx.db.patch("groups", crew!._id, { visible: false });
  });
  const week = await t.query(api.weeklyTops.getWeek, { week: FRIDAY });
  expect(week?.boards.map((board) => board.board)).toEqual(["impressions", "convex"]);
  expect(await t.query(api.weeklyTops.getWeek, { week: "2026-10-16" })).toBeNull();
});
