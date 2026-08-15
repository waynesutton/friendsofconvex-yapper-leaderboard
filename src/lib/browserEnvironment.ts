// Best-effort detection for the mobile X login flow. X's Universal Links
// intercept https://x.com/i/oauth2/authorize on iOS, so login must stay in a
// real browser. These helpers only change copy and messaging, never whether
// the sign-in button works.

const SIGN_IN_ATTEMPT_KEY = "foc-signin-attempt";
const SIGN_IN_ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;

/** True inside the X app's in-app WebView, where web OAuth cannot complete. */
export function isXInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  // The X app WebView reports TwitterAndroid on Android and
  // "Twitter for iPhone/iPad" on iOS. Normal browsers never include these.
  return /twitterandroid|twitter for i(phone|pad)|\btwitter\b/i.test(navigator.userAgent);
}

/** Coarse mobile check for the one-line stay-in-this-browser hint. */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** Record that a sign-in redirect is about to start. */
export function markSignInAttempt(): void {
  try {
    window.sessionStorage.setItem(SIGN_IN_ATTEMPT_KEY, String(Date.now()));
  } catch {
    // Private mode or blocked storage: degrade to current behavior.
  }
}

/**
 * True when a recent sign-in attempt exists. Consumes the flag so the retry
 * message only shows once. Stale flags are cleared and ignored.
 */
export function consumeFailedSignInAttempt(): boolean {
  try {
    const raw = window.sessionStorage.getItem(SIGN_IN_ATTEMPT_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(SIGN_IN_ATTEMPT_KEY);
    const startedAt = Number(raw);
    return Number.isFinite(startedAt) && Date.now() - startedAt < SIGN_IN_ATTEMPT_MAX_AGE_MS;
  } catch {
    return false;
  }
}