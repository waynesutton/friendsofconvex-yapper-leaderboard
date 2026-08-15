import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  CopyIcon,
  DownloadSimpleIcon,
  FloppyDiskIcon,
  GiftIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  PlugIcon,
  ProhibitIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { FormEvent, useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type Feedback = { tone: "success" | "error" | "info"; message: string } | null;

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

// RFC 4180 escaping plus a space guard so spreadsheet apps never treat a
// value like =SUM(...) as a formula.
function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? ` ${value}` : value;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replaceAll('"', '""')}"` : guarded;
}

function csvTime(value: number | null): string {
  return value === null ? "" : new Date(value).toISOString();
}

// Full-campaign CSV so gift status can be shared outside the app.
function buildRecipientCsv(recipients: Array<Doc<"giftRecipients">>): string {
  const header = [
    "gift_number",
    "display_name",
    "handle",
    "status",
    "sent_at",
    "opened_at",
    "redeemed_at",
    "consent_source",
    "dm_opt_out",
    "delivery_error",
    "pass_url",
  ];
  const rows = recipients.map((recipient) =>
    [
      String(recipient.giftNumber ?? 1),
      recipient.displayName,
      `@${recipient.handle}`,
      recipient.status,
      csvTime(recipient.sentAt),
      csvTime(recipient.openedAt),
      csvTime(recipient.redeemedAt),
      recipient.consentSource === "x_account_activity" ? "x_webhook" : "manual",
      recipient.dmSuppressedAt === null ? "no" : "yes",
      recipient.deliveryError ?? "",
      localUrl(`/gift/${recipient.portalToken}`),
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function GiftEventLog({ recipientId }: { recipientId: Id<"giftRecipients"> }) {
  const events = useQuery(api.gifts.listRecipientEventsAdmin, {
    recipientId,
    limit: 50,
  });
  return (
    <ol className="gift-event-log">
      {events === undefined ? (
        <li>Loading event history…</li>
      ) : events.length === 0 ? (
        <li>No events recorded yet.</li>
      ) : (
        events.map((event) => (
          <li key={event._id}>
            <span>{event.type.replaceAll("_", " ")}</span>
            <small>{event.source} · {readableTime(event.createdAt)}</small>
            {event.detail ? <p>{event.detail}</p> : null}
          </li>
        ))
      )}
    </ol>
  );
}

function GiftRecipientRow({
  recipient,
  onFeedback,
}: {
  recipient: Doc<"giftRecipients">;
  onFeedback: (feedback: Feedback) => void;
}) {
  const sendGiftDm = useAction(api.giftActions.sendGiftDm);
  const setDmSuppressed = useMutation(api.gifts.setDmSuppressed);
  const [busy, setBusy] = useState<"send" | "suppress" | null>(null);

  async function copyPortalMessage() {
    const portalUrl = localUrl(`/gift/${recipient.portalToken}`);
    const message = `Your Friends of Convex gift #${recipient.giftNumber ?? 1} is ready. Your personal gift pass is ${portalUrl}`;
    await navigator.clipboard.writeText(message);
    onFeedback({ tone: "success", message: `Copied the DM for @${recipient.handle}.` });
  }

  async function send() {
    setBusy("send");
    onFeedback(null);
    try {
      const result = await sendGiftDm({ recipientId: recipient._id });
      onFeedback({
        tone: "success",
        message:
          result.status === "sent"
            ? `X created gift #${recipient.giftNumber ?? 1} DM for @${recipient.handle}.`
            : `Gift #${recipient.giftNumber ?? 1} for @${recipient.handle} already has a recorded X DM.`,
      });
    } catch (error) {
      onFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not send the X DM.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function toggleSuppressed() {
    setBusy("suppress");
    onFeedback(null);
    try {
      await setDmSuppressed({
        recipientId: recipient._id,
        suppressed: recipient.dmSuppressedAt === null,
      });
      onFeedback({
        tone: "success",
        message:
          recipient.dmSuppressedAt === null
            ? `This gift delivery for @${recipient.handle} is marked as opted out.`
            : `This gift delivery for @${recipient.handle} can be sent again.`,
      });
    } catch (error) {
      onFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not update DM preference.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="gift-recipient-row">
      <div className="gift-recipient-person">
        {recipient.profileImageUrl ? (
          <img src={recipient.profileImageUrl} alt="" width={44} height={44} />
        ) : (
          <span aria-hidden="true">@</span>
        )}
        <div>
          <strong>{recipient.displayName}</strong>
          <a href={`https://x.com/${recipient.handle}`} target="_blank" rel="noreferrer noopener">
            @{recipient.handle}
          </a>
          <small>Gift #{recipient.giftNumber ?? 1}</small>
        </div>
      </div>
      <div className="gift-lifecycle" aria-label={`Gift status ${recipient.status}`}>
        <span className={`gift-status gift-status-${recipient.status}`}>{recipient.status}</span>
        <small>Sent {readableTime(recipient.sentAt)}</small>
        <small>Opened {readableTime(recipient.openedAt)}</small>
        <small>Redeemed {readableTime(recipient.redeemedAt)}</small>
        <small>Consent {recipient.consentSource === "x_account_activity" ? "X webhook" : "manual"}</small>
        {recipient.deliveryError ? <p role="alert">{recipient.deliveryError}</p> : null}
      </div>
      <div className="gift-recipient-actions">
        <button
          type="button"
          className="icon-text-button"
          disabled={busy !== null || recipient.sentAt !== null || recipient.dmSuppressedAt !== null || !recipient.fourthwallUrl}
          title="Send the gift pass by X DM from the connected sender account"
          onClick={() => void send()}
        >
          <PaperPlaneTiltIcon aria-hidden="true" /> {busy === "send" ? "Sending" : "Send X DM"}
        </button>
        <button
          type="button"
          className="icon-text-button"
          title="Copy a ready-to-paste DM with this person's personal gift pass link"
          onClick={() => void copyPortalMessage()}
        >
          <CopyIcon aria-hidden="true" /> Copy DM
        </button>
        <a
          className="icon-text-button"
          href={`/gift/${recipient.portalToken}`}
          target="_blank"
          rel="noreferrer"
          title="Open this person's gift pass page exactly as they will see it"
        >
          <LinkIcon aria-hidden="true" /> Open pass
        </a>
        <button
          type="button"
          className="icon-text-button"
          disabled={busy !== null || recipient.dmSuppressionSource === "x_account_activity"}
          title={
            recipient.dmSuppressionSource === "x_account_activity"
              ? "This person sent STOP by DM, so sends stay blocked until they send GIFT again"
              : "Block or unblock gift DMs for this person"
          }
          onClick={() => void toggleSuppressed()}
        >
          <ProhibitIcon aria-hidden="true" /> {recipient.dmSuppressionSource === "x_account_activity" ? "STOP detected" : recipient.dmSuppressedAt === null ? "Mark opt-out" : "Remove opt-out"}
        </button>
      </div>
      <details className="gift-event-details">
        <summary>Event history</summary>
        <GiftEventLog recipientId={recipient._id} />
      </details>
    </article>
  );
}

export function GiftAdminPanel() {
  const profiles = useQuery(api.profiles.listAdmin, { limit: 200 });
  const campaigns = useQuery(api.gifts.listCampaignsAdmin, { limit: 30 });
  const configuration = useQuery(api.gifts.getConfigurationAdmin, {});
  const giftIntents = useQuery(api.xAccountActivity.listIntentsAdmin, {
    limit: 200,
  });
  const giftHistory = useQuery(api.gifts.listRecentGiftHistoryAdmin, {
    limit: 250,
  });
  const createCampaign = useAction(api.giftActions.createCampaign);
  const syncCampaign = useAction(api.giftActions.syncCampaign);
  const beginXSenderConnection = useAction(api.giftActions.beginXSenderConnection);
  const setupAccountActivity = useAction(api.xAccountActivityActions.setup);
  const productPresets = useQuery(api.gifts.listProductPresetsAdmin, {});
  const saveProductPreset = useMutation(api.gifts.saveProductPreset);
  const deleteProductPreset = useMutation(api.gifts.deleteProductPreset);
  const [chosenCampaignId, setChosenCampaignId] = useState<Id<"giftCampaigns"> | null>(null);
  const selectedCampaignId = chosenCampaignId ?? campaigns?.[0]?._id ?? null;
  const [ledgerSearch, setLedgerSearch] = useState("");
  const trimmedLedgerSearch = ledgerSearch.trim();
  const allRecipients = useQuery(
    api.gifts.listRecipientsAdmin,
    selectedCampaignId ? { campaignId: selectedCampaignId, limit: 200 } : "skip",
  );
  // Convex full text search over handles; only runs while the box has text.
  const searchedRecipients = useQuery(
    api.gifts.searchRecipientsAdmin,
    selectedCampaignId && trimmedLedgerSearch
      ? { campaignId: selectedCampaignId, searchTerm: trimmedLedgerSearch, limit: 100 }
      : "skip",
  );
  const recipients = trimmedLedgerSearch ? searchedRecipients : allRecipients;
  const [title, setTitle] = useState("Friends of Convex gift");
  const [productId, setProductId] = useState("");
  const [presetLabel, setPresetLabel] = useState("");
  const [portalDays, setPortalDays] = useState("30");
  const [selectedProfiles, setSelectedProfiles] = useState<Set<Id<"profiles">>>(new Set());
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [busy, setBusy] = useState<"create" | "connect" | "activity" | "sync" | "preset" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const eligibleProfiles = useMemo(
    () => profiles?.filter((profile) => profile.active && profile.membershipStatus !== "rejected" && profile.xUserId) ?? [],
    [profiles],
  );
  const intentsByXUserId = useMemo(
    () => new Map((giftIntents ?? []).map((intent) => [intent.xUserId, intent])),
    [giftIntents],
  );
  const latestGiftByProfileId = useMemo(
    () =>
      new Map(
        [...(giftHistory ?? [])]
          .reverse()
          .map((gift) => [gift.profileId, gift] as const),
      ),
    [giftHistory],
  );
  const selectedConsentState = useMemo(() => {
    const selected = eligibleProfiles.filter((profile) => selectedProfiles.has(profile._id));
    return {
      manualRequired: selected.some(
        (profile) => {
          if (!profile.xUserId) return true;
          const intent = intentsByXUserId.get(profile.xUserId);
          return (
            intent?.state !== "active" ||
            intent.latestEventId === intent.consumedGiftEventId
          );
        },
      ),
      stopped: selected.find(
        (profile) =>
          profile.xUserId && intentsByXUserId.get(profile.xUserId)?.state === "suppressed",
      ),
    };
  }, [eligibleProfiles, intentsByXUserId, selectedProfiles]);
  const selectedCampaign = campaigns?.find((campaign) => campaign._id === selectedCampaignId) ?? null;
  const counts = useMemo(() => {
    // Totals always reflect the whole campaign, not the current search.
    const values = allRecipients ?? [];
    return {
      total: values.length,
      sent: values.filter((recipient) => recipient.sentAt !== null).length,
      opened: values.filter((recipient) => recipient.openedAt !== null).length,
      redeemed: values.filter((recipient) => recipient.redeemedAt !== null).length,
    };
  }, [allRecipients]);

  function toggleProfile(profileId: Id<"profiles">) {
    setSelectedProfiles((current) => {
      const next = new Set(current);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  async function connectSender() {
    setBusy("connect");
    setFeedback(null);
    try {
      const result = await beginXSenderConnection({});
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not start X sender connection." });
      setBusy(null);
    }
  }

  async function enableAccountActivity() {
    setBusy("activity");
    setFeedback(null);
    try {
      const result = await setupAccountActivity({});
      setFeedback({
        tone: "success",
        message: `X Account Activity is subscribed for sender ${result.senderXUserId}. GIFT and STOP detection is live.`,
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not set up X Account Activity.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setFeedback(null);
    try {
      const result = await createCampaign({
        title,
        fourthwallProductId: productId,
        profileIds: [...selectedProfiles],
        portalDays: Number(portalDays),
        consentConfirmed,
      });
      setChosenCampaignId(result.campaignId);
      setSelectedProfiles(new Set());
      setConsentConfirmed(false);
      setFeedback({
        tone: "success",
        message: `Created ${result.recipientCount} new personal Fourthwall gift passes. Repeat recipients keep a separate delivery history.`,
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not create the gift campaign." });
    } finally {
      setBusy(null);
    }
  }

  async function savePreset() {
    setBusy("preset");
    setFeedback(null);
    try {
      await saveProductPreset({ label: presetLabel, fourthwallProductId: productId });
      setPresetLabel("");
      setFeedback({ tone: "success", message: "Saved this Fourthwall product for one-click reuse." });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not save the product." });
    } finally {
      setBusy(null);
    }
  }

  async function removePreset(presetId: Id<"giftProductPresets">, label: string) {
    setFeedback(null);
    try {
      await deleteProductPreset({ presetId });
      setFeedback({ tone: "success", message: `Removed “${label}” from saved products.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not remove the product." });
    }
  }

  async function syncSelectedCampaign() {
    if (!selectedCampaignId) return;
    setBusy("sync");
    setFeedback(null);
    try {
      const result = await syncCampaign({ campaignId: selectedCampaignId });
      setFeedback({ tone: "success", message: `Fourthwall status checked. ${result.updated} recipient records changed.` });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Could not sync Fourthwall status." });
    } finally {
      setBusy(null);
    }
  }

  function exportLedgerCsv() {
    if (!allRecipients || allRecipients.length === 0) return;
    const campaignSlug = (selectedCampaign?.title ?? "gift-campaign")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${campaignSlug}-recipients-${stamp}.csv`, buildRecipientCsv(allRecipients));
    setFeedback({
      tone: "success",
      message: `Downloaded ${allRecipients.length} recipient${allRecipients.length === 1 ? "" : "s"} as CSV.`,
    });
  }

  async function copyIntentLink() {
    if (!configuration?.sender) return;
    const url = new URL("https://x.com/messages/compose");
    url.searchParams.set("recipient_id", configuration.sender.xUserId);
    url.searchParams.set("text", "GIFT");
    await navigator.clipboard.writeText(url.toString());
    setFeedback({ tone: "success", message: "Copied the consent-first GIFT DM link." });
  }

  return (
    <div className="admin-page gift-admin-page">
      <section className="gift-admin-intro">
        <div>
          <p className="eyebrow">Gift operations</p>
          <h1>Send one-of-one Convex signals.</h1>
          <p>Issue Fourthwall giveaway links, reply by X DM, and track each pass without collecting shipping data.</p>
        </div>
        <div className="gift-admin-links">
          <Link className="text-link" to="/admin/gifts/guide">How to send gifts</Link>
          {/* App setup link hidden for now; the page still lives at /admin/setup.
          <Link className="text-link" to="/admin/setup">App setup</Link> */}
          <a className="text-link" href="https://docs.fourthwall.com/guides/overview" target="_blank" rel="noreferrer noopener">Fourthwall docs</a>
        </div>
      </section>

      <section className="gift-readiness" aria-label="Gift integration status">
        <div>
          {configuration?.fourthwallConfigured ? <CheckCircleIcon aria-hidden="true" /> : <WarningCircleIcon aria-hidden="true" />}
          <span><strong>Fourthwall</strong>{configuration?.fourthwallConfigured ? "API user ready" : "Credentials missing"}</span>
        </div>
        <div>
          {configuration?.sender ? <CheckCircleIcon aria-hidden="true" /> : <WarningCircleIcon aria-hidden="true" />}
          <span><strong>X sender</strong>{configuration?.sender ? `@${configuration.sender.username} connected` : "DM grant not connected"}</span>
        </div>
        <div>
          {configuration?.webhookConfigured ? <CheckCircleIcon aria-hidden="true" /> : <WarningCircleIcon aria-hidden="true" />}
          <span><strong>Redemption webhook</strong>{configuration?.webhookConfigured ? "Signature secret ready" : "Secret missing"}</span>
        </div>
        <div>
          {configuration?.accountActivity?.subscribedAt ? <CheckCircleIcon aria-hidden="true" /> : <WarningCircleIcon aria-hidden="true" />}
          <span><strong>X Account Activity</strong>{configuration?.accountActivity?.subscribedAt ? "Automatic GIFT and STOP live" : configuration?.accountActivityConfigured ? "Ready to register" : "OAuth 1.0a credentials missing"}</span>
        </div>
      </section>

      <section className="gift-sender-panel">
        <div>
          <p className="section-kicker">Consent-first delivery</p>
          <h2>{configuration?.sender ? `Connected as @${configuration.sender.username}` : "Connect the dedicated X sender"}</h2>
          <p>Recipients should send “GIFT” first. Account Activity records consent automatically, and an inbound “STOP” blocks future sends immediately.</p>
          {configuration?.accountActivity?.lastEventAt ? <small>Last X event {readableTime(configuration.accountActivity.lastEventAt)}</small> : null}
          {configuration?.accountActivity?.lastError ? <p className="gift-activity-error" role="alert">{configuration.accountActivity.lastError}</p> : null}
        </div>
        <div className="gift-sender-actions">
          <button type="button" className="secondary-button" disabled={!configuration?.xDmOAuthConfigured || busy === "connect"} title="Authorize the X account that sends gift DMs" onClick={() => void connectSender()}>
            <PlugIcon aria-hidden="true" /> {busy === "connect" ? "Connecting" : configuration?.sender ? "Reconnect sender" : "Connect X sender"}
          </button>
          <button type="button" className="secondary-button" disabled={!configuration?.sender} title="Copy a link that opens a DM to the sender pre-filled with GIFT, for recipients to opt in" onClick={() => void copyIntentLink()}>
            <CopyIcon aria-hidden="true" /> Copy “DM us GIFT” link
          </button>
          <button type="button" className="secondary-button" disabled={!configuration?.sender || !configuration?.accountActivityConfigured || busy === "activity"} title="Register the X webhook that detects GIFT and STOP DMs automatically" onClick={() => void enableAccountActivity()}>
            <ArrowClockwiseIcon aria-hidden="true" /> {busy === "activity" ? "Connecting events" : configuration?.accountActivity?.subscribedAt ? "Recheck X events" : "Enable automatic detection"}
          </button>
        </div>
      </section>

      {feedback ? <div className={`feedback-message feedback-${feedback.tone}`} role="status" aria-live="polite">{feedback.message}</div> : null}

      <section className="gift-studio-grid">
        <form className="gift-campaign-form" onSubmit={submitCampaign}>
          <p className="section-kicker">New dispatch</p>
          <h2>Create personal passes</h2>
          <p className="gift-repeat-note">
            Repeat gifts are supported. Create a new campaign for each dispatch;
            every gift gets its own pass, Fourthwall link, X DM record, and
            redemption history.
          </p>
          <label htmlFor="gift-title">Campaign title</label>
          <input id="gift-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required />
          <label htmlFor="gift-product">Fourthwall product ID</label>
          <input
            id="gift-product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            placeholder="Product UUID from Fourthwall"
            title="Copy the product ID from the Fourthwall dashboard, or pick a saved product below"
            required
          />

          {/* Saved products: click to fill the ID instead of pasting each time. */}
          {productPresets && productPresets.length > 0 ? (
            <div className="gift-preset-list" role="group" aria-label="Saved Fourthwall products">
              {productPresets.map((preset) => (
                <span key={preset._id} className={`gift-preset-chip${preset.fourthwallProductId === productId ? " is-active" : ""}`}>
                  <button
                    type="button"
                    title={`Use product ID ${preset.fourthwallProductId}`}
                    onClick={() => setProductId(preset.fourthwallProductId)}
                  >
                    {preset.label}
                  </button>
                  <button
                    type="button"
                    className="gift-preset-remove"
                    aria-label={`Remove saved product ${preset.label}`}
                    title={`Remove “${preset.label}” from saved products`}
                    onClick={() => void removePreset(preset._id, preset.label)}
                  >
                    <TrashIcon aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="gift-preset-save">
            <input
              value={presetLabel}
              onChange={(event) => setPresetLabel(event.target.value)}
              placeholder="Label to save this product, like Racing tee"
              maxLength={60}
              aria-label="Label for the saved Fourthwall product"
            />
            <button
              type="button"
              className="secondary-button"
              disabled={busy === "preset" || !productId.trim() || !presetLabel.trim()}
              title="Save the product ID above so you can pick it next time instead of pasting"
              onClick={() => void savePreset()}
            >
              <FloppyDiskIcon aria-hidden="true" /> {busy === "preset" ? "Saving" : "Save product"}
            </button>
          </div>

          <label htmlFor="gift-days">Portal access days</label>
          <input id="gift-days" type="number" min={1} max={365} value={portalDays} onChange={(event) => setPortalDays(event.target.value)} required />

          <fieldset className="gift-profile-picker">
            <legend>Approved recipients</legend>
            <p>Automatic X consent appears here after the sender receives “GIFT.” Each detected request can authorize one new delivery; ask for a fresh GIFT before the next one. The manual confirmation remains available as a fallback.</p>
            <div>
              {eligibleProfiles.length === 0 ? <span className="gift-empty">Sync an approved X profile before issuing a gift.</span> : eligibleProfiles.map((profile) => {
                const intent = profile.xUserId ? intentsByXUserId.get(profile.xUserId) : null;
                const latestGift = latestGiftByProfileId.get(profile._id);
                const hasAvailableGift = intent?.state === "active" && intent.latestEventId !== intent.consumedGiftEventId;
                return (
                  <label key={profile._id} htmlFor={`gift-profile-${profile._id}`}>
                    <input id={`gift-profile-${profile._id}`} type="checkbox" checked={selectedProfiles.has(profile._id)} onChange={() => toggleProfile(profile._id)} />
                    <span className="sr-only">Select @{profile.handle}</span>
                    <span>
                      <strong>{profile.displayName}</strong>
                      <small>@{profile.handle}</small>
                      <small className="gift-history-note">
                        {latestGift
                          ? `${latestGift.giftNumber} gift${latestGift.giftNumber === 1 ? "" : "s"} · last ${latestGift.status}`
                          : "No gifts yet"}
                      </small>
                    </span>
                    {intent?.state === "suppressed" ? <em className="gift-consent-state is-stopped">STOP active</em> : hasAvailableGift ? <em className="gift-consent-state is-active">GIFT ready</em> : intent?.state === "active" ? <em className="gift-consent-state is-used">GIFT used</em> : <em className="gift-consent-state">Manual check</em>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="gift-consent-check">
            <input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} />
            <span>I manually confirm that selected people without “GIFT ready” made a new request for this specific gift by DM on X. This never overrides STOP.</span>
          </label>
          {selectedConsentState.stopped ? <p className="gift-consent-warning" role="alert">@{selectedConsentState.stopped.handle} has an active STOP. Ask them to send GIFT again before creating a pass.</p> : null}
          <button type="submit" className="primary-button" title="Create a personal Fourthwall gift pass for every selected person" disabled={busy === "create" || !configuration?.fourthwallConfigured || selectedProfiles.size === 0 || Boolean(selectedConsentState.stopped) || (selectedConsentState.manualRequired && !consentConfirmed)}>
            <GiftIcon aria-hidden="true" /> {busy === "create" ? "Creating passes" : `Create ${selectedProfiles.size || ""} pass${selectedProfiles.size === 1 ? "" : "es"}`}
          </button>
        </form>

        <aside className="gift-campaign-rail" aria-label="Gift campaigns">
          <p className="section-kicker">Dispatches</p>
          <h2>{campaigns?.length ?? "—"} campaigns</h2>
          <div>
            {campaigns === undefined ? <span>Loading campaigns…</span> : campaigns.length === 0 ? <span>No campaigns yet.</span> : campaigns.map((campaign) => (
              <button key={campaign._id} type="button" className={campaign._id === selectedCampaignId ? "is-active" : ""} onClick={() => setChosenCampaignId(campaign._id)}>
                <strong>{campaign.title}</strong>
                <span>{campaign.status} · {readableTime(campaign.createdAt)}</span>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <section className="gift-ledger" aria-labelledby="gift-ledger-title">
        <div className="gift-ledger-heading">
          <div>
            <p className="eyebrow">Recipient ledger</p>
            <h2 id="gift-ledger-title">{selectedCampaign?.title ?? "Choose a campaign"}</h2>
          </div>
          <div className="gift-ledger-tools">
            <div className="gift-ledger-search">
              <MagnifyingGlassIcon aria-hidden="true" />
              <input
                type="search"
                value={ledgerSearch}
                onChange={(event) => setLedgerSearch(event.target.value)}
                placeholder="Search by handle"
                aria-label="Search recipients in this campaign by X handle"
                title="Type an X handle to filter this campaign's recipients"
                disabled={selectedCampaignId === null}
              />
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={!selectedCampaign?.fourthwallPackageId || busy === "sync"}
              title="Ask Fourthwall for the latest open and redeemed status of every pass in this campaign"
              onClick={() => void syncSelectedCampaign()}
            >
              <ArrowClockwiseIcon aria-hidden="true" /> {busy === "sync" ? "Checking" : "Check Fourthwall"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={!allRecipients || allRecipients.length === 0}
              title="Download every recipient in this campaign as a CSV file for sharing outside the app"
              onClick={exportLedgerCsv}
            >
              <DownloadSimpleIcon aria-hidden="true" /> Download CSV
            </button>
          </div>
        </div>
        <div className="gift-count-strip" aria-label="Campaign totals">
          <span><strong>{counts.total}</strong> issued</span>
          <span><strong>{counts.sent}</strong> sent</span>
          <span><strong>{counts.opened}</strong> opened</span>
          <span><strong>{counts.redeemed}</strong> redeemed</span>
        </div>
        <div className="gift-recipient-list">
          {selectedCampaignId === null ? (
            <div className="gift-empty">Create or choose a campaign.</div>
          ) : recipients === undefined ? (
            <div className="gift-empty">Loading recipient records…</div>
          ) : recipients.length === 0 ? (
            <div className="gift-empty">
              {trimmedLedgerSearch
                ? `No recipients match “${trimmedLedgerSearch}” in this campaign.`
                : "No recipients in this campaign."}
            </div>
          ) : (
            recipients.map((recipient) => <GiftRecipientRow key={recipient._id} recipient={recipient} onFeedback={setFeedback} />)
          )}
        </div>
      </section>
    </div>
  );
}
