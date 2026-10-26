import type { BoardCardInput } from "../../convex/ogArt";

const AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// Card inputs covering every board kind, shared by the frame tests and the
// byte for byte card snapshots.
export const RANKED_INPUT: BoardCardInput = {
  communityName: "Friends of Convex",
  boardLabel: "Yappers",
  kind: "ranked",
  metricLabel: "Engagements",
  dataAsOf: 1_790_000_000_000,
  rows: [1, 2, 3, 4, 5].map((rank) => ({
    rank,
    handle: `yapper${rank}`,
    displayName: `Yapper <${rank}>`,
    avatar: rank % 2 === 0 ? null : AVATAR,
    value: null,
  })),
};

export const CONVEX_INPUT: BoardCardInput = {
  communityName: "Friends of Convex",
  boardLabel: "Convex mentions",
  kind: "ranked",
  metricLabel: "Convex posts",
  dataAsOf: 1_790_000_000_000,
  rows: [
    { rank: 1, handle: "jamie", displayName: "Jamie", avatar: AVATAR, value: 14 },
    { rank: 3, handle: "zoe", displayName: "Zoe", avatar: null, value: 12_345 },
  ],
};

export const LEGENDS_INPUT: BoardCardInput = {
  communityName: "Friends of Convex",
  boardLabel: "Legends",
  kind: "legends",
  metricLabel: "Undefeated",
  dataAsOf: null,
  rows: [
    { rank: null, handle: "champ", displayName: "The Champ", avatar: AVATAR, value: null },
  ],
};

export const LONG_LABEL_INPUT: BoardCardInput = {
  ...RANKED_INPUT,
  boardLabel: "Convex Champions & Friends of the Week",
};
