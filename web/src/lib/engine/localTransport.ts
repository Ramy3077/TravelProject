import { rangeFrom } from './money';
import { TIERS } from './tiers';
import type { Confidence, CostRange, CostRecord, Tier } from './types';

/**
 * Local getting-around cost (metro, buses, the occasional taxi) = daily transit
 * spend × days × travellers, scaled by tier.
 *
 * This category is new: the source data has a transit figure that the original
 * engine computed, stored, and then never read. Surfacing it makes the breakdown
 * more honest and gives the affordability levers another dimension to tune.
 */
export function estimateLocalTransport(
  cost: CostRecord,
  days: number,
  travellers: number,
  tier: Tier,
  confidence: Confidence,
): CostRange {
  const daily = (cost.transitDaily ?? 0) * TIERS[tier].localFactor;
  const point = daily * days * travellers;
  return rangeFrom(point, 0.8, 1.3, confidence);
}
