import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

const OWNER_X_ID = "900001";
const previousAdmins = process.env.ADMIN_X_USER_IDS;

beforeEach(() => {
  process.env.ADMIN_X_USER_IDS = OWNER_X_ID;
});

afterEach(() => {
  process.env.ADMIN_X_USER_IDS = previousAdmins;
});

async function asOwner(t: TestConvex<typeof schema>) {
  const subject = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { xUserId: OWNER_X_ID });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "twitter",
      providerAccountId: OWNER_X_ID,
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + 86_400_000,
    });
    return `${userId}|${sessionId}`;
  });
  return t.withIdentity({ subject });
}

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
    currentImpressions: 0,
    currentPosts: 0,
    currentEngagements: 0,
    currentFollowers: 0,
    lastSyncedAt: null,
    addedAt: 1_000_000 + index,
    updatedAt: 1_000_000 + index,
    membershipStatus: "approved" as const,
  };
}

test("a re-request on an old profile still reaches the admin roster", async () => {
  const t = convexTest(schema, modules);
  const owner = await asOwner(t);
  const pendingId = await t.run(async (ctx) => {
    // The oldest profile, which a newest-first read of 5 would skip.
    const id = await ctx.db.insert("profiles", {
      ...makeProfile(0),
      active: false,
      membershipStatus: "pending",
      requestedAt: 9_000_000,
    });
    for (let index = 1; index <= 10; index += 1) {
      await ctx.db.insert("profiles", makeProfile(index));
    }
    return id;
  });

  const roster = await owner.query(api.profiles.listAdmin, { limit: 5 });
  expect(roster).toHaveLength(6);
  expect(roster.some((profile) => profile._id === pendingId)).toBe(true);
  expect(new Set(roster.map((profile) => profile._id)).size).toBe(roster.length);
});
