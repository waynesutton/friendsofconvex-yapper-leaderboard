import { defineConfig } from "vitest/config";

// Tests live in tests/ (outside convex/) so the Convex bundler never sees
// them. convex-test needs the edge runtime to mirror the Convex environment.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
