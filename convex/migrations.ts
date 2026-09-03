import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

// One-off data migrations, run by hand from the CLI with an admin key:
//   npx convex run migrations:backfillLegendFields
// Each one is safe to run twice: it skips rows that are already moved.

// Retire mode was renamed to Legends, so `retiredAt` / `retiredNote` become
// `legendAt` / `legendNote`. Copies any pre-rename rows onto the new fields
// and clears the old ones. Nothing else in the codebase reads the old names.
export const backfillLegendFields = internalMutation({
  args: {},
  returns: v.object({ scanned: v.number(), moved: v.number() }),
  handler: async (ctx) => {
    // The board is a few hundred rows at most and this runs once, so a full
    // read is cheaper than adding an index for a field we are deleting.
    const profiles = await ctx.db.query("profiles").take(5000);
    let moved = 0;
    for (const profile of profiles) {
      if (profile.retiredAt === undefined) continue;
      await ctx.db.patch("profiles", profile._id, {
        legendAt: profile.legendAt ?? profile.retiredAt,
        legendNote: profile.legendNote ?? profile.retiredNote,
        retiredAt: undefined,
        retiredNote: undefined,
      });
      moved += 1;
    }
    return { scanned: profiles.length, moved };
  },
});
