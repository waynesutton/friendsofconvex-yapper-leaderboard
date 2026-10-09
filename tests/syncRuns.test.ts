import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

const previousToken = process.env.X_BEARER_TOKEN;

beforeEach(() => {
  process.env.X_BEARER_TOKEN = "test-token";
});

afterEach(() => {
  process.env.X_BEARER_TOKEN = previousToken;
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// X answers the user lookup and an empty 7 day post page.
function stubXOk() {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname.startsWith("/2/users/by/username/")) {
      const username = url.pathname.split("/").pop() ?? "someone";
      return jsonResponse(200, {
        data: { id: `id-${username}`, name: username, username, public_metrics: {} },
      });
    }
    return jsonResponse(200, { data: [], meta: {} });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubXSpendCap() {
  const fetchMock = vi.fn(async () =>
    jsonResponse(429, { title: "UsageCapExceeded", detail: "Your monthly spend cap has been reached." }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function seedProfiles(t: TestConvex<typeof schema>, count: number) {
  await t.run(async (ctx) => {
    for (let index = 0; index < count; index += 1) {
      await ctx.db.insert("profiles", {
        handle: `yapper${index}`,
        normalizedHandle: `yapper${index}`,
        displayName: `Yapper ${index}`,
        bio: null,
        profileImageUrl: null,
        xUserId: null,
        active: true,
        syncStatus: "synced",
        syncError: null,
        currentImpressions: 100,
        currentPosts: 1,
        currentEngagements: 1,
        currentFollowers: 1,
        lastSyncedAt: 1_000_000,
        addedAt: 1_000_000 + index,
        updatedAt: 1_000_000 + index,
      });
    }
  });
}

test("a spend cap halt shows on the board and schedules a retry", async () => {
  const t = convexTest(schema, modules);
  await seedProfiles(t, 3);
  const fetchMock = stubXSpendCap();

  const result = await t.action(internal.xSync.refreshAllScheduled, {});
  expect(result.haltedReason).toMatch(/spend cap/);
  expect(result.retryScheduled).toBe(true);
  // Halts on the first profile, so X is called once, not once per person.
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const health = await t.query(api.profiles.getSyncHealth, {});
  expect(health.haltedAt).not.toBeNull();
  expect(health.haltedReason).toMatch(/spend cap/);
  expect(health.boardSyncedAt).toBeNull();

  const scheduled = await t.run(
    async (ctx) => await ctx.db.system.query("_scheduled_functions").collect(),
  );
  expect(scheduled.some((job) => job.name.includes("refreshAllContinuation"))).toBe(true);
});

test("a finished pass sets the board time and clears the halt", async () => {
  const t = convexTest(schema, modules);
  await seedProfiles(t, 3);
  stubXSpendCap();
  await t.action(internal.xSync.refreshAllScheduled, {});

  stubXOk();
  const result = await t.action(internal.xSync.refreshAllScheduled, {});
  expect(result.synced).toBe(3);

  const health = await t.query(api.profiles.getSyncHealth, {});
  expect(health.haltedAt).toBeNull();
  expect(health.boardSyncedAt).not.toBeNull();
});

test("an old retry chain stops once a newer pass started", async () => {
  const t = convexTest(schema, modules);
  await seedProfiles(t, 2);
  await t.mutation(internal.syncRuns.start, { runStartedAt: 1 });
  await t.mutation(internal.syncRuns.start, { runStartedAt: 2 });
  const fetchMock = stubXOk();

  await t.action(internal.xSync.refreshAllContinuation, {
    cursor: null,
    runStartedAt: 1,
    processed: 0,
    synced: 0,
    failed: 0,
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
