import {
  CheckIcon,
  CopyIcon,
  CrownSimpleIcon,
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

function formatLegendDate(timestamp: number): string {
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

// Public page for a legend: someone who held number one long enough that we
// took them out of the race. Simple on purpose: a stripe card with their face,
// the reason, their career numbers, and one button to post it on X. Only posts
// and followers show here; engagements and impressions are race metrics and
// this page is the opposite of a race.
export function LegendPage() {
  const { handle } = useParams<{ handle: string }>();
  const legend = useQuery(api.profiles.getLegend, { handle: handle ?? "" });
  const branding = useQuery(api.siteSettings.getSiteBranding, {});
  const communityName = branding?.communityName ?? DEFAULT_BRANDING.communityName;
  const [copied, setCopied] = useState(false);

  usePageTitle(legend ? `@${legend.handle}, undefeated legend` : "Legends");

  if (legend === undefined) {
    return <div className="gift-portal-state">Loading the legend…</div>;
  }

  if (legend === null) {
    return (
      <section className="gift-portal gift-portal-closed">
        <div className="gift-closed-card">
          <WarningCircleIcon aria-hidden="true" />
          <h1>No legend under that handle.</h1>
          <p>They are either still yapping or never made the board.</p>
          <Link className="text-link" to="/">
            Back to the board
          </Link>
        </div>
      </section>
    );
  }

  const shareText = `@${legend.handle} is leaving the ${communityName} board undefeated. Legend status. Nobody could catch them.`;

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
    <section className="legend-page">
      <div className="legend-heading">
        <p className="eyebrow">
          <span>{communityName} · legends</span>
        </p>
        <h1>
          Undefeated legend:
          <span className="legend-handle">@{legend.handle}</span>
        </h1>
        <p className="legend-note">
          {legend.legendNote ??
            "Held the top spot so long that the only fair move was to hang the jersey."}
        </p>
        <p className="legend-date">
          A legend since {formatLegendDate(legend.legendAt)}. Off the board, in the
          record books.
        </p>
      </div>

      <div className="legend-card-column">
        <article className="gift-signal-card legend-card">
          <header>
            <div className="gift-card-brand">
              <GiftRotor />
              <span>{communityName}</span>
            </div>
            <span className="legend-card-flag">
              <CrownSimpleIcon aria-hidden="true" /> Undefeated
            </span>
          </header>
          <div className="gift-card-center">
            <div className="gift-portal-identity">
              {legend.profileImageUrl ? (
                <img src={legend.profileImageUrl} alt="" width={52} height={52} />
              ) : (
                <span aria-hidden="true">@</span>
              )}
              <div>
                <strong>{legend.displayName}</strong>
                <span>@{legend.handle}</span>
              </div>
            </div>
            <h2>@{legend.handle}</h2>
            <p>Number one, unbeaten, legend</p>
          </div>
        </article>

        <dl className="legend-stats">
          <div>
            <dt>Posts</dt>
            <dd>{compactNumber(legend.currentPosts)}</dd>
          </div>
          <div>
            <dt>Followers</dt>
            <dd>{compactNumber(legend.currentFollowers)}</dd>
          </div>
        </dl>

        <div className="legend-actions">
          <button type="button" className="gift-primary-action" onClick={postOnX}>
            <XLogoIcon aria-hidden="true" /> Post this on X
          </button>
          <button type="button" className="gift-share-action" onClick={() => void copyLink()}>
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <p className="legend-footer-line">
          <a href={`https://x.com/${legend.handle}`} target="_blank" rel="noreferrer noopener">
            Follow @{legend.handle} on X
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
