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

// Hourly check for the admin mention queue. Cron schedules are fixed in code,
// so the admin chosen interval (1, 4, or 6 hours, default 6) and the on/off
// switch live in mentionScanState. Runs that are off or not due return before
// any X request. since_id keeps each real scan to posts since the last one.
crons.cron(
  "scan @convex mentions",
  "41 * * * *",
  internal.mentionQueue.scanScheduled,
  {},
);

// Drop mention queue people whose mentions aged out of the 30 day window,
// then prune stored mention posts past 35 days.
crons.cron(
  "recount mention queue window",
  "23 11 * * *",
  internal.mentionQueue.recountWindow,
  { cursor: null },
);

export default crons;
