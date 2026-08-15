// Local preview of the personalized share OG card. Mirrors the SVG builder in
// convex/giftShareRender.ts using the same wasm and fonts from public/render.
// Usage: node scripts/preview-share-og.mjs [handle] [displayName]
import { readFile, writeFile } from "node:fs/promises";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const handle = process.argv[2] ?? "Fayeezashaikh";
const displayName = process.argv[3] ?? "Fayeeza Shaikh";

const CONVEX_SYMBOL = `
  <path d="M108.092 130.021C126.258 128.003 143.385 118.323 152.815 102.167C148.349 142.128 104.653 167.385 68.9858 151.878C65.6992 150.453 62.8702 148.082 60.9288 145.034C52.9134 132.448 50.2786 116.433 54.0644 101.899C64.881 120.567 86.8748 132.01 108.092 130.021Z" fill="#F3B01C"/>
  <path d="M53.4012 90.1735C46.0375 107.191 45.7186 127.114 54.7463 143.51C22.9759 119.608 23.3226 68.4578 54.358 44.7949C57.2286 42.6078 60.64 41.3097 64.2178 41.1121C78.9312 40.336 93.8804 46.0225 104.364 56.6193C83.0637 56.831 62.318 70.4756 53.4012 90.1735Z" fill="#8D2676"/>
  <path d="M114.637 61.8552C103.89 46.8701 87.0686 36.6684 68.6387 36.358C104.264 20.1876 148.085 46.4045 152.856 85.1654C153.3 88.7635 152.717 92.4322 151.122 95.6775C144.466 109.195 132.124 119.679 117.702 123.559C128.269 103.96 126.965 80.0151 114.637 61.8552Z" fill="#EE342F"/>
`;

// Racing stripe lines from public/background-image-sidebar.svg. The art is
// 1200x675 with stripes anchored to the bottom edge; shifting up 45px
// bottom-aligns them on the 1200x630 OG canvas.
const BOTTOM_STRIPES = `
  <g transform="translate(0, -45)">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M0 604.47L895.679 604.47C913.235 604.47 927.916 592.681 932.205 575.651L982.897 383.956C987.186 366.926 1001.87 355.859 1019.42 355.859H1211.41V674.416L0 674.416L0 604.47ZM0 628.029L945.289 628.029C962.809 628.029 977.443 616.329 981.785 599.365L1032.82 408.012C1037.16 391.054 1051.8 379.714 1069.32 379.714H1211.41V674.416L0 674.416L0 628.029Z" fill="#F3B01D"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M0 628.03L945.289 628.03C962.809 628.03 977.443 616.33 981.785 599.365L1032.82 408.012C1037.16 391.054 1051.8 379.715 1069.32 379.715H1211.41V674.416L0 674.416L0 628.03ZM0 651.595L994.863 651.595C1012.37 651.595 1026.98 639.943 1031.35 623.02L1082.86 431.874C1087.23 414.951 1101.84 403.623 1119.34 403.623H1211.41V674.416L0 674.416L0 651.595Z" fill="#EE3430"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M0 651.595L994.863 651.595C1012.37 651.595 1026.98 639.943 1031.35 623.02L1082.86 431.874C1087.23 414.951 1101.84 403.623 1119.34 403.623H1211.41V674.416L0 674.416L0 651.595ZM1211.64 427.165H1174.4C1156.9 427.165 1142.29 438.493 1137.92 455.416L1086.41 646.562C1082.04 663.485 1067.43 674.546 1049.93 674.546H1211.64V427.165Z" fill="#8D2676"/>
  </g>
`;

const FIELD_LEFT = 80;
const bigText = `@${handle}`;
const bigSize = Math.min(96, Math.max(30, Math.floor(860 / (bigText.length * 0.62))));

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#2A1E1D" />
  ${BOTTOM_STRIPES}
  <g transform="translate(62, 38) scale(0.3)">${CONVEX_SYMBOL}</g>
  <text x="132" y="78" font-family="Inter" font-weight="700" font-size="18" letter-spacing="3.2" fill="#FFFEFA">FRIENDS OF CONVEX</text>
  <circle cx="${FIELD_LEFT + 40}" cy="210" r="40" fill="rgba(255,255,255,0.08)" />
  <circle cx="${FIELD_LEFT + 40}" cy="210" r="44" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
  <text x="${FIELD_LEFT + 40}" y="224" text-anchor="middle" font-family="Inter" font-weight="700" font-size="36" fill="rgba(255,254,250,0.7)">@</text>
  <text x="${FIELD_LEFT}" y="300" font-family="Inter" font-weight="700" font-size="22" fill="#FFFEFA">${displayName}</text>
  <text x="${FIELD_LEFT}" y="328" font-family="Inter" font-weight="500" font-size="15" fill="rgba(255,254,250,0.62)">@${handle}</text>
  <text x="${FIELD_LEFT - 4}" y="${448 + Math.floor(bigSize * 0.08)}" font-family="Inter" font-weight="700" font-size="${bigSize}" letter-spacing="${(-0.03 * bigSize).toFixed(1)}" fill="#FFFEFA">${bigText}</text>
</svg>`;

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
await writeFile("/tmp/share-og-preview.png", png);
console.log(`Wrote /tmp/share-og-preview.png (${png.byteLength} bytes, big size ${bigSize})`);
