import type { TestConvex } from "convex-test";
import type schema from "../convex/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

// Signed in client for any X account, admin or not. Mirrors what Convex Auth
// writes on an X sign in: a user, its twitter account, and a live session.
export async function asXUser(t: TestConvex<typeof schema>, xUserId: string) {
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
