// Local preview of the board share card. Uses the same SVG builder as the
// Convex renderer (convex/ogArt.ts, loaded with Node's built in type
// stripping) plus the shipped wasm and fonts from public/render. Avatars are
// left as placeholders so the preview needs no network.
// Usage: node scripts/preview-board-og.mjs [ranked|convex|legends|weekly|weekly-convex] [label]
// The weekly variants draw a top 10 on the two column card.
import { readFile, writeFile } from "node:fs/promises";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { buildBoardCardSvg } from "../convex/ogArt.ts";

const variant = process.argv[2] ?? "ranked";
const weekly = variant.startsWith("weekly");
const top5 = [
  ["waynesutton", "Wayne Sutton", 48210],
  ["jamwt", "James Cowling", 31877],
  ["ianmacartney", "Ian Macartney", 18450],
  ["thomasballinger", "Tom Ballinger", 9312],
  ["a_very_long_handle_name", "Someone With A Really Long Display Name", 4210],
];
const people = weekly
  ? [
      ...top5,
      ["mikeysee", "Mike Cann", 3980],
      ["sshader", "Sarah Shader", 3120],
      ["nipunn", "Nipunn Koorapati", 2875],
      ["jordanhunt", "Jordan Hunt", 1990],
      ["rjdellecese", "RJ Dellecese", 1504],
    ]
  : top5;

const legends = variant === "legends";
const convex = variant === "convex" || variant === "weekly-convex";
const label =
  process.argv[3] ?? (legends ? "Legends" : convex ? "Convex mentions" : "Yappers");

const svg = buildBoardCardSvg({
  communityName: "Friends of Convex",
  boardLabel: label,
  kind: legends ? "legends" : "ranked",
  metricLabel: convex ? "Convex posts" : "Engagements",
  dataAsOf: Date.now(),
  ...(weekly ? { rankingDay: "2026-10-23", period: "week" } : {}),
  rows: people.map(([handle, displayName, value], index) => ({
    rank: legends ? null : index + 1,
    handle,
    displayName,
    avatar: null,
    value: convex ? Math.round(value / 1000) : null,
  })),
});

await initWasm(await readFile("public/render/resvg.wasm"));
const fonts = [
  new Uint8Array(await readFile("public/render/fonts/inter-500.ttf")),
  new Uint8Array(await readFile("public/render/fonts/inter-700.ttf")),
];
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: { fontBuffers: fonts, defaultFontFamily: "Inter", loadSystemFonts: false },
});
const png = resvg.render().asPng();
const out = `/tmp/board-og-${variant}.png`;
await writeFile(out, png);
console.log(`Wrote ${out} (${png.byteLength} bytes)`);
