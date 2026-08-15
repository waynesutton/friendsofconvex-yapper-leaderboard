import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import {
  consumeFailedSignInAttempt,
  isMobileDevice,
  markSignInAttempt,
} from "../lib/browserEnvironment";

const onMobile = isMobileDevice();

export function AdminGate({
  children,
  redirectTo = "/admin",
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.authz.viewer, {});
  const { signIn, signOut } = useAuthActions();
  const [signingIn, setSigningIn] = useState(false);
  // Consume the pre-redirect attempt flag once on mount. Convex Auth
  // redirects back with no query param when OAuth fails, so a recent flag
  // plus a signed-out visitor is the only reliable failure signal.
  const [hadRecentAttempt] = useState(() => consumeFailedSignInAttempt());
  const signInFailed = hadRecentAttempt && !signingIn && !authLoading && !isAuthenticated;

  function startSignIn() {
    setSigningIn(true);
    markSignInAttempt();
    void signIn("twitter", { redirectTo });
  }

  // Wait for both the auth token handshake and the viewer query. Right after
  // the OAuth redirect the query can run once without a token and report
  // "not signed in", which used to flash the sign-in screen and make admins
  // log in twice. Holding the loading state until the token settles fixes it.
  if (viewer === undefined || authLoading || (isAuthenticated && !viewer.authenticated)) {
    return <main className="access-state">Checking admin access…</main>;
  }

  if (!viewer.authConfigured) {
    return (
      <main className="access-state">
        <p className="eyebrow">Admin setup required</p>
        <h1>Connect the X login first.</h1>
        <p>
          The route is closed until the Convex Auth X keys are configured. Use
          the project setup guide to finish the one-time connection.
        </p>
        <Link className="text-link" to="/">
          Return to the leaderboard
        </Link>
      </main>
    );
  }

  if (!viewer.authenticated) {
    return (
      <main className="access-state">
        <p className="eyebrow">Restricted board operations</p>
        <h1>Admin sign-in</h1>
        <p>Continue with the X account listed in the Convex admin allowlist.</p>
        <button
          className="primary-button"
          type="button"
          disabled={signingIn}
          onClick={startSignIn}
        >
          {signingIn ? "Opening X sign-in" : "Continue with X"}
        </button>
        {signInFailed ? (
          <p className="feedback-message feedback-error" role="alert">
            Sign-in didn’t finish. Stay in this browser and try once more.
          </p>
        ) : null}
        {onMobile ? (
          <p className="sign-in-hint">
            Approve in this browser. If your phone offers to open the X app, stay here.
          </p>
        ) : null}
      </main>
    );
  }

  if (!viewer.isAdmin) {
    return (
      <main className="access-state">
        <p className="eyebrow">Access denied</p>
        <h1>This X account is not an admin.</h1>
        <p>
          Signed in as @{viewer.xUsername ?? "unknown"}. Ask the operator to add
          your stable X user ID to <code>ADMIN_X_USER_IDS</code>.
        </p>
        <button className="secondary-button" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </main>
    );
  }

  return <>{children}</>;
}
