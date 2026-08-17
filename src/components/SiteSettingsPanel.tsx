import {
  ArrowCounterClockwiseIcon,
  CheckCircleIcon,
  GearSixIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;
type Branding = FunctionReturnType<typeof api.siteSettings.getSiteBranding>;

type TextFieldKey =
  | "siteTitle"
  | "siteDescription"
  | "communityName"
  | "boardName"
  | "eyebrowText"
  | "headerTitle";

const FIELDS: Array<{ key: TextFieldKey; label: string; help: string }> = [
  {
    key: "communityName",
    label: "Community name",
    help: "The board heading lead, the join page, share text, and llms.txt all use this.",
  },
  {
    key: "boardName",
    label: "Board name",
    help: "The second line of the homepage heading and the share text.",
  },
  {
    key: "headerTitle",
    label: "Header title",
    help: "The short title next to the logo in the site header.",
  },
  {
    key: "siteTitle",
    label: "Site title",
    help: "The browser tab title on the homepage and the llms.txt heading.",
  },
  {
    key: "siteDescription",
    label: "Site description",
    help: "The one-line description in llms.txt.",
  },
  {
    key: "eyebrowText",
    label: "Eyebrow text",
    help: "Reserved for the small hero eyebrow line.",
  },
];

// Branding form, split out so its inputs can initialize from the loaded
// query result. Every field falls back to the shipped default when emptied.
function BrandingForm({ branding }: { branding: Branding }) {
  const setBranding = useMutation(api.siteSettings.setSiteBranding);
  const resetBranding = useMutation(api.siteSettings.resetSiteBranding);
  const generateUploadUrl = useMutation(api.siteSettings.generateLogoUploadUrl);
  const [values, setValues] = useState<Record<TextFieldKey, string>>({
    siteTitle: branding.siteTitle,
    siteDescription: branding.siteDescription,
    communityName: branding.communityName,
    boardName: branding.boardName,
    eyebrowText: branding.eyebrowText,
    headerTitle: branding.headerTitle,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Feedback>(null);
  // Reset arms on the first click and only restores on the second.
  const [confirmReset, setConfirmReset] = useState(false);

  // Values that match the shipped defaults are stored as "use the default"
  // rather than as overrides, so future default updates flow through.
  function toSavedValue(key: TextFieldKey): string {
    const value = values[key].trim();
    return value === DEFAULT_BRANDING[key] ? "" : value;
  }

  async function saveText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setNote(null);
    setConfirmReset(false);
    try {
      await setBranding({
        siteTitle: toSavedValue("siteTitle"),
        siteDescription: toSavedValue("siteDescription"),
        communityName: toSavedValue("communityName"),
        boardName: toSavedValue("boardName"),
        eyebrowText: toSavedValue("eyebrowText"),
        headerTitle: toSavedValue("headerTitle"),
      });
      setNote({
        tone: "success",
        message:
          "Branding saved. The header, board, page title, share text, and llms.txt update live.",
      });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not save the branding.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function uploadLogo() {
    if (!logoFile) return;
    setBusy("logo");
    setNote(null);
    setConfirmReset(false);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": logoFile.type },
        body: logoFile,
      });
      if (!response.ok) throw new Error("The logo upload failed. Try again.");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await setBranding({ logoStorageId: storageId });
      setLogoFile(null);
      setNote({ tone: "success", message: "Logo saved. The header uses it now." });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not save the logo.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function removeLogo() {
    setBusy("logo");
    setNote(null);
    setConfirmReset(false);
    try {
      await setBranding({ logoStorageId: null });
      setNote({ tone: "success", message: "Logo removed. The built-in wordmark is back." });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not remove the logo.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function resetAll() {
    if (!confirmReset) {
      setConfirmReset(true);
      setNote({
        tone: "info",
        message:
          "Press Confirm to clear every override, including the logo, and restore the shipped branding.",
      });
      return;
    }
    setBusy("reset");
    setNote(null);
    try {
      await resetBranding({});
      setValues({
        siteTitle: DEFAULT_BRANDING.siteTitle,
        siteDescription: DEFAULT_BRANDING.siteDescription,
        communityName: DEFAULT_BRANDING.communityName,
        boardName: DEFAULT_BRANDING.boardName,
        eyebrowText: DEFAULT_BRANDING.eyebrowText,
        headerTitle: DEFAULT_BRANDING.headerTitle,
      });
      setNote({ tone: "success", message: "Branding reset to the shipped defaults." });
    } catch (error) {
      setNote({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not reset the branding.",
      });
    } finally {
      setBusy(null);
      setConfirmReset(false);
    }
  }

  return (
    <>
      {/* Live preview of the header lockup and the board heading. */}
      <section className="board-settings" aria-labelledby="branding-preview-title">
        <div className="board-settings-heading">
          <p className="section-kicker">Preview</p>
          <h2 id="branding-preview-title">How it reads</h2>
        </div>
        <div className="branding-preview">
          <div className="branding-preview-header">
            {branding.hasCustomLogo && branding.logoUrl ? (
              <img className="branding-preview-logo" src={branding.logoUrl} alt="" />
            ) : (
              <img
                className="branding-preview-logo"
                src="/brand/convex-logo-white.svg"
                alt=""
              />
            )}
            <strong>{values.headerTitle.trim() || DEFAULT_BRANDING.headerTitle}</strong>
          </div>
          <p className="branding-preview-heading">
            {values.communityName.trim() || DEFAULT_BRANDING.communityName}{" "}
            <span>{values.boardName.trim() || DEFAULT_BRANDING.boardName}</span>
          </p>
          <small>
            Tab title: {values.siteTitle.trim() || DEFAULT_BRANDING.siteTitle}
          </small>
        </div>
      </section>

      <section className="board-settings" aria-labelledby="branding-text-title">
        <div className="board-settings-heading">
          <p className="section-kicker">Names and titles</p>
          <h2 id="branding-text-title">Site text</h2>
          <p>
            Empty fields fall back to the shipped defaults, so you can always type over a value or
            clear it to go back.
          </p>
        </div>
        <form className="branding-form" onSubmit={saveText}>
          {FIELDS.map((field) => (
            <div className="branding-field" key={field.key}>
              <label htmlFor={`branding-${field.key}`}>{field.label}</label>
              <input
                id={`branding-${field.key}`}
                value={values[field.key]}
                maxLength={field.key === "siteDescription" ? 240 : 120}
                placeholder={DEFAULT_BRANDING[field.key]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
              <p className="field-help">{field.help}</p>
            </div>
          ))}
          <button
            type="submit"
            className="primary-button"
            disabled={busy !== null}
            title="Save every text field. Changes apply to the live site immediately."
          >
            <CheckCircleIcon aria-hidden="true" /> {busy === "save" ? "Saving" : "Save branding"}
          </button>
        </form>
      </section>

      <section className="board-settings" aria-labelledby="branding-logo-title">
        <div className="board-settings-heading">
          <p className="section-kicker">Logo</p>
          <h2 id="branding-logo-title">Header logo</h2>
          <p>
            PNG or SVG. It replaces the Convex wordmark in the site header. Remove it to bring the
            wordmark back.
          </p>
        </div>
        <div className="branding-logo-row">
          <input
            type="file"
            accept="image/png,image/svg+xml"
            onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            aria-label="Header logo file"
          />
          <button
            type="button"
            className="secondary-button"
            disabled={!logoFile || busy !== null}
            title="Upload this file and use it as the header logo"
            onClick={() => void uploadLogo()}
          >
            <UploadSimpleIcon aria-hidden="true" /> {busy === "logo" ? "Working" : "Upload logo"}
          </button>
          {branding.hasCustomLogo ? (
            <button
              type="button"
              className="secondary-button"
              disabled={busy !== null}
              title="Remove the uploaded logo and show the built-in wordmark"
              onClick={() => void removeLogo()}
            >
              <TrashIcon aria-hidden="true" /> Remove logo
            </button>
          ) : null}
        </div>
      </section>

      <section className="board-settings" aria-labelledby="branding-reset-title">
        <div className="board-settings-heading">
          <p className="section-kicker">Reset</p>
          <h2 id="branding-reset-title">Back to defaults</h2>
          <p>
            {branding.customized
              ? "This site has custom branding."
              : "This site is on the shipped defaults."}
          </p>
        </div>
        <button
          type="button"
          className={`secondary-button${confirmReset ? " danger" : ""}`}
          disabled={busy === "reset" || !branding.customized}
          title={
            confirmReset
              ? "Clear every branding override, including the logo."
              : "Restore the shipped Friends of Convex branding"
          }
          onClick={() => void resetAll()}
        >
          <ArrowCounterClockwiseIcon aria-hidden="true" />{" "}
          {confirmReset ? "Confirm reset" : "Reset to defaults"}
        </button>
      </section>

      {note ? (
        <div className={`feedback-message feedback-${note.tone}`} role="status" aria-live="polite">
          {note.message}
        </div>
      ) : null}
    </>
  );
}

// The /admin/settings page body: one pass to retitle and relogo the site.
// Static files (index.html meta tags, favicon, OG image) stay a manual edit
// and are documented in the README fork guide.
export function SiteSettingsPanel() {
  const branding = useQuery(api.siteSettings.getSiteBranding, {});

  return (
    <div className="admin-page">
      <section className="admin-intro">
        <div>
          <p className="eyebrow">Site settings</p>
          <h1>
            <GearSixIcon aria-hidden="true" /> Branding.
          </h1>
          <p>
            Change the site title, community name, board name, and logo in one pass. Every field
            defaults to the shipped Friends of Convex look, so nothing breaks if you leave this
            page alone.
          </p>
          <p>
            <Link className="text-link" to="/admin">
              Back to board ops
            </Link>
          </p>
        </div>
      </section>

      {branding === undefined ? (
        <div className="admin-empty">Loading site settings…</div>
      ) : (
        <BrandingForm branding={branding} />
      )}
    </div>
  );
}
