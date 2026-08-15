import {
  ArrowRightIcon,
  CheckCircleIcon,
  GiftIcon,
  ShareNetworkIcon,
  WarningCircleIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

function GiftRotor() {
  return (
    <div className="gift-rotor" aria-hidden="true">
      <img src="/convex/symbol-color.svg" alt="" />
      <span />
    </div>
  );
}

// The big recipient name scales down for long handles. The CSS variable feeds
// the container-query font-size rule on .gift-card-center h2.
function GiftCardName({ handle }: { handle: string }) {
  const text = `@${handle}`;
  return (
    <h2 style={{ "--gift-name-length": text.length } as CSSProperties}>{text}</h2>
  );
}

function GiftIdentity({
  handle,
  displayName,
  profileImageUrl,
}: {
  handle: string;
  displayName: string;
  profileImageUrl: string | null;
}) {
  return (
    <div className="gift-portal-identity">
      {profileImageUrl ? (
        <img src={profileImageUrl} alt="" width={52} height={52} />
      ) : (
        <span aria-hidden="true">@</span>
      )}
      <div>
        <strong>{displayName}</strong>
        <span>@{handle}</span>
      </div>
    </div>
  );
}

export function GiftPortal({ token }: { token: string }) {
  const [now] = useState(() => Date.now());
  const portal = useQuery(api.gifts.getPortal, { token, now });
  const recordOpen = useMutation(api.gifts.recordOpen);
  const reveal = useMutation(api.gifts.reveal);
  const recordFourthwallClick = useMutation(api.gifts.recordFourthwallClick);
  const [busy, setBusy] = useState<"reveal" | "fourthwall" | null>(null);
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (portal?.state === "active") {
      void recordOpen({ token }).catch(() => undefined);
    }
  }, [portal?.state, recordOpen, token]);

  async function revealGift() {
    setBusy("reveal");
    setFeedback(null);
    try {
      const result = await reveal({ token });
      setRevealedUrl(result.url);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not reveal this gift.");
    } finally {
      setBusy(null);
    }
  }

  async function openFourthwall() {
    setBusy("fourthwall");
    setFeedback(null);
    try {
      const result = await recordFourthwallClick({ token });
      window.location.assign(result.url);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not open Fourthwall.");
      setBusy(null);
    }
  }

  function shareOnX() {
    if (portal?.state !== "active") return;
    const shareUrl = new URL(`/gift/share/${portal.shareToken}`, window.location.origin).toString();
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", `Proud to be a Friend of Convex. @${portal.handle}`);
    intent.searchParams.set("url", shareUrl);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
  }

  if (portal === undefined) {
    return <div className="gift-portal-state">Tuning your Convex signal…</div>;
  }

  if (portal.state === "closed") {
    const messages = {
      invalid: "This gift pass does not exist.",
      expired: "This gift pass has expired.",
      revoked: "This gift pass was closed by the Friends of Convex team.",
      cancelled: "Fourthwall marked this giveaway link as cancelled.",
    };
    return (
      <section className="gift-portal gift-portal-closed">
        <div className="gift-closed-card">
          <WarningCircleIcon aria-hidden="true" />
          <p className="eyebrow">Gift signal closed</p>
          <h1>{messages[portal.reason]}</h1>
          {portal.handle ? <p>This pass was reserved for @{portal.handle}.</p> : null}
          <Link className="text-link" to="/">Return to the Yapper Board</Link>
        </div>
      </section>
    );
  }

  const giftUrl = revealedUrl ?? portal.fourthwallUrl;
  const isRedeemed = portal.status === "redeemed";

  return (
    <section className="gift-portal">
      <div className="gift-portal-copy">
        <p className="eyebrow">Friends of Convex · one of one</p>
        <h1>
          A signal of thanks for
          <span
            className="gift-portal-handle"
            style={{ "--gift-name-length": portal.handle.length + 1 } as CSSProperties}
          >
            @{portal.handle}
          </span>
        </h1>
        <p>This private pass reveals one free Fourthwall gift. Fourthwall collects the shipping details only after you continue.</p>
        <div className="gift-trust-line">
          <CheckCircleIcon aria-hidden="true" />
          <span>The claim button goes directly to fourthwall.com. This page never asks for an address or payment method.</span>
        </div>
      </div>

      <article className={`gift-signal-card${isRedeemed ? " is-redeemed" : ""}`}>
        <header>
          <div className="gift-card-brand">
            <GiftRotor />
            <span>Friends of Convex</span>
          </div>
          <span>PERSONAL PASS / 2026</span>
        </header>

        <div className="gift-card-center">
          <GiftIdentity handle={portal.handle} displayName={portal.displayName} profileImageUrl={portal.profileImageUrl} />
          <GiftCardName handle={portal.handle} />
          <p>{isRedeemed ? "GIFT REDEEMED" : giftUrl ? "GIFT REVEALED" : "READY TO REVEAL"}</p>
        </div>

        <footer>
          <span>{portal.campaignTitle}</span>
          <span>{isRedeemed ? "THANK YOU" : "ONE GIFT / ONE PERSON"}</span>
        </footer>
      </article>

      <div className="gift-portal-actions">
        {isRedeemed ? (
          <div className="gift-redeemed-message">
            <CheckCircleIcon aria-hidden="true" />
            <div><strong>Fourthwall confirmed your gift.</strong><span>Thank you for being a Friend of Convex.</span></div>
          </div>
        ) : giftUrl ? (
          <button type="button" className="gift-primary-action" disabled={busy === "fourthwall"} onClick={() => void openFourthwall()}>
            {busy === "fourthwall" ? "Opening Fourthwall" : "Choose your gift on Fourthwall"} <ArrowRightIcon aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="gift-primary-action" disabled={busy === "reveal"} onClick={() => void revealGift()}>
            <GiftIcon aria-hidden="true" /> {busy === "reveal" ? "Revealing your gift" : "Reveal my gift"}
          </button>
        )}
        <button type="button" className="gift-share-action" onClick={shareOnX}>
          <XLogoIcon aria-hidden="true" /> Share a safe public card <ShareNetworkIcon aria-hidden="true" />
        </button>
        {feedback ? <p className="gift-portal-error" role="alert">{feedback}</p> : null}
      </div>
    </section>
  );
}

