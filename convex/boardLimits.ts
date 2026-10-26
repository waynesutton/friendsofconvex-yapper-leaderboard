// One ceiling for every full board read: the public board, the admin roster,
// share cards, and discovery files. The client imports it too, so a page can
// never subscribe to fewer rows than the server would return.
export const BOARD_MAX = 1000;

// Board ids match the `?board=` URL values the leaderboard uses. Group
// boards use their slug.
export const YAPPERS_BOARD = "impressions";
export const CONVEX_BOARD = "convex";
export const LEGENDS_BOARD = "legends";
