import type { Confidence, CostRecord, DataContext, DataCoverage } from './types';

/**
 * Global last-resort defaults (USD/day, per person), used when we have neither
 * city nor country data. Ported from the original Java fallbacks (food $40,
 * accom $50/$100) and nudged up to rough present-day global averages to match
 * the now CPI-adjusted dataset (the old engine had no transit fallback at all,
 * because it never used transit). This branch is "low" confidence regardless.
 */
export const GLOBAL_DEFAULT_COST: Required<Omit<CostRecord, 'dataQuality'>> & { dataQuality: null } = {
  foodDaily: 48,
  transitDaily: 15,
  accLow: 60,
  accMid: 120,
  dataQuality: null,
};

export interface ResolvedCost {
  cost: CostRecord;
  coverage: DataCoverage;
}

/**
 * Resolve a destination's cost data with a graceful fallback chain:
 *   city row → country median → global default.
 * Each step down lowers confidence (handled in confidence.ts).
 */
export function resolveCost(ctx: DataContext, cityId: string, iso2: string): ResolvedCost {
  const city = ctx.getCost(cityId);
  if (city && hasAnyValue(city)) {
    return { cost: fillGaps(city), coverage: 'city' };
  }
  const country = ctx.getCountryMedian(iso2);
  if (country && hasAnyValue(country)) {
    return { cost: fillGaps(country), coverage: 'country-fallback' };
  }
  return { cost: { ...GLOBAL_DEFAULT_COST }, coverage: 'global-fallback' };
}

const hasAnyValue = (c: CostRecord): boolean =>
  c.foodDaily != null || c.transitDaily != null || c.accLow != null || c.accMid != null;

/** Backfill any individual missing field from the global defaults. */
function fillGaps(c: CostRecord): CostRecord {
  return {
    foodDaily: c.foodDaily ?? GLOBAL_DEFAULT_COST.foodDaily,
    transitDaily: c.transitDaily ?? GLOBAL_DEFAULT_COST.transitDaily,
    accLow: c.accLow ?? GLOBAL_DEFAULT_COST.accLow,
    accMid: c.accMid ?? GLOBAL_DEFAULT_COST.accMid,
    dataQuality: c.dataQuality ?? null,
  };
}

/**
 * Confidence for a DB-derived category (accommodation/food/local). City-level
 * data is trusted; country fallback is medium; global default is low. Replaces
 * the old binary `cityId == null ? LOW : HIGH`.
 */
export function coverageConfidence(coverage: DataCoverage): Confidence {
  switch (coverage) {
    case 'city':
      return 'high';
    case 'country-fallback':
      return 'medium';
    case 'global-fallback':
      return 'low';
  }
}
