import {
  ArrowRightIcon,
  CheckCircleIcon,
  GiftIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { GiftCountdown, GiftRotor } from "./GiftPortal";

// Closed-state card for invalid, expired, revoked, and cancelled lab links,
// plus the client-side countdown hitting zero.
function GiftLabClosedCard({ message, fullName }: { message: string; fullName: string | null }) {
  return (
    <section className="gift-portal gift-portal-closed">
      <div className="gift-closed-card">
        <WarningCircleIcon aria-hidden="true" />
        <p className="eyebrow">Gift signal closed</p>
        <h1>{message}</h1>
        {fullName ? <p>This gift was reserved for {fullName}.</p> : null}
        <Link className="text-link" to="/">
          Return to the Yapper Board
        </Link>
      </div>
    </section>
  );
}

// Recipient page for a Gift lab link. Same card language as the board gift
// pass, but keyed to a full name instead of an X profile: no handle, no
// avatar, and no public share card.
export function GiftLabPortal({ token }: { token: string }) {
  const [now] = useState(() => Date.now());
  const portal = useQuery(api.giftLab.getLabPortal, { token, now });
  const recordOpen = useMutation(api.giftLab.recordLabOpen);
  const reveal = useMutation(api.giftLab.revealLab);
  const recordFourthwallClick = useMutation(api.giftLab.recordLabFourthwallClick);
  const [busy, setBusy] = useState<"reveal" | "fourthwall" | null>(null);
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Flipped by the countdown when it reaches zero so the page closes itself
  // without a reload. Server mutations enforce the same deadline.
  const [countdownExpired, setCountdownExpired] = useState(false);
  const handleExpired = useCallback(() => setCountdownExpired(true), []);

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

  if (portal === undefined) {
    return <div className="gift-portal-state">Tuning your Convex signal…</div>;
  }

  if (portal.state === "closed") {
    const messages = {
      invalid: "This gift link does not exist.",
      expired: "This gift link has expired.",
      revoked: "This gift link was closed by the Friends of Convex team.",
      cancelled: "Fourthwall marked this giveaway link as cancelled.",
    };
    return <GiftLabClosedCard message={messages[portal.reason]} fullName={portal.fullName} />;
  }

  const isRevealed = revealedUrl !== null || portal.revealed;
  const isRedeemed = portal.status === "redeemed";

  if (countdownExpired && !isRedeemed) {
    return <GiftLabClosedCard message="This gift link has expired." fullName={portal.fullName} />;
  }

  return (
    <section className="gift-portal">
      <div className="gift-portal-copy">
        <p className="eyebrow">Friends of Convex · one of one</p>
        <h1>
          A signal of thanks for
          <span
            className="gift-portal-handle"
            style={{ "--gift-name-length": portal.fullName.length } as CSSProperties}>
            {portal.fullName}
          </span>
        </h1>
        <p>
          This private pass reveals one free Fourthwall gift. Fourthwall collects the shipping
          details only after you continue.
        </p>
        <div className="gift-trust-line">
          <CheckCircleIcon aria-hidden="true" />
          <span>
            The claim button goes directly to fourthwall.com. This page never asks for an address or
            payment method.
          </span>
        </div>
        {portal.expiresAt !== null && !isRedeemed ? (
          <GiftCountdown expiresAt={portal.expiresAt} onExpired={handleExpired} />
        ) : null}
      </div>

      <article className={`gift-signal-card${isRedeemed ? " is-redeemed" : ""}`}>
        <header>
          <div className="gift-card-brand">
            <GiftRotor />
            <span>Friends of Convex</span>
          </div>
        </header>

        <div className="gift-card-center">
          {/* The big name scales down for long names through the same
              container-query variable the board pass uses. */}
          <h2 style={{ "--gift-name-length": portal.fullName.length } as CSSProperties}>
            {portal.fullName}
          </h2>
          <p>{isRedeemed ? "GIFT REDEEMED" : isRevealed ? "GIFT REVEALED" : "READY TO REVEAL"}</p>
        </div>
      </article>

      <div className="gift-portal-actions">
        {isRedeemed ? (
          <div className="gift-redeemed-message">
            <CheckCircleIcon aria-hidden="true" />
            <div>
              <strong>Gift confirmed.</strong>
              <span>Thank you for being a Friend of Convex.</span>
            </div>
          </div>
        ) : isRevealed ? (
          <button
            type="button"
            className="gift-primary-action"
            disabled={busy === "fourthwall"}
            onClick={() => void openFourthwall()}>
            {busy === "fourthwall" ? "Opening Fourthwall" : "Choose your gift on Fourthwall"}{" "}
            <ArrowRightIcon aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="gift-primary-action"
            disabled={busy === "reveal"}
            onClick={() => void revealGift()}>
            <GiftIcon aria-hidden="true" />{" "}
            {busy === "reveal" ? "Revealing your gift" : "Reveal my gift"}
          </button>
        )}
        {feedback ? (
          <p className="gift-portal-error" role="alert">
            {feedback}
          </p>
        ) : null}
      </div>
    </section>
  );
}
