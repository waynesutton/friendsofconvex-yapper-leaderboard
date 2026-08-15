# Convex.dev homepage design spec

Reference for rebuilding the convex.dev marketing homepage. Based on the live site as of August 2026.

---

## Typography

**Display font (hero headline "ALL GAS NO BREAKAGES")**

```html
<link rel="stylesheet" href="https://use.typekit.net/xmd6bow.css">
```

```css
font-family: "neue-haas-grotesk-display", sans-serif;
font-weight: 900;
font-style: normal;
```

- Rendered in all caps, tight tracking, tight line-height (~0.95)
- Very large: roughly clamp(3.5rem, 8vw, 6.5rem)
- Color: white on dark hero background

**Body / UI font**

- Clean grotesque sans (same neue-haas family at weights 400 to 600 works)
- Small labels and section badges use a monospace font, uppercase, letter-spaced (e.g. "TRUSTED BY", "BUILT FOR THE FRONTIER", "QUOTES", "BUILT BY", "ENTERPRISE READY")
- Code snippets and terminal commands use monospace

**Editorial serif accent**

- The large pull quote ("Convex lets me build at the speed of AI.") is set in an italic serif display face, centered, very large
- The closing CTA subline "Scale it for decades." is also italic serif

## Color palette

| Token | Hex | Usage |
|---|---|---|
| Cream (main body) | `#F7EEDB` | Light section backgrounds ("Solved." section, trusted-by strip) |
| Near-black plum | `#1C1414` (approx) | Hero background, dark sections, footer |
| Dark charcoal | `#141414` (approx) | Components section background |
| Olive green | `#4A4A33` (approx) | Quotes section background |
| Muted olive card | `#5A5A42` (approx) | Testimonial cards on quotes section |
| Deep maroon | `#3D1F1F` (approx) | "Built by" founders section and enterprise band |
| Racing stripe orange | `#F26B1D` (approx) | Accent stripes, primary CTA button ("Start building") |
| Stripe yellow | `#F2B01D` (approx) | Hero racing stripes |
| Stripe magenta/red | `#D93A3A` / `#C4386B` (approx) | Hero racing stripes |
| White | `#FFFFFF` | Headlines on dark, pill buttons |
| Checkbox blue | `#5B8DEF` (approx) | Checked checkboxes in "Solved." list |

The hero's signature visual is a set of curved retro racing stripes (yellow, orange, magenta, purple) sweeping across the right side, evoking speed. "All gas."

## Page structure (top to bottom)

1. **Nav bar** (dark, sticky)
   - Left: Convex wordmark
   - Center: Product (dropdown), Developers (dropdown), Blog, Changelog, Docs, Pricing
   - Right: npm badge (1.3M weekly), GitHub badge (21,110 stars), Log in button (pill)

2. **Hero** (dark plum bg, racing stripes)
   - H1: "ALL GAS NO BREAKAGES" (neue-haas-grotesk-display 900, caps, white)
   - Subhead: "The reactive backend platform that keeps up with you and your agents. Database, functions, workflow, sync, search, file storage, and more. All TypeScript, zero glue."
   - Buttons: "Read the docs" (outline/ghost pill), "Start building" (white pill)
   - Right: agent setup card (dark, rounded, elevated) with three rows:
     - "MAKE YOUR AGENT A CONVEX EXPERT" — copy-a-prompt input with model icons + copy button, caption "Works great with any model, any agent, any editor →"
     - "START A NEW CONVEX PROJECT" — terminal input `npm create convex@latest` with copy button
     - "BUILD ANYTHING WITH CONVEX" — prompt input "Build a collaborative drawing app"

3. **Trusted by strip** (cream `#F7EEDB`)
   - Mono badge label "TRUSTED BY"
   - Logos: OpenAI, Tripadvisor, Solana, doxy.me, Town, reducto, Zapier

4. **"Solved." section** (cream `#F7EEDB`)
   - H2: "Solved." (large, bold, dark, with period)
   - Copy: "We solved the hardest problems in computer science so you and your agent get it right from the start."
   - Checklist (blue checked checkboxes, each row a subtle card):
     - ACID transactions so concurrent writes never corrupt your data
     - End-to-end type safety so agent hallucinations are caught before they ship
     - Automatic caching & scaling so going viral never takes you down
     - Real-time sync so your users instantly see the latest data
   - Line: "Convex is better than your stack."
   - CTA: "Here's the proof →" (dark pill)
   - Right: abstract gantt/schedule-style graphic (thin horizontal bars on grid, cream/blue/orange)

