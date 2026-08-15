// Pure builders for live discovery files. HTTP routes and the directory
// query both import these. No Convex function registrations here.

export const DIRECTORY_CAP = 250;

export const SITE_PAGES: Array<{
  title: string;
  path: string;
  description: string;
}> = [
  {
    title: "Home",
    path: "/",
    description:
      "People-only seven-day X leaderboard for Friends of Convex, ranked by public impressions.",
  },
  {
    title: "About",
    path: "/about",
    description: "How the board scores a week of yaps and who it is for.",
  },
  {
    title: "Join the board",
    path: "/join",
    description: "Sign in with X and ask to join the Friends of Convex board.",
  },
];

export type PublicDirectoryPerson = {
  handle: string;
  displayName: string;
  currentImpressions: number;
  currentPosts: number;
  currentEngagements: number;
  currentConvexPosts: number | null;
  addedAt: number;
  updatedAt: number;
};

export type PublicDirectory = {
  people: Array<PublicDirectoryPerson>;
  newestUpdatedAt: number | null;
};

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMdLinkLabel(text: string): string {
  return text.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function xProfileUrl(handle: string): string {
  return `https://x.com/${handle}`;
}

export function buildRobotsTxt(baseUrl: string): string {
  const lines: Array<string> = [
    "# Friends of Convex robots.txt",
    "# Public discovery files: /llms.txt and /sitemap.md",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /gift/",
    "",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: anthropic-ai",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
    "",
    "User-agent: CCBot",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: Applebot-Extended",
    "Allow: /",
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
    `LLMs: ${baseUrl}/llms.txt`,
    `# Markdown sitemap: ${baseUrl}/sitemap.md`,
  ];
  return lines.join("\n") + "\n";
}

export function buildLlmsTxt(
  directory: PublicDirectory,
  baseUrl: string,
): string {
  const updated = directory.newestUpdatedAt
    ? formatDay(directory.newestUpdatedAt)
    : "unknown";
  const lines: Array<string> = [
    "# Friends of Convex Yapper Board",
    "",
    "> A people-only, seven-day X leaderboard for the Friends of Convex community.",
    "",
    "Friends of Convex lists public community voices talking, teaching, and building in public. Pending join requests and archived handles are not included.",
    "",
    `This file lists ${directory.people.length} public people on the board. Updated ${updated}.`,
    "",
    "Optional:",
    `- [Markdown sitemap](${baseUrl}/sitemap.md): handle, X profile, and seven-day metrics for every public person`,
    `- [XML sitemap](${baseUrl}/sitemap.xml)`,
    `- [Homepage](${baseUrl}/)`,
    `- [About](${baseUrl}/about)`,
    `- [Join](${baseUrl}/join)`,
    `- [agents.md](${baseUrl}/agents.md)`,
    "",
    "## Site",
    "",
  ];

  for (const page of SITE_PAGES) {
    lines.push(
      `- [${page.title}](${baseUrl}${page.path}): ${page.description}`,
    );
  }

  lines.push("", "## People", "");

  for (const person of directory.people) {
    const label = escapeMdLinkLabel(`@${person.handle}`);
    const convexNote =
      person.currentConvexPosts === null
        ? "Convex mentions not scanned yet"
        : `${person.currentConvexPosts} Convex posts`;
    lines.push(
      `- [${label}](${xProfileUrl(person.handle)}): ${person.displayName}. ${person.currentPosts} posts, ${person.currentImpressions} impressions, ${convexNote} in the last seven days.`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function buildSitemapMd(
  directory: PublicDirectory,
  baseUrl: string,
): string {
  const updated = directory.newestUpdatedAt
    ? formatDay(directory.newestUpdatedAt)
    : "unknown";
  const lines: Array<string> = [
    "# Friends of Convex sitemap",
    "",
    `A live catalog of public people on the [Friends of Convex yapper board](${baseUrl}). Pending join requests and archived handles are excluded.`,
    "",
    `${directory.people.length} people | Updated ${updated}`,
    "",
    "Agents: treat this file as the canonical people list. Each person links to their public X profile. Fetch `/llms.txt` for the shorter index.",
    "",
    "## Site",
    "",
  ];

  for (const page of SITE_PAGES) {
    lines.push(
      `- [${page.title}](${baseUrl}${page.path}): ${page.description}`,
    );
  }

  lines.push("", "## People", "");

  directory.people.forEach((person, index) => {
    const label = escapeMdLinkLabel(`@${person.handle}`);
    lines.push(`### ${index + 1}. [${label}](${xProfileUrl(person.handle)})`);
    lines.push("");
    lines.push(`- Display name: ${person.displayName}`);
    lines.push(`- X: ${xProfileUrl(person.handle)}`);
    lines.push(`- Posts (7d): ${person.currentPosts}`);
    lines.push(`- Impressions (7d): ${person.currentImpressions}`);
    lines.push(`- Engagements (7d): ${person.currentEngagements}`);
    if (person.currentConvexPosts === null) {
      lines.push("- Convex posts (7d): not scanned yet");
    } else {
      lines.push(`- Convex posts (7d): ${person.currentConvexPosts}`);
    }
    lines.push(`- Added: ${formatDay(person.addedAt)}`);
    lines.push("");
  });

  lines.push("---");
  lines.push("");
  lines.push(`[View the board](${baseUrl}/)`);
  lines.push("");
  return lines.join("\n");
}

export function buildSitemapXml(
  directory: PublicDirectory,
  baseUrl: string,
): string {
  const homepageLastmod = directory.newestUpdatedAt
    ? formatDay(directory.newestUpdatedAt)
    : "2026-01-01";

  const urls: Array<{
    loc: string;
    lastmod: string;
    changefreq: string;
    priority: string;
  }> = [
    {
      loc: `${baseUrl}/`,
      lastmod: homepageLastmod,
      changefreq: "daily",
      priority: "1.0",
    },
    {
      loc: `${baseUrl}/about`,
      lastmod: homepageLastmod,
      changefreq: "weekly",
      priority: "0.8",
    },
    {
      loc: `${baseUrl}/join`,
      lastmod: homepageLastmod,
      changefreq: "weekly",
      priority: "0.8",
    },
    {
      loc: `${baseUrl}/llms.txt`,
      lastmod: homepageLastmod,
      changefreq: "hourly",
      priority: "0.6",
    },
    {
      loc: `${baseUrl}/sitemap.md`,
      lastmod: homepageLastmod,
      changefreq: "hourly",
      priority: "0.6",
    },
  ];

  const body = urls
    .map((entry) => {
      return [
        "  <url>",
        `    <loc>${xmlEscape(entry.loc)}</loc>`,
        `    <lastmod>${entry.lastmod}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
