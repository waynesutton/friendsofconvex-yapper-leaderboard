import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  CopyIcon,
  FlaskIcon,
  GiftIcon,
  LinkIcon,
  ProhibitIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { GiftProductShelf, type GiftFeedback } from "./GiftProductShelf";

type LabLink = FunctionReturnType<typeof api.giftLab.listLinksAdmin>[number];

function localUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

function readableTime(value: number | null): string {
  if (value === null) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

// Display status folds in revocation and read-time expiry so the log tells
// the truth without a cron.
function labLinkState(link: LabLink, now: number): string {
  if (link.revokedAt !== null) return "revoked";
  if (link.status !== "redeemed" && link.expiresAt !== null && link.expiresAt <= now) {
    return "expired";
  }
  return link.status;
}

export function GiftLabPanel() {
  const links = useQuery(api.giftLab.listLinksAdmin, { limit: 100 });
  const configuration = useQuery(api.gifts.getConfigurationAdmin, {});
  const productPresets = useQuery(api.gifts.listProductPresetsAdmin, {});
  const createLabLink = useAction(api.giftActions.createLabLink);
  const syncLabLink = useAction(api.giftActions.syncLabLink);
  const revokeLink = useMutation(api.giftLab.revokeLinkAdmin);
  const deleteLink = useMutation(api.giftLab.deleteLinkAdmin);

  const [fullName, setFullName] = useState("");
  const [productId, setProductId] = useState("");
  const [expires, setExpires] = useState(true);
  const [busy, setBusy] = useState<"create" | Id<"giftLabLinks"> | null>(null);
  const [feedback, setFeedback] = useState<GiftFeedback>(null);
  // The most recently generated link so the team can copy it right away.
  const [latestLinkId, setLatestLinkId] = useState<Id<"giftLabLinks"> | null>(null);
  // Two step delete: first click arms, second confirms; other actions disarm.
  const [armedDeleteId, setArmedDeleteId] = useState<Id<"giftLabLinks"> | null>(null);

  // Page load time for read-time expiry labels; server checks stay canonical.
  const [now] = useState(() => Date.now());
  const latestLink = links?.find((link) => link._id === latestLinkId) ?? null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setArmedDeleteId(null);
    setFeedback(null);
    try {
      const result = await createLabLink({
        fullName,
        fourthwallProductId: productId,
        expires,
      });
      setLatestLinkId(result.labLinkId);
      setFullName("");
      setFeedback({
        tone: "success",
        message: `Generated a gift link for ${fullName.trim()}. Copy it from the panel and share it directly.`,
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not generate the gift link." });
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(link: LabLink) {
    await navigator.clipboard.writeText(localUrl(`/gift/for/${link.token}`));
    setFeedback({ tone: "success", message: `Copied the gift link for ${link.fullName}.` });
  }

  async function checkFourthwall(link: LabLink) {
    setBusy(link._id);
    setArmedDeleteId(null);
    setFeedback(null);
    try {
      await syncLabLink({ labLinkId: link._id });
      setFeedback({ tone: "success", message: `Checked Fourthwall for ${link.fullName}'s gift.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not check Fourthwall." });
    } finally {
      setBusy(null);
    }
  }

  async function revoke(link: LabLink) {
    setBusy(link._id);
    setArmedDeleteId(null);
    setFeedback(null);
    try {
      await revokeLink({ labLinkId: link._id });
      setFeedback({ tone: "success", message: `Closed the gift link for ${link.fullName}. The page now shows the closed card.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not close the link." });
    } finally {
      setBusy(null);
    }
  }

  async function remove(link: LabLink) {
    if (armedDeleteId !== link._id) {
      setArmedDeleteId(link._id);
      setFeedback({
        tone: "info",
        message: `Deleting ${link.fullName}'s link permanently removes it and its page. Click Confirm delete to proceed.`,
      });
      return;
    }
    setArmedDeleteId(null);
    setFeedback(null);
    try {
      await deleteLink({ labLinkId: link._id });
      if (latestLinkId === link._id) setLatestLinkId(null);
      setFeedback({ tone: "success", message: `Deleted the gift link for ${link.fullName}.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not delete the link." });
    }
  }

  return (
    <div className="admin-page gift-admin-page">
      <section className="gift-admin-intro">
        <div>
          <p className="eyebrow">Gift lab</p>
          <h1>Create named gift links.</h1>
          <p>
            Mint a personal Fourthwall gift link for a client, customer, or friend who is not on
            the board. Enter a name, pick a product, and copy the link. No DMs, no emails; you
            share the link yourself.
          </p>
        </div>
        <div className="gift-admin-links">
          <Link className="text-link" to="/admin/gifts">Gift studio</Link>
          <a className="text-link" href="https://docs.fourthwall.com/guides/overview" target="_blank" rel="noreferrer noopener">Fourthwall docs</a>
        </div>
      </section>

      <section className="gift-readiness gift-lab-readiness" aria-label="Gift lab integration status">
        <div>
          {configuration?.fourthwallConfigured ? <CheckCircleIcon aria-hidden="true" /> : <WarningCircleIcon aria-hidden="true" />}
          <span><strong>Fourthwall</strong>{configuration?.fourthwallConfigured ? "API user ready" : "Credentials missing"}</span>
        </div>
        <div>
          <FlaskIcon aria-hidden="true" />
          <span><strong>Delivery</strong>Copy the link and share it yourself</span>
        </div>
      </section>

      {feedback ? <div className={`feedback-message feedback-${feedback.tone}`} role="status" aria-live="polite">{feedback.message}</div> : null}

      {/* Same Gift inventory as the studio: products saved here show there. */}
      <GiftProductShelf activeProductId={productId} onUse={setProductId} onFeedback={setFeedback} />

      <section className="gift-studio-grid">
        <form className="gift-campaign-form" onSubmit={(event) => void submit(event)}>
          <p className="section-kicker">New gift link</p>
          <h2>Generate a custom link</h2>
          <p className="gift-repeat-note">
            The recipient page greets the person by name and reveals one Fourthwall gift. Their
            page has no X handle and no public share card.
          </p>
          <label htmlFor="lab-name">Full name</label>
          <input
            id="lab-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Ada Lovelace"
            maxLength={80}
            title="The name shown on the recipient's thank-you page"
            required
          />
          <label htmlFor="lab-product">Fourthwall product ID</label>
          <input
            id="lab-product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            placeholder="Product UUID from Fourthwall"
            title="Copy the product ID from the Fourthwall dashboard, or pick a saved product"
            required
          />
          {productPresets && productPresets.length > 0 ? (
            <div className="gift-preset-list" role="group" aria-label="Saved Fourthwall products">
              {productPresets.map((preset) => (
                <span key={preset._id} className={`gift-preset-chip${preset.fourthwallProductId === productId ? " is-active" : ""}`}>
                  <button
                    type="button"
                    title={
                      preset.productName
                        ? `${preset.productName} · product ID ${preset.fourthwallProductId}`
                        : `Use product ID ${preset.fourthwallProductId}`
                    }
                    onClick={() => setProductId(preset.fourthwallProductId)}
                  >
                    {preset.thumbnailUrl ? (
                      <img className="gift-preset-thumb" src={preset.thumbnailUrl} alt="" loading="lazy" />
                    ) : null}
                    {preset.label}
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <label className="gift-consent-check">
            <input
              type="checkbox"
              checked={expires}
              onChange={(event) => setExpires(event.target.checked)}
            />
            <span>
              Link expires 7 days after it is generated. Uncheck for a link that stays open until
              you close or delete it.
            </span>
          </label>

          <button
            type="submit"
            className="primary-button"
            title="Create one Fourthwall gift link for this person"
            disabled={busy === "create" || !configuration?.fourthwallConfigured || !fullName.trim() || !productId.trim()}
          >
            <GiftIcon aria-hidden="true" /> {busy === "create" ? "Generating link" : "Generate gift link"}
          </button>
        </form>

        <aside className="gift-lab-result" aria-label="Latest generated link">
          <p className="section-kicker">Latest link</p>
          {latestLink ? (
            <>
              <h2>{latestLink.fullName}</h2>
              <p className="gift-lab-result-note">
                {latestLink.expiresAt === null
                  ? "This link never expires."
                  : `Expires ${readableTime(latestLink.expiresAt)}.`}
              </p>
              <div className="gift-lab-link-box">
                <code>{localUrl(`/gift/for/${latestLink.token}`)}</code>
                <button
                  type="button"
                  className="icon-text-button"
                  title="Copy the full gift link"
                  onClick={() => void copyLink(latestLink)}
                >
                  <CopyIcon aria-hidden="true" /> Copy link
                </button>
              </div>
              <a
                className="text-link"
                href={`/gift/for/${latestLink.token}`}
                target="_blank"
                rel="noreferrer"
                title="Open the thank-you page exactly as the person will see it"
              >
                Preview the page
              </a>
            </>
          ) : (
            <>
              <h2>No link yet</h2>
              <p className="gift-lab-result-note">
                Generate a link on the left and it appears here with a copy button. Every link
                you have made stays in the log below.
              </p>
            </>
          )}
        </aside>
      </section>

      <section className="gift-dispatch-log" aria-labelledby="gift-lab-log-title">
        <div className="gift-ledger-heading">
          <div>
            <p className="eyebrow">Gift lab links</p>
            <h2 id="gift-lab-log-title">Every link you have generated</h2>
            <p className="gift-shelf-note">
              Close stops a link from working but keeps the record. Delete removes the link and
              its page for good.
            </p>
          </div>
        </div>
        <div className="gift-dispatch-rows">
          {links === undefined ? (
            <div className="gift-empty">Loading gift links…</div>
          ) : links.length === 0 ? (
            <div className="gift-empty">No gift links yet. Generate one above.</div>
          ) : (
            links.map((link) => {
              const state = labLinkState(link, now);
              const armed = armedDeleteId === link._id;
              const closed = link.revokedAt !== null;
              return (
                <div key={link._id} className={`gift-dispatch-row${closed ? " is-archived" : ""}`}>
                  <div className="gift-dispatch-main">
                    <strong>{link.fullName}</strong>
                    <span>
                      {state} · {readableTime(link.createdAt)} · {link.productName ?? link.fourthwallProductId}
                      {link.expiresAt === null ? " · never expires" : ` · expires ${readableTime(link.expiresAt)}`}
                    </span>
                    <div className="gift-lab-link-box">
                      <code>{localUrl(`/gift/for/${link.token}`)}</code>
                    </div>
                    {link.syncError ? <p className="gift-portal-error" role="alert">{link.syncError}</p> : null}
                  </div>
                  <div className="gift-dispatch-actions">
                    <button
                      type="button"
                      className="icon-text-button"
                      title="Copy the full gift link"
                      onClick={() => void copyLink(link)}
                    >
                      <CopyIcon aria-hidden="true" /> Copy link
                    </button>
                    <a
                      className="icon-text-button"
                      href={`/gift/for/${link.token}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Open this person's thank-you page exactly as they will see it"
                    >
                      <LinkIcon aria-hidden="true" /> Open
                    </a>
                    <button
                      type="button"
                      className="icon-text-button"
                      disabled={busy === link._id || !link.fourthwallPackageId}
                      title="Ask Fourthwall for this gift's latest open or redeemed status"
                      onClick={() => void checkFourthwall(link)}
                    >
                      <ArrowClockwiseIcon aria-hidden="true" /> {busy === link._id ? "Checking" : "Check Fourthwall"}
                    </button>
                    <button
                      type="button"
                      className="icon-text-button"
                      disabled={busy === link._id || closed}
                      title="Stop this link from working; the record stays in the log"
                      onClick={() => void revoke(link)}
                    >
                      <ProhibitIcon aria-hidden="true" /> {closed ? "Closed" : "Close link"}
                    </button>
                    <button
                      type="button"
                      className={`icon-text-button${armed ? " danger" : ""}`}
                      title="Permanently delete this link and its page"
                      onClick={() => void remove(link)}
                    >
                      <TrashIcon aria-hidden="true" /> {armed ? "Confirm delete" : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