5. **Components section** (near-black bg)
   - Mono badge "BUILT FOR THE FRONTIER"
   - H2: "Ready for agentic workloads (and everything else)"
   - Copy: "Convex Components are sandboxed, open-source building blocks for your app. They let you add complex functionality to your app without implementing everything from scratch."
   - Three feature cards (dark, mono tag top-left, title, description, install command with arrow):
     - WORKPOOL — "Fan out work, on a managed pool" — retries, backoff, parallelism — `npm install @convex-dev/workpool`
     - WORKFLOW — "Workflows that survive anything" — checkpoint, retry, resume — `npm install @convex-dev/workflow`
     - AGENTS — "Build AI agents" — threads, context, vector search — `npm install @convex-dev/agent`
   - Integration tile row: Stripe, Resend, Twilio, WorkOS, PostHog
   - CTA: "Browse the full library →"

6. **Quotes section** (olive green bg)
   - Mono badge "QUOTES"
   - Large italic serif pull quote: "Convex lets me build at the speed of AI." — Thomas Forrest, Cofounder, Sensory Research (previously Stripe, Ramp)
   - Two testimonial cards (muted olive):
     - Sean Rich, Blueberry Social — "all-in-one solution... it's everything"
     - Karan Singhal, VendPark — "Convex is the promised land. This is what I've been waiting for."

7. **Founders section** (deep maroon bg)
   - Mono badge "BUILT BY"
   - H2: "We learned how to build and run distributed systems at exabyte scale so you don't have to"
   - Two founder bios with circular headshots:
     - Jamie Turner, Co-founder CEO — Dropbox senior eng director, ex-Bump head of engineering
     - James Cowling, Co-founder CTO — Dropbox senior principal engineer, MIT PhD under Barbara Liskov

8. **Enterprise band** (maroon, single row)
   - Mono badge "ENTERPRISE READY"
   - Pills: SOC 2 TYPE II · HIPAA · RBAC & SSO · CONVEX IN YOUR VPC (COMING SOON tag)
   - CTA: "Convex for Enterprise →"

9. **Closing CTA** (dark bg with scattered pixel-cluster decorations in cream/orange/blue)
   - H2: "Build a production app this afternoon"
   - Italic serif subline: "Scale it for decades."
   - Repeats the hero agent setup card (prompt copy, `npm create convex@latest`, "Build a real-time chat app")
   - Buttons: "Read the docs" (ghost), "Start building" (orange pill)

10. **Footer** (near-black, 4 link columns + social)
    - Product: Sync, Realtime, Auth, Open source, AI coding, FAQ, Merch, Enterprise, Pricing
    - Developers: Docs, Blog, Components, Templates, Convex for Startups, Convex for Open Source, Champions, Podcasts, LLMs.txt
    - Company: About us, Brand, Investors, Become a partner, Jobs, News, Events, Security, Legal
    - Social: X (Twitter), Discord, YouTube, Luma, LinkedIn, GitHub
    - "A Trusted Solution" checklist: SOC 2 Type II Compliant, HIPAA Compliant, GDPR Verified
    - Copyright: ©2026 Convex, Inc.

## Design language notes

- **Racing/speed motif.** Curved multicolor stripes in the hero, "All gas no breakages" copy, pixel-cluster confetti near the closing CTA. Retro-futurist, slightly 70s racing livery.
- **Section rhythm alternates background colors:** dark plum → cream → near-black → olive → maroon → dark → near-black footer. Each section is a full-bleed color block.
- **Mono uppercase badge labels** introduce every section, boxed with a thin border, letter-spaced.
- **Pills everywhere.** All buttons are fully rounded pills. Primary CTA is orange or white depending on background.
- **Cards are soft-rounded (12 to 16px radius)** with subtle borders on dark backgrounds, slightly lighter fill than the section bg.
- **Copy-to-clipboard affordances** on every command and prompt input. The agent setup card is the hero's main interactive element and repeats at the bottom for symmetry.
- **Voice:** confident, short declaratives, agent-first positioning ("you and your agents", "any model, any agent, any editor").