export function GiftShareCard({ token }: { token: string }) {
  const card = useQuery(api.gifts.getShareCard, { token });
  if (card === undefined) return <div className="gift-portal-state">Loading public signal…</div>;
  if (card === null) {
    return (
      <section className="gift-portal gift-portal-closed">
        <div className="gift-closed-card">
          <WarningCircleIcon aria-hidden="true" />
          <h1>This public gift card does not exist.</h1>
          <Link className="text-link" to="/">Return to the Yapper Board</Link>
        </div>
      </section>
    );
  }
  return (
    <section className="gift-public-page">
      <div className="gift-public-heading">
        <p className="eyebrow">Friends of Convex · community signal</p>
        <h1>Thank you for being a Friend of Convex.</h1>
        <p>This is the public celebration card. It does not contain a private claim link.</p>
      </div>
      <article className="gift-signal-card gift-public-card">
        <header>
          <div className="gift-card-brand"><GiftRotor /><span>Friends of Convex</span></div>
          <span>COMMUNITY / 2026</span>
        </header>
        <div className="gift-card-center">
          <GiftIdentity handle={card.handle} displayName={card.displayName} profileImageUrl={card.profileImageUrl} />
          <GiftCardName handle={card.handle} />
          <p>{card.redeemed ? "FRIEND + GIFT RECIPIENT" : "FRIEND OF CONVEX"}</p>
        </div>
        <footer><span>{card.campaignTitle}</span><span>BUILT TOGETHER</span></footer>
      </article>
    </section>
  );
}
