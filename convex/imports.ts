import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import { importEntryValidator } from "./validators";

const X_API_ORIGIN = "https://api.x.com";
const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const MAX_IMPORT_SIZE = 100;

type ImportStatus =
  | "valid"
  | "existing"
  | "invalid"
  | "not-found"
  | "duplicate";

type ImportEntry = {
  input: string;
  handle: string;
  xUserId: string | null;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  followerCount: number;
  status: ImportStatus;
  message: string | null;
};

type XUser = {
  id: string;
  username: string;
  name: string;
  description: string | null;
  profileImageUrl: string | null;
  followerCount: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function xError(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.title === "string") return payload.title;
  if (Array.isArray(payload.errors) && isRecord(payload.errors[0])) {
    const error = payload.errors[0];
    if (typeof error.detail === "string") return error.detail;
    if (typeof error.message === "string") return error.message;
  }
  return fallback;
}

async function requestX(url: URL, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(xError(payload, `X API request failed (${response.status}).`));
  }
  return payload;
}

function parseXUser(value: unknown): XUser | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    typeof value.name !== "string"
  ) {
    return null;
  }
  const metrics = isRecord(value.public_metrics) ? value.public_metrics : {};
  return {
    id: value.id,
    username: value.username,
    name: value.name,
    description: stringOrNull(value.description),
    profileImageUrl: stringOrNull(value.profile_image_url),
    followerCount: numberOrZero(metrics.followers_count),
  };
}

function entryForUser(user: XUser, input = `@${user.username}`): ImportEntry {
  return {
    input,
    handle: user.username,
    xUserId: user.id,
    displayName: user.name,
    bio: user.description,
    profileImageUrl: user.profileImageUrl,
    followerCount: user.followerCount,
    status: "valid",
    message: null,
  };
}

function normalizeInput(value: string): string {
  const withoutQuery = value.trim().split(/[?#]/, 1)[0] ?? "";
  const pathMatch = withoutQuery.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/i);
  return (pathMatch?.[1] ?? withoutQuery.replace(/^@+/, "")).toLowerCase();
}

function splitHandleInput(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, MAX_IMPORT_SIZE);
}

export async function requireAdminAction(ctx: ActionCtx): Promise<void> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in with X to continue.");
  const isAdmin: boolean = await ctx.runQuery(internal.authz.isAdminUser, {
    userId,
  });
  if (!isAdmin) throw new Error("This X account is not on the admin allowlist.");
}

function bearerToken(): string {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    throw new Error(
      "X API is not configured. Add X_BEARER_TOKEN to this Convex deployment.",
    );
  }
  return token;
}

async function markExisting(
  ctx: ActionCtx,
  entries: ImportEntry[],
): Promise<ImportEntry[]> {
  const people = entries
    .filter((entry): entry is ImportEntry & { xUserId: string } =>
      Boolean(entry.xUserId),
    )
    .map((entry) => ({ handle: entry.handle, xUserId: entry.xUserId }));
  if (people.length === 0) return entries;

  const existingIds: string[] = await ctx.runQuery(
    internal.profiles.findExistingForImport,
    { people },
  );
  const existing = new Set(existingIds);
  return entries.map((entry) =>
    entry.xUserId && existing.has(entry.xUserId)
      ? {
          ...entry,
          status: "existing" as const,
          message: "Already on this board.",
        }
      : entry,
  );
}

