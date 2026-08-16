import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";

// convex-test needs the module map because these tests live outside convex/.
// The .js entries cover convex/_generated; declaration files are excluded.
const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

function makeProfile(index: number, active: boolean) {
  return {
    handle: `yapper${index}`,
    normalizedHandle: `yapper${index}`,
    displayName: `Yapper ${index}`,
    bio: null,
    profileImageUrl: null,
    xUserId: null,
    active,
    syncStatus: "synced" as const,
    syncError: null,
    // Spread scores wide so a score-ordered read would visibly skip rows.
    currentImpressions: index * 100_000,
    currentPosts: index,
    currentEngagements: index * 1_000,
    currentFollowers: index,
    lastSyncedAt: null,
    addedAt: 1_000_000 + index,
    updatedAt: 1_000_000 + index,
  };
}

test("a full refresh pages every active profile once, regardless of score", async () => {
  const t = convexTest(schema, modules);

  const activeCount = 110;
  await t.run(async (ctx) => {
    for (let index = 0; index < activeCount; index += 1) {
      await ctx.db.insert("profiles", makeProfile(index, true));
    }
    // Archived rows must never appear in a sync run.
    for (let index = activeCount; index < activeCount + 7; index += 1) {
      await ctx.db.insert("profiles", makeProfile(index, false));
    }
  });

  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  for (;;) {
    const page: {
      targets: Array<{ profileId: string; handle: string }>;
      continueCursor: string;
      isDone: boolean;
    } = await t.query(internal.profiles.listForSync, { cursor, numItems: 25 });
    for (const target of page.targets) {
      // Exactly once: a repeat would mean the cursor is unstable.
      expect(seen.has(target.profileId)).toBe(false);
      seen.add(target.profileId);
      expect(target.handle.startsWith("yapper")).toBe(true);
    }
    pages += 1;
    if (page.isDone) break;
    cursor = page.continueCursor;
    expect(pages).toBeLessThan(50);
  }

  // Every active profile is attempted; the old code stopped at the 100
  // lowest-impression rows and left the top of the board stale.
  expect(seen.size).toBe(activeCount);
});

test("high-impression profiles are in the same run as everyone else", async () => {
  const t = convexTest(schema, modules);

  const theoId = await t.run(async (ctx) => {
    for (let index = 0; index < 105; index += 1) {
      await ctx.db.insert("profiles", makeProfile(index, true));
    }
    // The highest-impression profile on the board, added last.
    return await ctx.db.insert("profiles", {
      ...makeProfile(200, true),
      handle: "theo",
      normalizedHandle: "theo",
      currentImpressions: 4_939_824,
    });
  });

  const seen = new Set<string>();
  let cursor: string | null = null;
  for (;;) {
    const page: {
      targets: Array<{ profileId: string; handle: string }>;
      continueCursor: string;
      isDone: boolean;
    } = await t.query(internal.profiles.listForSync, { cursor, numItems: 25 });
    for (const target of page.targets) seen.add(target.profileId);
    if (page.isDone) break;
    cursor = page.continueCursor;
  }

  expect(seen.has(theoId)).toBe(true);
  expect(seen.size).toBe(106);
});
