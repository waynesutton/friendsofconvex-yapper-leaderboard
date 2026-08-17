import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  PaperPlaneTiltIcon,
  PauseCircleIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatSyncTime } from "./formatters";
import { ImportPanel } from "./ImportPanel";

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;

type RankBadge = FunctionReturnType<typeof api.badges.listRankBadges>[number];
type BadgeRank = 1 | 2 | 3;
type BadgeKind = "emoji" | "text" | "image";

const RESCAN_TOOLTIP =
  "Re-pulls this account's recent posts and rescans them for Convex mentions.";

// One editor per top-3 rank: default medal, custom emoji, short text, or an
// uploaded PNG or SVG stored in Convex file storage.
function BadgeEditor({ badge }: { badge: RankBadge }) {
  const setBadge = useMutation(api.badges.setRankBadge);
  const clearBadge = useMutation(api.badges.clearRankBadge);
  const generateUploadUrl = useMutation(api.badges.generateBadgeUploadUrl);
  const [kind, setKind] = useState<BadgeKind>(
    badge.kind === "image" ? "image" : badge.kind,
  );
  const [value, setValue] = useState(badge.kind === "image" ? "" : badge.value);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Feedback>(null);
  const rank = badge.rank as BadgeRank;

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      if (kind === "image") {
        if (!file) throw new Error("Choose a PNG or SVG file first.");
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error("The badge upload failed. Try again.");
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        await setBadge({ rank, kind: "image", imageStorageId: storageId });
        setFile(null);
      } else {
        await setBadge({ rank, kind, value });
      }
      setNote({ tone: "success", message: `Rank ${rank} badge saved.` });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Badge save failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setNote(null);
    try {
      await clearBadge({ rank });
      setValue("");
      setFile(null);
      setNote({ tone: "success", message: `Rank ${rank} badge reset to default.` });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Badge reset failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="badge-editor">
      <div className="badge-editor-current">
        {badge.kind === "image" && badge.imageUrl ? (
          <img src={badge.imageUrl} alt={`Rank ${rank} badge`} />
        ) : (
          <span>{badge.value}</span>
        )}
        <small>
          Rank {rank} · {badge.isDefault ? "default" : "custom"}
        </small>
      </div>
      <div className="badge-editor-controls">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as BadgeKind)}
          aria-label={`Rank ${rank} badge type`}
        >
          <option value="emoji">Emoji</option>
          <option value="text">Short text</option>
          <option value="image">PNG or SVG</option>
        </select>
        {kind === "image" ? (
          <input
            type="file"
            accept="image/png,image/svg+xml"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            aria-label={`Rank ${rank} badge image`}
          />
        ) : (
          <input
            type="text"
            value={value}
            maxLength={kind === "text" ? 12 : 8}
            placeholder={kind === "emoji" ? "One emoji" : "Up to 12 characters"}
            onChange={(event) => setValue(event.target.value)}
            aria-label={`Rank ${rank} badge value`}
          />
        )}
        <button
          type="button"
          className="icon-text-button"
          disabled={busy}
          title={`Apply this badge to rank ${rank} on the public board`}
          onClick={() => void save()}
        >
          {busy ? "Saving" : "Save"}
        </button>
        <button
          type="button"
          className="icon-text-button"
          disabled={busy || badge.isDefault}
          title={`Put rank ${rank} back to its default badge`}
          onClick={() => void reset()}
        >
          Reset
        </button>
      </div>
      {note ? (
        <p className={`badge-editor-note feedback-${note.tone}`} role="status">
          {note.message}
        </p>
      ) : null}
    </div>
  );
}

type BoardDisplay = FunctionReturnType<typeof api.boardSettings.getBoardDisplay>;

const YAPPERS_COLUMN_LABELS: Array<{
  key: keyof BoardDisplay["yappersColumns"];
  label: string;
}> = [
  { key: "posts", label: "Posts" },
  { key: "engagements", label: "Engagements" },
  { key: "impressions", label: "Impressions (7D)" },
];

