import { convexTest, type TestConvex } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { MAX_VIDEO_BYTES } from "../convex/boardShareVideo";
import schema from "../convex/schema";
import { boardShareMeta, parseByteRange } from "../convex/sharePages";
import { asXUser } from "./asXUser";

const modules = import.meta.glob([
  "../convex/**/*.{ts,js}",
  "!../convex/**/*.d.ts",
]);

const OWNER_X_ID = "900001";
const previousAdmins = process.env.ADMIN_X_USER_IDS;

beforeEach(() => {
  process.env.ADMIN_X_USER_IDS = OWNER_X_ID;
  vi.useFakeTimers();
});

afterEach(() => {
  process.env.ADMIN_X_USER_IDS = previousAdmins;
  vi.useRealTimers();
});

type T = TestConvex<typeof schema>;

async function seedShare(t: T): Promise<Id<"boardShares">> {
  return await t.run(
    async (ctx) =>
      await ctx.db.insert("boardShares", {
        board: "impressions",
        boardLabel: "Yappers",
        kind: "ranked",
        metricLabel: "Engagements",
        rows: [
          { rank: 1, handle: "jamie", displayName: "Jamie", profileImageUrl: null, value: null },
          { rank: 2, handle: "zoe", displayName: "Zoe", profileImageUrl: null, value: null },
        ],
        dataAsOf: 1_790_000_000_000,
        contentHash: "hash",
      }),
  );
}

// convex-test drops the Blob type that real storage records as contentType,
// so the helper writes it onto the _storage row the way an upload would.
async function storeFile(t: T, bytes: number, type: string): Promise<Id<"_storage">> {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(bytes)], { type }));
    const patchSystem = ctx.db.patch as unknown as (
      id: Id<"_storage">,
      value: { contentType: string },
    ) => Promise<void>;
    await patchSystem(storageId, { contentType: type });
    return storageId;
  });
}

async function fileExists(t: T, storageId: Id<"_storage">): Promise<boolean> {
  return await t.run(async (ctx) => (await ctx.db.system.get("_storage", storageId)) !== null);
}

const PAGE = { paginationOpts: { numItems: 10, cursor: null } };

test("signed out visitors and non admins are refused by every video function", async () => {
  const t = convexTest(schema, modules);
  const shareId = await seedShare(t);
  const storageId = await storeFile(t, 16, "video/mp4");
  const stranger = await asXUser(t, "123");

  for (const client of [t, stranger]) {
    await expect(client.mutation(api.boardShareVideo.generateVideoUploadUrl, {})).rejects.toThrow();
    await expect(
      client.mutation(api.boardShareVideo.attachVideo, { shareId, storageId }),
    ).rejects.toThrow();
    await expect(client.mutation(api.boardShareVideo.removeVideo, { shareId })).rejects.toThrow();
    await expect(client.query(api.boardShareVideo.listRecent, PAGE)).rejects.toThrow();
    await expect(client.query(api.boardShareVideo.getShareVideo, { shareId })).rejects.toThrow();
    await expect(
      client.action(api.boardShareVideo.getVideoInputs, { shareId }),
    ).rejects.toThrow();
  }
  // A refused attach never touches the share or the file.
  expect(await fileExists(t, storageId)).toBe(true);
  const share = await t.run(async (ctx) => await ctx.db.get("boardShares", shareId));
  expect(share?.videoStorageId).toBeUndefined();
});

