import {
  ArrowSquareOutIcon,
  CaretDownIcon,
  CaretUpIcon,
  ChatCircleTextIcon,
  CheckIcon,
  CopyIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  ShareNetworkIcon,
  TrophyIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState, type CSSProperties } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { FilterDropdown, type FilterDropdownOption } from "./FilterDropdown";
import { compactNumber, formatSyncTime, initials, relativeSyncTime } from "./formatters";

const PAGE_SIZE = 10;

// Top N cap applied after search and sort; "all" shows everyone.
type TopFilterValue = "30" | "60" | "100" | "150" | "all";
const TOP_FILTER_OPTIONS: Array<FilterDropdownOption<TopFilterValue>> = [
  { value: "30", label: "Top 30" },
  { value: "60", label: "Top 60" },
  { value: "100", label: "Top 100" },
  { value: "150", label: "Top 150" },
  { value: "all", label: "All yappers" },
];

type BoardMode = "impressions" | "convex";
type LeaderboardRow = FunctionReturnType<typeof api.profiles.listLeaderboard>[number];
type RankBadge = FunctionReturnType<typeof api.badges.listRankBadges>[number];

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
};

// Grid column widths mirror the CSS defaults so hiding a column reflows the
// table instead of leaving an empty track.
const YAPPERS_TRACKS: Array<{ key: keyof BoardDisplay["yappersColumns"]; width: string }> = [
  { key: "posts", width: "minmax(90px, 0.55fr)" },
  { key: "engagements", width: "minmax(110px, 0.7fr)" },
  { key: "impressions", width: "minmax(150px, 0.8fr)" },
];

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
  const profiles = useQuery(api.profiles.listLeaderboard, { limit: 200 });
  const convexProfiles = useQuery(api.profiles.listLeaderboard, {
    limit: 200,
    mode: "convex",
  });
  const rankBadges = useQuery(api.badges.listRankBadges, {});
  const display = useQuery(api.boardSettings.getBoardDisplay, {}) ?? ALL_VISIBLE;
  const [mode, setMode] = useState<BoardMode>("impressions");
  const [search, setSearch] = useState(initialSearch);
  // Load-more list: how many sorted rows are revealed right now.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Board opens capped to the top 30; Load more walks through them ten at a time.
  const [topFilter, setTopFilter] = useState<TopFilterValue>("30");
  const [copied, setCopied] = useState<string | null>(null);
  // Engagement is the default story even when impressions are visible.
  const [sortKey, setSortKey] = useState<SortKey>("engagements");
  const [sortDirection, setSortDirection] = useState<SortDirection>("descending");
  const [expandedId, setExpandedId] = useState<Id<"profiles"> | null>(null);

  const convexMode = mode === "convex";
  const activeRows = convexMode ? convexProfiles : profiles;
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

  // Top N cap applies after search and sort, then load-more reveals rows.
  const topLimit = topFilter === "all" ? null : Number(topFilter);
  const cappedProfiles = topLimit ? sortedProfiles.slice(0, topLimit) : sortedProfiles;
  const visibleProfiles = cappedProfiles.slice(0, visibleCount);
  const remainingCount = cappedProfiles.length - visibleProfiles.length;
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

  async function handleShare() {
    const shareData = {
      title: "Friends of Convex Yapper Board",
      text: "Friends of Convex Yapper Leader Board",
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
    const text = "Friends of Convex Yapper Leader Board";
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", text);
    intent.searchParams.set("url", window.location.href);
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  function changeSearch(value: string) {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  }

  function changeMode(nextMode: BoardMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setVisibleCount(PAGE_SIZE);
    setExpandedId(null);
    const nextKey: SortKey = nextMode === "convex" ? "rank" : "engagements";
    setSortKey(nextKey);
    setSortDirection(defaultSortDirection(nextKey));
  }

  function changeTopFilter(nextValue: TopFilterValue) {
    setTopFilter(nextValue);
    setVisibleCount(PAGE_SIZE);
  }

  function chooseSort(nextSortKey: SortKey) {
    setSortKey(nextSortKey);
    setSortDirection(defaultSortDirection(nextSortKey));
    setVisibleCount(PAGE_SIZE);
  }

  function changeSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((direction) => (direction === "ascending" ? "descending" : "ascending"));
      setVisibleCount(PAGE_SIZE);
      return;
    }

    chooseSort(nextSortKey);
  }

  function sortIndicator(column: SortKey) {
    if (activeSortKey !== column) return "↕";
    return sortDirection === "ascending" ? "↑" : "↓";
  }

  function headerCell(column: SortKey, label: string) {
    return (
      <span role="columnheader" aria-sort={activeSortKey === column ? sortDirection : "none"}>
        <button
          type="button"
          onClick={() => changeSort(column)}
          data-active={activeSortKey === column}>
          {label} <span aria-hidden="true">{sortIndicator(column)}</span>
        </button>
      </span>
    );
  }

  return (
    <div className="leaderboard-page">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            <span>Friends of Convex · people edition</span>
            <span>Top signal / 7 days</span>
          </p>
          <p className="hero-deck">Who&rsquo;s yapping and who&rsquo;s posting about Convex.</p>
          <h1 id="hero-title">
            Friends of Convex <span>Yapper Leader Board</span>
          </h1>
          {/* <p className="hero-deck">Who's yapping and who's posting about Convex.</p> */}
        </div>
        <aside className="signal-panel" aria-label="Leaderboard status">
          <div className="signal-pulse" aria-hidden="true" />
          <p className="signal-label">Rolling signal</p>
          <strong>{profiles?.length ?? "—"}</strong>
          <span>Friends of Convex</span>
          <div className="signal-meta">
            <span>{formatSyncTime(latestSync)}</span>
            <span>Daily at 08:00 UTC</span>
          </div>
        </aside>
      </section>

      <section className="board-shell" aria-labelledby="board-title">
        <h2 id="board-title" className="sr-only">
          {convexMode
            ? "People, ranked by Convex mentions"
            : "People, ranked by public impressions"}
        </h2>
        <div className="board-toolbar">
          <p className="eyebrow board-kicker">
            This week&apos;s board
            {/* Freshness chip: relative label, absolute time in the tooltip. */}
            <span className="board-sync-chip" title={formatSyncTime(latestSync)}>
              {relativeSyncTime(latestSync)}
            </span>
          </p>
          <div className="mode-tabs" aria-label="Ranking mode">
            <button
              type="button"
              aria-pressed={mode === "impressions"}
              onClick={() => changeMode("impressions")}>
              <ChatCircleTextIcon aria-hidden="true" /> Yappers
            </button>
            <button
              type="button"
              aria-pressed={mode === "convex"}
              onClick={() => changeMode("convex")}>
              <TrophyIcon aria-hidden="true" /> Convex mentions
            </button>
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

        <label className="search-field">
          <MagnifyingGlassIcon aria-hidden="true" />
          <span className="sr-only">Search by name or X handle</span>
          <input
            type="search"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Search a person or @handle"
          />
          {activeRows ? <span>{cappedProfiles.length} people</span> : null}
        </label>

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
          aria-label="Friends of Convex leaderboard"
          data-mode={mode}
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
                        <ProfileAvatar profile={profile} />
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
                          <strong
                            className="impression-cell"
                            role="cell"
                            data-label="Impressions (7D)">
                            {profile.syncStatus === "synced"
                              ? compactNumber(profile.currentImpressions)
                              : "Awaiting X"}
                          </strong>
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
            Showing {visibleProfiles.length} of {cappedProfiles.length}
          </span>
          {remainingCount > 0 ? (
            <button
              type="button"
              onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>
              Load more <CaretDownIcon aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
