import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  CalendarBlankIcon,
  CheckIcon,
  CopyIcon,
  FilmStripIcon,
  ListBulletsIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";
import { formatDayLabel, isFriday } from "../../convex/rankingDays";
import { copyText, openXIntent, shareLink, weeklyPostText } from "../lib/weeklyShare";
import { FilterDropdown, type FilterDropdownOption } from "./FilterDropdown";

type WeeklyBoard = NonNullable<FunctionReturnType<typeof api.weeklyTops.getWeek>>["boards"][number];
type Feedback = { tone: "success" | "error"; message: string };

// /admin/weekly: capture any saved day as a weekly top 10 (Fridays capture
// on their own), then post each board's card, copy every post at once, or
// open a board in Share video to render its MP4.
export function WeeklyAdminPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const days = useQuery(api.weeklyTops.listCapturableDays, {});
  const branding = useQuery(api.siteSettings.getSiteBranding, {}) ?? DEFAULT_BRANDING;
  const captureWeekNow = useMutation(api.weeklyTops.captureWeekNow);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // ?day= when it is still a saved day, else the newest Friday, else the
  // newest saved day.
  const requested = searchParams.get("day");
  const activeDay =
    days === undefined
      ? null
      : requested && days.some((entry) => entry.day === requested)
        ? requested
        : (days.find((entry) => isFriday(entry.day))?.day ?? days[0]?.day ?? null);
  const activeEntry = days?.find((entry) => entry.day === activeDay) ?? null;
  const week = useQuery(api.weeklyTops.getWeek, activeDay ? { week: activeDay } : "skip");

  const dayOptions: Array<FilterDropdownOption<string>> = (days ?? []).map((entry) => ({
    value: entry.day,
    label: `${formatDayLabel(entry.day, true)}${entry.captured ? " · captured" : ""}`,
  }));

  function chooseDay(next: string) {
    setFeedback(null);
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        updated.set("day", next);
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
      weekOf: activeDay ?? "",
      handles: board.rows.map((row) => row.handle),
    });
  }

  async function capture() {
    if (!activeDay) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { captured } = await captureWeekNow({ day: activeDay });
      setFeedback(
        captured === 0
          ? {
              tone: "error",
              message: `No public board had a saved ranking on ${formatDayLabel(activeDay, true)}.`,
            }
          : {
              tone: "success",
              message: `Saved ${captured} ${captured === 1 ? "board" : "boards"} for the week ending ${formatDayLabel(activeDay, true)}.`,
            },
      );
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "That did not work.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function copy(key: string, value: string) {
    if (!(await copyText(value))) {
      setFeedback({ tone: "error", message: "The browser blocked the copy. Click the page and try again." });
      return;
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  // One block with every board's post and link, for a scheduler or a thread.
  const allPosts = (week?.boards ?? [])
    .map((board) => `${postText(board)}\n${shareLink(board.shareId)}`)
    .join("\n\n");

  return (
    <div className="admin-page weekly-admin-page">
      <section className="admin-intro">
        <div>
          <p className="eyebrow">Weekly top 10</p>
          <h1>Every board&apos;s week, ready to post.</h1>
          <p>
            Fridays save on their own after the morning refresh. Pick any saved day to capture a
            week now: each saved ranking already covers the 7 days before it.
          </p>
        </div>
      </section>

      <section className="share-video-controls" aria-label="Pick a week">
        {days === undefined ? (
          <span className="weekly-state">Loading saved days…</span>
        ) : days.length === 0 ? (
          <span className="weekly-state">
            No saved rankings yet. They appear after the next full board refresh.
          </span>
        ) : (
          <FilterDropdown
            label="Week ending"
            value={activeDay ?? ""}
            options={dayOptions}
            onChange={chooseDay}
            icon={<CalendarBlankIcon aria-hidden="true" />}
          />
        )}
        <div className="admin-actions">
          {activeDay && week ? (
            <Link className="icon-text-button" to={`/weekly?week=${activeDay}`}>
              <ArrowSquareOutIcon aria-hidden="true" /> Public page
            </Link>
          ) : null}
          {week && week.boards.length > 0 ? (
            <button type="button" className="secondary-button" onClick={() => void copy("all", allPosts)}>
              {copied === "all" ? <CheckIcon aria-hidden="true" /> : <ListBulletsIcon aria-hidden="true" />}
              {copied === "all" ? "Copied" : "Copy all posts"}
            </button>
          ) : null}
          <button
            type="button"
            className="primary-button"
            disabled={busy || !activeDay}
            onClick={() => void capture()}>
            <ArrowClockwiseIcon aria-hidden="true" />
            {busy ? "Capturing" : activeEntry?.captured ? "Capture again" : "Capture week"}
          </button>
        </div>
      </section>

      {feedback ? (
        <div className={`feedback-message feedback-${feedback.tone}`} role="status" aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      {activeDay && week === null ? (
        <p className="weekly-state">
          Not captured yet. Capture week freezes the top 10 of every public board saved on{" "}
          {formatDayLabel(activeDay, true)}.
        </p>
      ) : null}

      {week && week.boards.length > 0 ? (
        <div className="weekly-admin-grid">
          {week.boards.map((board) => (
            <article className="weekly-admin-card" key={board.board}>
              <a
                className="weekly-admin-card-image"
                href={shareLink(board.shareId)}
                target="_blank"
                rel="noreferrer noopener">
                <img
                  src={`${window.location.origin}/og/board/${board.shareId}.png`}
                  alt={`${board.boardLabel} top ${board.rows.length} card`}
                  width={1200}
                  height={630}
                  loading="lazy"
                />
              </a>
              <div className="weekly-admin-card-body">
                <div>
                  <strong>{board.boardLabel}</strong>
                  <span>
                    {board.rows
                      .slice(0, 3)
                      .map((row) => `@${row.handle}`)
                      .join(" ")}
                  </span>
                </div>
                <span className={`share-video-live-status${board.hasVideo ? " is-frozen" : ""}`}>
                  {board.hasVideo ? "Video attached" : "Card only"}
                </span>
              </div>
              <div className="weekly-admin-card-actions">
                <button
                  type="button"
                  className="icon-text-button"
                  onClick={() => openXIntent(postText(board), shareLink(board.shareId))}>
                  <XLogoIcon aria-hidden="true" /> Open X post
                </button>
                <button
                  type="button"
                  className="icon-text-button"
                  onClick={() => void copy(board.board, shareLink(board.shareId))}>
                  {copied === board.board ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                  {copied === board.board ? "Copied" : "Copy link"}
                </button>
                <Link
                  className="icon-text-button"
                  to={`/admin/share-video?board=${encodeURIComponent(board.board)}&share=${board.shareId}`}>
                  <FilmStripIcon aria-hidden="true" /> {board.hasVideo ? "Video" : "Make video"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
