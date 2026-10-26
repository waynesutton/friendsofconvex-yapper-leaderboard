import { expect, test } from "vitest";
import {
  OG_WIDTH,
  boardVideoFrameState,
  boardVideoTimeline,
  buildBoardCardFrameSvg,
  buildBoardCardSvg,
} from "../convex/ogArt";
import {
  CONVEX_INPUT,
  LEGENDS_INPUT,
  LONG_LABEL_INPUT,
  RANKED_INPUT,
} from "./fixtures/boardCardInputs";

const INPUTS = { RANKED_INPUT, CONVEX_INPUT, LEGENDS_INPUT, LONG_LABEL_INPUT };

test("the last video frame is the PNG card SVG, byte for byte", () => {
  for (const input of Object.values(INPUTS)) {
    const { duration, buildEnd } = boardVideoTimeline(input);
    const card = buildBoardCardSvg(input);
    expect(buildBoardCardFrameSvg(input, duration)).toBe(card);
    // The whole hold is the finished card too.
    expect(buildBoardCardFrameSvg(input, buildEnd)).toBe(card);
  }
});

test("a saved day names its date on the card and every video frame keeps it", () => {
  const dated = { ...RANKED_INPUT, rankingDay: "2026-10-24" };
  const { duration } = boardVideoTimeline(dated);
  const card = buildBoardCardSvg(dated);
  expect(buildBoardCardFrameSvg(dated, duration)).toBe(card);
  expect(card).toContain(`Top ${RANKED_INPUT.rows.length} on <tspan`);
  expect(card).toContain("Sat, Oct 24, 2026");
  expect(buildBoardCardFrameSvg(dated, 0.6)).toContain("Sat, Oct 24, 2026");
  expect(card).not.toContain("right now");

  // Live cards keep their original wording, and legends never take a day.
  expect(buildBoardCardSvg(RANKED_INPUT)).toContain("right now");
  expect(buildBoardCardSvg(RANKED_INPUT)).not.toContain("Saved ranking");
  expect(buildBoardCardSvg({ ...LEGENDS_INPUT, rankingDay: "2026-10-24" })).not.toContain(
    "Oct 24, 2026</tspan>",
  );
});

test("embedded fonts ride in a style block and change nothing else", () => {
  const { duration } = boardVideoTimeline(RANKED_INPUT);
  const fontFaces = '@font-face{font-family:"Inter";src:url(data:font/ttf;base64,AAAA)}';
  const svg = buildBoardCardFrameSvg(RANKED_INPUT, duration, { fontFaces });
  expect(svg).toContain(`<style><![CDATA[${fontFaces}]]></style>`);
  expect(svg.replace(/\n {2}<defs>.*?<\/defs>/, "")).toBe(buildBoardCardSvg(RANKED_INPUT));
});

test("the racing lines draw from nothing to full width by 1.1s", () => {
  expect(boardVideoFrameState(RANKED_INPUT, 0).stripesWidth).toBe(0);
  expect(buildBoardCardFrameSvg(RANKED_INPUT, 0)).toContain(
    '<clipPath id="stripes-reveal"><rect x="0" y="0" width="0" height="630" />',
  );
  const midway = boardVideoFrameState(RANKED_INPUT, 0.4).stripesWidth;
  expect(midway).toBeGreaterThan(0);
  expect(midway).toBeLessThan(OG_WIDTH / 2);
  expect(boardVideoFrameState(RANKED_INPUT, 1.1).stripesWidth).toBe(OG_WIDTH);
  expect(buildBoardCardFrameSvg(RANKED_INPUT, 1.1)).not.toContain("stripes-reveal");
});

test("rows appear top to bottom and everything settles by the end of the build", () => {
  const timeline = boardVideoTimeline(RANKED_INPUT);
  const starts = timeline.beats.rows.map((beat) => beat.start);
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
  expect(new Set(starts).size).toBe(starts.length);

  for (let t = 0; t <= timeline.buildEnd; t += 1 / 30) {
    const { rows } = boardVideoFrameState(RANKED_INPUT, t, timeline);
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index]!.opacity).toBeLessThanOrEqual(rows[index - 1]!.opacity);
    }
  }

  const end = boardVideoFrameState(RANKED_INPUT, timeline.buildEnd, timeline);
  expect(end.lockupOpacity).toBe(1);
  expect(end.asOfOpacity).toBe(1);
  expect(end.pulseScale).toBe(1);
  expect(end.subtitle).toEqual({ opacity: 1, offset: 0 });
  expect(end.words.every((word) => word.opacity === 1 && word.offset === 0 && word.blur === 0)).toBe(
    true,
  );
  expect(end.rows.every((row) => row.opacity === 1 && row.offset === 0 && row.dividerX2 === 880)).toBe(
    true,
  );
});

test("rank 1 pulses once after the last row lands", () => {
  const timeline = boardVideoTimeline(RANKED_INPUT);
  const { pulse } = timeline.beats;
  const peak = boardVideoFrameState(RANKED_INPUT, pulse.start + pulse.duration / 2, timeline);
  expect(peak.pulseScale).toBeCloseTo(1.12, 5);
  expect(boardVideoFrameState(RANKED_INPUT, pulse.start - 0.01, timeline).pulseScale).toBe(1);
  expect(buildBoardCardFrameSvg(RANKED_INPUT, pulse.start + pulse.duration / 2)).toContain(
    "scale(1.12)",
  );
});

test("each label word gets its own layer while it rises", () => {
  const svg = buildBoardCardFrameSvg(CONVEX_INPUT, 0.6);
  expect(svg).toContain('<tspan fill-opacity="0">Convex </tspan>mentions');
  expect(svg).toContain('Convex<tspan fill-opacity="0"> mentions</tspan>');
  expect(svg).toContain('filter="url(#word-blur-0)"');
});

test("a five row board runs between 4.5 and 6 seconds", () => {
  const { duration, buildEnd } = boardVideoTimeline(RANKED_INPUT);
  expect(duration).toBeGreaterThanOrEqual(4.5);
  expect(duration).toBeLessThanOrEqual(6);
  expect(duration - buildEnd).toBeCloseTo(3, 10);
  expect(buildEnd).toBeCloseTo(2.53, 2);
});
