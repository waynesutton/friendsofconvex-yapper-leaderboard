import {
  CheckIcon,
  CopyIcon,
  TrophyIcon,
  WarningCircleIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";
import { GiftRotor } from "../components/GiftPortal";
import { compactNumber } from "../components/formatters";
import { usePageTitle } from "../lib/usePageTitle";

function formatRetiredDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

// Public champion page for someone retired undefeated. Simple on purpose:
// a stripe card with their face, the reason we hung the jersey, their final
// numbers, and one button to post it on X.
export function RetiredPage() {
  const { handle } = useParams<{ handle: string }>();
  const champion = useQuery(api.profiles.getRetired, { handle: handle ?? "" });
  const branding = useQuery(api.siteSettings.getSiteBranding, {});
  const communityName = branding?.communityName ?? DEFAULT_BRANDING.communityName;
  const [copied, setCopied] = useState(false);

  usePageTitle(champion ? `@${champion.handle} retired undefeated` : "Hall of fame");

  if (champion === undefined) {
    return <div className="gift-portal-state">Loading the hall of fame…</div>;
  }

  if (champion === null) {
    return (
      <section className="gift-portal gift-portal-closed">
        <div className="gift-closed-card">
          <WarningCircleIcon aria-hidden="true" />
          <h1>Nobody has been retired under that handle.</h1>
          <p>They are either still yapping or never made the board.</p>
          <Link className="text-link" to="/">
            Back to the board
          </Link>
        </div>
      </section>
    );
  }

  const shareText = `@${champion.handle} is retiring from the ${communityName} board undefeated. Nobody could catch them.`;

  function postOnX() {
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", shareText);
    intent.searchParams.set("url", window.location.href);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    await copyText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="retired-page">
      <div className="retired-heading">
        <p className="eyebrow">
          <span>{communityName} · hall of fame</span>
        </p>
        <h1>
          Retired undefeated:
          <span className="retired-handle">@{champion.handle}</span>
        </h1>
        <p className="retired-note">
          {champion.retiredNote ??
            "Held the top spot so long that the only fair move was to hang the jersey."}
        </p>
        <p className="retired-date">
          Off the board since {formatRetiredDate(champion.retiredAt)}. Their numbers stay
          exactly where they left them.
        </p>
      </div>

      <div className="retired-card-column">
        <article className="gift-signal-card retired-card">
          <header>
            <div className="gift-card-brand">
              <GiftRotor />
              <span>{communityName}</span>
            </div>
            <span className="retired-card-flag">
              <TrophyIcon aria-hidden="true" /> Undefeated
            </span>
          </header>
          <div className="gift-card-center">
            <div className="gift-portal-identity">
              {champion.profileImageUrl ? (
                <img src={champion.profileImageUrl} alt="" width={52} height={52} />
              ) : (
                <span aria-hidden="true">@</span>
              )}
              <div>
                <strong>{champion.displayName}</strong>
                <span>@{champion.handle}</span>
              </div>
            </div>
            <h2>@{champion.handle}</h2>
            <p>Number one, retired, unbeaten</p>
          </div>
        </article>

        <dl className="retired-stats">
          <div>
            <dt>Posts</dt>
            <dd>{compactNumber(champion.currentPosts)}</dd>
          </div>
          <div>
            <dt>Engagements</dt>
            <dd>{compactNumber(champion.currentEngagements)}</dd>
          </div>
          <div>
            <dt>Impressions</dt>
            <dd>{compactNumber(champion.currentImpressions)}</dd>
          </div>
          <div>
            <dt>Followers</dt>
            <dd>{compactNumber(champion.currentFollowers)}</dd>
          </div>
        </dl>

        <div className="retired-actions">
          <button type="button" className="gift-primary-action" onClick={postOnX}>
            <XLogoIcon aria-hidden="true" /> Post this on X
          </button>
          <button type="button" className="gift-share-action" onClick={() => void copyLink()}>
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <p className="retired-footer-line">
          <a href={`https://x.com/${champion.handle}`} target="_blank" rel="noreferrer noopener">
            Follow @{champion.handle} on X
          </a>{" "}
          ·{" "}
          <Link className="text-link" to="/">
            See who is competing for the crown
          </Link>
        </p>
      </div>
    </section>
  );
}