test("owners and granted admins can make, attach, list, and remove videos", async () => {
  const t = convexTest(schema, modules);
  const shareId = await seedShare(t);
  const owner = await asXUser(t, OWNER_X_ID);
  const mate = await asXUser(t, "700007");
  await owner.mutation(api.admins.grant, {
    xUserId: "700007",
    handle: "teammate",
    displayName: "Team Mate",
    profileImageUrl: null,
  });

  for (const admin of [owner, mate]) {
    expect(typeof (await admin.mutation(api.boardShareVideo.generateVideoUploadUrl, {}))).toBe(
      "string",
    );
    const inputs = await admin.action(api.boardShareVideo.getVideoInputs, { shareId });
    expect(inputs?.boardLabel).toBe("Yappers");
    expect(inputs?.communityName).toBe("Friends of Convex");
    expect(inputs?.rows.map((row) => [row.rank, row.handle, row.avatar])).toEqual([
      [1, "jamie", null],
      [2, "zoe", null],
    ]);
  }
  expect(await owner.action(api.boardShareVideo.getVideoInputs, { shareId: "nope" })).toBeNull();

  const storageId = await storeFile(t, 2048, "video/mp4");
  const attached = await mate.mutation(api.boardShareVideo.attachVideo, { shareId, storageId });
  expect(attached.status).toBe("attached");

  const status = await owner.query(api.boardShareVideo.getShareVideo, { shareId });
  expect(status).toMatchObject({ hasVideo: true, videoBytes: 2048 });
  const { page } = await owner.query(api.boardShareVideo.listRecent, PAGE);
  expect(page).toEqual([
    expect.objectContaining({ _id: shareId, hasVideo: true, topHandles: ["jamie", "zoe"] }),
  ]);
  const share = await t.run(async (ctx) => await ctx.db.get("boardShares", shareId));
  expect(share?.videoRenderedBy).toBe("700007");

  await owner.mutation(api.boardShareVideo.removeVideo, { shareId });
  expect(await fileExists(t, storageId)).toBe(false);
  const cleared = await t.run(async (ctx) => await ctx.db.get("boardShares", shareId));
  expect(cleared?.videoStorageId).toBeUndefined();
  expect(cleared?.videoRenderedBy).toBeUndefined();
  expect(cleared?.videoRenderedAt).toBeUndefined();
  // Removing again is a no op.
  await owner.mutation(api.boardShareVideo.removeVideo, { shareId });
});

test("attachVideo deletes and rejects anything that is not a small MP4", async () => {
  const t = convexTest(schema, modules);
  const shareId = await seedShare(t);
  const owner = await asXUser(t, OWNER_X_ID);

  const png = await storeFile(t, 64, "image/png");
  expect(await owner.mutation(api.boardShareVideo.attachVideo, { shareId, storageId: png })).toEqual(
    { status: "rejected", reason: "Only MP4 videos can be attached." },
  );
  expect(await fileExists(t, png)).toBe(false);

  const huge = await storeFile(t, MAX_VIDEO_BYTES + 1, "video/mp4");
  expect(
    await owner.mutation(api.boardShareVideo.attachVideo, { shareId, storageId: huge }),
  ).toEqual({ status: "rejected", reason: "Videos must be 8 MB or smaller." });
  expect(await fileExists(t, huge)).toBe(false);

  const share = await t.run(async (ctx) => await ctx.db.get("boardShares", shareId));
  expect(share?.videoStorageId).toBeUndefined();
});

test("replacing a video deletes the old file", async () => {
  const t = convexTest(schema, modules);
  const shareId = await seedShare(t);
  const owner = await asXUser(t, OWNER_X_ID);

  const first = await storeFile(t, 100, "video/mp4");
  await owner.mutation(api.boardShareVideo.attachVideo, { shareId, storageId: first });
  vi.advanceTimersByTime(1000);
  const second = await storeFile(t, 200, "video/mp4");
  await owner.mutation(api.boardShareVideo.attachVideo, { shareId, storageId: second });

  expect(await fileExists(t, first)).toBe(false);
  expect(await fileExists(t, second)).toBe(true);
  const share = await t.run(async (ctx) => await ctx.db.get("boardShares", shareId));
  expect(share?.videoStorageId).toBe(second);
});

