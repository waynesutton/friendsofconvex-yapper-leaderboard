import { Link } from "react-router-dom";
import { AdminAccessNote } from "../components/AdminAccessNote";
import { AdminGate } from "../components/AdminGate";
import { usePageTitle } from "../lib/usePageTitle";

// Admin reference page: who can see the admin area, how to grant access, and
// where each admin surface lives. Keeps the working pages free of doc copy.
export function AdminDocsPage() {
  usePageTitle("Admin docs");
  return (
    <AdminGate redirectTo="/admin/docs">
      <div className="editorial-page setup-page">
        <Link className="text-link setup-back-link" to="/admin">
          Back to Board operations
        </Link>

        <header className="editorial-hero">
          <div className="editorial-title">
            <p className="eyebrow">Admin docs</p>
            <h1>How admin access works.</h1>
          </div>
          <p>
            Everything under /admin is protected by Convex Auth and an X user
            ID allowlist. This page explains who gets in, how to add someone,
            and what each admin surface does.
          </p>
        </header>

        <AdminAccessNote />

        <div className="setup-steps">
          <section>
            <span className="method-number">01</span>
            <div>
              <h2>Board operations</h2>
              <p>
                <Link className="text-link" to="/admin">/admin</Link> is where
                you add people by X handle, approve join requests, pause or
                restore profiles, run X syncs, pick which columns the public
                leaderboard shows, and customize the top 3 badges.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">02</span>
            <div>
              <h2>Gift studio</h2>
              <p>
                <Link className="text-link" to="/admin/gifts">/admin/gifts</Link>{" "}
                sends one-of-one Fourthwall gift passes by X DM and tracks each
                pass from sent to redeemed. The full plain language walkthrough
                lives at{" "}
                <Link className="text-link" to="/admin/gifts/guide">
                  /admin/gifts/guide
                </Link>
                .
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">03</span>
            <div>
              <h2>Revoking access</h2>
              <p>
                Remove a person&apos;s X user ID from{" "}
                <code>ADMIN_X_USER_IDS</code> in the Convex dashboard and save.
                Every admin read and write rechecks the allowlist, so access
                ends immediately. No deploy needed.
              </p>
            </div>
          </section>
        </div>
      </div>
    </AdminGate>
  );
}
