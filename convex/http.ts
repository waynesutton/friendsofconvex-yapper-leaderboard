import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { registerRoutes } from "@waynesutton/agent-ready";
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { auth } from "./auth";
import { fourthwallWebhook, xDmCallback } from "./giftWebhooks";
import { giftShareImage, giftSharePage } from "./sharePages";
import {
  serveLlmsTxt,
  serveRobotsTxt,
  serveSitemapMd,
  serveSitemapXml,
} from "./siteFiles";
import {
  accountActivityCrc,
  accountActivityEvents,
} from "./xAccountActivityWebhooks";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/x-dm/callback",
  method: "GET",
  handler: xDmCallback,
});

http.route({
  path: "/fourthwall/webhook",
  method: "POST",
  handler: fourthwallWebhook,
});

http.route({
  path: "/x-account-activity",
  method: "GET",
  handler: accountActivityCrc,
});

http.route({
  path: "/x-account-activity",
  method: "POST",
  handler: accountActivityEvents,
});

// Personalized share pages: crawlers get recipient specific OpenGraph tags
// and a rendered card image. Longest prefix wins, so these beat the static
// hosting catch-all below.
http.route({
  pathPrefix: "/gift/share/",
  method: "GET",
  handler: giftSharePage,
});

http.route({
  pathPrefix: "/og/gift/",
  method: "GET",
  handler: giftShareImage,
});

// Agent Ready: agents.md, llms-full.txt, status, readiness, RSS, agent-skills.
// Live directory files are app-owned so they rebuild from the public board.
registerRoutes(http, components.agentReady, {
  skipRoutes: ["/llms.txt", "/robots.txt", "/sitemap.xml"],
});

http.route({
  path: "/robots.txt",
  method: "GET",
  handler: serveRobotsTxt,
});

http.route({
  path: "/llms.txt",
  method: "GET",
  handler: serveLlmsTxt,
});

http.route({
  path: "/sitemap.md",
  method: "GET",
  handler: serveSitemapMd,
});

http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: serveSitemapXml,
});

// Serve the built Vite frontend from Convex storage. Exact routes above win
// over this catch-all, so auth callbacks and webhooks keep their URLs.
registerStaticRoutes(http, components.staticHosting);

export default http;