test("the video route serves attached files with byte ranges and 404s the rest", async () => {
  const t = convexTest(schema, modules);
  const shareId = await seedShare(t);
  const owner = await asXUser(t, OWNER_X_ID);

  const missing = await t.fetch(`/v/board/${shareId}.mp4`);
  expect(missing.status).toBe(404);
  expect(missing.headers.get("Cache-Control")).toBe("no-store");
  expect((await t.fetch("/v/board/not-an-id.mp4")).status).toBe(404);

  const storageId = await storeFile(t, 1000, "video/mp4");
  await owner.mutation(api.boardShareVideo.attachVideo, { shareId, storageId });

  const full = await t.fetch(`/v/board/${shareId}.mp4`);
  expect(full.status).toBe(200);
  expect(full.headers.get("Content-Type")).toBe("video/mp4");
  expect(full.headers.get("Accept-Ranges")).toBe("bytes");
  expect((await full.arrayBuffer()).byteLength).toBe(1000);

  const partial = await t.fetch(`/v/board/${shareId}.mp4?v=1`, {
    headers: { Range: "bytes=0-1" },
  });
  expect(partial.status).toBe(206);
  expect(partial.headers.get("Content-Range")).toBe("bytes 0-1/1000");
  expect((await partial.arrayBuffer()).byteLength).toBe(2);

  const past = await t.fetch(`/v/board/${shareId}.mp4`, { headers: { Range: "bytes=5000-" } });
  expect(past.status).toBe(416);
});

test("byte ranges parse open, closed, and suffix forms", () => {
  expect(parseByteRange(null, 100)).toBeNull();
  expect(parseByteRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
  expect(parseByteRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
  expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  expect(parseByteRange("bytes=50-500", 100)).toEqual({ start: 50, end: 99 });
  expect(parseByteRange("bytes=100-", 100)).toBe("invalid");
  expect(parseByteRange("bytes=0-1,5-6", 100)).toBeNull();
});

const metaShare = {
  _id: "share123",
  board: "convex",
  boardLabel: "Convex mentions",
  kind: "ranked" as const,
  rows: [
    { rank: 1, handle: "jamie" },
    { rank: 3, handle: "zoe" },
  ],
  videoStorageId: null,
  videoRenderedAt: null,
};
const branding = { communityName: "Friends of Convex", boardName: "Yapper Leaderboard" };

test("share meta adds og:video only once a video is attached", () => {
  const plain = boardShareMeta(metaShare, "https://site.test", branding);
  const keys = plain.tags.map((tag) => tag.key);
  expect(keys.some((key) => key.startsWith("og:video"))).toBe(false);
  expect(plain.tags.find((tag) => tag.key === "og:image")?.content).toBe(
    "https://site.test/og/board/share123.png",
  );
  expect(plain.canonical).toBe("https://site.test/?board=convex");
  expect(plain.title).toBe("Top 2 on Convex mentions | Friends of Convex Yapper Leaderboard");

  const withVideo = boardShareMeta(
    { ...metaShare, videoStorageId: "kg2storage", videoRenderedAt: 1_790_000_000_123 },
    "https://site.test",
    branding,
  );
  const video = Object.fromEntries(withVideo.tags.map((tag) => [tag.key, tag.content]));
  const url = "https://site.test/v/board/share123.mp4?v=1790000000123";
  expect(video["og:video"]).toBe(url);
  expect(video["og:video:url"]).toBe(url);
  expect(video["og:video:secure_url"]).toBe(url);
  expect(video["og:video:type"]).toBe("video/mp4");
  expect(video["og:video:width"]).toBe("1200");
  expect(video["og:video:height"]).toBe("630");
  // The image card stays, and twitter:card is never switched to player.
  expect(video["og:image"]).toBe("https://site.test/og/board/share123.png");
  for (const meta of [plain, withVideo]) {
    const all = [...meta.headTags, ...meta.tags];
    expect(all.some((tag) => tag.key === "twitter:card")).toBe(false);
    expect(all.some((tag) => tag.content === "player")).toBe(false);
  }
});

test("a saved day share names the date and links to that day", () => {
  const dated = boardShareMeta(
    { ...metaShare, rankingDay: "2026-10-24" },
    "https://site.test",
    branding,
  );
  expect(dated.title).toBe(
    "Top 2 on Convex mentions, Sat, Oct 24 | Friends of Convex Yapper Leaderboard",
  );
  expect(dated.canonical).toBe("https://site.test/?board=convex&day=2026-10-24");
  expect(dated.tags.find((tag) => tag.key === "og:description")?.content).toContain(
    "on Sat, Oct 24, 2026.",
  );
  const yappers = boardShareMeta(
    { ...metaShare, board: "impressions", rankingDay: "2026-10-24" },
    "https://site.test",
    branding,
  );
  expect(yappers.canonical).toBe("https://site.test/?day=2026-10-24");
});
