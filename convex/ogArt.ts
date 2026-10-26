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
  // Pacific day (YYYY-MM-DD) of a saved daily ranking. Set means the card
  // names that date instead of "right now".
  rankingDay?: string | null;
  // "week" turns the subtitle into "Top 10 for the week ending" the
  // ranking day. Needs rankingDay.
  period?: "week" | null;
};

// "Sat, Oct 24, 2026" from a YYYY-MM-DD key. Mirrors formatDayLabel in
// rankingDays.ts, inlined so this file keeps no imports.
function formatRankingDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
}

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

// Frame values are written with at most 3 decimals so SVG strings stay short.
function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

// Wraps animated content in a group carrying its opacity, vertical offset,
// and filter. Settled content comes back untouched, which is what keeps the
// last video frame identical to the static card.
function layer(content: string, opacity: number, offset = 0, filterId?: string): string {
  const attrs: Array<string> = [];
  if (opacity !== 1) attrs.push(`opacity="${fmt(opacity)}"`);
  if (offset !== 0) attrs.push(`transform="translate(0 ${fmt(offset)})"`);
  if (filterId) attrs.push(`filter="url(#${filterId})"`);
  if (attrs.length === 0) return content;
  return `<g ${attrs.join(" ")}>${content}</g>`;
}

type RowFrame = { opacity: number; offset: number; dividerX2: number; pulseScale: number };

// Up to 5 rows stack in one column. A weekly top 10 splits into two columns
// of 5 (ranks 1 to 5 left, 6 to 10 right) inside the same text area, so the
// card keeps clear of the rising stripes.
const COLUMN_ROWS = 5;
const COLUMN_GAP = 40;
const COLUMN_WIDTH = (RIGHT - LEFT - COLUMN_GAP) / 2;

type RowPlace = { left: number; right: number; slot: number; compact: boolean };

function rowPlace(index: number, twoColumns: boolean): RowPlace {
  if (!twoColumns) return { left: LEFT, right: RIGHT, slot: index, compact: false };
  const column = Math.floor(index / COLUMN_ROWS);
  const left = LEFT + column * (COLUMN_WIDTH + COLUMN_GAP);
  return { left, right: left + COLUMN_WIDTH, slot: index % COLUMN_ROWS, compact: true };
}

function rowSvg(
  row: BoardCardRow,
  index: number,
  legends: boolean,
  place: RowPlace,
  frame?: RowFrame,
): string {
  const settled = frame ?? { opacity: 1, offset: 0, dividerX2: place.right, pulseScale: 1 };
  const { left, right } = place;
  const top = ROWS_TOP + place.slot * ROW_HEIGHT;
  const cy = top + ROW_HEIGHT / 2;
  const avatarCx = left + (place.compact ? 66 : 76);
  const textX = avatarCx + AVATAR_RADIUS + 18;
  const clipId = `avatar-${index}`;

  const rankMarker = legends
    ? crown(left + 4, cy - 12)
    : `<text x="${left + 18}" y="${cy + 9}" text-anchor="middle" font-family="Inter"
        font-weight="700" font-size="26" fill="${row.rank === 1 ? GOLD : CREAM}">${row.rank ?? ""}</text>`;
  // The rank 1 pulse scales the number around its own center.
  const marker =
    settled.pulseScale === 1
      ? rankMarker
      : `<g transform="translate(${left + 18} ${cy}) scale(${fmt(settled.pulseScale)}) translate(${-(left + 18)} ${-cy})">${rankMarker}</g>`;

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
      : `<text x="${right}" y="${cy + 9}" text-anchor="end" font-family="Inter" font-weight="700"
          font-size="26" fill="${CREAM}">${escapeXml(formatCompact(row.value))}</text>`;

  // Names get less room when a metric value sits on the right, and half
  // width columns get less again.
  const nameMax = place.compact ? (row.value === null ? 21 : 15) : row.value === null ? 44 : 34;
  const handleMax = place.compact ? 26 : 40;
  const divider =
    place.slot === 0
      ? ""
      : `<line x1="${left}" y1="${top}" x2="${fmt(settled.dividerX2)}" y2="${top}" stroke="${FAINT}" stroke-width="1" />`;

  const body = `${marker}
    ${avatar}
    <circle cx="${avatarCx}" cy="${cy}" r="${AVATAR_RADIUS + 3}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.25" />
    <text x="${textX}" y="${cy - 2}" font-family="Inter" font-weight="700" font-size="21"
      fill="${CREAM}">${escapeXml(fitLabel(row.displayName, nameMax))}</text>
    <text x="${textX}" y="${cy + 19}" font-family="Inter" font-weight="500" font-size="15"
      fill="${MUTED}">@${escapeXml(fitLabel(row.handle, handleMax))}</text>
    ${value}`;

  return `${divider}
    ${layer(body, settled.opacity, settled.offset)}`;
}

