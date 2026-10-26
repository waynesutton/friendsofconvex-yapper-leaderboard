import { CalendarBlankIcon, CheckIcon, CopyIcon, XLogoIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";
import { formatAsOf } from "../../convex/ogArt";
import { formatDayLabel } from "../../convex/rankingDays";
import { copyText, openXIntent, shareLink, weeklyPostText } from "../lib/weeklyShare";
import { FilterDropdown, type FilterDropdownOption } from "./FilterDropdown";

type WeeklyBoard = NonNullable<FunctionReturnType<typeof api.weeklyTops.getWeek>>["boards"][number];

// Public weekly archive: every visible board's top 10 for one week, frozen
// from that Friday's rolling 7 day ranking. ?week= picks the week and
// ?board= scrolls to one board, which is where /b links for weekly shares
// point their canonical.
export function WeeklyBoards() {
  const [searchParams, setSearchParams] = useSearchParams();
  const weeks = useQuery(api.weeklyTops.listWeeks, {});
  const branding = useQuery(api.siteSettings.getSiteBranding, {}) ?? DEFAULT_BRANDING;
  const requestedWeek = searchParams.get("week");
  const focusBoard = searchParams.get("board");
  // An unknown or missing ?week= falls back to the newest week.
  const activeWeek =
    weeks && requestedWeek && weeks.includes(requestedWeek) ? requestedWeek : (weeks?.[0] ?? null);
  const week = useQuery(api.weeklyTops.getWeek, activeWeek ? { week: activeWeek } : "skip");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState<string | null>(null);

  // Scroll to ?board= once its card is on the page.
  useEffect(() => {
    if (!focusBoard || !week) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`weekly-${focusBoard}`)
      ?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, [focusBoard, week]);

  const weekOptions: Array<FilterDropdownOption<string>> = (weeks ?? []).map((entry, index) => ({
    value: entry,
    label: `${index === 0 ? "Latest · " : ""}Week ending ${formatDayLabel(entry, true)}`,
  }));

  function chooseWeek(next: string) {
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        updated.set("week", next);
        updated.delete("board");
        return updated;
      },
      { replace: true },
    );
  }

  function postText(board: WeeklyBoard): string {
    return weeklyPostText({
      communityName: branding.communityName,
      boardName: branding.boardName,
      board: board.board,
      boardLabel: board.boardLabel,
      weekOf: activeWeek ?? "",
      handles: board.rows.map((row) => row.handle),
    });
  }

  async function copyLink(board: WeeklyBoard) {
    const ok = await copyText(shareLink(board.shareId));
    setCopied(ok ? board.board : null);
    setCopyFailed(ok ? null : board.board);
    window.setTimeout(() => {
      setCopied(null);
      setCopyFailed(null);
    }, 1800);
  }

  return (
    <div className="editorial-page weekly-page">
      <header className="editorial-hero">
        <div className="editorial-title">
          <p className="eyebrow">Weekly top 10</p>
          <h1>
            {activeWeek
              ? `Week ending ${formatDayLabel(activeWeek, true)}`
              : "Every board's top 10, every Friday."}
          </h1>
        </div>
        <p>
          Each board&apos;s top 10 over the last 7 days, frozen every Friday after the 8:17 AM
          Pacific refresh. Weeks stay here after the daily rankings roll off.
        </p>
      </header>

      {weeks === undefined ? (
        <p className="weekly-state">Loading weeks…</p>
      ) : weeks.length === 0 ? (
        <div className="weekly-state weekly-empty">
          <strong>No weekly top 10 yet.</strong>
          <span>
            The first one is saved Friday after the morning refresh. The{" "}
            <Link className="text-link" to="/">
              live board
            </Link>{" "}
            is always current.
          </span>
        </div>
      ) : (
        <>
          <div className="weekly-toolbar">
            <FilterDropdown
              label="Week"
              value={activeWeek ?? ""}
              options={weekOptions}
              onChange={chooseWeek}
              icon={<CalendarBlankIcon aria-hidden="true" />}
            />
            {week && week.boards.length > 1 ? (
              <nav className="weekly-jump" aria-label="Jump to a board">
                {week.boards.map((board) => (
                  <Link
                    key={board.board}
                    to={`/weekly?week=${activeWeek}&board=${encodeURIComponent(board.board)}`}
                    replace
                    aria-current={focusBoard === board.board || undefined}>
                    {board.boardLabel}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

          {week === undefined ? (
            <p className="weekly-state">Loading the week…</p>
          ) : week === null || week.boards.length === 0 ? (
            <p className="weekly-state">No public boards were saved for this week.</p>
          ) : (
            <div className="weekly-grid">
              {week.boards.map((board) => (
                <article
                  key={board.board}
                  id={`weekly-${board.board}`}
                  className={`weekly-card${focusBoard === board.board ? " is-focused" : ""}`}
                  aria-labelledby={`weekly-${board.board}-title`}>
                  <header className="weekly-card-heading">
                    <div>
                      <p className="eyebrow">Top {board.rows.length}</p>
                      <h2 id={`weekly-${board.board}-title`}>{board.boardLabel}</h2>
                    </div>
                    {board.dataAsOf ? (
                      <span className="weekly-card-asof">
                        Last 7 days as of {formatAsOf(board.dataAsOf)}
                      </span>
                    ) : null}
                  </header>
                  <ol className="weekly-rows">
                    {board.rows.map((row) => (
                      <li key={row.handle} className={row.rank === 1 ? "is-first" : undefined}>
                        <span className="weekly-rank">{String(row.rank ?? "").padStart(2, "0")}</span>
                        {row.profileImageUrl ? (
                          <img src={row.profileImageUrl} alt="" width={32} height={32} loading="lazy" />
                        ) : (
                          <span className="weekly-avatar" aria-hidden="true">
                            {row.displayName.slice(0, 1)}
                          </span>
                        )}
                        <a
                          className="weekly-name"
                          href={`https://x.com/${row.handle}`}
                          target="_blank"
                          rel="noreferrer noopener">
                          <strong>{row.displayName}</strong>
                          <span>@{row.handle}</span>
                        </a>
                        {row.value !== null ? (
                          <span className="weekly-value">
                            {row.value.toLocaleString("en-US")}{" "}
                            <span>{board.metricLabel.toLowerCase()}</span>
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  <footer className="weekly-card-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openXIntent(postText(board), shareLink(board.shareId))}>
                      <XLogoIcon aria-hidden="true" /> Post on X
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void copyLink(board)}>
                      {copied === board.board ? (
                        <CheckIcon aria-hidden="true" />
                      ) : (
                        <CopyIcon aria-hidden="true" />
                      )}
                      {copied === board.board
                        ? "Copied"
                        : copyFailed === board.board
                          ? "Copy failed"
                          : "Copy link"}
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