const CONVEX_COLUMN_LABELS: Array<{
  key: keyof BoardDisplay["convexColumns"];
  label: string;
}> = [
  { key: "convexPosts", label: "Convex posts (7d)" },
  { key: "shareOfPosts", label: "Share of posts" },
  { key: "convexImpressions", label: "Convex impressions" },
  { key: "convexEngagements", label: "Convex engagement" },
  { key: "weeklyChange", label: "Weekly change" },
];

// Checkmark lists deciding which metric columns the public board shows in the
// Yappers and Convex mentions views. Changes apply to the live board instantly.
function BoardColumnSettings() {
  const display = useQuery(api.boardSettings.getBoardDisplay, {});
  const setDisplay = useMutation(api.boardSettings.setBoardDisplay);
  const [note, setNote] = useState<Feedback>(null);

  async function save(next: BoardDisplay) {
    setNote(null);
    try {
      await setDisplay(next);
    } catch (error) {
      setNote({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not save the column settings.",
      });
    }
  }

  if (display === undefined) {
    return <div className="admin-empty">Loading column settings…</div>;
  }

  return (
    <div className="board-column-settings">
      <fieldset>
        <legend>Board tabs</legend>
        <label title="Show or hide the main Yappers pill. Forks that only run custom group boards can turn this off; the board opens on the first remaining pill. At least one visible group must exist before both tabs can be hidden.">
          <input
            type="checkbox"
            checked={display.showYappersTab}
            onChange={(event) =>
              void save({
                ...display,
                showYappersTab: event.target.checked,
              })
            }
          />
          <span>Show the main Yappers tab</span>
        </label>
        <label title="Show or hide the Convex mentions pill on the public board. Forks that do not track Convex mentions can turn this off.">
          <input
            type="checkbox"
            checked={display.showConvexTab}
            onChange={(event) =>
              void save({
                ...display,
                showConvexTab: event.target.checked,
              })
            }
          />
          <span>Show the Convex mentions tab</span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Yappers view columns</legend>
        {YAPPERS_COLUMN_LABELS.map(({ key, label }) => (
          <label key={key} title={`Show or hide the ${label} column on the public board`}>
            <input
              type="checkbox"
              checked={display.yappersColumns[key]}
              onChange={(event) =>
                void save({
                  ...display,
                  yappersColumns: {
                    ...display.yappersColumns,
                    [key]: event.target.checked,
                  },
                })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Convex mentions view columns</legend>
        {CONVEX_COLUMN_LABELS.map(({ key, label }) => (
          <label key={key} title={`Show or hide the ${label} column on the public board`}>
            <input
              type="checkbox"
              checked={display.convexColumns[key]}
              onChange={(event) =>
                void save({
                  ...display,
                  convexColumns: {
                    ...display.convexColumns,
                    [key]: event.target.checked,
                  },
                })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      {note ? (
        <p className={`badge-editor-note feedback-${note.tone}`} role="status">
          {note.message}
        </p>
      ) : null}
    </div>
  );
}

// Board settings live here because the app has no dedicated settings page.
function BoardSettings() {
  const badges = useQuery(api.badges.listRankBadges, {});
  const postDigest = useAction(api.slack.postConvexDigest);
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Feedback>(null);

  async function sendDigest() {
    setBusy(true);
    setNote(null);
    try {
      const result = await postDigest({
        channel: channel.trim() || undefined,
      });
      setNote({ tone: result.ok ? "success" : "error", message: result.message });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "The digest failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="board-settings" aria-labelledby="board-settings-title">
      <div className="board-settings-heading">
        <p className="section-kicker">Board settings</p>
        <h2 id="board-settings-title">Leaderboard display</h2>
        <p>
          Choose which tabs and columns the public board shows, customize the
          top 3 badges in Convex mentions mode, and post the digest to Slack.
          Slack needs SLACK_BOT_TOKEN and SLACK_DIGEST_CHANNEL in this Convex
          deployment.
        </p>
        <p>
          <Link className="text-link" to="/admin/groups">
            Manage custom groups
          </Link>{" "}
          ·{" "}
          <Link className="text-link" to="/admin/settings">
            Site branding settings
          </Link>
        </p>
      </div>
      <BoardColumnSettings />
      <div className="badge-settings-grid">
        {badges === undefined ? (
          <div className="admin-empty">Loading badges…</div>
        ) : (
          badges.map((badge) => <BadgeEditor key={badge.rank} badge={badge} />)
        )}
      </div>
      <div className="slack-digest-row">
        <input
          type="text"
          value={channel}
          placeholder="#channel override (optional)"
          onChange={(event) => setChannel(event.target.value)}
          aria-label="Slack channel override"
        />
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          title="Posts the top Convex yappers with rank, handle, post count, impressions, and streak."
          onClick={() => void sendDigest()}
        >
          <PaperPlaneTiltIcon aria-hidden="true" /> {busy ? "Posting" : "Post Slack digest"}
        </button>
      </div>
      {note ? (
        <div className={`feedback-message feedback-${note.tone}`} role="status" aria-live="polite">
          {note.message}
        </div>
      ) : null}
    </section>
  );
}

// Cleans pasted or typed handle input so "@name", " @name ", "x.com/name",
// and full profile links all become a plain handle. The backend normalizes
// again, but this keeps the browser pattern check from blocking the form.
function sanitizeHandleInput(value: string): string {
  let cleaned = value.trim();
  const urlMatch = cleaned.match(/(?:x\.com|twitter\.com)\/(@?[A-Za-z0-9_]+)/i);
  if (urlMatch) {
    cleaned = urlMatch[1];
  }
  return cleaned.replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "");
}

export function AdminPanel() {
  const profiles = useQuery(api.profiles.listAdmin, { limit: 200 });
  const setup = useQuery(api.profiles.getSetupStatus, {});
  const addProfile = useMutation(api.profiles.add);
  const setActive = useMutation(api.profiles.setActive);
  const removeProfile = useMutation(api.profiles.remove);
  const reviewMembership = useMutation(api.profiles.reviewMembership);
  const refreshOne = useAction(api.xSync.refreshOne);
  const refreshAll = useAction(api.xSync.refreshAll);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Remove is destructive, so the button arms on the first click and only
  // deletes on the second. Any other row action disarms it.
  const [confirmRemoveId, setConfirmRemoveId] = useState<Id<"profiles"> | null>(null);

  async function submitHandle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("add");
    setFeedback(null);
    try {
      const result = await addProfile({ handle });
      setHandle("");
      if (setup?.xApiConfigured) {
        const sync = await refreshOne({ profileId: result.profileId });
        setFeedback({
          tone: sync.status === "synced" ? "success" : "error",
          message:
            sync.status === "synced"
              ? `@${sync.handle} was added and synced.`
              : sync.message ?? "The handle was added, but X sync failed.",
        });
      } else {
        setFeedback({
          tone: "success",
          message: result.created
            ? "Handle added to Convex. Add the X key when you are ready to sync metrics."
            : "That handle was already on the board and is active again.",
        });
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not add this handle.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleProfile(profileId: Id<"profiles">, active: boolean) {
    setBusy(profileId);
    setFeedback(null);
    setConfirmRemoveId(null);
    try {
      await setActive({ profileId, active });
      setFeedback({
        tone: "success",
        message: active ? "Profile returned to the board." : "Profile archived from the board.",
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Update failed." });
    } finally {
      setBusy(null);
    }
  }

  // First click arms the confirm state; second click deletes the profile and
  // its snapshot history for good. Gift history keeps its own name copies.
  async function removeHandle(profileId: Id<"profiles">, profileHandle: string) {
    if (confirmRemoveId !== profileId) {
      setConfirmRemoveId(profileId);
      setFeedback({
        tone: "info",
        message: `Press Confirm to permanently remove @${profileHandle} and their board history. Archive instead if you may want them back.`,
      });
      return;
    }
    setBusy(profileId);
    setFeedback(null);
    try {
      await removeProfile({ profileId });
      setFeedback({
        tone: "success",
        message: `@${profileHandle} was removed from the board for good.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Remove failed.",
      });
    } finally {
      setBusy(null);
      setConfirmRemoveId(null);
    }
  }

  async function syncProfile(profileId: Id<"profiles">) {
    setBusy(profileId);
    setFeedback(null);
    setConfirmRemoveId(null);
    try {
      const result = await refreshOne({ profileId });
      setFeedback({
        tone: result.status === "synced" ? "success" : "error",
        message:
          result.status === "synced"
            ? `@${result.handle} synced ${result.impressions.toLocaleString("en-US")} impressions.`
            : result.message ?? "Sync failed.",
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Sync failed." });
    } finally {
      setBusy(null);
    }
  }

  async function syncEveryone() {
    setBusy("all");
    setFeedback(null);
    try {
      const result = await refreshAll({});
      setFeedback({
        tone: result.failed > 0 ? "info" : "success",
        message: result.missingKey
          ? "Add X_BEARER_TOKEN to Convex before syncing."
          : `Synced ${result.synced} of ${result.processed} active profiles${result.failed ? `; ${result.failed} need attention` : ""}.${result.remainderScheduled ? " The rest of the board is refreshing in the background." : ""}`,
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Sync failed." });
    } finally {
      setBusy(null);
    }
  }

  async function review(profileId: Id<"profiles">, decision: "approved" | "rejected") {
    setBusy(profileId);
    setFeedback(null);
    setConfirmRemoveId(null);
    try {
      await reviewMembership({ profileId, decision });
      setFeedback({
        tone: "success",
        message: decision === "approved" ? "Join request approved." : "Join request declined.",
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Review failed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <p className="eyebrow">Board operations</p>
          <h1>Curate the Convex signal.</h1>
          <p>Add people by X handle, pause profiles, and refresh public seven-day metrics.</p>
        </div>
        <div className="security-banner" role="note">
          <CheckCircleIcon aria-hidden="true" />
          <div>
            <strong>Convex Auth protected</strong>
            <span>Every admin read, write, import, and manual sync checks the X user ID allowlist.</span>
          </div>
          {/* Gift studio, Setup guide, and Sign out moved to the site header. */}
        </div>
      </section>

      <section className="admin-grid">
        <form className="add-handle-panel" onSubmit={submitHandle}>
          <p className="section-kicker">Add to the board</p>
          <label htmlFor="handle">X handle</label>
          <div className="handle-input-row">
            <span aria-hidden="true">@</span>
            <input
              id="handle"
              value={handle}
              onChange={(event) => setHandle(sanitizeHandleInput(event.target.value))}
              placeholder="jamesacowling"
              autoComplete="off"
              required
              pattern="[A-Za-z0-9_]{1,50}"
            />
            <button type="submit" disabled={busy === "add"} title="Add this X handle to the board right away">
              <PlusIcon aria-hidden="true" /> {busy === "add" ? "Adding" : "Add person"}
            </button>
          </div>
          <p className="field-help">The handle is saved immediately. X profile data syncs only when its backend key is configured.</p>
        </form>

        <div className="readiness-panel">
          <p className="section-kicker">Integration status</p>
          <div className="readiness-row">
            {setup?.xApiConfigured ? <CheckCircleIcon aria-hidden="true" /> : <WarningCircleIcon aria-hidden="true" />}
            <span><strong>X API</strong>{setup?.xApiConfigured ? "Ready to sync" : "Key not configured"}</span>
          </div>
          <div className="readiness-row">
            {setup?.authEnabled && setup.adminAllowlistConfigured ? <CheckCircleIcon aria-hidden="true" /> : <WarningCircleIcon aria-hidden="true" />}
            <span><strong>Convex Auth</strong>{setup?.authEnabled && setup.adminAllowlistConfigured ? "X login and allowlist ready" : "Finish X login or allowlist setup"}</span>
          </div>
          {/* Setup guide link hidden for now; the page still lives at /admin/setup.
          <Link className="text-link" to="/admin/setup">Open setup guide</Link> */}
        </div>
      </section>

      <ImportPanel xApiConfigured={Boolean(setup?.xApiConfigured)} />

      <BoardSettings />

      {feedback ? (
        <div className={`feedback-message feedback-${feedback.tone}`} role="status" aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      <section className="admin-list" aria-labelledby="managed-people-title">
        <div className="admin-list-heading">
          <div>
            <p className="eyebrow">Friends on the board</p>
            <h2 id="managed-people-title">{profiles?.length ?? "—"} profiles</h2>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={!setup?.xApiConfigured || busy === "all" || !profiles?.some((profile) => profile.active)}
            title="Re-pulls every active account's recent posts and rescans them for Convex mentions."
            onClick={syncEveryone}
          >
            <ArrowClockwiseIcon aria-hidden="true" /> {busy === "all" ? "Syncing" : "Sync everyone"}
          </button>
        </div>

        <div className="admin-rows">
          {profiles === undefined ? (
            <div className="admin-empty">Loading Convex data…</div>
          ) : profiles.length === 0 ? (
            <div className="admin-empty">Add the first real X handle above. The public board will update in realtime.</div>
          ) : (
            profiles.map((profile) => (
              <article className="admin-row" key={profile._id}>
                <div className="admin-identity">
                  <span className={`status-dot status-${profile.syncStatus}`} aria-hidden="true" />
                  <span>
                    <strong>{profile.displayName}</strong>
                    <a href={`https://x.com/${profile.handle}`} target="_blank" rel="noreferrer noopener">@{profile.handle}</a>
                  </span>
                </div>
                <div className="admin-sync-meta">
                  <strong>{profile.membershipStatus ?? "approved"} · {profile.syncStatus}</strong>
                  <span>{profile.syncError ?? formatSyncTime(profile.lastSyncedAt)}</span>
                </div>
                <div className="admin-actions">
                  {profile.membershipStatus === "pending" ? (
                    <>
                      <button
                        type="button"
                        className="icon-text-button"
                        disabled={busy === profile._id}
                        title="Approve this join request and show them on the public board"
                        onClick={() => review(profile._id, "approved")}
                      >
                        <CheckCircleIcon aria-hidden="true" /> Approve
                      </button>
                      <button
                        type="button"
                        className="icon-text-button"
                        disabled={busy === profile._id}
                        title="Decline this join request; they stay off the public board"
                        onClick={() => review(profile._id, "rejected")}
                      >
                        <PauseCircleIcon aria-hidden="true" /> Decline
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="icon-text-button"
                    disabled={!profile.active || !setup?.xApiConfigured || busy === profile._id}
                    title={RESCAN_TOOLTIP}
                    onClick={() => syncProfile(profile._id)}
                  >
                    <ArrowClockwiseIcon aria-hidden="true" /> Rescan
                  </button>
                  <button
                    type="button"
                    className="icon-text-button"
                    disabled={busy === profile._id}
                    title={
                      profile.active
                        ? "Hide this person from the public board without deleting their history"
                        : "Put this person back on the public board"
                    }
                    onClick={() => toggleProfile(profile._id, !profile.active)}
                  >
                    {profile.active ? <PauseCircleIcon aria-hidden="true" /> : <CheckCircleIcon aria-hidden="true" />}
                    {profile.active ? "Archive" : "Restore"}
                  </button>
                  <button
                    type="button"
                    className={`icon-text-button${confirmRemoveId === profile._id ? " danger" : ""}`}
                    disabled={busy === profile._id}
                    title={
                      confirmRemoveId === profile._id
                        ? `Permanently delete @${profile.handle} and their board history. This cannot be undone.`
                        : "Remove this person from the board for good, including their history"
                    }
                    onClick={() => void removeHandle(profile._id, profile.handle)}
                  >
                    <TrashIcon aria-hidden="true" />
                    {confirmRemoveId === profile._id ? "Confirm" : "Remove"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
