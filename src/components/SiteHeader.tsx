import { useAuthActions } from "@convex-dev/auth/react";
import { GearSixIcon, ListIcon, XIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";
import { ThemeSwitcher } from "./ThemeSwitcher";

// One list per audience so the desktop nav and the mobile menu never drift.
const ADMIN_LINKS = [
  { to: "/admin", label: "Board ops" },
  { to: "/admin/groups", label: "Groups" },
  { to: "/admin/gifts", label: "Gift studio" },
  { to: "/admin/gift-lab", label: "Gift lab" },
  { to: "/admin/gifts/guide", label: "Gifts guide" },
  { to: "/admin/docs", label: "Admin docs" },
] as const;

const PUBLIC_LINKS = [
  { to: "/about", label: "About" },
  { to: "/join", label: "Join the board" },
] as const;

export function SiteHeader() {
  const location = useLocation();
  const viewer = useQuery(api.authz.viewer, {});
  const { signOut } = useAuthActions();
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Navigating anywhere closes the mobile menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={`site-header${showAdminNav ? " site-header--admin" : ""}`}>
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
            {ADMIN_LINKS.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
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
            {PUBLIC_LINKS.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        <ThemeSwitcher />
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <XIcon aria-hidden="true" /> : <ListIcon aria-hidden="true" />}
        </button>
      </div>
      {menuOpen ? (
        <nav
          id="mobile-nav"
          className="mobile-nav"
          aria-label={showAdminNav ? "Admin navigation" : "Primary navigation"}
        >
          {(showAdminNav ? ADMIN_LINKS : PUBLIC_LINKS).map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
          {showAdminNav ? (
            <>
              <Link to="/admin/settings" className="mobile-nav-settings">
                <GearSixIcon aria-hidden="true" />
                Site settings
              </Link>
              <div className="mobile-nav-footer">
                <span className="header-admin-chip">
                  Admin{viewer?.authenticated && viewer.xUsername ? ` · @${viewer.xUsername}` : ""}
                </span>
                <button type="button" className="nav-signout" onClick={() => void signOut()}>
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
