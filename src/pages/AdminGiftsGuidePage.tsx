import { Link } from "react-router-dom";
import { AdminGate } from "../components/AdminGate";
import { usePageTitle } from "../lib/usePageTitle";

// Plain language walkthrough of the Gift studio for non technical admins.
export function AdminGiftsGuidePage() {
  usePageTitle("How to send gifts");
  return (
    <AdminGate redirectTo="/admin/gifts/guide">
      <div className="editorial-page setup-page">
        <Link className="text-link setup-back-link" to="/admin/gifts">
          Back to the Gift studio
        </Link>

        <header className="editorial-hero">
          <div className="editorial-title">
            <p className="eyebrow">Admin only guide</p>
            <h1>How to send a gift, start to finish.</h1>
          </div>
          <p>
            The Gift studio sends one free Fourthwall gift to one person on X.
            You pick the person, the app sends them a private link by X DM, and
            they choose their own gift on Fourthwall. You never collect an
            address or payment details. Fourthwall handles all of that.
          </p>
        </header>

        <div className="setup-steps">
          <section>
            <span className="method-number">00</span>
            <div>
              <h2>Who can use this page</h2>
              <p>
                Only admins. The Gift studio checks your X account against the
                admin allowlist on every action. If a teammate needs access,
                add their X user ID to <code>ADMIN_X_USER_IDS</code> in the
                Convex dashboard. The steps are on the{" "}
                <Link className="text-link" to="/admin/docs">Admin docs</Link>{" "}
                page.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">01</span>
            <div>
              <h2>Check the four status lights</h2>
              <p>
                At the top of the <Link className="text-link" to="/admin/gifts">Gift studio</Link>{" "}
                are four status rows: Fourthwall, X sender, Redemption webhook,
                and X Account Activity. Each shows a check mark when it is
                ready.
              </p>
              <p>
                Green checks mean you can send gifts. If any row shows a
                warning, ask the person who set up the app to fix that
                connection first. Nothing you do on this page can break those
                connections.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">02</span>
            <div>
              <h2>Create or pick a campaign</h2>
              <p>
                A campaign is a batch of gifts with one name, for example
                Friends of Convex 2026. It sets the gift promotion used on
                Fourthwall and the expiration window for the gift links.
                Links live at most 7 days after the dispatch is created; an
                hourly job closes expired dispatches automatically.
              </p>
              <p>
                If a campaign already exists, use it. Create a new one only
                when you start a new giving round with a different promotion or
                budget.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">03</span>
            <div>
              <h2>Add the recipient</h2>
              <p>
                Type the person&apos;s X handle, with or without the @ sign.
                The app pulls their public name and photo from X so you can
                confirm you have the right person before anything is sent.
              </p>
              <p>
                Each pass is one of one. One gift, one person, one private
                link. Adding the same handle twice will not create a second
                gift.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">04</span>
            <div>
              <h2>Send the gift pass</h2>
              <p>
                Press send. The app creates a private gift page for that person
                and delivers the link in an X direct message from the connected
                sender account. If the DM cannot be delivered, the studio shows
                the pass link so you can copy it and send it yourself.
              </p>
              <p>
                The private page greets the person by handle, shows a gift
                card, and has one button: reveal my gift. The reveal button
                takes them to fourthwall.com where they pick their gift and
                enter their own shipping details.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">05</span>
            <div>
              <h2>Track each pass</h2>
              <p>The recipient list shows where every gift stands:</p>
              <p>
                <strong>Sent</strong> means the DM went out.{" "}
                <strong>Opened</strong> means the person visited their page.{" "}
                <strong>Revealed</strong> means they clicked through to
                Fourthwall. <strong>Redeemed</strong> means Fourthwall
                confirmed the order. Redeemed status arrives automatically
                through a webhook, so you do not need to check Fourthwall
                yourself.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">06</span>
            <div>
              <h2>Revoke a pass if you need to</h2>
              <p>
                Sent to the wrong person, or a link leaked? Use revoke on that
                row. The private page closes immediately and shows a friendly
                closed message. Revoking never cancels an order the person
                already placed on Fourthwall.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">07</span>
            <div>
              <h2>What recipients can share</h2>
              <p>
                Every gift page has a share button that posts a public
                celebration card to X. The public card shows their handle and
                the campaign name only. It never contains the private claim
                link, so retweets and screenshots are safe.
              </p>
            </div>
          </section>
        </div>
      </div>
    </AdminGate>
  );
}
