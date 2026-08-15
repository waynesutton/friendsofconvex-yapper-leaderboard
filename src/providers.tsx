import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { getConvexUrl } from "@convex-dev/static-hosting";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

// The build-time Vite value wins. When the page is served from the
// *.convex.site static host, getConvexUrl() derives the matching cloud URL.
const convexUrl: string | null =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ??
  getConvexUrl() ??
  null;

const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function Providers({ children }: { children: ReactNode }) {
  if (!convexClient) {
    return (
      <main className="configuration-state">
        <p className="eyebrow">Backend configuration needed</p>
        <h1>Connect this app to Convex.</h1>
        <p>
          Add a public <code>VITE_CONVEX_URL</code> value, then restart the
          development server. See the setup guide in this project.
        </p>
      </main>
    );
  }

  return (
    <ConvexAuthProvider client={convexClient}>{children}</ConvexAuthProvider>
  );
}
