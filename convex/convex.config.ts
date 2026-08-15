import staticHosting from "@convex-dev/static-hosting/convex.config";
import agentReady from "@waynesutton/agent-ready/convex.config.js";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    X_BEARER_TOKEN: v.optional(v.string()),
    AUTH_TWITTER_ID: v.optional(v.string()),
    AUTH_TWITTER_SECRET: v.optional(v.string()),
    X_API_KEY: v.optional(v.string()),
    X_API_SECRET: v.optional(v.string()),
    X_ACCOUNT_ACTIVITY_ACCESS_TOKEN: v.optional(v.string()),
    X_ACCOUNT_ACTIVITY_ACCESS_TOKEN_SECRET: v.optional(v.string()),
    ADMIN_X_USER_IDS: v.optional(v.string()),
    SITE_URL: v.optional(v.string()),
    JWT_PRIVATE_KEY: v.optional(v.string()),
    JWKS: v.optional(v.string()),
    FOURTHWALL_API_USERNAME: v.optional(v.string()),
    FOURTHWALL_API_PASSWORD: v.optional(v.string()),
    FOURTHWALL_WEBHOOK_SECRET: v.optional(v.string()),
    X_DM_TOKEN_ENCRYPTION_KEY: v.optional(v.string()),
    SLACK_BOT_TOKEN: v.optional(v.string()),
    SLACK_DIGEST_CHANNEL: v.optional(v.string()),
  },
});

// Agent Ready nests its own crons and workpool. It serves agents.md,
// llms-full.txt, RSS, and readiness. Live llms.txt / sitemap files are
// app-owned HTTP routes so they stay in sync with the public board.
app.use(agentReady);

// App-owned root routing: the app keeps every existing HTTP route at its
// exact URL, and convex/http.ts registers the static catch-all after them.
app.use(staticHosting);

export default app;
