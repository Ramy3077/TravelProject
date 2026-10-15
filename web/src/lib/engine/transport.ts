import { rangeFrom } from './money';
import { TIERS } from './tiers';
import type { CostRange, Tier } from './types';

/**
 * Transport cost model — a distance-band (piecewise-linear) airfare estimate.
 *
 * The original Java MockFlightProvider, and the first TS port, used a *linear*
 * `base + km × perKm`. Real airfare is strongly **non-linear** per km: short hops
 * cost a lot per km (fixed taxes/handling dominate), while long-haul is much
 * cheaper per km (it trends toward ~$0.06/km one-way on widebodies). A straight
 * line over- or under-prices both ends.
 *
 * So we interpolate a curve calibrated to typical round-trip economy fares
 * (per person, USD) instead. Anchor benchmarks (one-way, doubled for return):
 *   short-haul ~500–800 km   →  ~$40–120 one-way
 *   medium-haul ~1–2.5k km   →  ~$70–200 one-way
 *   long-haul narrowbody     →  ~$120–350 one-way
 *   long-haul widebody 6k+   →  ~$250–700+ one-way (≈ $0.06/km)
 *
 * This is still always a *model* estimate, never a live quote, so its confidence
 * is capped at "medium"; a future price-trends provider (see lib/providers) could
 * raise it. The per-tier factor scales the cabin (budget carrier → premium), and
 * seasonality scales the fare by travel month.
 */

/**
 * Round-trip economy fare anchors: [distanceKm, fareUSD] per person, sorted by
 * distance. Between anchors we interpolate linearly; beyond the last we
 * extrapolate with the final segment's slope. The implied per-km cost falls as
 * distance grows (e.g. ~$0.16/km at 250 km → ~$0.06/km at 6,000 km), which is the
 * whole point of using bands over a single rate.
 */
const FARE_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, 60],
  [250, 100],
  [650, 170],
  [1500, 240],
  [2500, 360],
  [4500, 560],
  [6000, 760],
  [10000, 1150],
  [15000, 1700],
];

/** Interpolated round-trip economy fare (per person, USD) for a distance. */
export function bandedFare(distanceKm: number): number {
  const d = Math.max(0, distanceKm);
  const anchors = FARE_ANCHORS;

  // Below or at the first anchor.
  if (d <= anchors[0][0]) return anchors[0][1];

  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i];
    if (d <= x1) {
      const [x0, y0] = anchors[i - 1];
      const t = (d - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }

  // Beyond the last anchor: extrapolate with the final segment's slope.
  const [xN, yN] = anchors[anchors.length - 1];
  const [xP, yP] = anchors[anchors.length - 2];
  const slope = (yN - yP) / (xN - xP);
  return yN + (d - xN) * slope;
}

export function estimateTransport(
  distanceKm: number,
  travellers: number,
  tier: Tier,
  seasonMultiplier: number,
): CostRange {
  const fare = bandedFare(distanceKm) * TIERS[tier].transportFactor * seasonMultiplier;
  const point = fare * travellers;
  // Fares are the most volatile line in the breakdown, so the band is wider than
  // the cost-of-living categories: roughly −15% / +20% around the modelled fare.
  return rangeFrom(point, 0.85, 1.2, 'medium');
}
