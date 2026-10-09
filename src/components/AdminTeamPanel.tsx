import {
  CheckCircleIcon,
  LockKeyIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FormEvent, useDeferredValue, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;
type Candidate =
  | FunctionReturnType<typeof api.admins.searchCandidates>[number]
  | FunctionReturnType<typeof api.admins.lookupHandle>;
type AdminRow = FunctionReturnType<typeof api.admins.list>["admins"][number];

const HANDLE_INPUT = /^@?[A-Za-z0-9_]{1,15}$/;

// Pulls a bare handle out of "@name" or an x.com link; null when it isn't one.
function handleFromInput(value: string): string | null {
  const trimmed = value.trim().split(/[?#]/, 1)[0] ?? "";
  const fromUrl = trimmed.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/i)?.[1];
  const candidate = fromUrl ?? trimmed;
  return HANDLE_INPUT.test(candidate) ? candidate.replace(/^@/, "") : null;
}

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Avatar({ src, name, size = "small" }: { src: string | null; name: string; size?: "small" | "large" }) {
  const className = `team-avatar team-avatar--${size}`;
  if (src) return <img className={className} src={src} alt="" loading="lazy" />;
  return (
    <span className={className} aria-hidden="true">
      {name.replace(/^@/, "").slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

// The /admin/team body: grant and remove admin access without touching env vars.
export function AdminTeamPanel() {
  const data = useQuery(api.admins.list, {});
  const grant = useMutation(api.admins.grant);
  const revoke = useMutation(api.admins.revoke);
  const lookupHandle = useAction(api.admins.lookupHandle);

  const [term, setTerm] = useState("");
  const deferredTerm = useDeferredValue(term.trim());
  const results = useQuery(
    api.admins.searchCandidates,
    deferredTerm ? { term: deferredTerm } : "skip",
  );
  const [pending, setPending] = useState<Candidate | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Remove arms on the first click and only deletes on the second.
  const [confirmRemoveId, setConfirmRemoveId] = useState<Id<"adminGrants"> | null>(null);

  const adminIds = new Set(data?.admins.map((row) => row.xUserId) ?? []);
  const grantedCount = data?.admins.filter((row) => row.tier === "granted").length ?? 0;
  const typedHandle = handleFromInput(term);
  const exactBoardMatch = typedHandle
    ? results?.find((row) => row.handle.toLowerCase() === typedHandle.toLowerCase())
    : undefined;

  async function lookUp(handle: string) {
    setBusy("lookup");
    setFeedback(null);
    setConfirmRemoveId(null);
    try {
      setPending(await lookupHandle({ handle }));
    } catch (error) {
      setPending(null);
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not look up that handle.",
      });
    } finally {
      setBusy(null);
    }
  }

  function choose(candidate: Candidate) {
    setFeedback(null);
    setConfirmRemoveId(null);
    // Board rows synced before X returned an ID need one lookup first.
    if (candidate.xUserId === null) {
      void lookUp(candidate.handle);
      return;
    }
    setPending(candidate);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (exactBoardMatch?.xUserId) {
      choose(exactBoardMatch);
    } else if (typedHandle) {
      void lookUp(typedHandle);
    } else {
      setFeedback({
        tone: "info",
        message: "Pick someone from the results, or type an X handle like @jamesacowling.",
      });
    }
  }

  async function confirmGrant() {
    if (!pending?.xUserId) return;
    setBusy("grant");
    setFeedback(null);
    try {
      const status = await grant({
        xUserId: pending.xUserId,
        handle: pending.handle,
        displayName: pending.displayName,
        profileImageUrl: pending.profileImageUrl,
      });
      setFeedback({
        tone: status === "granted" ? "success" : "info",
        message:
          status === "granted"
            ? `@${pending.handle} is an admin now. They sign in at /admin with X and get in right away.`
            : `@${pending.handle} already has admin access.`,
      });
      setPending(null);
      setTerm("");
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not grant admin access.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: AdminRow) {
    if (!row.grantId) return;
    if (confirmRemoveId !== row.grantId) {
      setConfirmRemoveId(row.grantId);
      setFeedback({
        tone: "info",
        message: `Press Confirm remove to take admin access away from @${row.handle ?? row.xUserId}.`,
      });
      return;
    }
    setBusy(row.grantId);
    setFeedback(null);
    try {
      await revoke({ grantId: row.grantId });
      setFeedback({
        tone: "success",
        message: `@${row.handle ?? row.xUserId} is no longer an admin. Their next request is refused.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not remove admin access.",
      });
    } finally {
      setBusy(null);
      setConfirmRemoveId(null);
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <p className="eyebrow">Admin access</p>
          <h1>Who holds the keys.</h1>
          <p>
            Search the board or type any X handle to make someone an admin. Access starts on their
            next request, no env vars or deploys.
          </p>
        </div>
      </section>

      <section className="admin-grid">
        <form className="add-handle-panel" onSubmit={submitSearch}>
          <p className="section-kicker">Add an admin</p>
          <label htmlFor="admin-team-search">Name, @handle, or x.com link</label>
          <div className="handle-input-row">
            <span className="team-search-icon" aria-hidden="true">
              <MagnifyingGlassIcon />
            </span>
            <input
              id="admin-team-search"
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setPending(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setTerm("");
                  setPending(null);
                }
              }}
              placeholder="Search the board or type @handle"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="admin-team-help"
              aria-controls="admin-team-results"
            />
            <button
              type="submit"
              disabled={busy === "lookup" || !term.trim()}
              title="Pick the exact board match, or find this handle on X"
            >
              <UserPlusIcon aria-hidden="true" />
              {busy === "lookup" ? "Looking up" : exactBoardMatch?.xUserId ? "Select" : "Look up on X"}
            </button>
          </div>
          <p className="field-help" id="admin-team-help">
            Board matches show as you type. Not on the board? Type their handle and press Look up on
            X.
          </p>

          {deferredTerm && !pending ? (
            <ul className="team-results" id="admin-team-results" aria-live="polite">
              {results === undefined ? (
                <li className="team-results-note">Searching the board…</li>
              ) : results.length === 0 ? (
                <li className="team-results-note">
                  Nobody on the board matches.
                  {typedHandle ? ` Press Look up on X to find @${typedHandle}.` : ""}
                </li>
              ) : (
                results.map((row) => {
                  const already = row.xUserId !== null && adminIds.has(row.xUserId);
                  return (
                    <li key={row.handle}>
                      <button
                        type="button"
                        className="team-result"
                        disabled={already || busy !== null}
                        onClick={() => choose(row)}
                        title={
                          already
                            ? "Already an admin"
                            : row.xUserId === null
                              ? "Not synced yet. Clicking looks the handle up on X first."
                              : `Make @${row.handle} an admin`
                        }
                      >
                        <Avatar src={row.profileImageUrl} name={row.displayName} />
                        <span className="team-result-name">
                          <strong>{row.displayName}</strong>
                          <small>@{row.handle}</small>
                        </span>
                        <span className={`team-tag${already ? " team-tag--admin" : ""}`}>
                          {already ? "Admin" : row.xUserId === null ? "Look up" : "On the board"}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}

          {pending ? (
            <div className="team-confirm" role="group" aria-label={`Confirm admin access for @${pending.handle}`}>
              <Avatar src={pending.profileImageUrl} name={pending.displayName} size="large" />
              <div className="team-confirm-body">
                <strong>{pending.displayName}</strong>
                <a href={`https://x.com/${pending.handle}`} target="_blank" rel="noreferrer noopener">
                  @{pending.handle}
                </a>
                <small>
                  {pending.source === "x" ? "Found on X" : "From the board"} · X ID {pending.xUserId}
                </small>
              </div>
              <div className="team-confirm-actions">
                {pending.xUserId && adminIds.has(pending.xUserId) ? (
                  <span className="team-tag team-tag--admin">Already an admin</span>
                ) : (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy !== null}
                    onClick={() => void confirmGrant()}
                    title="They can open every admin page and run every admin action"
                  >
                    <ShieldCheckIcon aria-hidden="true" />
                    {busy === "grant" ? "Granting" : "Grant admin access"}
                  </button>
                )}
                <button type="button" className="secondary-button" onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </form>

        <div className="readiness-panel">
          <p className="section-kicker">Two tiers</p>
          <div className="readiness-row">
            <LockKeyIcon aria-hidden="true" />
            <span>
              <strong>Owners</strong>
              Set in ADMIN_X_USER_IDS. Always admin, only removable in the Convex dashboard.
            </span>
          </div>
          <div className="readiness-row">
            <ShieldCheckIcon aria-hidden="true" />
            <span>
              <strong>Granted</strong>
              Added here by any admin. {grantedCount} of {data?.maxGrants ?? 50} slots used.
            </span>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className={`feedback-message feedback-${feedback.tone}`} role="status" aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      <section className="admin-list" aria-labelledby="admin-team-title">
        <div className="admin-list-heading">
          <div>
            <p className="eyebrow">Current admins</p>
            <h2 id="admin-team-title">
              {data === undefined
                ? "— admins"
                : `${data.admins.length} admin${data.admins.length === 1 ? "" : "s"}`}
            </h2>
          </div>
        </div>

        <div className="admin-rows">
          {data === undefined ? (
            <div className="admin-empty">Loading admins…</div>
          ) : (
            data.admins.map((row) => {
              const label = row.displayName ?? (row.handle ? `@${row.handle}` : `X user ${row.xUserId}`);
              return (
                <article className="admin-row" key={`${row.tier}-${row.xUserId}`}>
                  <div className="admin-identity">
                    <Avatar src={row.profileImageUrl} name={label} />
                    <span>
                      <strong>{label}</strong>
                      {row.handle ? (
                        <a href={`https://x.com/${row.handle}`} target="_blank" rel="noreferrer noopener">
                          @{row.handle}
                        </a>
                      ) : (
                        <span className="team-identity-note">Not signed in yet</span>
                      )}
                    </span>
                  </div>
                  <div className="admin-sync-meta">
                    <strong className={`team-tier team-tier--${row.tier}`}>
                      {row.tier === "owner" ? "Owner · env" : "Granted"}
                    </strong>
                    <span>
                      {row.tier === "owner"
                        ? "Set in ADMIN_X_USER_IDS"
                        : `Added${row.grantedByHandle ? ` by @${row.grantedByHandle}` : ""}${row.grantedAt ? ` · ${formatDate(row.grantedAt)}` : ""}`}
                    </span>
                  </div>
                  <div className="admin-actions">
                    {row.isYou ? <span className="admin-chip">You</span> : null}
                    {row.tier === "owner" ? (
                      <span
                        className="team-locked"
                        title="Owners live in the ADMIN_X_USER_IDS env var. Edit it in the Convex dashboard to remove them."
                      >
                        <LockKeyIcon aria-hidden="true" /> Env managed
                      </span>
                    ) : row.isYou ? null : (
                      <button
                        type="button"
                        className={`icon-text-button${confirmRemoveId === row.grantId ? " danger" : ""}`}
                        disabled={busy === row.grantId}
                        title="Take admin access away. They keep their spot on the board."
                        onClick={() => void remove(row)}
                      >
                        <TrashIcon aria-hidden="true" />
                        {confirmRemoveId === row.grantId ? "Confirm remove" : "Remove"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
        <p className="field-help">
          <CheckCircleIcon aria-hidden="true" className="team-help-icon" /> Every admin read and
          write rechecks this list, so changes apply on the very next request.
        </p>
      </section>
    </div>
  );
}
