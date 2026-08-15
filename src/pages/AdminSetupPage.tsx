import { Link } from "react-router-dom";
import { AdminGate } from "../components/AdminGate";
import { usePageTitle } from "../lib/usePageTitle";

export function AdminSetupPage() {
  usePageTitle("Admin setup guide");
  return (
    <AdminGate redirectTo="/admin/setup">
      <div className="editorial-page setup-page">
        <Link className="text-link setup-back-link" to="/admin">
          Back to admin
        </Link>

        <header className="editorial-hero">
          <div className="editorial-title">
            <p className="eyebrow">Private operator guide</p>
            <h1>Connect Convex Auth, X, and production in this order.</h1>
          </div>
          <p>
            The app needs both Convex Auth and an X OAuth app. Convex keeps
            every secret. The frontend is a Vite React app served by the
            Convex static hosting component, so it only ever receives the
            public Convex URL.
          </p>
        </header>

        <div className="setup-steps">
          <section>
            <span className="method-number">00</span>
            <div>
              <h2>Current verified state</h2>
              <p>
                This folder is linked to Convex team <code> cvx-devx</code>,
                project <code>convex-yappers</code>, with production deployment
                <code> agile-spaniel-476</code>.
              </p>
              <p className="inline-warning">
                Production <code>SITE_URL</code>, auth keys, the admin
                allowlist, X credentials, and optional gift values are set per
                deployment. Confirm them in the Convex dashboard before
                depending on production sign-in.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">01</span>
            <div>
              <h2>Start local development</h2>
              <p>Run the backend and the frontend in two terminals:</p>
              <code>npx convex dev</code>
              <code>npm run dev</code>
              <p>
                The frontend runs at <code>http://localhost:5173</code> and
                reads <code>VITE_CONVEX_URL</code> from <code>.env.local</code>.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">02</span>
            <div>
              <h2>Create the development X OAuth app</h2>
              <p>
                In the X Developer Console, enable OAuth 2.0 for a confidential
                web app and use read-only permissions. The code requests only
                <code> users.read</code> and <code> tweet.read</code>.
              </p>
              <code>Website URL: http://localhost:5173</code>
              <code>Callback: http://127.0.0.1:3211/api/auth/callback/twitter</code>
              <p className="inline-warning">
                Use the HTTP Actions origin printed by local Convex if its port
                differs. X requires an exact callback match.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">03</span>
            <div>
              <h2>Set the development Convex environment</h2>
              <p>
                Run <code>npm run auth:keys</code>, then put all seven values in
                the active development Convex deployment:
              </p>
              <code>SITE_URL=http://localhost:5173</code>
              <code>JWT_PRIVATE_KEY=&lt;development private key&gt;</code>
              <code>JWKS=&lt;matching development JWKS&gt;</code>
              <code>AUTH_TWITTER_ID=&lt;X OAuth 2.0 Client ID&gt;</code>
              <code>AUTH_TWITTER_SECRET=&lt;X OAuth 2.0 Client Secret&gt;</code>
              <code>ADMIN_X_USER_IDS=&lt;numeric X IDs, comma separated&gt;</code>
              <code>X_BEARER_TOKEN=&lt;X app-only Bearer Token&gt;</code>
              <p>
                The OAuth Client ID and Secret power login. The Bearer Token is
                separate and powers imports and metrics.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">04</span>
            <div>
              <h2>Bootstrap the first admin</h2>
              <p>
                Open <Link to="/join">/join</Link> and continue with X. In the
                active Convex deployment, open <strong>Data → users</strong>, find
                your <code>xUsername</code>, and copy its numeric <code>xUserId</code>.
              </p>
              <code>ADMIN_X_USER_IDS=123456789</code>
              <p>
                Reload <code>/admin</code>. Handles can change, so admin access
                always uses the stable numeric X ID.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">05</span>
            <div>
              <h2>Add more admins without replacing anyone</h2>
              <p>
                Have each new admin sign in once at <Link to="/join">/join</Link>.
                Copy their <code>xUserId</code> from <strong>Data → users</strong>,
                then append it to the same Convex value:
              </p>
              <code>ADMIN_X_USER_IDS=123456789,987654321,555555555</code>
              <p className="inline-warning">
                Keep every existing ID. Development and production allowlists
                must be updated separately.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">06</span>
            <div>
              <h2>Verify the owner before production</h2>
              <code>npx convex dashboard</code>
              <code>npx convex env --prod list --names-only</code>
              <code>npx convex deploy --dry-run</code>
              <p className="inline-warning">
                In the dashboard, confirm the exact target team, project, and
                production deployment. Stop if any one is wrong.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">07</span>
            <div>
              <h2>Record the production Convex routes</h2>
              <p>For the current production deployment, use:</p>
              <code>https://agile-spaniel-476.convex.site/api/auth/callback/twitter</code>
              <code>https://agile-spaniel-476.convex.site/x-dm/callback</code>
              <code>https://agile-spaniel-476.convex.site/x-account-activity</code>
              <code>https://agile-spaniel-476.convex.site/fourthwall/webhook</code>
              <p>
                The first two are X OAuth callbacks. Account Activity registers
                the third through the X API. Fourthwall receives the fourth.
                These callbacks stay on the <code>.convex.site</code> origin
                even after a custom domain goes live.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">08</span>
            <div>
              <h2>Deploy the frontend and backend together</h2>
              <code>npm run deploy</code>
              <p>
                This one command builds the Vite app, deploys the Convex
                backend, and uploads the static files to the production
                deployment. The site is served from
                <code> https://agile-spaniel-476.convex.site</code>. Run it only
                after you approve the exact target deployment.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">09</span>
            <div>
              <h2>Point production auth at the live origin</h2>
              <p>
                Set the production <code>SITE_URL</code> to the browser origin
                visitors use. Today that is the static host origin; after the
                planned <code>friendsofconvex.dev</code> purchase it becomes the
                custom domain:
              </p>
              <code>SITE_URL=https://agile-spaniel-476.convex.site</code>
              <code>SITE_URL=https://friendsofconvex.dev (after domain cutover)</code>
              <p>
                Update the production X app Website URL to the same origin. The
                OAuth callbacks from step 07 do not change.
              </p>
            </div>
          </section>

          <section>
            <span className="method-number">10</span>
            <div>
              <h2>Optional: automate gift consent and opt-outs</h2>
              <p>
                The gift studio uses a separate OAuth 2.0 sender grant for DMs
                and OAuth 1.0a Account Activity credentials for signed inbound
                <code> GIFT</code> and <code> STOP</code> events. A public Convex
                Cloud deployment is required; X cannot call local Agent Mode.
              </p>
              <code>X_API_KEY=&lt;X API or Consumer Key&gt;</code>
              <code>X_API_SECRET=&lt;X API or Consumer Secret&gt;</code>
              <code>
                X_ACCOUNT_ACTIVITY_ACCESS_TOKEN=&lt;dedicated sender access token&gt;
              </code>
              <code>
                X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET=&lt;matching token secret&gt;
              </code>
              <p>
                Put these only in the matching Convex deployment. Connect the
                dedicated sender in <Link to="/admin/gifts">/admin/gifts</Link>,
                then select <strong>Enable automatic detection</strong>. Keep the
                manual consent control as the fallback when Account Activity is
                unavailable.
              </p>
            </div>
          </section>
        </div>

        <aside className="editorial-note">
          <p className="section-kicker">Read before production</p>
          <h2>Use the full checklist</h2>
          <p>
            <code>SETUP_GUIDE.md</code> contains the exact development and
            production value matrix, static hosting deploy flow, multi-admin
            procedure, custom domain preparation, test order, cost notes, and
            troubleshooting steps.
          </p>
          <div className="setup-reference-links">
            <a href="https://labs.convex.dev/auth/setup" target="_blank" rel="noreferrer noopener">Convex Auth setup</a>
            <a href="https://labs.convex.dev/auth/config/oauth" target="_blank" rel="noreferrer noopener">Convex Auth OAuth</a>
            <a href="https://docs.convex.dev/cli/reference/dev" target="_blank" rel="noreferrer noopener">Convex dev command</a>
            <a href="https://docs.convex.dev/cli/reference/deploy" target="_blank" rel="noreferrer noopener">Convex deploy command</a>
            <a href="https://docs.convex.dev/cli/reference/env" target="_blank" rel="noreferrer noopener">Convex environment commands</a>
            <a href="https://docs.convex.dev/production/environment-variables" target="_blank" rel="noreferrer noopener">Convex environment variables</a>
            <a href="https://www.convex.dev/components/static-hosting" target="_blank" rel="noreferrer noopener">Convex static hosting component</a>
            <a href="https://docs.convex.dev/production/custom-domains" target="_blank" rel="noreferrer noopener">Convex custom domains</a>
            <a href="https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code" target="_blank" rel="noreferrer noopener">X OAuth 2.0 with PKCE</a>
            <a href="https://docs.x.com/x-api/account-activity/quickstart" target="_blank" rel="noreferrer noopener">X Account Activity setup</a>
            <a href="https://docs.x.com/x-api/webhooks/quickstart" target="_blank" rel="noreferrer noopener">X webhook verification</a>
            <a href="https://docs.x.com/x-api/getting-started/pricing" target="_blank" rel="noreferrer noopener">X API pricing</a>
          </div>
        </aside>
      </div>
    </AdminGate>
  );
}
