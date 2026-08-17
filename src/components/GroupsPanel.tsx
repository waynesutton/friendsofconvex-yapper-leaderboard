import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretDownIcon,
  CaretUpIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ListBulletsIcon,
  LockSimpleIcon,
  LockSimpleOpenIcon,
  PlusIcon,
  TrashIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;
type AdminGroup = FunctionReturnType<typeof api.groups.listAdmin>[number];
type GroupColumnKey = "posts" | "engagements" | "impressions";

// Mirrors the Yappers view columns in Board settings so both screens use
// the same names for the same table columns.
const GROUP_COLUMN_LABELS: Array<{ key: GroupColumnKey; label: string }> = [
  { key: "posts", label: "Posts" },
  { key: "engagements", label: "Engagements" },
  { key: "impressions", label: "Impressions (7D)" },
];

// Matches the sanitizer on the main admin page so pasted profile links work.
function sanitizeHandleInput(value: string): string {
  let cleaned = value.trim();
  const urlMatch = cleaned.match(/(?:x\.com|twitter\.com)\/(@?[A-Za-z0-9_]+)/i);
  if (urlMatch) {
    cleaned = urlMatch[1];
  }
  return cleaned.replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "");
}

// Member roster plus add-by-handle and X list sync for one group. Rendered
// only while the group card is expanded so the membership query stays lazy.
function GroupMembers({ group }: { group: AdminGroup }) {
  const members = useQuery(api.groups.listMembers, { groupId: group._id });
  const addMemberByHandle = useMutation(api.groups.addMemberByHandle);
  const removeMember = useMutation(api.groups.removeMember);
  const syncFromXList = useAction(api.groups.syncFromXList);
  const [handle, setHandle] = useState("");
  const [listUrl, setListUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Feedback>(null);
  // Removing a member arms on the first click and removes on the second,
  // same pattern as group delete.
  const [confirmRemove, setConfirmRemove] = useState<Id<"groupMemberships"> | null>(null);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("add");
    setNote(null);
    try {
      const result = await addMemberByHandle({ groupId: group._id, handle });
      setHandle("");
      setNote({
        tone: "success",
        message: result.added
          ? result.profileCreated
            ? "Added to the group. They are new to the board, so metrics arrive on the next sync."
            : "Added to the group."
          : "They were already in this group.",
      });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not add this handle.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function drop(membershipId: Id<"groupMemberships">, memberHandle: string) {
    if (confirmRemove !== membershipId) {
      setConfirmRemove(membershipId);
      setNote({
        tone: "info",
        message: `Press Confirm remove to take @${memberHandle} out of this group. They stay on the main board.`,
      });
      return;
    }
    setBusy(membershipId);
    setNote(null);
    try {
      await removeMember({ membershipId });
      setNote({
        tone: "success",
        message: `@${memberHandle} left this group. They stay on the main board.`,
      });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not remove this member.",
      });
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  async function syncList() {
    setBusy("sync");
    setNote(null);
    try {
      const result = await syncFromXList({
        groupId: group._id,
        urlOrId: listUrl.trim() || undefined,
      });
      setListUrl("");
      setNote({
        tone: "success",
        message: `${result.listName}: ${result.addedMembers} added, ${result.alreadyMembers} already in, ${result.createdProfiles} new to the board${result.skipped ? `, ${result.skipped} skipped` : ""}${result.truncated ? ". The list has more than 100 members; the first 100 were checked." : "."}`,
      });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "The list sync failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="group-members">
      <form className="group-member-add" onSubmit={addMember}>
        <label htmlFor={`member-${group._id}`}>Add a member by X handle</label>
        <div className="handle-input-row">
          <span aria-hidden="true">@</span>
          <input
            id={`member-${group._id}`}
            value={handle}
            onChange={(event) => setHandle(sanitizeHandleInput(event.target.value))}
            placeholder="jamesacowling"
            autoComplete="off"
            required
            pattern="[A-Za-z0-9_]{1,50}"
          />
          <button type="submit" disabled={busy === "add"} title="Add this person to the group">
            <PlusIcon aria-hidden="true" /> {busy === "add" ? "Adding" : "Add"}
          </button>
        </div>
        <p className="field-help">
          Handles not on the board yet are added to it automatically, approved and active.
        </p>
      </form>

      <div className="group-list-sync">
        <label htmlFor={`list-${group._id}`}>Import members from an X List</label>
        <input
          id={`list-${group._id}`}
          value={listUrl}
          onChange={(event) => setListUrl(event.target.value)}
          placeholder={
            group.xListId
              ? `Saved list ${group.xListId}; paste a URL to switch lists`
              : "https://x.com/i/lists/1234567890"
          }
        />
        <button
          type="button"
          className="secondary-button"
          disabled={busy === "sync" || (!listUrl.trim() && !group.xListId)}
          title="Fetches up to 100 list members, adds missing people to the board, and puts everyone in this group. Safe to run again."
          onClick={() => void syncList()}
        >
          <ListBulletsIcon aria-hidden="true" />{" "}
          {busy === "sync" ? "Syncing" : group.xListId ? "Re-sync list" : "Import list"}
        </button>
        <p className="field-help">
          The import reads list members from the X API, which needs the X_BEARER_TOKEN
          environment variable set on this Convex deployment. The first import saves the
          list id on this group, so pressing Re-sync list later pulls fresh members
          without pasting the URL again.
        </p>
      </div>

      {note ? (
        <p className={`feedback-message feedback-${note.tone}`} role="status">
          {note.message}
        </p>
      ) : null}

      <div className="admin-rows">
        {members === undefined ? (
          <div className="admin-empty">Loading members…</div>
        ) : members.length === 0 ? (
          <div className="admin-empty">
            No members yet. Add a handle above or import an X list.
          </div>
        ) : (
          members.map((member) => (
            <article className="admin-row" key={member.membershipId}>
              <div className="admin-identity">
                <span className={`status-dot status-${member.syncStatus}`} aria-hidden="true" />
                <span>
                  <strong>{member.displayName}</strong>
                  <a
                    href={`https://x.com/${member.handle}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    @{member.handle}
                  </a>
                </span>
              </div>
              <div className="admin-sync-meta">
                <strong>{member.active ? "active" : "archived"}</strong>
                <span>{member.active ? "Counts toward this group's pill" : "Hidden until restored on the main board"}</span>
              </div>
              <div className="admin-actions">
                <button
                  type="button"
                  className={`icon-text-button${
                    confirmRemove === member.membershipId ? " danger" : ""
                  }`}
                  disabled={busy === member.membershipId}
                  title={
                    confirmRemove === member.membershipId
                      ? "Confirm: remove them from this group. They stay on the main board."
                      : "Remove from this group only; they stay on the main board"
                  }
                  onClick={() => void drop(member.membershipId, member.handle)}
                >
                  <TrashIcon aria-hidden="true" />{" "}
                  {confirmRemove === member.membershipId ? "Confirm remove" : "Remove from group"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

// One expandable card per group: rename, describe, show or hide, reorder,
// delete, and the member roster.
function GroupCard({
  group,
  first,
  last,
  expanded,
  onToggle,
}: {
  group: AdminGroup;
  first: boolean;
  last: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const updateGroup = useMutation(api.groups.update);
  const moveGroup = useMutation(api.groups.move);
  const removeGroup = useMutation(api.groups.remove);
  // Global board settings supply the inherited columns while this group has
  // no override of its own.
  const boardDisplay = useQuery(api.boardSettings.getBoardDisplay, {});
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Feedback>(null);
  // Delete arms on the first click and only removes on the second.
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setNote(null);
    try {
      await updateGroup({
        groupId: group._id,
        name,
        description: description.trim() || null,
      });
      setNote({ tone: "success", message: "Group saved." });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not save this group.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleVisible() {
    setBusy("visible");
    setNote(null);
    try {
      await updateGroup({ groupId: group._id, visible: !group.visible });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not update visibility.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleInternal() {
    setBusy("internal");
    setNote(null);
    try {
      await updateGroup({ groupId: group._id, internal: !group.internal });
      setNote({
        tone: "success",
        message: group.internal
          ? "This board is public again. Everyone can see its pill."
          : "This board is now internal. Only signed in admins see its pill, and it stays out of llms.txt and the sitemaps.",
      });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not update the internal flag.",
      });
    } finally {
      setBusy(null);
    }
  }

  // The columns this board actually shows right now: the group override if
  // one exists, otherwise the global Yappers view columns.
  const inheritedColumns = boardDisplay?.yappersColumns ?? {
    posts: true,
    engagements: true,
    impressions: true,
  };
  const effectiveColumns = group.columns ?? inheritedColumns;
  const hasColumnOverride = group.columns !== null;

  async function toggleColumn(key: GroupColumnKey) {
    const next = { ...effectiveColumns, [key]: !effectiveColumns[key] };
    if (!Object.values(next).some(Boolean)) {
      setNote({
        tone: "error",
        message: "Keep at least one column visible on this board.",
      });
      return;
    }
    setBusy("columns");
    setNote(null);
    try {
      // Any toggle materializes the override, even if it matches the
      // defaults, so later global changes stop affecting this board.
      await updateGroup({ groupId: group._id, columns: next });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not update the columns.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function resetColumns() {
    setBusy("columns");
    setNote(null);
    try {
      await updateGroup({ groupId: group._id, columns: null });
      setNote({
        tone: "success",
        message: "This board follows the Yappers view columns from Board settings again.",
      });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not reset the columns.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function move(direction: "up" | "down") {
    setBusy(direction);
    try {
      await moveGroup({ groupId: group._id, direction });
    } finally {
      setBusy(null);
    }
  }

  async function destroy() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setNote({
        tone: "info",
        message:
          "Press Confirm to delete this group and its memberships. People stay on the main board.",
      });
      return;
    }
    setBusy("delete");
    setNote(null);
    try {
      await removeGroup({ groupId: group._id });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not delete this group.",
      });
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  return (
    <article className="group-card" data-expanded={expanded || undefined}>
      <header className="group-card-header">
        <button
          type="button"
          className="group-card-toggle"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <UsersThreeIcon aria-hidden="true" />
          <span className="group-card-name">
            <strong>{group.name}</strong>
            <small>
              /?board={group.slug} · {group.activeMemberCount} active of {group.memberCount}{" "}
              members · {group.visible ? "shown" : "hidden"}
              {group.internal ? " · internal (admins only)" : ""}
              {group.visible && group.activeMemberCount === 0
                ? " (pill hidden until a member is active)"
                : ""}
            </small>
          </span>
          {expanded ? <CaretUpIcon aria-hidden="true" /> : <CaretDownIcon aria-hidden="true" />}
        </button>
        <div className="admin-actions">
          <button
            type="button"
            className="icon-text-button"
            disabled={first || busy !== null}
            title="Move this pill one spot left on the public board"
            onClick={() => void move("up")}
          >
            <ArrowUpIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-text-button"
            disabled={last || busy !== null}
            title="Move this pill one spot right on the public board"
            onClick={() => void move("down")}
          >
            <ArrowDownIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-text-button"
            disabled={busy !== null}
            title={
              group.visible
                ? "Hide this group's pill from the public board"
                : "Show this group's pill on the public board"
            }
            onClick={() => void toggleVisible()}
          >
            {group.visible ? (
              <EyeSlashIcon aria-hidden="true" />
            ) : (
              <EyeIcon aria-hidden="true" />
            )}
            {group.visible ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            className="icon-text-button"
            disabled={busy !== null}
            title={
              group.internal
                ? "Make this board public: everyone sees its pill and it joins llms.txt and the sitemaps"
                : "Make this board internal: only signed in admins see its pill, blocked for everyone else, out of llms.txt and the sitemaps"
            }
            onClick={() => void toggleInternal()}
          >
            {group.internal ? (
              <LockSimpleOpenIcon aria-hidden="true" />
            ) : (
              <LockSimpleIcon aria-hidden="true" />
            )}
            {group.internal ? "Make public" : "Make internal"}
          </button>
          <button
            type="button"
            className={`icon-text-button${confirmDelete ? " danger" : ""}`}
            disabled={busy === "delete"}
            title={
              confirmDelete
                ? "Permanently delete this group and its memberships."
                : "Delete this group. Members stay on the main board."
            }
            onClick={() => void destroy()}
          >
            <TrashIcon aria-hidden="true" /> {confirmDelete ? "Confirm" : "Delete"}
          </button>
        </div>
      </header>

      {note ? (
        <p className={`feedback-message feedback-${note.tone}`} role="status">
          {note.message}
        </p>
      ) : null}

      {expanded ? (
        <div className="group-card-body">
          <form className="group-detail-form" onSubmit={saveDetails}>
            <label htmlFor={`name-${group._id}`}>Group name</label>
            <input
              id={`name-${group._id}`}
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <label htmlFor={`description-${group._id}`}>Description (optional)</label>
            <input
              id={`description-${group._id}`}
              value={description}
              maxLength={200}
              placeholder="Shows in llms.txt and sitemap.md"
              onChange={(event) => setDescription(event.target.value)}
            />
            <button
              type="submit"
              className="secondary-button"
              disabled={busy === "save"}
              title="Save the name and description. Renaming updates the pill label and its /?board= link."
            >
              <CheckCircleIcon aria-hidden="true" /> {busy === "save" ? "Saving" : "Save details"}
            </button>
          </form>
          <div className="board-column-settings group-column-settings">
            <fieldset disabled={busy === "columns"}>
              <legend>
                Board columns · {hasColumnOverride ? "custom" : "board defaults"}
              </legend>
              {GROUP_COLUMN_LABELS.map(({ key, label }) => (
                <label
                  key={key}
                  title={`Show or hide the ${label} column on this group's board`}
                >
                  <input
                    type="checkbox"
                    checked={effectiveColumns[key]}
                    onChange={() => void toggleColumn(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
              {hasColumnOverride ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy === "columns"}
                  title="Drop this board's custom columns and follow the Yappers view columns from Board settings"
                  onClick={() => void resetColumns()}
                >
                  Use board defaults
                </button>
              ) : null}
            </fieldset>
          </div>
          <GroupMembers group={group} />
        </div>
      ) : null}
    </article>
  );
}

// The /admin/groups page body: create groups, then manage each one. Every
// visible group with at least one active member becomes a pill on the public
// board, next to Yappers and Convex mentions.
export function GroupsPanel() {
  const groups = useQuery(api.groups.listAdmin, {});
  const createGroup = useMutation(api.groups.create);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [expandedId, setExpandedId] = useState<Id<"groups"> | null>(null);

  async function submitGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const groupId = await createGroup({ name });
      setName("");
      setExpandedId(groupId);
      setFeedback({
        tone: "success",
        message:
          "Group created hidden. Add members below, then press Show to put its pill on the public board.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not create this group.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <p className="eyebrow">Board operations</p>
          <h1>Custom groups.</h1>
          <p>
            Spotlight a team, a conference, or any circle as its own leaderboard pill. Groups rank
            with the standard Yappers scoring and show up in llms.txt and sitemap.md.
          </p>
          <p>
            <Link className="text-link" to="/admin">
              Back to board ops
            </Link>
          </p>
        </div>
      </section>

      <section className="admin-grid">
        <form className="add-handle-panel" onSubmit={submitGroup}>
          <p className="section-kicker">New group</p>
          <label htmlFor="group-name">Group name</label>
          <div className="handle-input-row">
            <input
              id="group-name"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="Convex team"
              autoComplete="off"
              required
            />
            <button type="submit" disabled={busy} title="Create this group">
              <PlusIcon aria-hidden="true" /> {busy ? "Creating" : "Create group"}
            </button>
          </div>
          <p className="field-help">
            The pill label on the public board. The URL slug is generated from it.
          </p>
        </form>

        <div className="readiness-panel">
          <p className="section-kicker">How pills work</p>
          <div className="readiness-row">
            <CheckCircleIcon aria-hidden="true" />
            <span>
              <strong>Visible + 1 active member</strong>A group&apos;s pill only renders when the
              group is shown and at least one member is active on the board. New groups start
              hidden; press Show when the member list is ready.
            </span>
          </div>
          <div className="readiness-row">
            <CheckCircleIcon aria-hidden="true" />
            <span>
              <strong>Shareable</strong>Each pill has its own link: /?board=slug.
            </span>
          </div>
          <div className="readiness-row">
            <CheckCircleIcon aria-hidden="true" />
            <span>
              <strong>Internal option</strong>Mark a board internal and only signed in admins see
              its pill. Everyone else is blocked and it stays out of llms.txt and the sitemaps.
            </span>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className={`feedback-message feedback-${feedback.tone}`} role="status" aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      <section className="admin-list" aria-labelledby="groups-title">
        <div className="admin-list-heading">
          <div>
            <p className="eyebrow">Groups</p>
            <h2 id="groups-title">{groups?.length ?? "—"} groups</h2>
          </div>
        </div>
        <div className="groups-list">
          {groups === undefined ? (
            <div className="admin-empty">Loading groups…</div>
          ) : groups.length === 0 ? (
            <div className="admin-empty">
              No groups yet. Create one above; the public board keeps its Yappers and Convex
              mentions pills either way.
            </div>
          ) : (
            groups.map((group, index) => (
              <GroupCard
                key={group._id}
                group={group}
                first={index === 0}
                last={index === groups.length - 1}
                expanded={expandedId === group._id}
                onToggle={() => setExpandedId(expandedId === group._id ? null : group._id)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