async function previewHandlesImpl(
  ctx: ActionCtx,
  text: string,
): Promise<ImportEntry[]> {
  const inputs = splitHandleInput(text);
  if (inputs.length === 0) return [];

  const seen = new Set<string>();
  const entries: ImportEntry[] = [];
  const validInputs: Array<{ input: string; handle: string }> = [];
  for (const input of inputs) {
    const handle = normalizeInput(input);
    if (!HANDLE_PATTERN.test(handle)) {
      entries.push({
        input,
        handle,
        xUserId: null,
        displayName: input,
        bio: null,
        profileImageUrl: null,
        followerCount: 0,
        status: "invalid",
        message: "Use 1 to 15 letters, numbers, or underscores.",
      });
      continue;
    }
    if (seen.has(handle)) {
      entries.push({
        input,
        handle,
        xUserId: null,
        displayName: `@${handle}`,
        bio: null,
        profileImageUrl: null,
        followerCount: 0,
        status: "duplicate",
        message: "Repeated in this paste.",
      });
      continue;
    }
    seen.add(handle);
    validInputs.push({ input, handle });
  }

  if (validInputs.length > 0) {
    const url = new URL("/2/users/by", X_API_ORIGIN);
    url.searchParams.set(
      "usernames",
      validInputs.map((item) => item.handle).join(","),
    );
    url.searchParams.set(
      "user.fields",
      "description,profile_image_url,public_metrics",
    );
    const payload = await requestX(url, bearerToken());
    const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
    const users = new Map<string, XUser>();
    for (const value of data) {
      const user = parseXUser(value);
      if (user) users.set(user.username.toLowerCase(), user);
    }

    for (const item of validInputs) {
      const user = users.get(item.handle);
      entries.push(
        user
          ? entryForUser(user, item.input)
          : {
              input: item.input,
              handle: item.handle,
              xUserId: null,
              displayName: `@${item.handle}`,
              bio: null,
              profileImageUrl: null,
              followerCount: 0,
              status: "not-found",
              message: "X did not return a public account for this handle.",
            },
      );
    }
  }

  return await markExisting(ctx, entries);
}

function parseListId(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:\/i)?\/lists\/(\d+)/i);
  if (!match) {
    throw new Error("Paste an X List URL that ends in /i/lists/ followed by its ID.");
  }
  return match[1];
}

export const previewHandles = action({
  args: { text: v.string() },
  returns: v.array(importEntryValidator),
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);
    return await previewHandlesImpl(ctx, args.text);
  },
});

export type XListPreview = {
  listId: string;
  name: string;
  totalMembers: number;
  fetchedCount: number;
  truncated: boolean;
  entries: ImportEntry[];
};

// Shared by the admin import panel and group list imports. Fetches list
// metadata plus up to MAX_IMPORT_SIZE members and marks existing profiles.
export async function fetchXListPreview(
  ctx: ActionCtx,
  urlOrId: string,
): Promise<XListPreview> {
  const token = bearerToken();
  const listId = parseListId(urlOrId);

  const listUrl = new URL(`/2/lists/${listId}`, X_API_ORIGIN);
  listUrl.searchParams.set("list.fields", "name,member_count");
  const listPayload = await requestX(listUrl, token);
  const listData = isRecord(listPayload) && isRecord(listPayload.data)
    ? listPayload.data
    : {};
  const name = typeof listData.name === "string" ? listData.name : `X List ${listId}`;
  const totalMembers = numberOrZero(listData.member_count);

  const membersUrl = new URL(`/2/lists/${listId}/members`, X_API_ORIGIN);
  membersUrl.searchParams.set("max_results", String(MAX_IMPORT_SIZE));
  membersUrl.searchParams.set(
    "user.fields",
    "description,profile_image_url,public_metrics",
  );
  const membersPayload = await requestX(membersUrl, token);
  const memberData =
    isRecord(membersPayload) && Array.isArray(membersPayload.data)
      ? membersPayload.data
      : [];
  const entries = memberData
    .map(parseXUser)
    .filter((user): user is XUser => user !== null)
    .map((user) => entryForUser(user));
  const marked = await markExisting(ctx, entries);

  return {
    listId,
    name,
    totalMembers,
    fetchedCount: marked.length,
    truncated: totalMembers > marked.length,
    entries: marked,
  };
}

export const previewXList = action({
  args: { urlOrId: v.string() },
  returns: v.object({
    listId: v.string(),
    name: v.string(),
    totalMembers: v.number(),
    fetchedCount: v.number(),
    truncated: v.boolean(),
    entries: v.array(importEntryValidator),
  }),
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);
    return await fetchXListPreview(ctx, args.urlOrId);
  },
});

export const commitImport = action({
  args: {
    entries: v.array(importEntryValidator),
    source: v.union(v.literal("bulk"), v.literal("x-list")),
  },
  returns: v.object({
    created: v.number(),
    updated: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    created: number;
    updated: number;
    skipped: number;
  }> => {
    await requireAdminAction(ctx);
    return await ctx.runMutation(internal.profiles.importPrepared, {
      entries: args.entries.slice(0, MAX_IMPORT_SIZE),
      source: args.source,
    });
  },
});
