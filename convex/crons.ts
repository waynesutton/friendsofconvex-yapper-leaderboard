import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily X metrics refresh at 8:17 AM Pacific during PDT (15:17 UTC).
// Cron strings are UTC only, so this is 7:17 AM during PST.
// Minute 17 stays off the top of the hour.
// Docs: https://docs.convex.dev/scheduling/cron-jobs
crons.cron(
  "refresh Friends of Convex X metrics",
  "17 15 * * *",
  internal.xSync.refreshAllScheduled,
  {},
);

export default crons;
