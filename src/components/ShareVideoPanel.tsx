import {
  ArrowClockwiseIcon,
  ArrowSquareOutIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CrownSimpleIcon,
  DownloadSimpleIcon,
  FilmStripIcon,
  ShareNetworkIcon,
  TrashIcon,
  UploadSimpleIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { boardVideoTimeline, formatAsOf, type BoardCardInput } from "../../convex/ogArt";
import { formatDayLabel, isDayKey, pacificDay } from "../../convex/rankingDays";
import {
  VideoUnsupportedError,
  VIDEO_UNSUPPORTED_MESSAGE,
  canEncodeBoardVideo,
  frameObjectUrl,
  loadFontFaces,
  renderBoardVideo,
} from "../lib/boardVideo";
import { FilterDropdown, type FilterDropdownOption } from "./FilterDropdown";

// The live board in the day picker; saved days use their YYYY-MM-DD key.
const TODAY = "today";

type VideoInputs = NonNullable<FunctionReturnType<typeof api.boardShareVideo.getVideoInputs>>;
type Feedback = { tone: "success" | "error"; message: string };
type Rendered = { file: File; url: string; seconds: number; hasAudio: boolean };

const RECENT_PAGE = 8;

function toCardInput(inputs: VideoInputs): BoardCardInput {
  return {
    communityName: inputs.communityName,
    boardLabel: inputs.boardLabel,
    kind: inputs.kind,
    metricLabel: inputs.metricLabel,
    rows: inputs.rows,
    dataAsOf: inputs.dataAsOf,
    rankingDay: inputs.rankingDay,
  };
}

// Same post text the board's Post on X builds. Keep in sync with shareText
// and boardShareLink in src/components/Leaderboard.tsx.
function postText(inputs: VideoInputs): string {
  const boardTitle = `${inputs.communityName} ${inputs.boardName}`;
  const when = inputs.rankingDay ? `on ${formatDayLabel(inputs.rankingDay)}` : "right now";
  const base =
    inputs.board === "convex"
      ? `Top Convex mentions ${when} on the ${boardTitle}`
      : inputs.board === "legends"
        ? `The legends of the ${boardTitle}, retired undefeated`
        : inputs.board === "impressions"
          ? `Top yappers ${when} on the ${boardTitle}`
          : `Who ${inputs.rankingDay ? "led" : "leads"} ${inputs.boardLabel} ${when} on the ${boardTitle}`;
  const handles = inputs.rows
    .slice(0, 3)
    .map((row) => `@${row.handle}`)
    .join(" ");
  return handles ? `${base}: ${handles}` : base;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// The card animating in an <img>, one SVG frame at a time. A new frame is
// only requested once the previous one has decoded, so slow machines drop
// frames instead of queueing them.
function AnimatedPreview({ input, fontFaces }: { input: BoardCardInput; fontFaces: string }) {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const { duration } = boardVideoTimeline(input);
    const started = performance.now();
    let frame = 0;
    let waiting = false;
    let shownT = -1;
    let shownUrl: string | null = null;
    let pendingUrl: string | null = null;

    const settle = () => {
      if (shownUrl) URL.revokeObjectURL(shownUrl);
      shownUrl = pendingUrl;
      pendingUrl = null;
      waiting = false;
    };
    image.onload = settle;
    image.onerror = settle;

    const tick = (now: number) => {
      const t = Math.min((now - started) / 1000, duration);
      if (!waiting) {
        waiting = true;
        pendingUrl = frameObjectUrl(input, t, fontFaces);
        shownT = t;
        image.src = pendingUrl;
      }
      if (shownT < duration || waiting) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      image.onload = null;
      image.onerror = null;
      if (shownUrl) URL.revokeObjectURL(shownUrl);
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  }, [input, fontFaces]);

  return <img ref={imageRef} alt="Animated preview of the board video" width={1200} height={630} />;
}

export function ShareVideoPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const display = useQuery(api.boardSettings.getBoardDisplay, {});
  const groups = useQuery(api.groups.listPublic, {});
  const createBoardShare = useMutation(api.boardShares.createBoardShare);
  const getVideoInputs = useAction(api.boardShareVideo.getVideoInputs);
  const generateVideoUploadUrl = useMutation(api.boardShareVideo.generateVideoUploadUrl);
  const attachVideo = useMutation(api.boardShareVideo.attachVideo);
  const removeVideo = useMutation(api.boardShareVideo.removeVideo);
  const recent = usePaginatedQuery(api.boardShareVideo.listRecent, {}, {
    initialNumItems: RECENT_PAGE,
  });

  const [board, setBoard] = useState(() => searchParams.get("board") ?? "impressions");
  // Which day to freeze: today's live board or a saved daily ranking.
  const [day, setDay] = useState(() => {
    const requested = searchParams.get("day");
    return requested && isDayKey(requested) ? requested : TODAY;
  });
  const [todayKey] = useState(() => pacificDay(Date.now()));
  const savedDays = useQuery(
    api.boardRankings.listDays,
    board === "legends" ? "skip" : { board },
  );
  const dayOptions: Array<FilterDropdownOption<string>> = [
    { value: TODAY, label: "Today, live board" },
    ...(savedDays ?? [])
      .filter((entry) => entry.day < todayKey)
      .map((entry) => ({ value: entry.day, label: formatDayLabel(entry.day, true) })),
  ];
  // A day the board has no saved copy of (or Legends) falls back to today.
  const activeDay = dayOptions.some((option) => option.value === day) ? day : TODAY;
  const [inputs, setInputs] = useState<VideoInputs | null>(null);
  const [cardInput, setCardInput] = useState<BoardCardInput | null>(null);
  const [fontFaces, setFontFaces] = useState<string | null>(null);
  const [previewRun, setPreviewRun] = useState(0);
  const [busy, setBusy] = useState<"snapshot" | "render" | "attach" | "remove" | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [removeArmed, setRemoveArmed] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);

  // Live view of what Make snapshot freezes for the picked board and day.
  const preview = useQuery(
    api.boardShareVideo.previewSnapshot,
    activeDay === TODAY ? { board } : { board, day: activeDay },
  );

  const shareId = inputs?.shareId ?? null;
  // The open snapshot is this board's live tab, but the board has moved on.
  const openIsStale =
    inputs !== null &&
    preview != null &&
    activeDay === TODAY &&
    inputs.board === board &&
    inputs.rankingDay === null &&
    preview.existingShareId !== inputs.shareId;
  const videoStatus = useQuery(
    api.boardShareVideo.getShareVideo,
    shareId ? { shareId } : "skip",
  );

  // WebCodecs support is a browser capability, checked once on mount.
  useEffect(() => {
    let active = true;
    canEncodeBoardVideo().then(
      (ok) => active && setSupported(ok),
      () => active && setSupported(false),
    );
    return () => {
      active = false;
    };
  }, []);

  // Rendered MP4s live in blob URLs; free each one when it is replaced.
  useEffect(() => {
    if (!rendered) return;
    return () => URL.revokeObjectURL(rendered.url);
  }, [rendered]);

  // Internal groups never get a snapshot, and hidden tabs return nothing,
  // so the picker leaves both out.
  const boards: Array<{ id: string; label: string }> = [
    ...(display?.showYappersTab === false ? [] : [{ id: "impressions", label: "Yappers" }]),
    ...(display?.showConvexTab === false ? [] : [{ id: "convex", label: "Convex mentions" }]),
    ...(groups ?? [])
      .filter((group) => !group.internal)
      .map((group) => ({ id: group.slug, label: group.name })),
    { id: "legends", label: "Legends" },
  ];

  const siteOrigin = window.location.origin;
  const shareUrl = shareId ? `${siteOrigin}/b/${shareId}` : null;
  const text = inputs ? postText(inputs) : "";
  const canShareFile =
    rendered !== null &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [rendered.file] });

  function chooseBoard(next: string) {
    setBoard(next);
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        updated.set("board", next);
        return updated;
      },
      { replace: true },
    );
  }

  function chooseDay(next: string) {
    setDay(next);
    setSearchParams(
      (params) => {
        const updated = new URLSearchParams(params);
        if (next === TODAY) {
          updated.delete("day");
        } else {
          updated.set("day", next);
        }
        return updated;
      },
      { replace: true },
    );
  }

  async function openShare(id: string) {
    const [loaded, faces] = await Promise.all([
      getVideoInputs({ shareId: id }),
      loadFontFaces(),
    ]);
    if (!loaded) {
      setFeedback({ tone: "error", message: "That snapshot no longer exists." });
      return;
    }
    setInputs(loaded);
    setCardInput(toCardInput(loaded));
    setFontFaces(faces);
    setRendered(null);
    setProgress(null);
    setRemoveArmed(false);
  }

  async function run(kind: NonNullable<typeof busy>, work: () => Promise<void>) {
    setBusy(kind);
    setFeedback(null);
    try {
      await work();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof VideoUnsupportedError
            ? VIDEO_UNSUPPORTED_MESSAGE
            : error instanceof Error
              ? error.message
              : "That did not work.",
      });
    } finally {
      setBusy(null);
    }
  }

  function makeSnapshot() {
    void run("snapshot", async () => {
      const share = await createBoardShare({
        board,
        ...(activeDay === TODAY ? {} : { day: activeDay }),
      });
      if (!share) {
        setFeedback({
          tone: "error",
          message:
            activeDay === TODAY
              ? "This board has nothing public to share right now."
              : `No public saved ranking for ${formatDayLabel(activeDay, true)} on this board.`,
        });
        return;
      }
      await openShare(share.shareId);
    });
  }

  function openRecent(id: Id<"boardShares">) {
    void run("snapshot", async () => {
      await openShare(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function renderVideo() {
    if (!cardInput || !inputs) return;
    // A saved day names the file after the day it shows, not the render day.
    const fileName = `${slug(inputs.communityName) || "board"}-${slug(inputs.board)}-${inputs.rankingDay ?? pacificDay(Date.now())}.mp4`;
    void run("render", async () => {
      setRendered(null);
      setProgress({ done: 0, total: 1 });
      const result = await renderBoardVideo(cardInput, (done, total) =>
        setProgress({ done, total }),
      );
      setRendered({
        file: new File([result.blob], fileName, { type: "video/mp4" }),
        url: URL.createObjectURL(result.blob),
        seconds: result.seconds,
        hasAudio: result.hasAudio,
      });
    });
  }

  function attach() {
    if (!rendered || !shareId) return;
    void run("attach", async () => {
      const uploadUrl = await generateVideoUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "video/mp4" },
        body: rendered.file,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status}).`);
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      const result = await attachVideo({ shareId, storageId });
      setFeedback(
        result.status === "attached"
          ? {
              tone: "success",
              message: "Video attached. The /b link now carries og:video for chat apps.",
            }
          : { tone: "error", message: result.reason },
      );
    });
  }

  function remove() {
    if (!shareId) return;
    if (!removeArmed) {
      setRemoveArmed(true);
      return;
    }
    void run("remove", async () => {
      await removeVideo({ shareId });
      setRemoveArmed(false);
      setFeedback({ tone: "success", message: "Video removed from the share link." });
    });
  }

  // navigator.share runs straight inside the click with the File already in
  // memory; Safari refuses it after an await.
  function shareVideo() {
    if (!rendered || !shareUrl) return;
    navigator.share({ files: [rendered.file], text: `${text} ${shareUrl}` }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "The share sheet did not open.",
      });
    });
  }

  function openXPost() {
    if (!shareUrl) return;
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", text);
    intent.searchParams.set("url", shareUrl);
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  const videoUrl =
    shareId && videoStatus?.hasVideo
      ? `${siteOrigin}/v/board/${shareId}.mp4${videoStatus.videoRenderedAt ? `?v=${videoStatus.videoRenderedAt}` : ""}`
      : null;

  return (
    <div className="admin-page share-video-page">
      <section className="admin-intro">
        <div>
          <p className="eyebrow">Share video</p>
          <h1>Turn a snapshot into a ranking video.</h1>
          <p>
            Freeze a board, render a short MP4 of it building itself, and attach it to the
            snapshot&apos;s /b link. X only plays video you attach to the post, so download it
            or send it through the share sheet.
          </p>
        </div>
        <div className="security-banner" role="note">
          <FilmStripIcon aria-hidden="true" />
          <div>
            <strong>
              {supported === false ? VIDEO_UNSUPPORTED_MESSAGE : "Renders in this browser"}
            </strong>
            <span>
              {supported === false
                ? "Open this page in desktop Chrome or Safari 26 to render. Attached videos still show below."
                : "1200 by 630 H.264 at 30 fps, about 5.5 seconds. Nothing is posted for you."}
            </span>
          </div>
        </div>
      </section>

      <section className="share-video-controls" aria-label="Pick a board">
        <div className="share-video-boards" role="group" aria-label="Board">
          {boards.map((option) => (
            <button
              key={option.id}
              type="button"
              className={board === option.id ? "is-active" : ""}
              aria-pressed={board === option.id}
              onClick={() => chooseBoard(option.id)}>
              {option.label}
            </button>
          ))}
        </div>
        {board === "legends" ? null : (
          <FilterDropdown
            label="Which day to freeze"
            value={activeDay}
            options={dayOptions}
            onChange={chooseDay}
            icon={<CalendarBlankIcon aria-hidden="true" />}
          />
        )}
        <button
          type="button"
          className="primary-button"
          disabled={busy !== null}
          onClick={makeSnapshot}>
          <ArrowClockwiseIcon aria-hidden="true" />
          {busy === "snapshot"
            ? "Freezing"
            : preview?.existingShareId && preview.existingShareId !== shareId
              ? "Open snapshot"
              : "Make snapshot"}
        </button>
      </section>

      <section className="share-video-live" aria-labelledby="share-video-live-title">
        <div className="share-video-live-heading">
          <div>
            <p className="eyebrow">Make snapshot freezes</p>
            <h2 id="share-video-live-title">
              {preview === undefined
                ? "Loading the board…"
                : preview === null
                  ? "Nothing public to freeze"
                  : preview.rankingDay
                    ? `${preview.boardLabel} on ${formatDayLabel(preview.rankingDay, true)}`
                    : `${preview.boardLabel} right now`}
            </h2>
          </div>
          {preview ? (
            <span className={`share-video-live-status${preview.existingShareId ? " is-frozen" : ""}`}>
              {preview.existingShareId === null
                ? "Not frozen yet"
                : preview.existingShareId === shareId
                  ? "Open below"
                  : "Already frozen"}
            </span>
          ) : null}
        </div>
        {preview === null ? (
          <p className="share-video-live-empty">
            {activeDay === TODAY
              ? "This board has no synced, public rows to put on a card."
              : `No public saved ranking for ${formatDayLabel(activeDay, true)} on this board.`}
          </p>
        ) : preview ? (
          <>
            <ol className="share-video-live-rows">
              {preview.rows.map((row) => (
                <li key={row.handle}>
                  <span className="share-video-live-rank">
                    {row.rank === null ? (
                      <CrownSimpleIcon aria-label="Legend" />
                    ) : (
                      String(row.rank).padStart(2, "0")
                    )}
                  </span>
                  {row.profileImageUrl ? (
                    <img src={row.profileImageUrl} alt="" width={28} height={28} loading="lazy" />
                  ) : (
                    <span className="share-video-live-avatar" aria-hidden="true">
                      {row.displayName.slice(0, 1)}
                    </span>
                  )}
                  <span className="share-video-live-name">
                    <strong>{row.displayName}</strong>
                    <span>@{row.handle}</span>
                  </span>
                  {row.value !== null ? (
                    <span className="share-video-live-value">
                      {row.value} {preview.metricLabel.toLowerCase()}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="share-video-live-meta">
              {preview.rankingDay ? "Saved ranking" : "Live board"}
              {preview.dataAsOf ? ` · as of ${formatAsOf(preview.dataAsOf)}` : ""}
            </p>
          </>
        ) : null}
      </section>

      {feedback ? (
        <div className={`feedback-message feedback-${feedback.tone}`} role="status" aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      {inputs && cardInput && fontFaces && shareId ? (
        <section className="share-video-stage" aria-labelledby="share-video-stage-title">
          <div className="admin-list-heading">
            <div>
              <p className="eyebrow">
                {inputs.rankingDay
                  ? `Saved ranking · ${formatDayLabel(inputs.rankingDay, true)}`
                  : "Snapshot"}
                {inputs.dataAsOf ? ` · board as of ${formatAsOf(inputs.dataAsOf)}` : ""}
                {openIsStale ? " · older than the live board" : ""}
              </p>
              <h2 id="share-video-stage-title">{inputs.boardLabel}</h2>
            </div>
            <div className="admin-actions">
              <a className="icon-text-button" href={shareUrl ?? "#"} target="_blank" rel="noreferrer noopener">
                <ArrowSquareOutIcon aria-hidden="true" /> Open /b link
              </a>
            </div>
          </div>

          <div className="share-video-previews">
            <figure>
              <div className="share-video-frame">
                <AnimatedPreview key={previewRun} input={cardInput} fontFaces={fontFaces} />
              </div>
              <figcaption>
                <span>Video preview</span>
                <button type="button" className="text-button" onClick={() => setPreviewRun((run) => run + 1)}>
                  <ArrowClockwiseIcon aria-hidden="true" /> Replay
                </button>
              </figcaption>
            </figure>
            <figure>
              <div className="share-video-frame">
                <img
                  src={`${siteOrigin}/og/board/${shareId}.png`}
                  alt="The static card X shows for this link"
                  width={1200}
                  height={630}
                />
              </div>
              <figcaption>
                <span>Link card (PNG)</span>
              </figcaption>
            </figure>
          </div>

          <div className="share-video-actions">
            <button
              type="button"
              className="primary-button"
              disabled={busy !== null || supported === false}
              onClick={renderVideo}>
              <FilmStripIcon aria-hidden="true" />
              {busy === "render" ? "Rendering" : rendered ? "Render again" : "Render video"}
            </button>
            {progress && (busy === "render" || !rendered) ? (
              <div className="share-video-progress">
                <progress value={progress.done} max={progress.total} aria-label="Render progress" />
                <span>
                  {progress.done} of {progress.total} frames
                </span>
              </div>
            ) : null}
            {rendered ? (
              <span className="share-video-meta">
                {megabytes(rendered.file.size)} · {rendered.seconds.toFixed(1)}s
                {rendered.hasAudio ? " · silent AAC" : " · video only"}
              </span>
            ) : null}
          </div>

          {rendered ? (
            <div className="share-video-result">
              <video src={rendered.url} controls playsInline muted width={1200} height={630} />
              <div className="share-video-buttons">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy !== null}
                  onClick={attach}>
                  <UploadSimpleIcon aria-hidden="true" />
                  {busy === "attach" ? "Attaching" : "Attach to share link"}
                </button>
                <a className="secondary-button" href={rendered.url} download={rendered.file.name}>
                  <DownloadSimpleIcon aria-hidden="true" /> Download MP4
                </a>
                {canShareFile ? (
                  <button type="button" className="secondary-button" onClick={shareVideo}>
                    <ShareNetworkIcon aria-hidden="true" /> Share video
                  </button>
                ) : null}
                <button type="button" className="secondary-button" onClick={openXPost}>
                  <XLogoIcon aria-hidden="true" /> Open X post
                </button>
              </div>
              <p className="field-help">Attach the downloaded video in the X composer.</p>
            </div>
          ) : null}

          <div className="share-video-attached">
            {videoStatus === undefined ? (
              <span>Checking for an attached video…</span>
            ) : videoStatus?.hasVideo && videoUrl ? (
              <>
                <span>
                  <FilmStripIcon aria-hidden="true" /> Attached
                  {videoStatus.videoBytes !== null ? ` · ${megabytes(videoStatus.videoBytes)}` : ""}
                  {videoStatus.videoRenderedAt ? ` · ${formatAsOf(videoStatus.videoRenderedAt)}` : ""}
                </span>
                <a className="text-link" href={videoUrl} target="_blank" rel="noreferrer noopener">
                  Open MP4
                </a>
                <button
                  type="button"
                  className={`icon-text-button${removeArmed ? " danger" : ""}`}
                  disabled={busy !== null}
                  onBlur={() => setRemoveArmed(false)}
                  onClick={remove}>
                  <TrashIcon aria-hidden="true" />
                  {busy === "remove" ? "Removing" : removeArmed ? "Confirm remove" : "Remove video"}
                </button>
              </>
            ) : (
              <span>No video attached to this snapshot yet.</span>
            )}
          </div>
        </section>
      ) : null}

      <section className="admin-list" aria-labelledby="share-video-recent-title">
        <div className="admin-list-heading">
          <div>
            <p className="eyebrow">Newest first</p>
            <h2 id="share-video-recent-title">Recent snapshots</h2>
          </div>
        </div>
        <div className="admin-rows">
          {recent.status === "LoadingFirstPage" ? (
            <div className="admin-empty">Loading snapshots…</div>
          ) : recent.results.length === 0 ? (
            <div className="admin-empty">No snapshots yet. Make one above.</div>
          ) : (
            recent.results.map((share) => (
              <article className="admin-row share-video-row" key={share._id}>
                <div className="admin-identity">
                  <span>
                    <strong>
                      {share.boardLabel}
                      {share.rankingDay ? ` · ${formatDayLabel(share.rankingDay)}` : ""}
                    </strong>
                    <span className="share-video-handles">
                      {share.topHandles.map((handle) => `@${handle}`).join(" ")}
                    </span>
                  </span>
                </div>
                <div className="admin-sync-meta">
                  <strong>{formatAsOf(share._creationTime)}</strong>
                  <span>
                    {share.hasVideo ? (
                      <>
                        <FilmStripIcon aria-hidden="true" /> Video attached
                      </>
                    ) : (
                      "Card only"
                    )}
                  </span>
                </div>
                <div className="admin-actions">
                  <button
                    type="button"
                    className="icon-text-button"
                    disabled={busy !== null}
                    aria-current={share._id === shareId || undefined}
                    onClick={() => openRecent(share._id)}>
                    <FilmStripIcon aria-hidden="true" /> {share._id === shareId ? "Open now" : "Open"}
                  </button>
                  <a
                    className="icon-text-button"
                    href={`${siteOrigin}/b/${share._id}`}
                    target="_blank"
                    rel="noreferrer noopener">
                    <ArrowSquareOutIcon aria-hidden="true" /> Open /b link
                  </a>
                </div>
              </article>
            ))
          )}
        </div>
        {recent.status === "CanLoadMore" || recent.status === "LoadingMore" ? (
          <div className="board-load-more">
            <span>Showing {recent.results.length}</span>
            <button
              type="button"
              disabled={recent.status === "LoadingMore"}
              onClick={() => recent.loadMore(RECENT_PAGE)}>
              {recent.status === "LoadingMore" ? "Loading" : "Load more"}{" "}
              <CaretDownIcon aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
