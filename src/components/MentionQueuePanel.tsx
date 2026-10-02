import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  ArrowUUpLeftIcon,
  CaretDownIcon,
  PlusIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { compactNumber, formatSyncTime, initials } from "./formatters";

type QueueView = "queued" | "dismissed" | "added";

const PAGE_SIZE = 30;
const WINDOW_DAYS = 30;

const VIEW_LABELS: Record<QueueView, string> = {
  queued: "Queued",
  dismissed: "Dismissed",
  added: "Added",
};

type Feedback = { tone: "success" | "error"; message: string };

type IntervalHours = 1 | 4 | 6;

const INTERVAL_OPTIONS: Array<{ hours: IntervalHours; label: string; hint: string }> = [
  { hours: 1, label: "Every hour", hint: "Freshest queue, 24 X requests a day at most" },
  { hours: 4, label: "Every 4 hours", hint: "6 X requests a day at most" },
  { hours: 6, label: "Every 6 hours (recommended)", hint: "4 X requests a day, plenty for a review queue" },
];

const HOUR_MS = 60 * 60 * 1000;
// Matches SCAN_GRACE_MS in convex/mentionQueue.ts.
const SCAN_GRACE_MS = 10 * 60 * 1000;

function scheduleLabel(hours: IntervalHours): string {
  return hours === 1 ? "every hour" : `every ${hours} hours`;
}

// The cron checks at minute 41 of every UTC hour, so the next scan is the
// first check after the interval has passed.
function nextScanAt(lastScannedAt: number | null, hours: IntervalHours, now: number): number {
  const dueAt = lastScannedAt === null ? now : lastScannedAt + hours * HOUR_MS - SCAN_GRACE_MS;
  const from = Math.max(dueAt, now);
  const check = new Date(from);
  check.setUTCMinutes(41, 0, 0);
  if (check.getTime() < from) check.setTime(check.getTime() + HOUR_MS);
  return check.getTime();
}

