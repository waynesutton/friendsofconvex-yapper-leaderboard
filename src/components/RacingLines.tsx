import { useEffect, useState } from "react";

// Same geometry as public/brand/convex-racing-lines-wide.svg. Each band fills
// down to the shared bottom edge and the next band paints over it, so touching
// edges never show an anti-aliased seam on the dark hero.
const BAND_TAIL =
  "L1674.7 101.64A52.94 52.94 0 0 0 1623.58 140.81L1549.53 415.58A52.94 52.94 0 0 1 1498.42 455L-3000 455Z";

const BANDS = [
  {
    fill: "#F3B01D",
    d: `M-3000 354.69L1278.17 354.69A52.94 52.94 0 0 0 1329.35 315.29L1402.31 39.4A52.94 52.94 0 0 1 1453.49 0L4729 0L4729 101.64${BAND_TAIL}`,
  },
  {
    fill: "#EE3430",
    d: `M-3000 388.05L1348.9 388.05A52.94 52.94 0 0 0 1400.05 348.76L1473.59 73.17A52.94 52.94 0 0 1 1524.74 33.88L4729 33.88L4729 101.64${BAND_TAIL}`,
  },
  {
    fill: "#8D2676",
    d: `M-3000 421.93L1419.63 421.93A52.94 52.94 0 0 0 1470.75 382.76L1544.94 107.46A52.94 52.94 0 0 1 1596.05 68.29L4729 68.29L4729 101.64${BAND_TAIL}`,
  },
] as const;

// Module scope so the reveal plays once per page load, not on every return to the board.
let hasRevealed = false;

/** Decorative Convex racing stripes pinned to the bottom of the hero. */
export function RacingLines() {
  const [reveal] = useState(() => !hasRevealed);

  useEffect(() => {
    hasRevealed = true;
  }, []);

  return (
    <div className="racing-lines" data-reveal={reveal} aria-hidden="true">
      <svg viewBox="-3000 0 4729 455" preserveAspectRatio="xMaxYMax meet" focusable="false">
        {BANDS.map((band) => (
          <path key={band.fill} fill={band.fill} d={band.d} />
        ))}
      </svg>
    </div>
  );
}
