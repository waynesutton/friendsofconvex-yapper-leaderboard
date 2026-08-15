// Local preview of the personalized share OG card. Mirrors the SVG builder in
// convex/giftShareRender.ts using the same wasm and fonts from public/render.
// Usage: node scripts/preview-share-og.mjs [handle] [displayName]
import { readFile, writeFile } from "node:fs/promises";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const handle = process.argv[2] ?? "Fayeezashaikh";
const displayName = process.argv[3] ?? "Fayeeza Shaikh";
const campaignTitle = "Friends of Convex gift";
const redeemed = false;

const CONVEX_SYMBOL = `
  <path d="M108.092 130.021C126.258 128.003 143.385 118.323 152.815 102.167C148.349 142.128 104.653 167.385 68.9858 151.878C65.6992 150.453 62.8702 148.082 60.9288 145.034C52.9134 132.448 50.2786 116.433 54.0644 101.899C64.881 120.567 86.8748 132.01 108.092 130.021Z" fill="#F3B01C"/>
  <path d="M53.4012 90.1735C46.0375 107.191 45.7186 127.114 54.7463 143.51C22.9759 119.608 23.3226 68.4578 54.358 44.7949C57.2286 42.6078 60.64 41.3097 64.2178 41.1121C78.9312 40.336 93.8804 46.0225 104.364 56.6193C83.0637 56.831 62.318 70.4756 53.4012 90.1735Z" fill="#8D2676"/>
  <path d="M114.637 61.8552C103.89 46.8701 87.0686 36.6684 68.6387 36.358C104.264 20.1876 148.085 46.4045 152.856 85.1654C153.3 88.7635 152.717 92.4322 151.122 95.6775C144.466 109.195 132.124 119.679 117.702 123.559C128.269 103.96 126.965 80.0151 114.637 61.8552Z" fill="#EE342F"/>
`;

const bigText = `@${handle}`;
const bigSize = Math.min(96, Math.max(32, Math.floor(980 / (bigText.length * 0.62))));
const statusText = redeemed ? "FRIEND + GIFT RECIPIENT" : "FRIEND OF CONVEX";
const campaign = campaignTitle.toUpperCase();

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="card-wash" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
      gradientTransform="translate(600 171) rotate(90) scale(968 1722)">
      <stop offset="0.0721154" stop-color="#2A1E1D"/>
      <stop offset="0.504808" stop-color="#4F3A39"/>
      <stop offset="0.865385" stop-color="#906763"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#card-wash)" />
  <g transform="translate(62, 38) scale(0.3)">${CONVEX_SYMBOL}</g>
  <text x="132" y="78" font-family="Space Grotesk" font-weight="700" font-size="18" letter-spacing="3.2" fill="#FFFEFA">FRIENDS OF CONVEX</text>
  <text x="1138" y="78" text-anchor="end" font-family="Space Grotesk" font-weight="500" font-size="16" letter-spacing="3.2" fill="rgba(255,254,250,0.72)">COMMUNITY / 2026</text>
  <circle cx="600" cy="196" r="40" fill="rgba(255,255,255,0.08)" />
  <circle cx="600" cy="196" r="44" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
  <text x="600" y="210" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="36" fill="rgba(255,254,250,0.7)">@</text>
  <text x="600" y="276" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="22" fill="#FFFEFA">${displayName}</text>
  <text x="600" y="302" text-anchor="middle" font-family="Space Grotesk" font-weight="500" font-size="15" fill="rgba(255,254,250,0.62)">@${handle}</text>
  <text x="600" y="${388 + Math.floor(bigSize * 0.08)}" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="${bigSize}" letter-spacing="${(-0.04 * bigSize).toFixed(1)}" fill="#FFFEFA">${bigText}</text>
  <text x="600" y="472" text-anchor="middle" font-family="Space Grotesk" font-weight="500" font-size="14" letter-spacing="3.8" fill="rgba(255,254,250,0.62)">${statusText}</text>
  <text x="62" y="584" font-family="Space Grotesk" font-weight="500" font-size="15" letter-spacing="2.8" fill="rgba(255,254,250,0.78)">${campaign}</text>
  <text x="1138" y="584" text-anchor="end" font-family="Space Grotesk" font-weight="500" font-size="15" letter-spacing="2.8" fill="rgba(255,254,250,0.78)">BUILT TOGETHER</text>
</svg>`;

await initWasm(await readFile("public/render/resvg.wasm"));
const fonts = [
  new Uint8Array(await readFile("public/render/fonts/space-grotesk-500.ttf")),
  new Uint8Array(await readFile("public/render/fonts/space-grotesk-700.ttf")),
];
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: { fontBuffers: fonts, defaultFontFamily: "Space Grotesk", loadSystemFonts: false },
});
const png = resvg.render().asPng();
await writeFile("/tmp/share-og-preview.png", png);
console.log(`Wrote /tmp/share-og-preview.png (${png.byteLength} bytes, big size ${bigSize})`);
