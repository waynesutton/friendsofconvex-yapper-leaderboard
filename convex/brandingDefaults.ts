// Shipped branding values. Pure constants with no Convex registrations so
// both the backend (siteSettings, discovery file builders) and the frontend
// (fallback while the branding query loads) can import them. An untouched
// deploy renders exactly these strings.

export type SiteBranding = {
  siteTitle: string;
  siteDescription: string;
  communityName: string;
  boardName: string;
  eyebrowText: string;
  headerTitle: string;
  logoUrl: string | null;
};

export const DEFAULT_BRANDING: SiteBranding = {
  siteTitle: "Friends of Convex Yapper Board",
  siteDescription:
    "A people-only, seven-day X leaderboard for the Friends of Convex community.",
  communityName: "Friends of Convex",
  boardName: "Yapper Leader Board",
  eyebrowText: "people edition",
  headerTitle: "Friends who yap",
  // null means the header renders the built-in Convex wordmark asset.
  logoUrl: null,
};