// Everything the card and its video frames derive from the input.
function cardLayout(input: BoardCardInput) {
  const legends = input.kind === "legends";
  const rows = input.rows.slice(0, COLUMN_ROWS * 2);
  const twoColumns = rows.length > COLUMN_ROWS;
  const label = fitLabel(input.boardLabel, 28);
  const day = legends ? null : (input.rankingDay ?? null);
  const week = day !== null && input.period === "week";
  return {
    legends,
    rows,
    twoColumns,
    label,
    // Split keeping the whitespace, so word layers rebuild the exact label.
    labelTokens: label.split(/(\s+)/).filter((token) => token !== ""),
    subtitle: legends
      ? "Retired undefeated"
      : week
        ? rows.length === 1
          ? "Leading the week ending "
          : `Top ${rows.length} for the week ending `
        : day
          ? rows.length === 1
            ? "Leading on "
            : `Top ${rows.length} on `
          : rows.length === 1
            ? "Leading right now"
            : `Top ${rows.length} right now`,
    // A saved day's date, drawn bold right after the subtitle.
    subtitleDate: day ? formatRankingDay(day) : null,
    asOf:
      input.dataAsOf === null
        ? ""
        : week
          ? `Last 7 days as of ${formatAsOf(input.dataAsOf)}`
          : day
            ? `Saved ranking, last 7 days as of ${formatAsOf(input.dataAsOf)}`
            : `Board as of ${formatAsOf(input.dataAsOf)}`,
    labelSize: Math.min(48, Math.max(30, Math.floor(760 / (input.boardLabel.length * 0.6)))),
    showMetric: !(legends || rows.every((row) => row.value === null)),
  };
}

function isWord(token: string): boolean {
  return !/^\s+$/.test(token);
}

// Board share video motion, ported from the TWIC renderer's timeline.
export const VIDEO_FPS = 30;
const HOLD_SECONDS = 3;

export type VideoBeat = { start: number; duration: number };

export type BoardVideoTimeline = {
  // Seconds from the empty canvas to the end of the hold.
  duration: number;
  buildEnd: number;
  beats: {
    stripes: VideoBeat;
    lockup: VideoBeat;
    words: Array<VideoBeat>;
    subtitle: VideoBeat;
    rows: Array<VideoBeat>;
    dividers: Array<VideoBeat>;
    pulse: VideoBeat;
    asOf: VideoBeat;
  };
};

function beatEnd(beat: VideoBeat): number {
  return beat.start + beat.duration;
}

export function boardVideoTimeline(input: BoardCardInput): BoardVideoTimeline {
  const layout = cardLayout(input);
  const wordCount = Math.max(1, layout.labelTokens.filter(isWord).length);
  const words = Array.from({ length: wordCount }, (_, index) => ({
    start: 0.45 + index * 0.09,
    duration: 0.45,
  }));
  // The panel keys off the start of the last label word, as in TWIC.
  const panel = words[wordCount - 1]!.start + 0.25;
  // Ten rows cascade faster so the video stays about as long as a top 5.
  const stagger = layout.twoColumns ? 0.06 : 0.12;
  const rows = layout.rows.map((_, index) => ({
    start: panel + 0.25 + index * stagger,
    duration: 0.4,
  }));
  const dividers = rows.map((row) => ({ start: row.start, duration: 0.3 }));
  const lastRowEnd = rows.length > 0 ? beatEnd(rows[rows.length - 1]!) : panel + 0.25;
  const beats = {
    stripes: { start: 0, duration: 1.1 },
    lockup: { start: 0.1, duration: 0.5 },
    words,
    subtitle: { start: panel, duration: 0.45 },
    rows,
    dividers,
    pulse: { start: lastRowEnd + 0.15, duration: 0.35 },
    asOf: { start: lastRowEnd + 0.3, duration: 0.4 },
  };
  const buildEnd = Math.max(
    beatEnd(beats.stripes),
    beatEnd(words[wordCount - 1]!),
    beatEnd(beats.subtitle),
    lastRowEnd,
    beatEnd(beats.pulse),
    beatEnd(beats.asOf),
  );
  return { duration: buildEnd + HOLD_SECONDS, buildEnd, beats };
}

