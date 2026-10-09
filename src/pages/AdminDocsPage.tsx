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
            and what each admin surface does: board operations, groups, retire
            mode, site settings, and gifts.
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
                leaderboard shows, and customize the top 3 badges. The Friends
                on the board list has a name and @handle search so you can find
                one person without scrolling the whole roster. The Board
                tabs fieldset has two fork toggles: &quot;Show the main Yappers
                tab&quot; and &quot;Show the Convex mentions tab&quot;. Turning
                one off removes that pill from the public board, and direct
                links to a hidden board fall back to the first visible pill. A
                fork running only custom group boards can hide both, but at
                least one visible group must exist first so the board never
                goes blank.
              </p>
              <p>
                Post on X and Share freeze the top 5 of whatever tab is open
                (Yappers, Convex mentions, a group, or Legends) into a short
                /b/ link. The X card for that link is a rendered image of
                those rows with the time of the last sync, so the post shows
                the ranking when it was shared, not whatever it says later.
                Posting an unchanged board again reuses the same link.
                Internal groups and hidden tabs never get a card; those
                buttons share the plain board link instead. Copy link always
                copies the live board.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">02</span>
            <div>
              <h2>Mention queue</h2>
              <p>
                <Link className="text-link" to="/admin/queue">/admin/queue</Link>{" "}
                lists people who mentioned @convex on X at least twice in the
                last 30 days and are not on the board yet, newest mention
                first. It shows 30 people at a time with Load more. Each row
                links to their two latest mentions so you can read them before
                deciding. Add to board puts them on the main Yappers board and
                syncs their metrics right away. Dismiss hides them from the
                queue for good, and the Dismissed tab has Restore.
              </p>
              <p>
                Automatic scans run every 6 hours by default. Pick every hour or
                every 4 hours under Scan every, or uncheck Scan X for new
                mentions to stop every X read for the queue; the queue and its
                actions keep working while it is off. Each scan only reads posts
                written since the last one, and Scan now runs one on demand. X only returns the 800
                most recent mentions, so on a fresh deployment the first scan
                may cover less than 30 days; counts fill in as later scans
                build history. A daily job drops people whose mentions aged out
                of the window. Set <code>MENTION_TARGET_HANDLE</code> in Convex
                to track a different account on a fork.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">03</span>
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
                changed. Each roster has a name and @handle search, same as
                the main board list.
              </p>
              <p>
                Each group card also has a Board columns fieldset. By default
                a group board shows the same Posts, Engagements, and
                Impressions columns as the Yappers view in Board settings.
                Toggle any column on the card and that board keeps its own
                set; press Use board defaults to follow the global setting
                again. At least one column must stay visible.
              </p>
              <p>
                Every member row has a Mute button. Muting keeps that person
                in the group and in the public list but takes their rank away:
                they render below a divider with a dash instead of a number
                and no medal, and no column sort or search moves them back up.
                Mute is per group, so the same person stays ranked on every
                other board, and they still count toward this group&apos;s
                member count and pill.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">04</span>
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
            <span className="method-number">05</span>
            <div>
              <h2>Legends</h2>
              <p>
                When someone holds number one long enough that the race stops
                being interesting, Make legend retires them undefeated. The
                button sits on their{" "}
                <Link className="text-link" to="/admin">/admin</Link> row and
                on every group member row in{" "}
                <Link className="text-link" to="/admin/groups">/admin/groups</Link>,
                and both do the same thing. Write a short line about why, press
                Make legend and publish, and they leave every ranking (Yappers,
                Convex mentions, and group boards) while a public page goes
                live at /legends/handle with your note, their career numbers,
                and a Post on X button.
              </p>
              <p>
                A Legends pill appears on the board as soon as one person has
                the status, and disappears again if nobody does. Nobody on that
                board gets a rank number: every row carries a crown instead,
                newest legend first. On a group board, legends drop out of the
                ranking but stay findable, so searching a handle still turns
                them up under a divider with a link to their page.
              </p>
              <p>
                Legend status is profile wide even when set from inside a
                group, so it pulls them off the main board and every other
                group too. Mute is the one-board version of the same idea.
                Muting a legend does nothing, so that button turns off.
              </p>
              <p>
                This is not Archive. Archived people disappear from the site
                entirely; legends keep their profile, keep syncing, and get a
                page built to celebrate them. Back to the board puts them in
                the running again and closes the page. Archive a person first
                and Make legend turns off until you restore them. Links shared
                from the old /retired/handle URL still work.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">06</span>
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
            <span className="method-number">07</span>
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
            <span className="method-number">08</span>
            <div>
              <h2>Adding and revoking admins</h2>
              <p>
                <Link className="text-link" to="/admin/team">/admin/team</Link>{" "}
                lists everyone with admin access. Search the board by name or
                @handle, or type any X handle and press Look up on X, then
                confirm with Grant admin access. Any admin can add or remove
                granted admins, up to 50. Nobody can remove themselves, so the
                last person in the room can&apos;t lock themselves out by
                accident.
              </p>
              <p>
                Owners are the X user IDs in <code>ADMIN_X_USER_IDS</code>.
                They are always admins and show a lock on the Admins page; to
                remove one, edit the env var in the Convex dashboard. Every
                admin read and write rechecks both lists, so changes apply on
                the next request. No deploy needed.
              </p>
            </div>
          </section>
        </div>
      </div>
    </AdminGate>
  );
}
