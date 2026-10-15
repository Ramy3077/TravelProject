import { estimateAccommodation } from './accommodation';
import { coverageConfidence, resolveCost } from './cost';
import { monthOf, nightsBetween } from './date';
import { haversineKm } from './distance';
import { EngineError } from './errors';
import { estimateFood } from './food';
import { estimateLocalTransport } from './localTransport';
import { sumRanges } from './money';
import { seasonality } from './seasonality';
import { estimateTransport } from './transport';
import type { DataContext, EstimateInput, EstimateResult } from './types';

// 1.1.0: distance-band (non-linear) transport model + CPI-adjusted cost data.
export const MODEL_VERSION = '1.1.0';

/**
 * The heart of the app: build a transparent, uncertainty-aware cost breakdown.
 *
 * Pure and synchronous — given the same input + data context it always returns
 * the same numbers (modulo the generatedAt timestamp). No I/O, no fetch. This is
 * what makes it trivially testable and what a future LLM tool layer calls
 * directly. External enrichment (live price trends) is layered on top elsewhere
 * (see lib/providers); the model alone is always a complete, valid answer —
 * graceful degradation is the default state, not a fallback path.
 */
export function estimateTrip(input: EstimateInput, ctx: DataContext): EstimateResult {
  const origin = ctx.getCity(input.originCityId);
  const dest = ctx.getCity(input.destinationCityId);
  if (!origin) throw new EngineError('UNKNOWN_CITY', `Unknown origin city: ${input.originCityId}`);
  if (!dest) throw new EngineError('UNKNOWN_CITY', `Unknown destination city: ${input.destinationCityId}`);

  const { travellers, tier } = input;
  const nights = nightsBetween(input.startDate, input.endDate);
  const days = nights + 1;

  const distanceKm = haversineKm(origin.lat, origin.lon, dest.lat, dest.lon);

  const { cost, coverage } = resolveCost(ctx, dest.id, dest.iso2);
  const dbConfidence = coverageConfidence(coverage);

  const season = seasonality(monthOf(input.startDate), dest.lat);

  const transport = estimateTransport(distanceKm, travellers, tier, season.multiplier);
  const accommodation = estimateAccommodation(cost, nights, travellers, tier, season.multiplier, dbConfidence);
  const food = estimateFood(cost, days, travellers, tier, dbConfidence);
  const localTransport = estimateLocalTransport(cost, days, travellers, tier, dbConfidence);
  const total = sumRanges([transport, accommodation, food, localTransport]);

  const meta = ctx.meta();

  return {
    currency: input.currency ?? 'USD',
    nights,
    days,
    breakdown: { transport, accommodation, food, localTransport, total },
    factors: {
      distanceKm: Math.round(distanceKm),
      seasonality: season,
      tier,
      dataCoverage: coverage,
    },
    metadata: {
      dataSource: meta.inflationAdjusted
        ? `Internal Cost Model (${meta.vintage} base, CPI-adjusted to ${meta.adjustedYear})`
        : `Internal Cost Model (${meta.vintage} base)`,
      dataVintage: meta.vintage,
      generatedAt: new Date().toISOString(),
      modelVersion: MODEL_VERSION,
    },
  };
}
