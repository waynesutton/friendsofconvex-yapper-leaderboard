import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { cleanHandle } from "../convex/admins";
import schema from "../convex/schema";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

const OWNER_X_ID = "900001";
const DAY_MS = 24 * 60 * 60 * 1000;
const previousAdmins = process.env.ADMIN_X_USER_IDS;

beforeEach(() => {
  process.env.ADMIN_X_USER_IDS = OWNER_X_ID;
});

afterEach(() => {
  process.env.ADMIN_X_USER_IDS = previousAdmins;
});

// Signed in client for any X account, admin or not.
async function asXUser(t: TestConvex<typeof schema>, xUserId: string) {
  const subject = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { xUserId, xUsername: `user${xUserId}` });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "twitter",
      providerAccountId: xUserId,
    });
    const sessionId = await ctx.db.insert("authSessions", {
      userId,
      expirationTime: Date.now() + DAY_MS,
    });
    return `${userId}|${sessionId}`;
  });
  return t.withIdentity({ subject });
}

const teammate = {
  xUserId: "700007",
  handle: "teammate",
  displayName: "Team Mate",
  profileImageUrl: null,
};

test("a granted account becomes an admin right away", async () => {
  const t = convexTest(schema, modules);
  const owner = await asXUser(t, OWNER_X_ID);
  const mate = await asXUser(t, teammate.xUserId);

  expect((await mate.query(api.authz.viewer, {})).isAdmin).toBe(false);
  await expect(mate.query(api.admins.list, {})).rejects.toThrow();

  expect(await owner.mutation(api.admins.grant, teammate)).toBe("granted");
  expect((await mate.query(api.authz.viewer, {})).isAdmin).toBe(true);

  const { admins } = await mate.query(api.admins.list, {});
  expect(admins.map((row) => [row.xUserId, row.tier])).toEqual([
    [OWNER_X_ID, "owner"],
    [teammate.xUserId, "granted"],
  ]);
  expect(admins[1].grantedByHandle).toBe(`user${OWNER_X_ID}`);
});

test("granting twice or granting an owner changes nothing", async () => {
  const t = convexTest(schema, modules);
  const owner = await asXUser(t, OWNER_X_ID);

  await owner.mutation(api.admins.grant, teammate);
  expect(await owner.mutation(api.admins.grant, teammate)).toBe("already");
  expect(
    await owner.mutation(api.admins.grant, { ...teammate, xUserId: OWNER_X_ID }),
  ).toBe("already");

  const grants = await t.run(async (ctx) => await ctx.db.query("adminGrants").collect());
  expect(grants).toHaveLength(1);
});

test("revoke removes access, but never your own", async () => {
  const t = convexTest(schema, modules);
  const owner = await asXUser(t, OWNER_X_ID);
  const mate = await asXUser(t, teammate.xUserId);
  await owner.mutation(api.admins.grant, teammate);
  const grantId = (await owner.query(api.admins.list, {})).admins[1].grantId;
  if (!grantId) throw new Error("expected a grant id");

  await expect(mate.mutation(api.admins.revoke, { grantId })).rejects.toThrow(
    /own admin access/,
  );

  await owner.mutation(api.admins.revoke, { grantId });
  expect((await mate.query(api.authz.viewer, {})).isAdmin).toBe(false);
  // Repeat is a no op.
  await owner.mutation(api.admins.revoke, { grantId });
});

test("non admins cannot grant", async () => {
  const t = convexTest(schema, modules);
  const stranger = await asXUser(t, "123");
  await expect(stranger.mutation(api.admins.grant, teammate)).rejects.toThrow();
});

test("search matches board handles by prefix", async () => {
  const t = convexTest(schema, modules);
  const owner = await asXUser(t, OWNER_X_ID);
  await t.run(async (ctx) => {
    for (const handle of ["jamie", "jamesacowling", "zoe"]) {
      await ctx.db.insert("profiles", {
        handle,
        normalizedHandle: handle,
        displayName: handle,
        bio: null,
        profileImageUrl: null,
        xUserId: handle === "zoe" ? null : `x-${handle}`,
        active: true,
        syncStatus: "synced",
        syncError: null,
        currentImpressions: 0,
        currentPosts: 0,
        currentEngagements: 0,
        currentFollowers: 0,
        lastSyncedAt: null,
        addedAt: 1,
        updatedAt: 1,
      });
    }
  });

  const results = await owner.query(api.admins.searchCandidates, { term: "@JAM" });
  expect(results.map((row) => row.handle).sort()).toEqual(["jamesacowling", "jamie"]);
  expect(await owner.query(api.admins.searchCandidates, { term: "  " })).toEqual([]);
});

test("cleanHandle accepts @handles and profile links", () => {
  expect(cleanHandle("@waynesutton")).toBe("waynesutton");
  expect(cleanHandle("https://x.com/waynesutton?s=20")).toBe("waynesutton");
  expect(() => cleanHandle("not a handle")).toThrow();
});
