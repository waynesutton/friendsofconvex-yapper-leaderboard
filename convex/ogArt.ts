// Shared OpenGraph card art and the board share card SVG. Pure strings and
// functions with no imports, so the Node renderers, vitest, and the local
// preview script (scripts/preview-board-og.mjs) all build the same SVG.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const CONVEX_SYMBOL = `
  <path d="M108.092 130.021C126.258 128.003 143.385 118.323 152.815 102.167C148.349 142.128 104.653 167.385 68.9858 151.878C65.6992 150.453 62.8702 148.082 60.9288 145.034C52.9134 132.448 50.2786 116.433 54.0644 101.899C64.881 120.567 86.8748 132.01 108.092 130.021Z" fill="#F3B01C"/>
  <path d="M53.4012 90.1735C46.0375 107.191 45.7186 127.114 54.7463 143.51C22.9759 119.608 23.3226 68.4578 54.358 44.7949C57.2286 42.6078 60.64 41.3097 64.2178 41.1121C78.9312 40.336 93.8804 46.0225 104.364 56.6193C83.0637 56.831 62.318 70.4756 53.4012 90.1735Z" fill="#8D2676"/>
  <path d="M114.637 61.8552C103.89 46.8701 87.0686 36.6684 68.6387 36.358C104.264 20.1876 148.085 46.4045 152.856 85.1654C153.3 88.7635 152.717 92.4322 151.122 95.6775C144.466 109.195 132.124 119.679 117.702 123.559C128.269 103.96 126.965 80.0151 114.637 61.8552Z" fill="#EE342F"/>
`;

// Racing stripe lines from public/background-image-sidebar.svg. The art is
// drawn for a 1200x675 frame with the stripes anchored to the bottom edge,
// so a -45px vertical shift bottom-aligns them on the 1200x630 OG canvas.
// The lines run flat near y=559 on the left and rise to y=311 past x=975.
export const BOTTOM_STRIPES = `
  <g transform="translate(0, -45)">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M0 604.47L895.679 604.47C913.235 604.47 927.916 592.681 932.205 575.651L982.897 383.956C987.186 366.926 1001.87 355.859 1019.42 355.859H1211.41V674.416L0 674.416L0 604.47ZM0 628.029L945.289 628.029C962.809 628.029 977.443 616.329 981.785 599.365L1032.82 408.012C1037.16 391.054 1051.8 379.714 1069.32 379.714H1211.41V674.416L0 674.416L0 628.029Z" fill="#F3B01D"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M0 628.03L945.289 628.03C962.809 628.03 977.443 616.33 981.785 599.365L1032.82 408.012C1037.16 391.054 1051.8 379.715 1069.32 379.715H1211.41V674.416L0 674.416L0 628.03ZM0 651.595L994.863 651.595C1012.37 651.595 1026.98 639.943 1031.35 623.02L1082.86 431.874C1087.23 414.951 1101.84 403.623 1119.34 403.623H1211.41V674.416L0 674.416L0 651.595Z" fill="#EE3430"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M0 651.595L994.863 651.595C1012.37 651.595 1026.98 639.943 1031.35 623.02L1082.86 431.874C1087.23 414.951 1101.84 403.623 1119.34 403.623H1211.41V674.416L0 674.416L0 651.595ZM1211.64 427.165H1174.4C1156.9 427.165 1142.29 438.493 1137.92 455.416L1086.41 646.562C1082.04 663.485 1067.43 674.546 1049.93 674.546H1211.64V427.165Z" fill="#8D2676"/>
  </g>
`;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function fitLabel(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1))}…`;
}