// On/off switch and schedule for the automatic scan. Saves instantly.
function ScanSettings({
  enabled,
  intervalHours,
  onFeedback,
}: {
  enabled: boolean;
  intervalHours: IntervalHours;
  onFeedback: (feedback: Feedback | null) => void;
}) {
  const setScanSettings = useMutation(api.mentionQueue.setScanSettings);
  const [saving, setSaving] = useState(false);

  async function save(next: { enabled: boolean; intervalHours: IntervalHours }) {
    setSaving(true);
    onFeedback(null);
    try {
      await setScanSettings(next);
      onFeedback({
        tone: "success",
        message: next.enabled
          ? `Mention scans run ${scheduleLabel(next.intervalHours)}.`
          : "Mention scans are off. The queue stays as it is until you turn them back on.",
      });
    } catch (error) {
      onFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not save the scan settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="board-column-settings queue-settings">
      <fieldset disabled={saving}>
        <legend>Automatic scans</legend>
        <label title="Turn off to stop every X request for the mention queue. Queued people, Add to board, and Dismiss keep working.">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => void save({ enabled: event.target.checked, intervalHours })}
          />
          <span>Scan X for new mentions</span>
        </label>
        <p className="queue-settings-hint">
          {enabled
            ? "Off stops all X reads for this queue. Your queue and history stay."
            : "Paused. No X requests until you turn this back on."}
        </p>
      </fieldset>
      <fieldset disabled={saving || !enabled}>
        <legend>Scan every</legend>
        {INTERVAL_OPTIONS.map((option) => (
          <label key={option.hours} title={option.hint}>
            <input
              type="radio"
              name="mention-scan-interval"
              checked={intervalHours === option.hours}
              onChange={() => void save({ enabled, intervalHours: option.hours })}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function shortDate(timestamp: number): string {
  if (timestamp === 0) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    timestamp,
  );
}

// Admin queue of people who mentioned the tracked X account at least twice in
// the last 30 days and are not on the board yet.
export function MentionQueuePanel() {
  const [view, setView] = useState<QueueView>("queued");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const status = useQuery(api.mentionQueue.getScanStatus, {});
  const { results, status: pageStatus, loadMore } = usePaginatedQuery(
    api.mentionQueue.listQueue,
    { status: view },
    { initialNumItems: PAGE_SIZE },
  );
  const scanNow = useAction(api.mentionQueue.scanNow);
  const addToBoard = useMutation(api.mentionQueue.addToBoard);
  const dismiss = useMutation(api.mentionQueue.dismiss);
  const restore = useMutation(api.mentionQueue.restore);

  const target = status?.targetHandle ?? "convex";
  // The first scan only reaches X's 800 most recent mentions, so the window
  // is only complete once 30 days have passed since tracking began.
  const [openedAt] = useState(() => Date.now());
  const historyIncomplete =
    status?.firstScannedAt !== null &&
    status?.firstScannedAt !== undefined &&
    openedAt - status.firstScannedAt < WINDOW_DAYS * 24 * 60 * 60 * 1000;

  async function runScan() {
    setBusy("scan");
    setFeedback(null);
    try {
      const result = await scanNow({});
      setFeedback(
        result.status === "ok"
          ? {
              tone: "success",
              message:
                result.newPosts === 0
                  ? `No new @${target} mentions since the last scan.`
                  : `Recorded ${result.newPosts} new @${target} mentions.`,
            }
          : { tone: "error", message: result.message ?? "Mention scan failed." },
      );
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Mention scan failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function act(
    candidateId: Id<"mentionCandidates">,
    handle: string,
    action: "add" | "dismiss" | "restore",
  ) {
    setBusy(candidateId);
    setFeedback(null);
    try {
      if (action === "add") {
        const result = await addToBoard({ candidateId });
        setFeedback({
          tone: "success",
          message: result.created
            ? `@${handle} is on the board. Their metrics are syncing now.`
            : `@${handle} was already on the board and is active again.`,
        });
      } else if (action === "dismiss") {
        await dismiss({ candidateId });
        setFeedback({ tone: "success", message: `@${handle} left the queue.` });
      } else {
        await restore({ candidateId });
        setFeedback({ tone: "success", message: `@${handle} is back in the queue.` });
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "That action failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <p className="eyebrow">Mention queue</p>
          <h1>People talking about @{target}.</h1>
          <p>
            Everyone who mentioned @{target} on X at least twice in the last {WINDOW_DAYS} days and
            is not on the board yet. Newest mention first.
          </p>
        </div>
        <div className="security-banner" role="note">
          {status?.lastError ? <WarningCircleIcon aria-hidden="true" /> : <ArrowClockwiseIcon aria-hidden="true" />}
          <div>
            <strong>
              {status === undefined
                ? "Checking scan status"
                : status.lastScannedAt === null
                  ? "Not scanned yet"
                  : `Last scan ${formatSyncTime(status.lastScannedAt)}`}
            </strong>
            <span>
              {status === undefined
                ? null
                : !status.enabled
                  ? "Scans are off. Turn them on below to read new mentions."
                  : status.lastError
                    ? status.lastError
                    : `Scans run ${scheduleLabel(status.intervalHours)} and only read posts written since the last scan. Next scan ${formatSyncTime(nextScanAt(status.lastScannedAt, status.intervalHours, openedAt))}.`}
            </span>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={
              busy === "scan" || status?.xApiConfigured === false || status?.enabled === false
            }
            title={
              status?.enabled === false
                ? "Turn on automatic scans to read mentions"
                : `Read new @${target} mentions from X right now`
            }
            onClick={() => void runScan()}
          >
            <ArrowClockwiseIcon aria-hidden="true" /> {busy === "scan" ? "Scanning" : "Scan now"}
          </button>
        </div>
      </section>

      {status ? (
        <ScanSettings
          enabled={status.enabled}
          intervalHours={status.intervalHours}
          onFeedback={setFeedback}
        />
      ) : null}

      {feedback ? (
        <div className={`feedback-message feedback-${feedback.tone}`} role="status" aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      <section className="admin-list" aria-labelledby="mention-queue-title">
        <div className="admin-list-heading">
          <div>
            <p className="eyebrow">2 or more mentions · last {WINDOW_DAYS} days</p>
            <h2 id="mention-queue-title">
              {status === undefined
                ? "— in the queue"
                : `${status.queuedCount}${status.queuedCountCapped ? "+" : ""} in the queue`}
            </h2>
          </div>
          <div className="admin-list-heading-actions">
            <div className="gift-view-tabs" role="group" aria-label="Queue views">
              {(Object.keys(VIEW_LABELS) as Array<QueueView>).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={view === key ? "is-active" : ""}
                  aria-pressed={view === key}
                  onClick={() => {
                    setView(key);
                    setFeedback(null);
                  }}
                >
                  {VIEW_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {historyIncomplete ? (
          <p className="field-help queue-history-note">
            Tracking started {shortDate(status.firstScannedAt ?? 0)}. X only returns the 800 most recent
            mentions, so counts fill in as the {WINDOW_DAYS} day window builds up.
          </p>
        ) : null}

        <div className="admin-rows">
          {pageStatus === "LoadingFirstPage" ? (
            <div className="admin-empty">Loading the queue…</div>
          ) : results.length === 0 ? (
            <div className="admin-empty">
              {view === "queued"
                ? status?.lastScannedAt === null
                  ? "Press Scan now to read recent mentions from X."
                  : "Nobody new has mentioned @" + target + " twice this month. Check back after the next scan."
                : view === "dismissed"
                  ? "Nobody has been dismissed."
                  : "Nobody has been added from the queue yet."}
            </div>
          ) : (
            results.map((person) => (
              <article className="admin-row queue-row" key={person._id}>
                <div className="admin-identity">
                  {person.profileImageUrl ? (
                    <img className="queue-avatar" src={person.profileImageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="queue-avatar queue-avatar-fallback" aria-hidden="true">
                      {initials(person.displayName)}
                    </span>
                  )}
                  <span>
                    <strong>{person.displayName}</strong>
                    <a href={`https://x.com/${person.handle}`} target="_blank" rel="noreferrer noopener">
                      @{person.handle} · {compactNumber(person.followerCount)} followers
                    </a>
                  </span>
                </div>

                <div className="admin-sync-meta queue-meta">
                  <strong>
                    <span className="queue-count">{person.recentMentionCount}</span> mentions ·{" "}
                    last {shortDate(person.lastMentionAt)}
                  </strong>
                  <ul className="queue-posts" aria-label={`Latest posts from @${person.handle}`}>
                    {person.lastPosts.map((post) => (
                      <li key={post.postId}>
                        <a href={post.url} target="_blank" rel="noreferrer noopener" title={post.text}>
                          <ArrowSquareOutIcon aria-hidden="true" />
                          <span className="queue-post-date">{shortDate(post.postedAt)}</span>
                          <span className="queue-post-text">{post.text || "View post"}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="admin-actions">
                  {person.status === "added" ? (
                    <span className="queue-added-note">
                      Added {person.reviewedAt ? shortDate(person.reviewedAt) : ""}
                    </span>
                  ) : person.status === "dismissed" ? (
                    <button
                      type="button"
                      className="icon-text-button"
                      disabled={busy === person._id}
                      title="Put this person back in the queue"
                      onClick={() => void act(person._id, person.handle, "restore")}
                    >
                      <ArrowUUpLeftIcon aria-hidden="true" /> Restore
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="icon-text-button"
                        disabled={busy === person._id}
                        title="Add this person to the main board and sync their metrics"
                        onClick={() => void act(person._id, person.handle, "add")}
                      >
                        <PlusIcon aria-hidden="true" /> {busy === person._id ? "Adding" : "Add to board"}
                      </button>
                      <button
                        type="button"
                        className="icon-text-button"
                        disabled={busy === person._id}
                        title="Hide this person from the queue; Restore brings them back"
                        onClick={() => void act(person._id, person.handle, "dismiss")}
                      >
                        <XCircleIcon aria-hidden="true" /> Dismiss
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        {results.length > 0 ? (
          <div className="board-load-more" aria-live="polite">
            <span>
              {pageStatus === "Exhausted" ? `Showing all ${results.length}` : `Showing ${results.length}`}
            </span>
            {pageStatus === "CanLoadMore" || pageStatus === "LoadingMore" ? (
              <button
                type="button"
                disabled={pageStatus === "LoadingMore"}
                onClick={() => loadMore(PAGE_SIZE)}
              >
                {pageStatus === "LoadingMore" ? "Loading" : "Load more"} <CaretDownIcon aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
