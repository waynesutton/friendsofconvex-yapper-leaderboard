import {
  DiscordLogoIcon,
  GithubLogoIcon,
  LinkedinLogoIcon,
  XLogoIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";

const SOCIAL_LINKS = [
  {
    href: "https://www.convex.dev/",
    label: "Convex.dev",
    icon: "convex" as const,
  },
  {
    href: "https://x.com/convex",
    label: "Convex on X",
    icon: "x" as const,
  },
  {
    href: "https://www.linkedin.com/company/convex-dev",
    label: "Convex on LinkedIn",
    icon: "linkedin" as const,
  },
  {
    href: "https://www.youtube.com/@convex-dev",
    label: "Convex on YouTube",
    icon: "youtube" as const,
  },
  {
    href: "https://www.convex.dev/community",
    label: "Convex Discord community",
    icon: "discord" as const,
  },
  {
    href: "https://github.com/get-convex",
    label: "Convex on GitHub",
    icon: "github" as const,
  },
] as const;

function SocialIcon({ icon }: { icon: (typeof SOCIAL_LINKS)[number]["icon"] }) {
  if (icon === "convex") {
    return (
      <img className="convex-mark" src="/convex/symbol-color.svg" alt="" width={16} height={16} />
    );
  }

  const phosphor = {
    x: XLogoIcon,
    linkedin: LinkedinLogoIcon,
    youtube: YoutubeLogoIcon,
    discord: DiscordLogoIcon,
    github: GithubLogoIcon,
  }[icon];
  const Icon = phosphor;

  return <Icon aria-hidden="true" size={16} />;
}

export function BuiltWithFooter() {
  return (
    <>
      {/* Optional attribution: users or agents may remove this BuiltWithFooter and the public/built-with logo assets without affecting app functionality. */}
      <footer
        className="site-footer"
        data-built-with-cursor-convex
        aria-label="Built with Cursor and Convex">
        <div className="footer-primary">
          <div className="footer-built-with">
            <span>Built with</span>
            <a
              href="https://cursor.com/"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Learn about Cursor">
              <img className="cursor-logomark" src="/built-with/cursor.svg" alt="Cursor" />
            </a>
            <span aria-hidden="true">+</span>
            <a
              href="https://www.convex.dev/"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Visit Convex">
              <img className="convex-wordmark" src="/built-with/convex-color.svg" alt="Convex" />
            </a>
          </div>
          <div className="footer-credits">
            <a
              className="footer-source"
              href="https://github.com/waynesutton/friendsofconvex-yapper-leaderboard"
              target="_blank"
              rel="noreferrer noopener">
              open source yapper board
            </a>
            <a className="footer-source" href="/llms.txt">
              llms.txt
            </a>
            <a className="footer-source" href="/sitemap.md">
              sitemap.md
            </a>
          </div>
        </div>
        <div className="footer-links">
          <Link to="/about">Methodology</Link>
          <Link to="/join">Join the board</Link>
          <nav className="footer-socials" aria-label="Convex on the web">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={link.label}>
                <SocialIcon icon={link.icon} />
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
