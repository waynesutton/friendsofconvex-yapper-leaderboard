# Friends of Convex design spec

This document explains the full design system behind [friendsofconvex.dev](https://friendsofconvex.dev), the Friends of Convex Yapper Board. It exists so anyone reproducing the look gets it exact, especially the line work. The site ships two complete themes from one stylesheet. Both are documented in full below.

Source of truth: `src/globals.css` in the [repo](https://github.com/waynesutton/friendsofconvex-yapper-leaderboard). Every value in this doc is copied from that file, not approximated.

---

## How the two themes work

One CSS file, two token sets. The base stylesheet is the Studio theme. The Convex theme overrides tokens and a set of component rules under `html[data-theme="convex"]`.

- The root element carries `data-theme="convex"` or `data-theme="studio"`.
- Convex is the default. Studio is restored by setting `data-theme="studio"`.
- The choice persists in `localStorage` under the key `friends-of-convex-theme`.
- A tiny inline script in `index.html` applies the saved theme before first paint so there is no flash:

```html
<script>
  (function () {
    try {
      var savedTheme = window.localStorage.getItem("friends-of-convex-theme");
      document.documentElement.dataset.theme =
        savedTheme === "studio" ? "studio" : "convex";
    } catch (error) {
      document.documentElement.dataset.theme = "convex";
    }
  })();
</script>
```

Every component reads the same variable names. Swapping the theme swaps the values, never the markup.

---

## Theme one, Convex (default)

Warm cream paper, near black plum ink, Convex orange as the single accent, graph paper background, dark sticky header, dark hero with the racing lines art. This theme quotes the convex.dev homepage language.

### Tokens

```css
html[data-theme="convex"] {
  --studio-paper: #f7eedb;        /* page background, warm cream */
  --studio-paper-deep: #eadfc7;   /* inset surfaces, hover fills */
  --studio-sheet: #fffaf0;        /* raised cards and sheets */
  --broadcast-ink: #211718;       /* primary text, near black plum */
  --broadcast-ink-soft: #3d2a2c;  /* secondary text */
  --caption-ink: #6d6258;         /* captions and labels */
  --quiet-ink: #938576;           /* muted and placeholder text */
  --signal-coral: #f26b1d;        /* the one accent, Convex orange */
  --signal-coral-dark: #d8492f;   /* accent on light backgrounds */
  --signal-green: #34785c;        /* success */
  --signal-red: #c03f38;          /* danger */
  --line-whisper: rgba(33, 23, 24, 0.1);
  --line-standard: rgba(33, 23, 24, 0.18);
  --line-emphasis: rgba(33, 23, 24, 0.38);
  --control-inset: #efe4cd;       /* input backgrounds, darker than sheet */
  --control-focus: #f26b1d;
  --radius-small: 8px;
  --radius-medium: 14px;
  --radius-large: 20px;
}
```

### Signature surfaces

- Body carries the graph paper grid (exact CSS in the line system section below).
- Header is sticky, full width, `rgba(33, 23, 24, 0.96)` with `backdrop-filter: blur(18px)`, bottom border `rgba(255, 250, 240, 0.16)`, cream text `#fffaf0`.
- Hero is a full bleed dark band, `#211718`, with the racing lines PNG anchored right bottom.
- Table header band is solid `#211718` with `rgba(255, 250, 240, 0.66)` labels, sitting on a cream card.
- Primary buttons are solid `#f26b1d`, hover `#d95019`, white text, pill radius.
- Rank numbers and method numbers use `#d8492f`.
- Row hover is `#fbf1df`.
- Footer is full width `#211718` with `rgba(255, 250, 240, 0.64)` text. Dark logo marks flip white with `filter: brightness(0) invert(1)`.
- Eyebrow labels get a 1px `currentColor` box, `border-radius: 3px`, padding `4px 7px`, font size 10px.
- Card shadow on light surfaces: `0 12px 38px rgba(61, 31, 31, 0.07)`.
- One hard rule from the stylesheet comment: no radial gradient backgrounds anywhere in the app. Washes stay flat color or linear only.

---

## Theme two, Studio

The base system. Quieter and more editorial. Cooler paper, graphite ink, muted coral accent, no graph paper, no dark hero band. The header sits in the page column instead of full bleed.

### Tokens

```css
:root {
  --studio-paper: #f3f0e9;        /* page background, cool bone */
  --studio-paper-deep: #e9e5dc;   /* inset surfaces, hover fills */
  --studio-sheet: #fffefa;        /* raised cards and sheets */
  --broadcast-ink: #1d1d1b;       /* primary text, warm graphite */
  --broadcast-ink-soft: #383735;  /* secondary text */
  --caption-ink: #69665f;         /* captions and labels */
  --quiet-ink: #8a857b;           /* muted and placeholder text */
  --signal-coral: #e9664c;        /* muted coral accent */
  --signal-coral-dark: #bd4934;   /* accent on light backgrounds */
  --signal-green: #26765b;        /* success */
  --signal-red: #b74f48;          /* danger */
  --line-whisper: rgba(29, 29, 27, 0.16);
  --line-standard: rgba(29, 29, 27, 0.28);
  --line-emphasis: rgba(29, 29, 27, 0.5);
  --control-inset: #ebe7de;       /* input backgrounds */
  --control-focus: #e9664c;
  --page-gutter: clamp(20px, 5vw, 72px);
  --page-width: 1400px;
  --radius-small: 6px;
  --radius-medium: 12px;
  --radius-large: 22px;
}
```

### Signature surfaces

- Flat `#f3f0e9` body. No grid overlay.
- Header stays inside the 1400px column with a 1px `--line-standard` bottom rule.
- Hero headline is light weight, `font-weight: 430`, tracking `-0.06em`, line height 0.94, with the second line colored `--signal-coral`.
- The signal panel (the dark stat card in the hero) is `--broadcast-ink` with an 8px solid coral rule down its left edge.
- Table header band is `--studio-paper-deep`, not dark.
- Primary buttons are ink filled, `--broadcast-ink` background, sheet colored text.
- Row hover is `#faf8f3`.

---

## The line system, how to get the lines right

This is the part people copy wrong. There are seven kinds of lines in this design. Each has exact values.

### 1. The three step border scale

Never use solid gray hex borders. Every hairline is ink at an alpha, so it blends with whatever paper it sits on. Three intensities, matched to the importance of the boundary:

| Token | Convex theme | Studio theme | Used for |
|---|---|---|---|
| `--line-whisper` | `rgba(33, 23, 24, 0.1)` | `rgba(29, 29, 27, 0.16)` | soft internal separators, mobile nav rows |
| `--line-standard` | `rgba(33, 23, 24, 0.18)` | `rgba(29, 29, 27, 0.28)` | default borders, table rows, chips, pills |
| `--line-emphasis` | `rgba(33, 23, 24, 0.38)` | `rgba(29, 29, 27, 0.5)` | card frames, table frame, section rules, hover borders |

On dark surfaces the same idea inverts to cream alphas: `rgba(255, 250, 240, 0.1)` for whisper, `0.16` to `0.24` for standard, `0.44` for emphasis hover states.

The squint test: blur your eyes at the page. You should still read the structure, but no border should jump out. If a line is the first thing you see, its alpha is too high.

### 2. The graph paper grid (Convex theme only)

Two crossed 1px linear gradients on the body, 48px cell, ink at 3.5 percent alpha, layered over the cream paper:

```css
html[data-theme="convex"] body {
  background:
    linear-gradient(rgba(33, 23, 24, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(33, 23, 24, 0.035) 1px, transparent 1px),
    var(--studio-paper);
  background-size: 48px 48px;
}
```

Common mistakes: alpha too high (it should be barely there), cell too small (48px, not 20px or 24px), or applying it to cards. It lives on the body only. Cards sit on top with opaque backgrounds.

### 3. The racing lines art

The signature graphic. Three stacked stripes in the Convex brand colors that run flat, then climb to the upper right through two rounded bends, like a road sweeping uphill. Colors, top to bottom:

| Stripe | Hex |
|---|---|
| Yellow | `#F3B01D` |
| Red | `#EE3430` |
| Purple | `#8D2676` |

Geometry rules that make it read correctly:

- The three stripes touch. No gaps between them.
- Each stripe is the same thickness, about 23.5 units tall in a 1200 wide viewBox.
- The flat run occupies roughly the left 75 to 80 percent, the climb the rest.
- Both knees of the climb are rounded with large radii, never sharp miters.
- The climb angle is steep, roughly 75 degrees from horizontal.
- The stripes stagger. Each lower stripe starts its climb slightly later than the one above, so the bend reads like three parallel lanes on a curve.

This is the full SVG source used to produce the art. It is `design/references/lines-source.svg` in the repo and matches `/brand/convex-racing-lines.png`:

```xml
<svg width="1200" height="675" viewBox="0 0 1200 675" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g clip-path="url(#clip0)">
    <rect width="1200" height="675" fill="#2A1E1D"/>
    <g clip-path="url(#clip1)">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M0 604.47L895.679 604.47C913.235 604.47 927.916 592.681 932.205 575.651L982.897 383.956C987.186 366.926 1001.87 355.859 1019.42 355.859H1211.41V674.416L0 674.416L0 604.47ZM0 628.029L945.289 628.029C962.809 628.029 977.443 616.329 981.785 599.365L1032.82 408.012C1037.16 391.054 1051.8 379.714 1069.32 379.714H1211.41V674.416L0 674.416L0 628.029Z" fill="#F3B01D"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M0 628.03L945.289 628.03C962.809 628.03 977.443 616.33 981.785 599.365L1032.82 408.012C1037.16 391.054 1051.8 379.715 1069.32 379.715H1211.41V674.416L0 674.416L0 628.03ZM0 651.595L994.863 651.595C1012.37 651.595 1026.98 639.943 1031.35 623.02L1082.86 431.874C1087.23 414.951 1101.84 403.623 1119.34 403.623H1211.41V674.416L0 674.416L0 651.595Z" fill="#EE3430"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M0 651.595L994.863 651.595C1012.37 651.595 1026.98 639.943 1031.35 623.02L1082.86 431.874C1087.23 414.951 1101.84 403.623 1119.34 403.623H1211.41V674.416L0 674.416L0 651.595ZM1211.64 427.165H1174.4C1156.9 427.165 1142.29 438.493 1137.92 455.416L1086.41 646.562C1082.04 663.485 1067.43 674.546 1049.93 674.546H1211.64V427.165Z" fill="#8D2676"/>
    </g>
  </g>
  <defs>
    <clipPath id="clip0"><rect width="1200" height="675" fill="white"/></clipPath>
    <clipPath id="clip1"><rect width="1212" height="318.823" fill="white" transform="translate(0 355.859)"/></clipPath>
  </defs>
</svg>
```

Remove the dark `rect` if you need the stripes on a transparent background. How each path works: every stripe is one even odd path built from two ribbon shapes. The constant vertical offset between the outer and inner edge (about 23.5 units) is what keeps the stripe thickness uniform through the bend. The `C` segments at each knee carry the large radius. If you redraw this by hand with `stroke-width` instead of filled ribbons, use `stroke-linejoin: round` and a stroke of about 23.5 units, and you will land very close.

Placement in the app, three usages, all decorative and `pointer-events: none` where layered:

```css
/* Hero band: art pinned right bottom, sized by width, never stretched */
html[data-theme="convex"] .hero {
  background-color: #211718;
  background-image: url("/brand/convex-racing-lines.png");
  background-position: right bottom;
  background-repeat: no-repeat;
  background-size: min(72vw, 1140px) auto;
}

/* Editorial hero card: art slides in from the corner, sized by height */
html[data-theme="convex"] .editorial-hero::after {
  content: "";
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: min(58%, 720px);
  height: 140px;
  background: url("/brand/convex-racing-lines.png") right bottom / auto 100% no-repeat;
  pointer-events: none;
}

/* Join page: same art as a faint watermark behind content */
html[data-theme="convex"] .join-page::before {
  content: "";
  position: absolute;
  z-index: -1;
  right: 0;
  top: 8%;
  width: min(55vw, 760px);
  height: 220px;
  background: url("/brand/convex-racing-lines.png") right center / auto 100% no-repeat;
  opacity: 0.16;
  pointer-events: none;
}
```

The placement rules that matter:

- Always anchor to the right edge. The flat run bleeds off the left, the climb lives at the right.
- Size one axis and let the other stay `auto`. Never `background-size: 100% 100%` on the raw stripes and never `cover`. Stretching changes the climb angle and the stripe thickness and that is the number one tell of a bad copy.
- The art sits behind content. Copy blocks above it get `position: relative; z-index: 1`.
- For watermark use, drop opacity to around 0.16 and never put text directly on top of full strength stripes.
- On mobile the hero shrinks the art with `background-size: auto 100px` so the stripes stay thin instead of dominating.

### 4. The signal panel edge rule

The dark stat card in the hero carries a vertical rule down its left edge, drawn with a `::before`:

```css
.signal-panel::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 8px;          /* 6px in the Convex theme */
  height: 100%;
  background: var(--signal-coral);
}
```

In the Convex theme the rule becomes a stacked tri color stripe using the same brand colors as the racing lines, drawn as a hard stop linear gradient:

```css
html[data-theme="convex"] .signal-panel::before {
  width: 6px;
  background: linear-gradient(#f3b01c 0 33%, #ee342f 33% 66%, #8d2676 66%);
}
```

Hard stops, equal thirds, no blending. If the colors feather into each other the gradient stops are wrong.

### 5. Hairline grids inside sections

The methodology grid draws an internal table with borders only, no gaps and no card backgrounds:

```css
.method-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--line-emphasis);
}
.method-grid section {
  min-height: 220px;
  padding: 32px;
  border-bottom: 1px solid var(--line-emphasis);
}
.method-grid section:nth-child(odd) {
  border-right: 1px solid var(--line-emphasis);
}
```

The pattern: one shared top rule, per cell bottom rules, and a right rule on odd cells only so the center line never doubles. Doubled 2px center lines are a common copy error.

### 6. Table rules

The leaderboard is a framed card with internal row rules:

```css
.leaderboard-table {
  background: var(--studio-sheet);
  border: 1px solid var(--line-emphasis);
  border-radius: var(--radius-medium);
  overflow: hidden;   /* clips the header band to the radius */
}
.table-header {
  border-bottom: 1px solid var(--line-emphasis);
}
.table-row {
  border-bottom: 1px solid var(--line-standard);
}
.table-row:last-child {
  border-bottom: 0;
}
```

Frame at emphasis, rows at standard, last row unruled so the frame closes the card. Rows are a CSS grid, not a `<table>`, with the column template in a `--board-grid` custom property.

### 7. Underlines and boxed labels

Text links underline with the accent color, thick offset underlines, not default browser underlines:

```css
.text-link {
  font-weight: 650;
  text-decoration-color: var(--signal-coral);
  text-decoration-thickness: 2px;
  text-underline-offset: 5px;
}
```

Quieter mono links (like the methodology link) use 1px thickness and 3px offset. Eyebrow kicker labels in the Convex theme are boxed in a 1px `currentColor` border with a 3px radius. Meta chips are 1px `--line-standard` pills. Between hero eyebrow items, a coral slash `/` acts as the separator, inserted with `::before` on `span + span`.

---

## Typography

| Role | Face | Loading |
|---|---|---|
| Big page headlines | `neue-haas-grotesk-display`, weight 900 | Adobe Fonts kit (licensed, see assets section) |
| Display headings | Inter, weights 400 to 700 | Google Fonts |
| Body and UI | Geist, weights 300 to 800 | Google Fonts |
| Labels, numbers, code | Geist Mono, weights 400 to 700 | Google Fonts |

```css
:root {
  --font-body: "Geist";
  --font-display: "Inter";
  --font-mono: "Geist Mono";
}
```

Rules that carry the voice:

- Headlines run tight. Tracking `-0.02em` at weight 900, up to `-0.065em` on lighter display settings. Line height 0.94 or below on heroes.
- The Convex theme sets hero headlines in uppercase at `clamp(48px, 5vw, 74px)`. Studio keeps sentence case at weight 430.
- Every label, kicker, chip, and table header is mono, uppercase, letter spaced `0.06em` to `0.1em`, sized 10px to 12px, weight 600 to 650.
- All numeric cells use `font-variant-numeric: tabular-nums` so live values never shift layout.
- Body copy sits around 15px to 17px with line height 1.45 to 1.65.

---

## Spacing, radius, layout

- Page column: `--page-width: 1400px` with `--page-gutter: clamp(20px, 5vw, 72px)`.
- Full bleed bands (Convex header, hero, footer) keep content aligned to the column with `padding-inline: max(var(--page-gutter), calc((100vw - var(--page-width)) / 2 + var(--page-gutter)))`.
- Spacing walks a loose 4px rhythm: 4, 8, 10, 12, 14, 16, 20, 24, 28, 32, 48.
- Radius scale: small 8px, medium 14px, large 20px in Convex. Small 6px, medium 12px, large 22px in Studio. Pills and circular icon buttons use `border-radius: 999px` or `50%`.
- Interactive targets are 44px minimum. Icon buttons are 44px circles with 1px alpha borders.
- Depth is borders first. Shadows exist only on floating layers (dropdowns, mobile nav) and as one soft ambient card shadow in the Convex theme, `0 12px 38px rgba(61, 31, 31, 0.07)`.

---

## Motion and states

- Micro transitions run 150ms to 160ms ease on background, border, and color.
- Press feedback is `transform: translateY(1px)` on `:active`.
- Focus is a 3px outline in the accent color mixed 28 percent toward transparent, offset 3px.
- Disabled is `opacity: 0.42` with `cursor: not-allowed`.
- The one looping animation is the signal pulse dot, 2.2s ease in and out, scaling 0.8 to 1 and fading 0.45 to 1.
- `prefers-reduced-motion: reduce` collapses all animation and transition durations to 0.01ms.

---

## Public assets and what is safe to reuse

Assets served by the site that this design references:

| Asset | URL | Notes |
|---|---|---|
| Racing lines PNG | `https://friendsofconvex.dev/brand/convex-racing-lines.png` | 3266 x 859, transparent background, the exact file the CSS loads |
| Racing lines SVG source | inlined in this doc, also `design/references/lines-source.svg` in the repo | vector master, redraw or recolor from this |
| OG card art with stripes | `https://friendsofconvex.dev/background-image-sidebar.svg` | 1200 x 675 dark card with the stripes along the bottom, used by the gift share card |
| Convex logo, color | `https://friendsofconvex.dev/brand/convex-logo-color.svg` | Convex brand mark |
| Convex logo, white | `https://friendsofconvex.dev/brand/convex-logo-white.svg` | for dark surfaces |
| Convex logo, black | `https://friendsofconvex.dev/brand/convex-logo-black.svg` | for light surfaces |
| Convex symbol | `https://friendsofconvex.dev/convex/symbol-color.svg` | small mark used in the footer |

Licensing notes, read before shipping:

- The racing lines and the Convex logos are Convex brand art. They trace to the convex.dev homepage and brand kit. Fine for community projects that point at Convex. Get your marks from [convex.dev](https://www.convex.dev) directly if you want the canonical files, and follow their brand guidance.
- Geist, Geist Mono, and Inter are open licensed and load from [Google Fonts](https://fonts.google.com). Safe to use anywhere:

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..800&family=Geist+Mono:wght@400..700&family=Inter:wght@400..700&display=swap" rel="stylesheet" />
```

- The headline face `neue-haas-grotesk-display` loads from an Adobe Fonts kit licensed to this site (`use.typekit.net/xmd6bow.css`). Do not hotlink someone else's kit. Create your own Adobe Fonts web project, or substitute Inter at weight 800 to 900 with `-0.02em` tracking, which lands close.
- There is one more file, `https://friendsofconvex.dev/background-image.svg`, a radial gradient card background. The app does not use it in the UI. The design system bans radial gradient backgrounds, so skip it.

---

## Checklist for a faithful copy

Work through this before calling a reproduction done.

1. Borders are ink alphas from a three step scale, never solid gray hex.
2. The graph paper grid is 48px, 1px lines, 3.5 percent alpha, body only.
3. Racing lines anchor right, size one axis with the other on `auto`, and never stretch.
4. Stripe order is yellow, red, purple, top to bottom, stripes touching, staggered bends.
5. The signal panel edge rule uses hard gradient stops at exact thirds.
6. Internal grids share rules, odd cell right borders only, no doubled center lines.
7. Tables frame at emphasis, rule rows at standard, drop the last row rule.
8. Underlines are accent colored, 2px thick, offset 5px.
9. Labels are mono, uppercase, letter spaced, 10px to 12px.
10. Numbers are tabular so nothing shifts when data updates.
11. Headlines are heavy and tight in Convex, light and tight in Studio.
12. One accent color per theme. Yellow, red, and purple appear only inside the brand stripe motifs.
13. No radial gradients anywhere.
14. Focus rings, hover fills, press nudges, and reduced motion all present.
