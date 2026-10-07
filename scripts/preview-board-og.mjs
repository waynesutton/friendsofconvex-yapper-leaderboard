// Local preview of the board share card. Uses the same SVG builder as the
// Convex renderer (convex/ogArt.ts, loaded with Node's built in type
// stripping) plus the shipped wasm and fonts from public/render. Avatars are
// left as placeholders so the preview needs no network.
// Usage: node scripts/preview-board-og.mjs [ranked|convex|legends] [label]
import { readFile, writeFile } from "node:fs/promises";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { buildBoardCardSvg } from "../convex/ogArt.ts";

const variant = process.argv[2] ?? "ranked";
const people = [
  ["waynesutton", "Wayne Sutton", 48210],
  ["jamwt", "James Cowling", 31877],
  ["ianmacartney", "Ian Macartney", 18450],
  ["thomasballinger", "Tom Ballinger", 9312],
  ["a_very_long_handle_name", "Someone With A Really Long Display Name", 4210],
];

const legends = variant === "legends";
const convex = variant === "convex";
const label =
  process.argv[3] ?? (legends ? "Legends" : convex ? "Convex mentions" : "Yappers");

const svg = buildBoardCardSvg({
  communityName: "Friends of Convex",
  boardLabel: label,
  kind: legends ? "legends" : "ranked",
  metricLabel: convex ? "Convex posts" : "Engagements",
  dataAsOf: Date.now(),
  rows: people.map(([handle, displayName, value], index) => ({
    rank: legends ? null : index + 1,
    handle,
    displayName,
    avatar: null,
    value: legends ? null : convex ? Math.round(value / 1000) : value,
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
