import { useAuthActions } from "@convex-dev/auth/react";
import { GearSixIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function SiteHeader() {
  const location = useLocation();
  const viewer = useQuery(api.authz.viewer, {});
  const { signOut } = useAuthActions();
  // Falls back to the shipped defaults while loading so the lockup never
  // flashes empty. An untouched deploy renders exactly the prod header.
  const branding = useQuery(api.siteSettings.getSiteBranding, {}) ?? {
    ...DEFAULT_BRANDING,
    hasCustomLogo: false,
    customized: false,
  };

  // Admin controls only render on /admin routes for a signed in admin.
  const onAdminRoute = location.pathname.startsWith("/admin");
  const showAdminNav = onAdminRoute && viewer?.authenticated === true && viewer.isAdmin;

  return (
    <header className="site-header">
      <Link className="brand-lockup" to="/" aria-label={`${branding.communityName} home`}>
        {/* A custom logo from /admin/settings replaces the Convex wordmark. */}
        {branding.hasCustomLogo && branding.logoUrl ? (
          <img className="brand-wordmark" src={branding.logoUrl} alt={branding.communityName} />
        ) : (
          <img className="brand-wordmark" src="/brand/convex-logo-white.svg" alt="Convex" />
        )}
        <span className="studio-brand-mark" aria-hidden="true">
          <span className="brand-chip">F/CVX</span>
          <span className="brand-slash">/</span>
        </span>
        <span className="brand-title-convex">{branding.headerTitle}</span>
        {/* The Studio theme keeps its own default title until branding is customized. */}
        <span className="brand-title-studio">
          {branding.headerTitle === DEFAULT_BRANDING.headerTitle
            ? "Yapper board"
            : branding.headerTitle}
        </span>
      </Link>
      <div className="header-actions">
        {showAdminNav ? (
          <nav className="site-nav" aria-label="Admin navigation">
            <Link to="/admin">Board ops</Link>
            <Link to="/admin/groups">Groups</Link>
            <Link to="/admin/gifts">Gift studio</Link>
            <Link to="/admin/gift-lab">Gift lab</Link>
            <Link to="/admin/gifts/guide">Gifts guide</Link>
            <Link to="/admin/docs">Admin docs</Link>
            <Link
              to="/admin/settings"
              className="nav-settings-link"
              title="Site branding settings"
              aria-label="Site branding settings"
            >
              <GearSixIcon aria-hidden="true" />
            </Link>
            {/* Setup guide link hidden for now; the page still exists at /admin/setup.
            <Link to="/admin/setup">Setup guide</Link> */}
            <span className="header-admin-chip" title={`Signed in as an admin${viewer.xUsername ? ` (@${viewer.xUsername})` : ""}`}>
              Admin{viewer.xUsername ? ` · @${viewer.xUsername}` : ""}
            </span>
            <button type="button" className="nav-signout" onClick={() => void signOut()}>
              Sign out
            </button>
          </nav>
        ) : (
          <nav className="site-nav" aria-label="Primary navigation">
            <Link to="/about">About</Link>
            <Link to="/join">Join the board</Link>
          </nav>
        )}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