// 12345 -> "12.3K", 1200000 -> "1.2M". Matches how the board reads numbers.
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}M`;
  if (abs >= 10_000) return `${trim(value / 1_000)}K`;
  return value.toLocaleString("en-US");
}

// "Oct 6, 2026, 8:17 AM PT". The board refreshes on a Pacific schedule.
export function formatAsOf(timestamp: number): string {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
  return `${text} PT`;
}

export type BoardCardRow = {
  rank: number | null;
  handle: string;
  displayName: string;
  // Base64 data URI or null for the placeholder circle.
  avatar: string | null;
  value: number | null;
};

export type BoardCardInput = {
  communityName: string;
  boardLabel: string;
  kind: "ranked" | "legends";
  metricLabel: string;
  rows: Array<BoardCardRow>;
  dataAsOf: number | null;
};

const LEFT = 80;
const RIGHT = 880;
const ROWS_TOP = 214;
const ROW_HEIGHT = 60;
const AVATAR_RADIUS = 21;
const CREAM = "#FFFEFA";
const MUTED = "rgba(255,254,250,0.62)";
const FAINT = "rgba(255,254,250,0.1)";
const GOLD = "#F3B01D";

// Small crown for Legends rows, drawn 28x22 at the given origin.
function crown(x: number, y: number): string {
  return `<g transform="translate(${x}, ${y})">
    <path d="M0 6 L7 12 L14 0 L21 12 L28 6 L25 18 L3 18 Z" fill="${GOLD}" />
    <rect x="3" y="19" width="22" height="3" rx="1.5" fill="${GOLD}" />
  </g>`;
}

function rowSvg(row: BoardCardRow, index: number, legends: boolean): string {
  const top = ROWS_TOP + index * ROW_HEIGHT;
  const cy = top + ROW_HEIGHT / 2;
  const avatarCx = LEFT + 76;
  const textX = avatarCx + AVATAR_RADIUS + 18;
  const clipId = `avatar-${index}`;

  const marker = legends
    ? crown(LEFT + 4, cy - 12)
    : `<text x="${LEFT + 18}" y="${cy + 9}" text-anchor="middle" font-family="Inter"
        font-weight="700" font-size="26" fill="${row.rank === 1 ? GOLD : CREAM}">${row.rank ?? ""}</text>`;

  const avatar = row.avatar
    ? `<clipPath id="${clipId}"><circle cx="${avatarCx}" cy="${cy}" r="${AVATAR_RADIUS}" /></clipPath>
      <image href="${row.avatar}" x="${avatarCx - AVATAR_RADIUS}" y="${cy - AVATAR_RADIUS}"
        width="${AVATAR_RADIUS * 2}" height="${AVATAR_RADIUS * 2}"
        preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`
    : `<circle cx="${avatarCx}" cy="${cy}" r="${AVATAR_RADIUS}" fill="rgba(255,255,255,0.08)" />
      <text x="${avatarCx}" y="${cy + 7}" text-anchor="middle" font-family="Inter" font-weight="700"
        font-size="20" fill="rgba(255,254,250,0.7)">@</text>`;

  const value =
    row.value === null
      ? ""
      : `<text x="${RIGHT}" y="${cy + 9}" text-anchor="end" font-family="Inter" font-weight="700"
          font-size="26" fill="${CREAM}">${escapeXml(formatCompact(row.value))}</text>`;

  // Names get less room when a metric value sits on the right.
  const nameMax = row.value === null ? 44 : 34;
  const divider =
    index === 0
      ? ""
      : `<line x1="${LEFT}" y1="${top}" x2="${RIGHT}" y2="${top}" stroke="${FAINT}" stroke-width="1" />`;

  return `${divider}
    ${marker}
    ${avatar}
    <circle cx="${avatarCx}" cy="${cy}" r="${AVATAR_RADIUS + 3}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.25" />
    <text x="${textX}" y="${cy - 2}" font-family="Inter" font-weight="700" font-size="21"
      fill="${CREAM}">${escapeXml(fitLabel(row.displayName, nameMax))}</text>
    <text x="${textX}" y="${cy + 19}" font-family="Inter" font-weight="500" font-size="15"
      fill="${MUTED}">@${escapeXml(fitLabel(row.handle, 40))}</text>
    ${value}`;
}

// The 1200x630 board share card: lockup, board name, up to five rows, and
// an as-of line, all left of the rising stripes so nothing overlaps them.
export function buildBoardCardSvg(input: BoardCardInput): string {
  const legends = input.kind === "legends";
  const rows = input.rows.slice(0, 5);
  const subtitle = legends
    ? "Retired undefeated"
    : rows.length === 1
      ? "Leading right now"
      : `Top ${rows.length} right now`;
  const asOf =
    input.dataAsOf === null ? "" : `Board as of ${formatAsOf(input.dataAsOf)}`;
  const labelSize = Math.min(48, Math.max(30, Math.floor(760 / (input.boardLabel.length * 0.6))));

  return `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#2A1E1D" />
  ${BOTTOM_STRIPES}

  <g transform="translate(62, 38) scale(0.3)">${CONVEX_SYMBOL}</g>
  <text x="132" y="78" font-family="Inter" font-weight="700" font-size="18"
    letter-spacing="3.2" fill="${CREAM}">${escapeXml(fitLabel(input.communityName.toUpperCase(), 40))}</text>

  <text x="${LEFT - 2}" y="152" font-family="Inter" font-weight="700" font-size="${labelSize}"
    letter-spacing="${(-0.02 * labelSize).toFixed(1)}" fill="${CREAM}">${escapeXml(fitLabel(input.boardLabel, 28))}</text>
  <text x="${LEFT}" y="186" font-family="Inter" font-weight="500" font-size="17"
    fill="${MUTED}">${escapeXml(subtitle)}</text>
  ${
    legends
      ? ""
      : `<text x="${RIGHT}" y="186" text-anchor="end" font-family="Inter" font-weight="700"
    font-size="13" letter-spacing="2" fill="${MUTED}">${escapeXml(input.metricLabel.toUpperCase())}</text>`
  }

  ${rows.map((row, index) => rowSvg(row, index, legends)).join("\n")}

  <text x="${LEFT}" y="${ROWS_TOP + Math.max(rows.length, 1) * ROW_HEIGHT + 30}" font-family="Inter" font-weight="500"
    font-size="14" fill="${MUTED}">${escapeXml(asOf)}</text>
</svg>`;
}
