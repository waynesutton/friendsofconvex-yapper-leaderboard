import {
  OG_HEIGHT,
  OG_WIDTH,
  VIDEO_FPS,
  boardVideoTimeline,
  buildBoardCardFrameSvg,
  type BoardCardInput,
} from "../../convex/ogArt";

// Browser side of the admin board share video. Frames come from the same SVG
// builder as the PNG card, go through an <img> onto an OffscreenCanvas, and
// are encoded to H.264 MP4 with mediabunny (WebCodecs). mediabunny loads with
// a dynamic import so it never reaches the public bundle.

export const VIDEO_UNSUPPORTED_MESSAGE = "Video needs Chrome or Safari 26 or newer";

export class VideoUnsupportedError extends Error {
  constructor() {
    super(VIDEO_UNSUPPORTED_MESSAGE);
    this.name = "VideoUnsupportedError";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function fontFace(weight: 500 | 700): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}render/fonts/inter-${weight}.ttf`);
  if (!response.ok) throw new Error(`Could not load Inter ${weight} (${response.status}).`);
  const base64 = bytesToBase64(new Uint8Array(await response.arrayBuffer()));
  return `@font-face{font-family:"Inter";font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${base64}) format("truetype");}`;
}

let fontFacesPromise: Promise<string> | null = null;

// The bundled Inter files as embedded @font-face CSS. An SVG drawn as an
// image cannot see page fonts, so every frame carries both weights.
export function loadFontFaces(): Promise<string> {
  if (!fontFacesPromise) {
    fontFacesPromise = Promise.all([fontFace(500), fontFace(700)]).then((faces) =>
      faces.join(""),
    );
    fontFacesPromise.catch(() => {
      fontFacesPromise = null;
    });
  }
  return fontFacesPromise;
}

export function frameObjectUrl(input: BoardCardInput, t: number, fontFaces: string): string {
  const svg = buildBoardCardFrameSvg(input, t, { fontFaces });
  return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
}

async function svgImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image(OG_WIDTH, OG_HEIGHT);
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function canEncodeBoardVideo(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof OffscreenCanvas === "undefined") {
    return false;
  }
  const { canEncodeVideo } = await import("mediabunny");
  return await canEncodeVideo("avc", {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    frameRate: VIDEO_FPS,
  });
}

export type RenderedBoardVideo = {
  blob: Blob;
  seconds: number;
  frames: number;
  hasAudio: boolean;
};

const AUDIO_SAMPLE_RATE = 48_000;

// Frame 0 is the finished card for one frame so every player and feed shows
// it as the thumbnail, then the build plays from empty and holds.
export async function renderBoardVideo(
  input: BoardCardInput,
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedBoardVideo> {
  if (!(await canEncodeBoardVideo())) throw new VideoUnsupportedError();
  const mediabunny = await import("mediabunny");
  const fontFaces = await loadFontFaces();
  const timeline = boardVideoTimeline(input);

  const canvas = new OffscreenCanvas(OG_WIDTH, OG_HEIGHT);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not open a 2D canvas.");

  const output = new mediabunny.Output({
    format: new mediabunny.Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new mediabunny.BufferTarget(),
  });
  const video = new mediabunny.CanvasSource(canvas, {
    codec: "avc",
    quality: mediabunny.QUALITY_HIGH,
    keyFrameInterval: 2,
  });
  output.addVideoTrack(video, { frameRate: VIDEO_FPS });

  // A silent AAC track, like TWIC's anullsrc, for players that expect audio.
  const hasAudio = await mediabunny.canEncodeAudio("aac", {
    numberOfChannels: 2,
    sampleRate: AUDIO_SAMPLE_RATE,
  });
  const audio = hasAudio
    ? new mediabunny.AudioBufferSource({ codec: "aac", quality: mediabunny.QUALITY_LOW })
    : null;
  if (audio) output.addAudioTrack(audio);

  await output.start();
  try {
    const frameSeconds = 1 / VIDEO_FPS;
    const buildFrames = Math.floor(timeline.duration * VIDEO_FPS + 1e-6) + 1;
    const total = buildFrames + 1;
    let drawn = "";
    for (let frame = 0; frame < total; frame += 1) {
      const t = frame === 0 ? timeline.duration : (frame - 1) * frameSeconds;
      const svg = buildBoardCardFrameSvg(input, t, { fontFaces });
      // Hold frames repeat the same SVG; reuse the canvas instead of decoding.
      if (svg !== drawn) {
        const image = await svgImage(svg);
        context.clearRect(0, 0, OG_WIDTH, OG_HEIGHT);
        context.drawImage(image, 0, 0, OG_WIDTH, OG_HEIGHT);
        drawn = svg;
      }
      await video.add(frame * frameSeconds, frameSeconds);
      onProgress?.(frame + 1, total);
    }

    const seconds = total * frameSeconds;
    if (audio) {
      await audio.add(
        new AudioBuffer({
          length: Math.ceil(seconds * AUDIO_SAMPLE_RATE),
          numberOfChannels: 2,
          sampleRate: AUDIO_SAMPLE_RATE,
        }),
      );
    }
    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("The encoder finished without a file.");
    return {
      blob: new Blob([buffer], { type: "video/mp4" }),
      seconds,
      frames: total,
      hasAudio,
    };
  } catch (error) {
    if (output.state === "pending" || output.state === "started") await output.cancel();
    throw error;
  }
}