function progress(beat: VideoBeat, t: number): number {
  return Math.min(1, Math.max(0, (t - beat.start) / beat.duration));
}

// Ease out cubic and ease in out cubic, the two curves the TWIC engine uses.
function eo(x: number): number {
  return 1 - (1 - x) ** 3;
}

function eio(x: number): number {
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
}

export type BoardVideoFrameState = {
  stripesWidth: number;
  lockupOpacity: number;
  words: Array<{ opacity: number; offset: number; blur: number }>;
  subtitle: { opacity: number; offset: number };
  rows: Array<{ opacity: number; offset: number; dividerX2: number }>;
  pulseScale: number;
  asOfOpacity: number;
};

// Numeric state of every animated element at time t. Past the build every
// value is settled exactly (opacity 1, offset 0, blur 0, scale 1).
export function boardVideoFrameState(
  input: BoardCardInput,
  t: number,
  timeline: BoardVideoTimeline = boardVideoTimeline(input),
): BoardVideoFrameState {
  const { beats } = timeline;
  const pulse = progress(beats.pulse, t);
  const { twoColumns } = cardLayout(input);
  return {
    stripesWidth: OG_WIDTH * eio(progress(beats.stripes, t)),
    lockupOpacity: eo(progress(beats.lockup, t)),
    words: beats.words.map((beat) => {
      const eased = eo(progress(beat, t));
      return { opacity: eased, offset: 18 * (1 - eased), blur: 3 * (1 - eased) };
    }),
    subtitle: (() => {
      const eased = eo(progress(beats.subtitle, t));
      return { opacity: eased, offset: 30 * (1 - eased) };
    })(),
    rows: beats.rows.map((beat, index) => {
      const eased = eo(progress(beat, t));
      const line = eo(progress(beats.dividers[index]!, t));
      const { left, right } = rowPlace(index, twoColumns);
      return {
        opacity: eased,
        offset: 16 * (1 - eased),
        dividerX2: left + (right - left) * line,
      };
    }),
    pulseScale: pulse <= 0 || pulse >= 1 ? 1 : 1 + 0.12 * Math.sin(Math.PI * pulse),
    asOfOpacity: eo(progress(beats.asOf, t)),
  };
}

