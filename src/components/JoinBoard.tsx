import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { CheckCircleIcon, ClockIcon, XLogoIcon } from "@phosphor-icons/react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_BRANDING } from "../../convex/brandingDefaults";
import {
  consumeFailedSignInAttempt,
  isMobileDevice,
  isXInAppBrowser,
  markSignInAttempt,
} from "../lib/browserEnvironment";

// Environment reads are stable for the life of the page.
const inXApp = isXInAppBrowser();
const onMobile = isMobileDevice();

export function JoinBoard() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const viewer = useQuery(api.authz.viewer, {});
  // Community name comes from admin site settings with the shipped default
  // as the loading fallback, so the copy never flashes empty.
  const branding = useQuery(api.siteSettings.getSiteBranding, {});
  const communityName = branding?.communityName ?? DEFAULT_BRANDING.communityName;
  const membership = useQuery(api.profiles.getMyMembership, isAuthenticated ? {} : "skip");
  const requestToJoin = useMutation(api.profiles.requestToJoin);
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Consume the pre-redirect attempt flag once on mount. Convex Auth
  // redirects back with no query param when OAuth fails, so a recent flag
  // plus a signed-out visitor is the only signal the round trip broke,
  // usually because the phone bounced into the X app.
  const [hadRecentAttempt] = useState(() => consumeFailedSignInAttempt());
  const signInFailed = hadRecentAttempt && !signingIn && !isLoading && !isAuthenticated;

  function startSignIn() {
    setSigningIn(true);
    markSignInAttempt();
    void signIn("twitter", { redirectTo: "/join" });
  }

  async function requestMembership() {
    setBusy(true);
    setError(null);
    try {
      await requestToJoin({});
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Could not send your request."
      );
    } finally {
      setBusy(false);
    }
  }

  const waiting =
    isLoading || viewer === undefined || (isAuthenticated && membership === undefined);

  return (
    <div className="join-page">
      <section className="join-copy">
        <p className="eyebrow">{communityName} · Open call</p>
        <h1>Request to join the {communityName} board.</h1>
        <p className="join-lede">
          Sign in with X, confirm your handle, and send one request. An admin reviews every request
          on a rolling basis. Joining is not automatic. Your last seven days of public metrics stay
          off the board until someone approves you.
        </p>
      </section>

      <section className="join-signal" aria-live="polite">
        <p className="section-kicker">Membership signal</p>
        {waiting ? (
          <div className="join-state">
            <ClockIcon aria-hidden="true" />
            <h2>Checking your signal</h2>
          </div>
        ) : !viewer?.authConfigured ? (
          <div className="join-state">
            <ClockIcon aria-hidden="true" />
            <h2>X sign-in is not connected yet.</h2>
            <p>The operator can finish the Convex Auth steps in the private setup guide.</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="join-state">
            <XLogoIcon aria-hidden="true" />
            <h2>Start with your X account.</h2>
            <p>We use X only to identify the person asking to join.</p>
            {inXApp ? (
              <div className="in-app-browser-note" role="note">
                <strong>You are inside the X app browser.</strong>
                <p>
                  Sign-in cannot finish here. Tap the menu in the corner and choose{" "}
                  <strong>Open in Safari</strong> on iPhone or <strong>Open in Chrome</strong> on
                  Android, then continue from there.
                </p>
              </div>
            ) : null}
            <button
              className="primary-button"
              type="button"
              disabled={signingIn}
              onClick={startSignIn}>
              {signingIn ? "Opening X sign-in" : "Continue with X"}
            </button>
            {signInFailed ? (
              <p className="feedback-message feedback-error" role="alert">
                Sign-in didn’t finish. Stay in this browser and try once more.
              </p>
            ) : null}
            {onMobile && !inXApp ? (
              <p className="sign-in-hint">
                Approve in this browser. If your phone offers to open the X app, stay here.
              </p>
            ) : null}
          </div>
        ) : membership?.status === "approved" ? (
          <div className="join-state join-state-approved">
            <CheckCircleIcon aria-hidden="true" />
            <h2>You’re approved.</h2>
            <p>@{membership.handle} is part of the Friends of Convex board.</p>
            <Link className="primary-button" to="/">
              View the leaderboard
            </Link>
          </div>
        ) : membership?.status === "pending" ? (
          <div className="join-state">
            <ClockIcon aria-hidden="true" />
            <h2>Your request is waiting for review.</h2>
            <p>
              Admins check the queue on a rolling basis. @{membership.handle} stays private until
              someone approves it.
            </p>
          </div>
        ) : (
          <div className="join-state">
            <XLogoIcon aria-hidden="true" />
            <h2>Confirm @{viewer?.xUsername}.</h2>
            <p>
              This is a request, not an auto join. Your handle stays private until an admin
              approves it.
            </p>
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() => void requestMembership()}>
              {busy ? "Sending request" : "Request to join"}
            </button>
          </div>
        )}

        {error ? (
          <p className="feedback-message feedback-error" role="alert">
            {error}
          </p>
        ) : null}
        {isAuthenticated ? (
          <button
            className="text-button join-sign-out"
            type="button"
            onClick={() => void signOut()}>
            Sign out
          </button>
        ) : null}
      </section>
    </div>
  );
}
