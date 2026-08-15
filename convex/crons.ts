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

// Close gift dispatches whose links passed the seven day cap so DM gift
// links stop working without waiting for someone to open them. The reveal
// mutations also enforce expiry with server time; this keeps the admin
// Dispatches log honest.
crons.interval(
  "expire gift links",
  { hours: 1 },
  internal.gifts.expireGiftLinks,
  {},
);

export default crons;
