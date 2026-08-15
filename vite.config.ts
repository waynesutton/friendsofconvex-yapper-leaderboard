import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const convexSite = env.VITE_CONVEX_URL?.replace(
    ".convex.cloud",
    ".convex.site",
  );

  return {
    plugins: [react()],
    // The static-hosting CLI sets this when the component mounts under a sub-path.
    base: process.env.STATIC_HOSTING_BASE_PATH ?? "/",
    server: {
      // Pinned so local URLs in the setup docs stay accurate.
      port: 5174,
      // Footer discovery links hit Convex HTTP actions, not the Vite SPA.
      proxy: convexSite
        ? {
            "/llms.txt": convexSite,
            "/sitemap.md": convexSite,
            "/sitemap.xml": convexSite,
            "/robots.txt": convexSite,
            "/agents.md": convexSite,
            "/llms-full.txt": convexSite,
            "/feed.xml": convexSite,
            "/llms-status": convexSite,
            "/llms-readiness": convexSite,
          }
        : undefined,
    },
  };
});
