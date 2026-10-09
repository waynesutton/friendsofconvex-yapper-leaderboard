import { useAuthActions } from "@convex-dev/auth/react";
import { GearSixIcon, ListIcon, SignOutIcon, XIcon } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import { useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";
import { useScrollActiveIntoView } from "../lib/useScrollActiveIntoView";
import { ThemeSwitcher } from "./ThemeSwitcher";

// Every admin page, in tab order. `end` matching on each link keeps
// /admin/gifts from lighting up while you are on /admin/gifts/guide.
const ADMIN_LINKS = [
  { to: "/admin", label: "Board ops" },
  { to: "/admin/groups", label: "Groups" },
  { to: "/admin/queue", label: "Mention queue" },
  { to: "/admin/gifts", label: "Gift studio" },
  { to: "/admin/gift-lab", label: "Gift lab" },
  { to: "/admin/gifts/guide", label: "Gifts guide" },
  { to: "/admin/team", label: "Admins" },
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
  // The public menu remembers the path it was opened on, so navigating
  // anywhere closes it without an effect.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null);
  const menuOpen = menuOpenOn === location.pathname;
  const adminTabsRef = useRef<HTMLElement>(null);
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
  const adminHandle = viewer?.authenticated && viewer.xUsername ? viewer.xUsername : null;

  useScrollActiveIntoView(adminTabsRef, "a.active", showAdminNav ? location.pathname : null);

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
          // Identity and session controls; the page links live in the tab row.
          <div className="header-admin-tools">
            <span
              className="header-admin-chip"
              title={`Signed in as an admin${adminHandle ? ` (@${adminHandle})` : ""}`}>
              Admin{adminHandle ? ` · @${adminHandle}` : ""}
            </span>
            <button
              type="button"
              className="nav-signout"
              aria-label="Sign out"
              onClick={() => void signOut()}>
              <SignOutIcon aria-hidden="true" />
              <span className="nav-signout-label">Sign out</span>
            </button>
          </div>
        ) : (
          <nav className="site-nav" aria-label="Primary navigation">
            {PUBLIC_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end>
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
        <ThemeSwitcher />
        {showAdminNav ? null : (
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpenOn(menuOpen ? null : location.pathname)}>
            {menuOpen ? <XIcon aria-hidden="true" /> : <ListIcon aria-hidden="true" />}
          </button>
        )}
      </div>
      {showAdminNav ? (
        // Second row: one tab per admin page. Scrolls sideways when the
        // viewport is narrower than the strip, so it never collapses.
        <nav ref={adminTabsRef} className="admin-tabs" aria-label="Admin navigation">
          {ADMIN_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end>
              {link.label}
            </NavLink>
          ))}
          {/* Setup guide link hidden for now; the page still exists at /admin/setup.
          <NavLink to="/admin/setup" end>Setup guide</NavLink> */}
          <NavLink to="/admin/settings" end className="admin-tabs-settings" title="Site branding settings">
            <GearSixIcon aria-hidden="true" />
            Settings
          </NavLink>
        </nav>
      ) : null}
      {menuOpen && !showAdminNav ? (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Primary navigation">
          {PUBLIC_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end>
              {link.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
