import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

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
          onClick={() => void signIn("twitter", { redirectTo })}
        >
          Continue with X
        </button>
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
