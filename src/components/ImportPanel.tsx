import {
  CheckCircleIcon,
  ListBulletsIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useAction } from "convex/react";
import { FormEvent, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";

type ImportEntry = {
  input: string;
  handle: string;
  xUserId: string | null;
  displayName: string;
  bio: string | null;
  profileImageUrl: string | null;
  followerCount: number;
  status: "valid" | "existing" | "invalid" | "not-found" | "duplicate";
  message: string | null;
};

type ImportSource = "bulk" | "x-list";

export function ImportPanel({ xApiConfigured }: { xApiConfigured: boolean }) {
  const previewHandles = useAction(api.imports.previewHandles);
  const previewXList = useAction(api.imports.previewXList);
  const commitImport = useAction(api.imports.commitImport);
  const [mode, setMode] = useState<ImportSource>("bulk");
  const [value, setValue] = useState("");
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [listNote, setListNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const importable = useMemo(
    () => entries.filter((entry) => entry.status === "valid"),
    [entries],
  );

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("preview");
    setMessage(null);
    setListNote(null);
    try {
      if (mode === "bulk") {
        setEntries(await previewHandles({ text: value }));
      } else {
        const result = await previewXList({ urlOrId: value });
        setEntries(result.entries);
        setListNote(
          `${result.name}: ${result.fetchedCount} of ${result.totalMembers || result.fetchedCount} members checked${result.truncated ? "; first 100 shown" : ""}.`,
        );
      }
    } catch (error) {
      setEntries([]);
      setMessage(error instanceof Error ? error.message : "Could not preview this import.");
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    setBusy("commit");
    setMessage(null);
    try {
      const result = await commitImport({ entries: importable, source: mode });
      setMessage(
        `Import complete: ${result.created} added, ${result.updated} updated, ${result.skipped} skipped.`,
      );
      setEntries([]);
      setValue("");
      setListNote(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not finish this import.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="import-panel" aria-labelledby="import-title">
      <div className="import-heading">
        <div>
          <p className="section-kicker">Batch intake</p>
          <h2 id="import-title">Bring in a group</h2>
        </div>
        <div className="import-tabs" aria-label="Import source">
          <button
            type="button"
            aria-pressed={mode === "bulk"}
            onClick={() => {
              setMode("bulk");
              setEntries([]);
              setMessage(null);
            }}
          >
            <UploadSimpleIcon aria-hidden="true" /> Paste handles
          </button>
          <button
            type="button"
            aria-pressed={mode === "x-list"}
            onClick={() => {
              setMode("x-list");
              setEntries([]);
              setMessage(null);
            }}
          >
            <ListBulletsIcon aria-hidden="true" /> X List URL
          </button>
        </div>
      </div>

      <form className="import-form" onSubmit={preview}>
        <label htmlFor="import-value">
          {mode === "bulk" ? "Handles, separated by spaces or new lines" : "Public X List URL or numeric list ID"}
        </label>
        {mode === "bulk" ? (
          <textarea
            id="import-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={"@jamesacowling\n@convex_dev\nhttps://x.com/example"}
            rows={5}
            required
          />
        ) : (
          <input
            id="import-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="https://x.com/i/lists/1234567890"
            required
          />
        )}
        <div className="import-form-footer">
          <p>Checks up to 100 public accounts before anything is written.</p>
          <button type="submit" disabled={!xApiConfigured || busy !== null}>
            {busy === "preview" ? "Checking" : "Preview import"}
          </button>
        </div>
      </form>

      {listNote ? <p className="import-list-note">{listNote}</p> : null}
      {message ? <p className="feedback-message feedback-info" role="status">{message}</p> : null}

      {entries.length > 0 ? (
        <div className="import-preview">
          <div className="import-preview-heading">
            <span>{importable.length} ready to add</span>
            <button
              type="button"
              className="primary-button"
              disabled={importable.length === 0 || busy !== null}
              onClick={() => void commit()}
            >
              {busy === "commit" ? "Importing" : `Import ${importable.length}`}
            </button>
          </div>
          <div className="import-preview-rows">
            {entries.map((entry, index) => (
              <div className="import-preview-row" key={`${entry.input}-${index}`}>
                {entry.status === "valid" ? (
                  <CheckCircleIcon aria-hidden="true" />
                ) : (
                  <WarningCircleIcon aria-hidden="true" />
                )}
                <span>
                  <strong>{entry.displayName}</strong>
                  <small>@{entry.handle || entry.input}</small>
                </span>
                <span className={`import-status import-status-${entry.status}`}>
                  {entry.status}
                </span>
                <small>{entry.message ?? `${entry.followerCount.toLocaleString("en-US")} followers`}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
