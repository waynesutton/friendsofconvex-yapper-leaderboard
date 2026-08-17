import {
  ArrowSquareOutIcon,
  CaretDownIcon,
  CaretUpIcon,
  ChatCircleTextIcon,
  CheckIcon,
  CopyIcon,
  FunnelSimpleIcon,
  LockSimpleIcon,
  MagnifyingGlassIcon,
  ShareNetworkIcon,
  TrophyIcon,
  UsersThreeIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";
import { FilterDropdown, type FilterDropdownOption } from "./FilterDropdown";
import { compactNumber, formatSyncTime, initials, relativeSyncTime } from "./formatters";
import { MetricInfo } from "./MetricInfo";
import { ProfilePeek } from "./ProfilePeek";

// Load-more step when the board is on "All yappers"; Top N picks step by N.
const PAGE_SIZE = 30;

// Top N sets the starting row count after search and sort. Load more keeps
// revealing rows past N until everyone is shown; "all" starts at PAGE_SIZE.
type TopFilterValue = "30" | "60" | "100" | "150" | "all";
const TOP_FILTER_OPTIONS: Array<FilterDropdownOption<TopFilterValue>> = [
  { value: "30", label: "Top 30" },
  { value: "60", label: "Top 60" },
  { value: "100", label: "Top 100" },
  { value: "150", label: "Top 150" },
  { value: "all", label: "All yappers" },
];

// The active board: the default Yappers ranking, the Convex mentions
// ranking, or a custom group's slug. Synced to the ?board= URL param so
// every pill is linkable.
type BoardSelection = string;
const DEFAULT_BOARD = "impressions";

type LeaderboardRow = FunctionReturnType<typeof api.profiles.listLeaderboard>[number];
type RankBadge = FunctionReturnType<typeof api.badges.listRankBadges>[number];
type PublicGroup = FunctionReturnType<typeof api.groups.listPublic>[number];

// Branding fallback while the settings query loads, so there is no flash of
// missing text. Matches the server-side defaults exactly.
const BRANDING_FALLBACK = {
  ...DEFAULT_BRANDING,
  hasCustomLogo: false,
  customized: false,
};

type SortKey =
  | "rank"
  | "name"
  | "posts"
  | "engagements"
  | "impressions"
  | "convexPosts"
  | "convexImpressions"
  | "convexEngagements"
  | "weeklyChange";
type SortDirection = "ascending" | "descending";

type BoardDisplay = FunctionReturnType<typeof api.boardSettings.getBoardDisplay>;

// How many rows a filter reveals at first, and how many each Load more click
// adds. Top 30 starts at 30 and loads 30 more; Top 60 starts at 60 and loads
// 60 more; "All yappers" starts at PAGE_SIZE and steps by PAGE_SIZE.
function filterStep(filter: TopFilterValue): number {
  return filter === "all" ? PAGE_SIZE : Number(filter);
}

// Everything visible until the admin settings load.
const ALL_VISIBLE: BoardDisplay = {
  yappersColumns: { posts: true, engagements: true, impressions: true },
  convexColumns: {
    convexPosts: true,
    shareOfPosts: true,
    convexImpressions: true,
    convexEngagements: true,
    weeklyChange: true,
  },
  showConvexTab: true,
};

// Grid column widths mirror the CSS defaults so hiding a column reflows the
// table instead of leaving an empty track.
const YAPPERS_TRACKS: Array<{ key: keyof BoardDisplay["yappersColumns"]; width: string }> = [
  { key: "posts", width: "minmax(90px, 0.55fr)" },
  { key: "engagements", width: "minmax(110px, 0.7fr)" },
  { key: "impressions", width: "minmax(150px, 0.8fr)" },
];

// Plain language definition for every metric column. These are the answer to
// "how is this being measured", shown in the header tooltips and mirrored on the
// About page. Keep them in sync with the sync rules in `convex/xSync.ts`.
const POSTS_DEFINITION =
  "Original posts, quote posts, and replies published in the last 7 days. Reposts are not counted. This matches the posts count in your own X analytics.";

const METRIC_DEFINITIONS: Partial<Record<SortKey, string>> = {
  posts: POSTS_DEFINITION,
  engagements:
    "Likes plus reposts plus replies plus quotes plus bookmarks on those posts, straight from the X API public metrics. This is not the broader engagement number in X analytics, which also counts link clicks, profile visits, and detail expands.",
  impressions:
    "Total public impressions on those posts as reported by the X API. Impressions keep accruing after a post goes up, so this rises between refreshes.",
  convexPosts:
    "How many of those posts mention Convex. The scan matches the whole word convex in the post text, a long post's full text, or a shared link that points to convex.dev, and it includes replies.",
  convexImpressions: "Public impressions on the Convex mentioning posts only.",
  convexEngagements:
    "Likes, reposts, replies, quotes, and bookmarks on the Convex mentioning posts only.",
  weeklyChange:
    "Change in Convex post count against the closest saved snapshot at least 7 days older.",
};

const SHARE_OF_POSTS_DEFINITION =
  "Convex mentioning posts out of all posts counted in the same 7 day window.";

const CONVEX_TRACKS: Array<{ key: keyof BoardDisplay["convexColumns"]; width: string }> = [
  { key: "convexPosts", width: "minmax(150px, 0.85fr)" },
  { key: "shareOfPosts", width: "minmax(105px, 0.6fr)" },
  { key: "convexImpressions", width: "minmax(115px, 0.65fr)" },
  { key: "convexEngagements", width: "minmax(115px, 0.65fr)" },
  { key: "weeklyChange", width: "minmax(95px, 0.5fr)" },
];

function defaultSortDirection(sortKey: SortKey): SortDirection {
  return sortKey === "rank" || sortKey === "name" ? "ascending" : "descending";
}

function ProfileAvatar({
  profile,
}: {
  profile: { profileImageUrl: string | null; displayName: string };
}) {
  if (profile.profileImageUrl) {
    return (
      <img className="profile-avatar" src={profile.profileImageUrl} alt="" width={44} height={44} />
    );
  }
  return <span className="profile-avatar avatar-fallback">{initials(profile.displayName)}</span>;
}

// Plain oversized medal floating left of the avatar; first place is bigger.
function RankBadgeMark({ badge }: { badge: RankBadge }) {
  return (
    <span
      className="rank-badge"
      data-first={badge.rank === 1 || undefined}
      title={`Rank ${badge.rank}`}
      aria-label={`Rank ${badge.rank} badge`}>
      {badge.kind === "image" && badge.imageUrl ? (
        <img className="rank-badge-image" src={badge.imageUrl} alt="" />
      ) : (
        <span className="rank-badge-glyph" aria-hidden="true">
          {badge.value}
        </span>
      )}
    </span>
  );
}

function formatPostDate(timestamp: number): string {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

// Expanded row content: the stored Convex posts from the latest snapshot.
function ConvexPostsPanel({ profileId }: { profileId: Id<"profiles"> }) {
  const data = useQuery(api.profiles.getConvexPosts, { profileId });
  if (data === undefined) {
    return (
      <div className="convex-posts-panel" role="row">
        Loading Convex posts…
      </div>
    );
  }
  if (!data || !data.scanned || data.posts.length === 0) {
    return (
      <div className="convex-posts-panel" role="row">
        No stored Convex posts yet. Run a rescan from the admin page.
      </div>
    );
  }
  return (
    <div className="convex-posts-panel" role="row">
      <ul>
        {data.posts.map((post) => (
          <li key={post.postId}>
            <a href={post.url} target="_blank" rel="noreferrer noopener">
              {post.text}
            </a>
            <span>
              {formatPostDate(post.postedAt)} · {compactNumber(post.impressions)} impressions ·{" "}
              {compactNumber(post.engagements)} engagement
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function formatWeeklyChange(row: LeaderboardRow): string {
  if (!row.convexScanned) return "—";
  const change = row.convexWeeklyChange;
  if (change === null || change === undefined) return "new";
  if (change > 0) return `+${change}`;
  return String(change);
}

export function Leaderboard({ initialSearch = "" }: { initialSearch?: string }) {
  // Both modes stay subscribed so toggling re-sorts instantly with no refetch.
  // 250 is the backend cap, so Load more can walk through the whole board.
  const profiles = useQuery(api.profiles.listLeaderboard, { limit: 250 });
  const convexProfiles = useQuery(api.profiles.listLeaderboard, {
    limit: 250,
    mode: "convex",
  });
  const rankBadges = useQuery(api.badges.listRankBadges, {});
  const display = useQuery(api.boardSettings.getBoardDisplay, {}) ?? ALL_VISIBLE;
  const groups = useQuery(api.groups.listPublic, {});
  const branding = useQuery(api.siteSettings.getSiteBranding, {}) ?? BRANDING_FALLBACK;
  const [searchParams, setSearchParams] = useSearchParams();
  // The active pill lives in the URL so boards are shareable. An unknown or
  // hidden board value falls back to the default Yappers ranking.
  const [board, setBoard] = useState<BoardSelection>(
    () => searchParams.get("board") ?? DEFAULT_BOARD,
  );
  const [search, setSearch] = useState(initialSearch);
  // Board opens on Top 30; Load more extends past the filter until everyone
  // is visible.
  const [topFilter, setTopFilter] = useState<TopFilterValue>("30");
  // How many sorted rows are revealed right now.
  const [visibleCount, setVisibleCount] = useState(() => filterStep("30"));
  const [copied, setCopied] = useState<string | null>(null);
  // Both modes open on the ranking view. The canonical rank already encodes
  // each mode's story (engagements for Yappers, mention count for Convex).
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [expandedId, setExpandedId] = useState<Id<"profiles"> | null>(null);
  // Which row's avatar bio peek is open; one card at a time across the board.
  const [peekId, setPeekId] = useState<Id<"profiles"> | null>(null);

  // One pill per board: Yappers always, Convex mentions unless the admin
  // hides it, then every visible group with at least one active member.
  const pills: Array<{ id: BoardSelection; label: string; icon: ReactNode }> = [
    {
      id: DEFAULT_BOARD,
      label: "Yappers",
      icon: <ChatCircleTextIcon aria-hidden="true" />,
    },
    ...(display.showConvexTab
      ? [
          {
            id: "convex",
            label: "Convex mentions",
            icon: <TrophyIcon aria-hidden="true" />,
          },
        ]
      : []),
    ...(groups ?? []).map((group) => ({
      id: group.slug,
      label: group.name,
      // Internal boards only reach admins (listPublic filters them); the
      // lock reminds the signed-in admin this pill is not public.
      icon: group.internal ? (
        <LockSimpleIcon aria-hidden="true" />
      ) : (
        <UsersThreeIcon aria-hidden="true" />
      ),
    })),
  ];
  const activeBoard: BoardSelection = pills.some((pill) => pill.id === board)
    ? board
    : DEFAULT_BOARD;
  const activeIndex = Math.max(
    pills.findIndex((pill) => pill.id === activeBoard),
    0,
  );
  const activeGroup: PublicGroup | undefined = (groups ?? []).find(
    (group) => group.slug === activeBoard,
  );

  // Group boards subscribe only while a group pill is active.
  const groupProfiles = useQuery(
    api.profiles.listLeaderboard,
    activeGroup ? { limit: 250, groupId: activeGroup._id } : "skip",
  );

  const convexMode = activeBoard === "convex";
  const groupMode = activeGroup !== undefined;
  const activeRows = convexMode
    ? convexProfiles
    : groupMode
      ? groupProfiles
      : profiles;
  const yappersColumns = display.yappersColumns;
  const convexColumns = display.convexColumns;

  // Admin hidden columns cannot stay sortable; fall back to rank order.
  const sortKeyVisibility: Record<SortKey, boolean> = {
    rank: true,
    name: true,
    posts: yappersColumns.posts,
    engagements: yappersColumns.engagements,
    impressions: yappersColumns.impressions,
    convexPosts: convexColumns.convexPosts,
    convexImpressions: convexColumns.convexImpressions,
    convexEngagements: convexColumns.convexEngagements,
    weeklyChange: convexColumns.weeklyChange,
  };
  const activeSortKey: SortKey = sortKeyVisibility[sortKey] ? sortKey : "rank";

  // Grid templates mirror the visible column set so the table reflows. The
  // compact template covers the tablet breakpoint, which otherwise hard codes
  // the metric column count.
  const visibleMetricCount = convexMode
    ? CONVEX_TRACKS.filter((track) => convexColumns[track.key]).length
    : YAPPERS_TRACKS.filter((track) => yappersColumns[track.key]).length;
  const gridTemplate = convexMode
    ? [
        "64px",
        "minmax(200px, 1.2fr)",
        ...CONVEX_TRACKS.filter((track) => convexColumns[track.key]).map((track) => track.width),
        "132px",
      ].join(" ")
    : [
        "70px",
        "minmax(260px, 1.55fr)",
        ...YAPPERS_TRACKS.filter((track) => yappersColumns[track.key]).map((track) => track.width),
        "96px",
      ].join(" ");
  const compactGridTemplate = convexMode
    ? `56px minmax(170px, 1fr) repeat(${visibleMetricCount}, minmax(82px, 0.45fr)) 128px`
    : `56px minmax(220px, 1fr) repeat(${visibleMetricCount}, minmax(90px, 0.45fr)) 76px`;

  const canonicalRanks = useMemo(
    () => new Map((activeRows ?? []).map((profile, index) => [profile._id, index + 1])),
    [activeRows]
  );

  const badgeByRank = useMemo(
    () => new Map((rankBadges ?? []).map((badge) => [badge.rank, badge])),
    [rankBadges]
  );

  const sortedProfiles = useMemo(() => {
    if (!activeRows) return [];
    const term = search.trim().replace(/^@/, "").toLowerCase();
    const matches = term
      ? activeRows.filter(
          (profile) =>
            profile.normalizedHandle.includes(term) ||
            profile.displayName.toLowerCase().includes(term)
        )
      : activeRows;

    return [...matches].sort((left, right) => {
      const leftRank = canonicalRanks.get(left._id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = canonicalRanks.get(right._id) ?? Number.MAX_SAFE_INTEGER;
      const isMetricSort = activeSortKey !== "rank" && activeSortKey !== "name";

      // People awaiting their first X sync stay after rows with real metrics.
      if (isMetricSort && left.syncStatus !== right.syncStatus) {
        return left.syncStatus === "synced" ? -1 : 1;
      }

      let comparison = 0;
      if (activeSortKey === "rank") {
        comparison = leftRank - rightRank;
      } else if (activeSortKey === "name") {
        comparison = left.displayName.localeCompare(right.displayName, undefined, {
          sensitivity: "base",
        });
      } else if (activeSortKey === "posts") {
        comparison = left.currentPosts - right.currentPosts;
      } else if (activeSortKey === "engagements") {
        comparison = left.currentEngagements - right.currentEngagements;
      } else if (activeSortKey === "impressions") {
        comparison = left.currentImpressions - right.currentImpressions;
      } else if (activeSortKey === "convexPosts") {
        comparison = (left.convexPostCount ?? 0) - (right.convexPostCount ?? 0);
      } else if (activeSortKey === "convexImpressions") {
        comparison = (left.convexImpressions ?? 0) - (right.convexImpressions ?? 0);
      } else if (activeSortKey === "convexEngagements") {
        comparison = (left.convexEngagements ?? 0) - (right.convexEngagements ?? 0);
      } else {
        comparison =
          (left.convexWeeklyChange ?? Number.MIN_SAFE_INTEGER) -
          (right.convexWeeklyChange ?? Number.MIN_SAFE_INTEGER);
      }

      if (comparison !== 0) {
        return sortDirection === "ascending" ? comparison : -comparison;
      }

      return leftRank - rightRank;
    });
  }, [activeRows, activeSortKey, canonicalRanks, search, sortDirection]);

  // The dropdown drives the starting list length: Top 30 opens with 30 rows,
  // Top 60 with 60, and so on. Load more always appears while more rows exist,
  // stepping by the filter size until the whole board is visible.
  const visibleProfiles = sortedProfiles.slice(0, visibleCount);
  const remainingCount = sortedProfiles.length - visibleProfiles.length;
  const syncedProfiles = profiles?.filter((profile) => profile.syncStatus === "synced") ?? [];
  const latestSync = syncedProfiles.reduce<number | null>(
    (latest, profile) =>
      profile.lastSyncedAt !== null && (latest === null || profile.lastSyncedAt > latest)
        ? profile.lastSyncedAt
        : latest,
    null
  );

  // Convex mode help states.
  const hasUnscannedRows =
    convexMode &&
    (convexProfiles ?? []).some((row) => row.syncStatus === "synced" && !row.convexScanned);
  const impressionsFallback =
    convexMode &&
    (convexProfiles ?? []).some((row) => (row.convexPostCount ?? 0) > 0) &&
    (convexProfiles ?? []).every((row) => (row.convexImpressions ?? 0) === 0);

  async function handleCopy(label: string, value: string) {
    await copyText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  }

  const shareText = `${branding.communityName} ${branding.boardName}`;

  async function handleShare() {
    const shareData = {
      title: branding.siteTitle,
      text: shareText,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await handleCopy("board", shareData.url);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        throw error;
      }
    }
  }

  function postOnX() {
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", shareText);
    intent.searchParams.set("url", window.location.href);
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  function changeSearch(value: string) {
    setSearch(value);
    setVisibleCount(filterStep(topFilter));
  }

  function changeBoard(nextBoard: BoardSelection) {
    if (nextBoard === activeBoard) return;
    setBoard(nextBoard);
    // Mirror the pill into the URL so the view is linkable. The default
    // board keeps a clean URL with no param.
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        if (nextBoard === DEFAULT_BOARD) {
          next.delete("board");
        } else {
          next.set("board", nextBoard);
        }
        return next;
      },
      { replace: true },
    );
    setVisibleCount(filterStep(topFilter));
    setExpandedId(null);
    // Switching boards returns to the ranking view so every board opens the
    // same way.
    setSortKey("rank");
    setSortDirection(defaultSortDirection("rank"));
  }

  function handleModeKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = Math.max(0, index - 1);
    if (event.key === "ArrowRight") nextIndex = Math.min(pills.length - 1, index + 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = pills.length - 1;
    const nextPill = pills[nextIndex];
    if (!nextPill) return;
    changeBoard(nextPill.id);
    const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
    tabs?.[nextIndex]?.focus();
  }

  function changeTopFilter(nextValue: TopFilterValue) {
    setTopFilter(nextValue);
    setVisibleCount(filterStep(nextValue));
  }

  function chooseSort(nextSortKey: SortKey) {
    setSortKey(nextSortKey);
    setSortDirection(defaultSortDirection(nextSortKey));
    setVisibleCount(filterStep(topFilter));
  }

  function changeSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((direction) => (direction === "ascending" ? "descending" : "ascending"));
      setVisibleCount(filterStep(topFilter));
      return;
    }

    chooseSort(nextSortKey);
  }

  function sortIndicator(column: SortKey) {
    if (activeSortKey !== column) return "↕";
    return sortDirection === "ascending" ? "↑" : "↓";
  }

  function headerCell(column: SortKey, label: string) {
    const definition = METRIC_DEFINITIONS[column];
    return (
      <span role="columnheader" aria-sort={activeSortKey === column ? sortDirection : "none"}>
        <button
          type="button"
          onClick={() => changeSort(column)}
          data-active={activeSortKey === column}>
          {label} <span aria-hidden="true">{sortIndicator(column)}</span>
        </button>
        {definition ? <MetricInfo label={label} definition={definition} /> : null}
      </span>
    );
  }

  return (
    <div className="leaderboard-page">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          {/* <p className="eyebrow hero-eyebrow">
            <span>Friends of Convex · people edition</span>
            <span>Top signal / 7 days</span>
          </p> */}
          <p className="hero-deck">Who&rsquo;s yapping and who&rsquo;s posting about Convex.</p>
          <h1 id="hero-title">
            {branding.communityName} <span>{branding.boardName}</span>
          </h1>
          {/* <p className="hero-deck">Who's yapping and who's posting about Convex.</p> */}
        </div>
        <aside className="signal-panel" aria-label="Leaderboard status">
          <div className="signal-pulse" aria-hidden="true" />
          <p className="signal-label">Rolling signal</p>
          <strong>{profiles?.length ?? "—"}</strong>
          <span>{branding.communityName}</span>
          <div className="signal-meta">
            <span>{formatSyncTime(latestSync)}</span>
            <span>Daily at 8:17 AM Pacific</span>
          </div>
        </aside>
      </section>

      <section className="board-shell" aria-labelledby="board-title">
        <h2 id="board-title" className="sr-only">
          {convexMode
            ? "People, ranked by Convex mentions"
            : groupMode && activeGroup
              ? `${activeGroup.name}, ranked by public engagement`
              : "People, ranked by public engagement"}
        </h2>
        <div className="board-toolbar">
          <p className="eyebrow board-kicker">
            {/* The label names the window so readers know the counts cover 7 days. */}
            <span className="board-kicker-label">This week&apos;s board · Last 7 days</span>
            {/* Freshness chip: relative label, absolute time in the tooltip. */}
            <span className="board-sync-chip" title={formatSyncTime(latestSync)}>
              {relativeSyncTime(latestSync)}
            </span>
            {/* Mobile hides the table header, so the definitions need a link too. */}
            <Link className="board-method-link" to="/about">
              How this is measured
            </Link>
          </p>
          {/* Compact search on the kicker row so filtering sits with the board title. */}
          <label className="search-field board-search">
            <MagnifyingGlassIcon aria-hidden="true" />
            <span className="sr-only">Search by name or X handle</span>
            <input
              type="search"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Search a person or @handle"
            />
            {activeRows ? <span>{sortedProfiles.length} people</span> : null}
          </label>
        </div>

        {/* Channel switch plus the list and share actions, directly above the table. */}
        <div className="board-controls">
          <div
            className="mode-tabs"
            role="group"
            aria-label="Switch the board view"
            style={
              {
                "--tab-count": pills.length,
                "--tab-index": activeIndex,
              } as CSSProperties
            }>
            <span className="mode-tabs-thumb" aria-hidden="true" />
            {pills.map((pill, index) => (
              <button
                key={pill.id}
                type="button"
                aria-pressed={activeBoard === pill.id}
                onClick={() => changeBoard(pill.id)}
                onKeyDown={(event) => handleModeKeyDown(event, index)}>
                <span className="mode-tabs-pip" aria-hidden="true" />
                {pill.icon}
                <span className="mode-tab-label">{pill.label}</span>
              </button>
            ))}
          </div>
          <div className="share-toolbar" aria-label="Share leaderboard">
            <FilterDropdown
              label="How many yappers to show"
              value={topFilter}
              options={TOP_FILTER_OPTIONS}
              onChange={changeTopFilter}
              icon={<FunnelSimpleIcon aria-hidden="true" />}
            />
            <button type="button" onClick={() => handleCopy("board", window.location.href)}>
              {copied === "board" ? (
                <CheckIcon aria-hidden="true" />
              ) : (
                <CopyIcon aria-hidden="true" />
              )}
              {copied === "board" ? "Copied" : "Copy link"}
            </button>
            <button type="button" onClick={handleShare}>
              <ShareNetworkIcon aria-hidden="true" /> Share
            </button>
            <button type="button" onClick={postOnX}>
              <XLogoIcon aria-hidden="true" /> Post on X
            </button>
          </div>
        </div>

        {profiles && profiles.length > 0 && syncedProfiles.length === 0 ? (
          <div className="data-notice" role="status">
            <span className="notice-mark" aria-hidden="true" />
            Handles are live in Convex. Add the X API key to replace “Awaiting X” with real
            seven-day metrics.
          </div>
        ) : null}

        {hasUnscannedRows ? (
          <div className="data-notice" role="status">
            <span className="notice-mark" aria-hidden="true" />
            Some rows predate the Convex mention scan. Run a rescan from the admin page to re-pull
            posts and scan them for mentions.
          </div>
        ) : null}

        {impressionsFallback ? (
          <div className="data-notice" role="status">
            <span className="notice-mark" aria-hidden="true" />
            This X API plan returns zero impressions, so the Convex ranking falls back to
            engagement.
          </div>
        ) : null}

        <div className="mobile-sort-controls">
          <label>
            <span>Sort by</span>
            <select
              value={activeSortKey}
              onChange={(event) => chooseSort(event.target.value as SortKey)}>
              <option value="rank">Rank</option>
              <option value="name">Yapper</option>
              {convexMode ? (
                <>
                  {convexColumns.convexPosts ? (
                    <option value="convexPosts">Convex posts (7d)</option>
                  ) : null}
                  {convexColumns.convexImpressions ? (
                    <option value="convexImpressions">Convex impressions</option>
                  ) : null}
                  {convexColumns.convexEngagements ? (
                    <option value="convexEngagements">Convex engagement</option>
                  ) : null}
                  {convexColumns.weeklyChange ? (
                    <option value="weeklyChange">Weekly change</option>
                  ) : null}
                </>
              ) : (
                <>
                  {yappersColumns.posts ? <option value="posts">Posts</option> : null}
                  {yappersColumns.engagements ? (
                    <option value="engagements">Engagements</option>
                  ) : null}
                  {yappersColumns.impressions ? (
                    <option value="impressions">Impressions (7D)</option>
                  ) : null}
                </>
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={() => changeSort(sortKey)}
            aria-label={`Sort ${sortDirection === "ascending" ? "descending" : "ascending"}`}>
            <span aria-hidden="true">{sortIndicator(sortKey)}</span>
            {sortDirection === "ascending" ? "Ascending" : "Descending"}
          </button>
        </div>

        <div
          className="leaderboard-table"
          role="table"
          aria-label={`${branding.communityName} leaderboard`}
          data-mode={convexMode ? "convex" : "impressions"}
          style={
            {
              "--board-grid": gridTemplate,
              "--board-grid-compact": compactGridTemplate,
            } as CSSProperties
          }>
          <div className="table-header" role="row">
            {headerCell("rank", "Rank")}
            {headerCell("name", "Yapper")}
            {convexMode ? (
              <>
                {convexColumns.convexPosts ? headerCell("convexPosts", "Convex posts (7d)") : null}
                {convexColumns.shareOfPosts ? (
                  <span role="columnheader" className="static-header">
                    Share of posts
                    <MetricInfo label="Share of posts" definition={SHARE_OF_POSTS_DEFINITION} />
                  </span>
                ) : null}
                {convexColumns.convexImpressions
                  ? headerCell("convexImpressions", "Convex impressions")
                  : null}
                {convexColumns.convexEngagements
                  ? headerCell("convexEngagements", "Convex engagement")
                  : null}
                {convexColumns.weeklyChange ? headerCell("weeklyChange", "Weekly change") : null}
              </>
            ) : (
              <>
                {yappersColumns.posts ? headerCell("posts", "Posts") : null}
                {yappersColumns.engagements ? headerCell("engagements", "Engagements") : null}
                {yappersColumns.impressions ? headerCell("impressions", "Impressions (7D)") : null}
              </>
            )}
            <span role="columnheader" className="sr-only">
              Actions
            </span>
          </div>

          {activeRows === undefined ? (
            Array.from({ length: 6 }, (_, index) => (
              <div className="table-row skeleton-row" role="row" key={index} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            ))
          ) : visibleProfiles.length > 0 ? (
            visibleProfiles.map((profile) => {
              const rank = canonicalRanks.get(profile._id) ?? 0;
              const profileUrl = `https://x.com/${profile.handle}`;
              // Top 3 badges show in both ranking modes.
              const badge = rank >= 1 && rank <= 3 ? badgeByRank.get(rank) : undefined;
              const dimmed =
                convexMode && (!profile.convexScanned || (profile.convexPostCount ?? 0) === 0);
              const expandable = convexMode && (profile.convexPostsStored ?? 0) > 0;
              const expanded = expandedId === profile._id;
              return (
                <div key={profile._id} className="table-row-group">
                  <div
                    className="table-row"
                    role="row"
                    data-dimmed={dimmed || undefined}
                    id={`yapper-${profile.normalizedHandle}`}>
                    <span className="rank-cell" role="cell">
                      {String(rank).padStart(2, "0")}
                    </span>
                    <div className="person-cell" role="cell">
                      <span className="avatar-stack">
                        <ProfilePeek
                          profile={profile}
                          open={peekId === profile._id}
                          onOpenChange={(next) => setPeekId(next ? profile._id : null)}>
                          <ProfileAvatar profile={profile} />
                        </ProfilePeek>
                        {badge ? <RankBadgeMark badge={badge} /> : null}
                      </span>
                      <span>
                        <strong>{profile.displayName}</strong>
                        <a href={profileUrl} target="_blank" rel="noreferrer noopener">
                          @{profile.handle}
                        </a>
                      </span>
                    </div>
                    {convexMode ? (
                      <>
                        {convexColumns.convexPosts ? (
                          <span
                            className="metric-cell convex-posts-cell"
                            role="cell"
                            data-label="Convex posts (7d)">
                            {profile.syncStatus !== "synced" ? (
                              "—"
                            ) : profile.convexScanned ? (
                              <span
                                className="convex-pill"
                                data-zero={(profile.convexPostCount ?? 0) === 0 || undefined}>
                                {compactNumber(profile.convexPostCount ?? 0)}
                              </span>
                            ) : (
                              <span
                                className="convex-unscanned"
                                title="This row's latest sync predates the mention scan. Run a rescan.">
                                Not scanned
                              </span>
                            )}
                            {(profile.convexStreak ?? 0) >= 2 ? (
                              <span
                                className="streak-chip"
                                title={`${profile.convexStreak} consecutive weeks with a Convex post`}>
                                {profile.convexStreak}w streak
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        {convexColumns.shareOfPosts ? (
                          <span className="metric-cell" role="cell" data-label="Share of posts">
                            {profile.syncStatus === "synced" && profile.convexScanned
                              ? `${compactNumber(profile.convexPostCount ?? 0)} of ${compactNumber(profile.currentPosts)}`
                              : "—"}
                          </span>
                        ) : null}
                        {convexColumns.convexImpressions ? (
                          <span className="metric-cell" role="cell" data-label="Convex impressions">
                            {profile.syncStatus === "synced" && profile.convexScanned
                              ? compactNumber(profile.convexImpressions ?? 0)
                              : "—"}
                          </span>
                        ) : null}
                        {convexColumns.convexEngagements ? (
                          <span className="metric-cell" role="cell" data-label="Convex engagement">
                            {profile.syncStatus === "synced" && profile.convexScanned
                              ? compactNumber(profile.convexEngagements ?? 0)
                              : "—"}
                          </span>
                        ) : null}
                        {convexColumns.weeklyChange ? (
                          <span className="metric-cell" role="cell" data-label="Weekly change">
                            {profile.syncStatus === "synced" ? formatWeeklyChange(profile) : "—"}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {yappersColumns.posts ? (
                          <span className="metric-cell posts-cell" role="cell" data-label="Posts">
                            {profile.syncStatus === "synced"
                              ? compactNumber(profile.currentPosts)
                              : "—"}
                          </span>
                        ) : null}
                        {yappersColumns.engagements ? (
                          <span
                            className="metric-cell engagement-cell"
                            role="cell"
                            data-label="Engagements">
                            {profile.syncStatus === "synced"
                              ? compactNumber(profile.currentEngagements)
                              : "—"}
                          </span>
                        ) : null}
                        {yappersColumns.impressions ? (
                          <span
                            className="metric-cell impression-cell"
                            role="cell"
                            data-label="Impressions (7D)">
                            {profile.syncStatus === "synced"
                              ? compactNumber(profile.currentImpressions)
                              : "Awaiting X"}
                          </span>
                        ) : null}
                      </>
                    )}
                    <div className="row-actions" role="cell">
                      {expandable ? (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} Convex posts from ${profile.displayName}`}
                          title="Show the actual Convex posts"
                          onClick={() => setExpandedId(expanded ? null : profile._id)}>
                          {expanded ? (
                            <CaretUpIcon aria-hidden="true" />
                          ) : (
                            <CaretDownIcon aria-hidden="true" />
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Copy a link to ${profile.displayName}`}
                        onClick={() => {
                          const link = `${window.location.origin}/?search=${encodeURIComponent(profile.handle)}`;
                          void handleCopy(profile._id, link);
                        }}>
                        {copied === profile._id ? (
                          <CheckIcon aria-hidden="true" />
                        ) : (
                          <CopyIcon aria-hidden="true" />
                        )}
                      </button>
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label={`Open @${profile.handle} on X`}>
                        <ArrowSquareOutIcon aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                  {expanded ? <ConvexPostsPanel profileId={profile._id} /> : null}
                </div>
              );
            })
          ) : (
            <div className="empty-state">
              <span className="empty-rank">00</span>
              <div>
                <h3>
                  {activeRows.length === 0
                    ? "The board is ready for its first voice."
                    : "No yappers match that search."}
                </h3>
                <p>
                  {activeRows.length === 0
                    ? "Add a real X handle in admin. Convex will update this board instantly."
                    : "Try a shorter name or handle."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="board-load-more" aria-live="polite">
          <span>
            {remainingCount > 0
              ? `Showing ${visibleProfiles.length} of ${sortedProfiles.length}`
              : `Showing all ${visibleProfiles.length}`}
          </span>
          {remainingCount > 0 ? (
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + filterStep(topFilter))}>
              Load more <CaretDownIcon aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
