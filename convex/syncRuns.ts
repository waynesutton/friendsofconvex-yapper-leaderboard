import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";

// State for the full board X sync (cron or Sync everyone). Group and single
// profile rescans never touch it, so the public freshness label only moves
// when every active profile has been attempted.

const KEY = "board";
// A halted pass retries every 2 hours, at most 6 times (12 hours). While X
// still refuses, each retry costs a single request before halting again.
export const HALT_RETRY_DELAY_MS = 2 * 60 * 60 * 1000;
export const MAX_HALT_RETRIES = 6;

export async function readSyncRun(ctx: QueryCtx): Promise<Doc<"syncRuns"> | null> {
  return await ctx.db
    .query("syncRuns")
    .withIndex("by_key", (q) => q.eq("key", KEY))
    .unique();
}

// A new pass replaces any halted one and resets its retry chain.
export const start = internalMutation({
  args: { runStartedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await readSyncRun(ctx);
    const fields = {
      runStartedAt: args.runStartedAt,
      haltedAt: null,
      haltedReason: null,
      retryCount: 0,
      updatedAt: args.runStartedAt,
    };
    if (existing) {
      await ctx.db.patch("syncRuns", existing._id, fields);
    } else {
      await ctx.db.insert("syncRuns", {
        key: KEY,
        lastFinishedRunStartedAt: null,
        lastFinishedAt: null,
        ...fields,
      });
    }
    return null;
  },
});

// Retries and continuations check this first so an old chain stops once a
// newer pass has started.
export const isCurrent = internalQuery({
  args: { runStartedAt: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const run = await readSyncRun(ctx);
    return run !== null && run.runStartedAt === args.runStartedAt;
  },
});

// Records a halt and reports whether another retry is allowed.
export const halt = internalMutation({
  args: { runStartedAt: v.number(), reason: v.string() },
  returns: v.object({ retry: v.boolean(), retryCount: v.number() }),
  handler: async (ctx, args) => {
    const run = await readSyncRun(ctx);
    if (!run || run.runStartedAt !== args.runStartedAt) {
      return { retry: false, retryCount: 0 };
    }
    const retryCount = run.retryCount + 1;
    const now = Date.now();
    await ctx.db.patch("syncRuns", run._id, {
      haltedAt: now,
      haltedReason: args.reason.slice(0, 280),
      retryCount,
      updatedAt: now,
    });
    return { retry: retryCount <= MAX_HALT_RETRIES, retryCount };
  },
});

// The freshness label uses the pass start, the oldest moment any row in the
// pass could be from, so a pass resumed hours later never overstates it.
export const finish = internalMutation({
  args: { runStartedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await readSyncRun(ctx);
    if (!run || run.runStartedAt !== args.runStartedAt) return null;
    const now = Date.now();
    await ctx.db.patch("syncRuns", run._id, {
      lastFinishedRunStartedAt: args.runStartedAt,
      lastFinishedAt: now,
      haltedAt: null,
      haltedReason: null,
      updatedAt: now,
    });
    return null;
  },
});
