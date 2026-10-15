import { rangeFrom } from './money';
import { TIERS } from './tiers';
import type { Confidence, CostRange, CostRecord, Tier } from './types';

/**
 * Food cost = daily food spend × days × travellers, scaled by the tier.
 * The original engine ignored the tier here entirely (budget and comfort
 * travellers were assumed to eat identically); the per-tier factor fixes that.
 */
export function estimateFood(
  cost: CostRecord,
  days: number,
  travellers: number,
  tier: Tier,
  confidence: Confidence,
): CostRange {
  const daily = (cost.foodDaily ?? 0) * TIERS[tier].foodFactor;
  const point = daily * days * travellers;
  return rangeFrom(point, 0.8, 1.3, confidence);
}
