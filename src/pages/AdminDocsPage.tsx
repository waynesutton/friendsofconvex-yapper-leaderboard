import { Link } from "react-router-dom";
import { AdminAccessNote } from "../components/AdminAccessNote";
import { AdminGate } from "../components/AdminGate";
import { usePageTitle } from "../lib/usePageTitle";

// Admin reference page: who can see the admin area, how to grant access, and
// what each admin surface does. Keeps the working pages free of doc copy.
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
            <h1>How the admin area works.</h1>
          </div>
          <p>
            Everything under /admin is protected by Convex Auth and an X user
            ID allowlist. This page explains who gets in, how to add someone,
            and what each admin surface does: board operations, groups, site
            settings, and gifts.
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
                leaderboard shows, and customize the top 3 badges. The Board
                tabs fieldset has two fork toggles: &quot;Show the main Yappers
                tab&quot; and &quot;Show the Convex mentions tab&quot;. Turning
                one off removes that pill from the public board, and direct
                links to a hidden board fall back to the first visible pill. A
                fork running only custom group boards can hide both, but at
                least one visible group must exist first so the board never
                goes blank.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">02</span>
            <div>
              <h2>Groups</h2>
              <p>
                <Link className="text-link" to="/admin/groups">/admin/groups</Link>{" "}
                manages custom boards. Each visible group with at least one
                active member renders as an extra pill on the public
                leaderboard, linkable at ?board=slug. New groups start hidden
                so you can build the member list first, then press Show to
                publish the pill. You can create up to 12 groups, rename them,
                add a description, reorder the pills, show or hide a group,
                and delete one (deleting also removes its memberships). A
                person can sit in more than one group.
              </p>
              <p>
                Members come in two ways. Add them one at a time by X handle
                or from existing profiles, up to 250 per group. Or paste an X
                List URL on the group card and import the whole list: missing
                profiles get created and picked up by the normal X sync, and
                re-running the import is safe because it only adds what
                changed.
              </p>
              <p>
                Each group card also has a Board columns fieldset. By default
                a group board shows the same Posts, Engagements, and
                Impressions columns as the Yappers view in Board settings.
                Toggle any column on the card and that board keeps its own
                set; press Use board defaults to follow the global setting
                again. At least one column must stay visible.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">03</span>
            <div>
              <h2>Public vs internal groups</h2>
              <p>
                Every group is public by default. The &quot;Make
                internal&quot; button on a group card flips it to an
                admin-only board. An internal group keeps every feature
                (members, X List sync, ranking) but its pill renders only for
                signed in admins, marked with a lock icon. Visitors never see
                the pill, the leaderboard query returns an empty board to
                anyone who is not an admin, and the group stays out of
                llms.txt and the sitemaps. Hiding a group wins over internal:
                a hidden internal group shows for no one.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">04</span>
            <div>
              <h2>Site settings</h2>
              <p>
                <Link className="text-link" to="/admin/settings">/admin/settings</Link>{" "}
                (the gear icon in the header) rebrands the whole site in one
                pass: site title, description, community name, board name,
                eyebrow text, header title, and an uploaded logo that replaces
                the Convex wordmark. Changes flow live through the header, the
                board heading, the browser tab title, share text, and llms.txt.
                Clearing a field restores its shipped default, and &quot;Reset
                to defaults&quot; wipes every override and the uploaded logo.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">05</span>
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
            <span className="method-number">06</span>
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
