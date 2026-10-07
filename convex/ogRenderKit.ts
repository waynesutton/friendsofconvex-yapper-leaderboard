"use node";

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { OG_WIDTH } from "./ogArt";

// Node side of the OpenGraph renderers: loads the resvg wasm and Inter fonts
// from static hosting once per warm instance, fetches X avatars as data
// URIs, and turns an SVG string into PNG bytes. Shared by the gift share
// card and the board share card.

function siteUrl(): string {
  const url = process.env.CONVEX_SITE_URL;
  if (!url) throw new Error("CONVEX_SITE_URL is not set");
  return url.replace(/\/$/, "");
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Asset fetch failed (${response.status}): ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

let rendererPromise: Promise<Uint8Array[]> | null = null;

function loadRenderer(): Promise<Uint8Array[]> {
  if (!rendererPromise) {
    rendererPromise = (async () => {
      const base = siteUrl();
      const [wasm, medium, bold] = await Promise.all([
        fetchBytes(`${base}/render/resvg.wasm`),
        fetchBytes(`${base}/render/fonts/inter-500.ttf`),
        fetchBytes(`${base}/render/fonts/inter-700.ttf`),
      ]);
      await initWasm(wasm);
      return [medium, bold];
    })();
    rendererPromise.catch(() => {
      rendererPromise = null;
    });
  }
  return rendererPromise;
}

// Starts the wasm and font load early so callers can overlap it with avatar
// fetches.
export async function warmRenderer(): Promise<void> {
  await loadRenderer();
}

// X serves `_normal` 48px avatars by default; the 400px variant stays crisp
// on the card. Any failure falls back to the placeholder circle.
export async function avatarDataUri(
  profileImageUrl: string | null,
): Promise<string | null> {
  if (!profileImageUrl) return null;
  try {
    const fullSize = profileImageUrl.replace("_normal", "_400x400");
    const response = await fetch(fullSize);
    if (!response.ok) return null;
    const mime = response.headers.get("content-type") ?? "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${mime};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderPng(svg: string): Promise<ArrayBuffer> {
  const fonts = await loadRenderer();
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: {
      fontBuffers: fonts,
      defaultFontFamily: "Inter",
      loadSystemFonts: false,
    },
  });
  const png = resvg.render().asPng();
  const out = new ArrayBuffer(png.byteLength);
  new Uint8Array(out).set(png);
  return out;
}