// One renderer for the static card and every video frame. A null frame is
// the settled card.
function renderBoardCard(
  input: BoardCardInput,
  frame: BoardVideoFrameState | null,
  fontFaces?: string,
): string {
  const {
    legends,
    rows,
    twoColumns,
    label,
    labelTokens,
    subtitle,
    subtitleDate,
    asOf,
    labelSize,
    showMetric,
  } = cardLayout(input);
  const defs: Array<string> = [];
  if (fontFaces) defs.push(`<style><![CDATA[${fontFaces}]]></style>`);

  let stripes = BOTTOM_STRIPES;
  if (frame && frame.stripesWidth < OG_WIDTH) {
    defs.push(
      `<clipPath id="stripes-reveal"><rect x="0" y="0" width="${fmt(frame.stripesWidth)}" height="${OG_HEIGHT}" /></clipPath>`,
    );
    stripes = `<g clip-path="url(#stripes-reveal)">${BOTTOM_STRIPES}</g>`;
  }

  const labelOpen = `<text x="${LEFT - 2}" y="152" font-family="Inter" font-weight="700" font-size="${labelSize}"
    letter-spacing="${(-0.02 * labelSize).toFixed(1)}" fill="${CREAM}">`;
  const wordFrames = frame?.words ?? [];
  const labelSettled = wordFrames.every(
    (word) => word.opacity === 1 && word.offset === 0 && word.blur === 0,
  );
  let labelSvg = `${labelOpen}${escapeXml(label)}</text>`;
  if (!labelSettled) {
    // Each word draws on its own layer holding the full label with the other
    // words transparent, so glyph positions match the static text exactly.
    const wordIndexes = labelTokens.flatMap((token, index) => (isWord(token) ? [index] : []));
    labelSvg = wordIndexes
      .map((tokenIndex, wordIndex) => {
        const word = wordFrames[wordIndex] ?? { opacity: 1, offset: 0, blur: 0 };
        const before = labelTokens.slice(0, tokenIndex).join("");
        const after = labelTokens.slice(tokenIndex + 1).join("");
        const hidden = (text: string) =>
          text ? `<tspan fill-opacity="0">${escapeXml(text)}</tspan>` : "";
        let filterId: string | undefined;
        if (word.blur > 0) {
          filterId = `word-blur-${wordIndex}`;
          defs.push(
            `<filter id="${filterId}" x="-5%" y="-40%" width="110%" height="180%"><feGaussianBlur stdDeviation="${fmt(word.blur)}" /></filter>`,
          );
        }
        return layer(
          `${labelOpen}${hidden(before)}${escapeXml(labelTokens[tokenIndex]!)}${hidden(after)}</text>`,
          word.opacity,
          word.offset,
          filterId,
        );
      })
      .join("\n  ");
  }

  const subtitleSvg = `<text x="${LEFT}" y="186" font-family="Inter" font-weight="500" font-size="17"
    fill="${MUTED}">${escapeXml(subtitle)}${
      subtitleDate
        ? `<tspan font-weight="700" fill="${CREAM}">${escapeXml(subtitleDate)}</tspan>`
        : ""
    }</text>
  ${
    showMetric
      ? `<text x="${RIGHT}" y="186" text-anchor="end" font-family="Inter" font-weight="700"
    font-size="13" letter-spacing="2" fill="${MUTED}">${escapeXml(input.metricLabel.toUpperCase())}</text>`
      : ""
  }`;

  const rowsSvg = rows
    .map((row, index) => {
      const place = rowPlace(index, twoColumns);
      const rowFrame = frame?.rows[index];
      if (!frame || !rowFrame) return rowSvg(row, index, legends, place);
      return rowSvg(row, index, legends, place, {
        ...rowFrame,
        pulseScale: row.rank === 1 ? frame.pulseScale : 1,
      });
    })
    .join("\n");

  const rowSlots = twoColumns ? COLUMN_ROWS : Math.max(rows.length, 1);
  const asOfSvg = `<text x="${LEFT}" y="${ROWS_TOP + rowSlots * ROW_HEIGHT + 30}" font-family="Inter" font-weight="500"
    font-size="14" fill="${MUTED}">${escapeXml(asOf)}</text>`;

  return `<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${
    defs.length > 0 ? `\n  <defs>${defs.join("")}</defs>` : ""
  }
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="#2A1E1D" />
  ${stripes}

  ${layer(
    `<g transform="translate(62, 38) scale(0.3)">${CONVEX_SYMBOL}</g>
  <text x="132" y="78" font-family="Inter" font-weight="700" font-size="18"
    letter-spacing="3.2" fill="${CREAM}">${escapeXml(fitLabel(input.communityName.toUpperCase(), 40))}</text>`,
    frame?.lockupOpacity ?? 1,
  )}

  ${labelSvg}
  ${layer(subtitleSvg, frame?.subtitle.opacity ?? 1, frame?.subtitle.offset ?? 0)}

  ${rowsSvg}

  ${layer(asOfSvg, frame?.asOfOpacity ?? 1)}
</svg>`;
}

// The 1200x630 board share card: lockup, board name, up to five rows (ten in
// two columns for a weekly top 10), and
// an as-of line, all left of the rising stripes so nothing overlaps them.
export function buildBoardCardSvg(input: BoardCardInput): string {
  return renderBoardCard(input, null);
}

// One frame of the board share video at time t (seconds). At or past
// timeline.duration this is buildBoardCardSvg(input), byte for byte, when no
// fontFaces are passed. fontFaces is CSS with embedded @font-face rules,
// needed when a browser draws the SVG as an image and cannot see page fonts.
export function buildBoardCardFrameSvg(
  input: BoardCardInput,
  t: number,
  options: { fontFaces?: string } = {},
): string {
  return renderBoardCard(input, boardVideoFrameState(input, t), options.fontFaces);
}
