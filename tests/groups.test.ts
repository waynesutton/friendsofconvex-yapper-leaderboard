import { describe, expect, test } from "vitest";
import { DEFAULT_BRANDING } from "../convex/brandingDefaults";
import { slugifyGroupName } from "../convex/groups";
import { compareYapperRows } from "../convex/profiles";
import {
  buildLlmsTxt,
  buildSitemapMd,
  buildSitemapXml,
  type PublicDirectory,
} from "../convex/siteDirectory";

// Minimal profile shape the comparator reads.
function makeRow(overrides: Partial<Parameters<typeof compareYapperRows>[0]> = {}) {
  return {
    syncStatus: "synced" as const,
    currentEngagements: 0,
    currentImpressions: 0,
    currentPosts: 0,
    addedAt: 0,
    ...overrides,
  };
}

describe("group leaderboard ordering", () => {
  test("engagements decide the rank", () => {
    const rows = [
      makeRow({ currentEngagements: 10 }),
      makeRow({ currentEngagements: 500 }),
      makeRow({ currentEngagements: 90 }),
    ];
    rows.sort(compareYapperRows);
    expect(rows.map((row) => row.currentEngagements)).toEqual([500, 90, 10]);
  });

  test("unsynced rows sort after synced rows regardless of metrics", () => {
    const pending = makeRow({
      syncStatus: "pending" as never,
      currentEngagements: 9999,
    });
    const synced = makeRow({ currentEngagements: 1 });
    expect([pending, synced].sort(compareYapperRows)[0]).toBe(synced);
  });

  test("impressions, posts, then join date break engagement ties", () => {
    const olderJoin = makeRow({ addedAt: 100 });
    const newerJoin = makeRow({ addedAt: 200 });
    expect([newerJoin, olderJoin].sort(compareYapperRows)[0]).toBe(olderJoin);

    const morePosts = makeRow({ currentPosts: 5 });
    const fewerPosts = makeRow({ currentPosts: 2 });
    expect([fewerPosts, morePosts].sort(compareYapperRows)[0]).toBe(morePosts);

    const moreImpressions = makeRow({ currentImpressions: 900 });
    const fewerImpressions = makeRow({ currentImpressions: 100 });
    expect(
      [fewerImpressions, moreImpressions].sort(compareYapperRows)[0],
    ).toBe(moreImpressions);
  });
});

describe("group slugs", () => {
  test("names become url safe slugs", () => {
    expect(slugifyGroupName("Convex Team")).toBe("convex-team");
    expect(slugifyGroupName("  Abstract 2026 Speakers!  ")).toBe(
      "abstract-2026-speakers",
    );
    expect(slugifyGroupName("A/B & C")).toBe("a-b-c");
  });

  test("a name with no usable characters throws", () => {
    expect(() => slugifyGroupName("!!!")).toThrow();
  });
});

const emptyDirectory: PublicDirectory = {
  people: [],
  groups: [],
  newestUpdatedAt: Date.UTC(2026, 7, 16),
};

const groupedDirectory: PublicDirectory = {
  ...emptyDirectory,
  groups: [
    {
      name: "Convex Team",
      slug: "convex-team",
      description: "People who build Convex.",
      memberHandles: ["jamesacowling", "waynesutton"],
    },
    {
      name: "Speakers",
      slug: "speakers",
      description: null,
      memberHandles: ["someone"],
    },
  ],
};

const ORIGIN = "https://example.dev";

describe("discovery files with groups", () => {
  test("no groups means no Groups section", () => {
    expect(buildLlmsTxt(emptyDirectory, ORIGIN)).not.toContain("## Groups");
    expect(buildSitemapMd(emptyDirectory, ORIGIN)).not.toContain("## Groups");
    expect(buildSitemapXml(emptyDirectory, ORIGIN)).not.toContain("?board=");
  });

  test("llms.txt lists each group with members and board link", () => {
    const output = buildLlmsTxt(groupedDirectory, ORIGIN);
    expect(output).toContain("## Groups");
    expect(output).toContain(
      `[Convex Team](${ORIGIN}/?board=convex-team): 2 members. People who build Convex. Members: @jamesacowling, @waynesutton.`,
    );
    expect(output).toContain(`[Speakers](${ORIGIN}/?board=speakers): 1 members.`);
  });

  test("sitemap.md gives each group a heading with member links", () => {
    const output = buildSitemapMd(groupedDirectory, ORIGIN);
    expect(output).toContain(`### [Convex Team](${ORIGIN}/?board=convex-team)`);
    expect(output).toContain("- About: People who build Convex.");
    expect(output).toContain("- Members: 2");
    expect(output).toContain("[@waynesutton](https://x.com/waynesutton)");
  });

  test("sitemap.xml adds a url per group pill", () => {
    const output = buildSitemapXml(groupedDirectory, ORIGIN);
    expect(output).toContain(`<loc>${ORIGIN}/?board=convex-team</loc>`);
    expect(output).toContain(`<loc>${ORIGIN}/?board=speakers</loc>`);
  });

  test("branding flows into the headers", () => {
    const output = buildLlmsTxt(emptyDirectory, ORIGIN, {
      ...DEFAULT_BRANDING,
      siteTitle: "Acme Yap Board",
      communityName: "Acme Friends",
    });
    expect(output).toContain("# Acme Yap Board");
    expect(output).toContain("Acme Friends lists public community voices");
  });
});
