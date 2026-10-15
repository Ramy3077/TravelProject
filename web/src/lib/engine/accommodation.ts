import { rangeFrom } from './money';
import { TIERS } from './tiers';
import type { Confidence, CostRange, CostRecord, Tier } from './types';

/**
 * Short-stay premium converting the cost data's *pro-rated monthly rent* into a
 * realistic *nightly tourist rate*.
 *
 * The source figures are `monthly_rent / 30` (see build-dataset.ts), i.e. what a
 * night costs if you sign a year's lease — which badly under-prices a hotel or a
 * few nights on Airbnb, where you pay for flexibility, cleaning, and turnover.
 * Short-term lodging commonly runs ~2.5–3.5× the pro-rated long-term rate; we use
 * a deliberately conservative 2.5×. Documented heuristic, not surveyed nightly
 * data — which is why accommodation confidence still comes from data coverage.
 */
export const NIGHTLY_RATE_PREMIUM = 2.5;

/**
 * Accommodation cost. Reads the tier's price point (low vs mid) from the cost
 * data, converts pro-rated rent to a nightly tourist rate, and applies the tier's
 * factor so "comfort" can exceed mid-tier even though the source dataset only has
 * low/mid rates.
 *
 * Scales by rooms (≈ 2 travellers per room) rather than ignoring party size as
 * the original engine did. Seasonality scales the nightly rate.
 */
export function estimateAccommodation(
  cost: CostRecord,
  nights: number,
  travellers: number,
  tier: Tier,
  seasonMultiplier: number,
  confidence: Confidence,
): CostRange {
  const cfg = TIERS[tier];
  const proRatedNightly = (cfg.accomKey === 'accLow' ? cost.accLow : cost.accMid) ?? 0;
  const nightly = proRatedNightly * NIGHTLY_RATE_PREMIUM;
  const rooms = Math.max(1, Math.ceil(travellers / 2));
  const point = nightly * cfg.accomFactor * nights * rooms * seasonMultiplier;
  // Wider band (0.8–1.3) reflecting the spread between listings.
  return rangeFrom(point, 0.8, 1.3, confidence);
}
