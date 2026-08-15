import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function SiteHeader() {
  const location = useLocation();
  const viewer = useQuery(api.authz.viewer, {});
  const { signOut } = useAuthActions();

  // Admin controls only render on /admin routes for a signed in admin.
  const onAdminRoute = location.pathname.startsWith("/admin");
  const showAdminNav = onAdminRoute && viewer?.authenticated === true && viewer.isAdmin;

  return (
    <header className="site-header">
      <Link className="brand-lockup" to="/" aria-label="Friends of Convex home">
        {/* The official wordmark leads in the Convex theme; the original lockup stays for Studio. */}
        <img className="brand-wordmark" src="/brand/convex-logo-white.svg" alt="Convex" />
        <span className="studio-brand-mark" aria-hidden="true">
          <span className="brand-chip">F/CVX</span>
          <span className="brand-slash">/</span>
        </span>
        <span className="brand-title-convex">Friends who yap</span>
        <span className="brand-title-studio">Yapper board</span>
      </Link>
      <div className="header-actions">
        {showAdminNav ? (
          <nav className="site-nav" aria-label="Admin navigation">
            <Link to="/admin">Board ops</Link>
            <Link to="/admin/gifts">Gift studio</Link>
            <Link to="/admin/gifts/guide">Gifts guide</Link>
            <Link to="/admin/docs">Admin docs</Link>
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
