import { describe, expect, it } from 'vitest';
import { estimateTrip } from '@/lib/engine/estimate';
import { EngineError } from '@/lib/engine/errors';
import { ALL_TIERS } from '@/lib/engine/tiers';
import type { EstimateInput, Tier } from '@/lib/engine/types';
import { LONDON, PARIS, makeContext } from '../fixtures';

const trip = (tier: Tier, over: Partial<EstimateInput> = {}): EstimateInput => ({
  originCityId: LONDON.id,
  destinationCityId: PARIS.id,
  startDate: '2026-07-01',
  endDate: '2026-07-08',
  travellers: 2,
  tier,
  ...over,
});

describe('estimateTrip', () => {
  const ctx = makeContext();

  it('produces a full breakdown whose total equals the sum of the parts', () => {
    const { breakdown, nights, days } = estimateTrip(trip('balanced'), ctx);
    const partsSum =
      breakdown.transport.point +
      breakdown.accommodation.point +
      breakdown.food.point +
      breakdown.localTransport.point;
    expect(breakdown.total.point).toBe(partsSum);
    expect(nights).toBe(7);
    expect(days).toBe(8);
  });

  it('surfaces the local-transport category that the old engine never read', () => {
    const { breakdown } = estimateTrip(trip('balanced'), ctx);
    expect(breakdown.localTransport.point).toBeGreaterThan(0);
  });

  it('makes the three tiers produce three DISTINCT, increasing totals (fixes CHEAP == BALANCED)', () => {
    const totals = ALL_TIERS.map((t) => estimateTrip(trip(t), ctx).breakdown.total.point);
    expect(new Set(totals).size).toBe(3);
    const [budget, balanced, comfort] = totals;
    expect(budget).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(comfort);
  });

  it('makes food respond to tier (it ignored the preference before)', () => {
    const [budget, balanced, comfort] = ALL_TIERS.map(
      (t) => estimateTrip(trip(t), ctx).breakdown.food.point,
    );
    expect(budget).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(comfort);
  });

  it('tags city-level cost data as high confidence', () => {
    const r = estimateTrip(trip('balanced'), ctx);
    expect(r.factors.dataCoverage).toBe('city');
    expect(r.breakdown.accommodation.confidence).toBe('high');
  });

  it('uses the country median (medium confidence) when a city has no row', () => {
    const ctxCountry = makeContext({
      costs: {},
      countryMedians: { FR: { foodDaily: 25, transitDaily: 6, accLow: 50, accMid: 100, dataQuality: null } },
    });
    const r = estimateTrip(trip('balanced'), ctxCountry);
    expect(r.factors.dataCoverage).toBe('country-fallback');
    expect(r.breakdown.food.confidence).toBe('medium');
  });

  it('falls back to global defaults (low confidence) when there is no cost data at all', () => {
    const r = estimateTrip(trip('balanced'), makeContext({ costs: {} }));
    expect(r.factors.dataCoverage).toBe('global-fallback');
    expect(r.breakdown.food.confidence).toBe('low');
  });

  it('throws a typed error for an unknown city', () => {
    expect(() => estimateTrip(trip('balanced', { destinationCityId: 'nope' }), ctx)).toThrowError(EngineError);
  });

  it('applies peak vs off-season pricing from the trip month', () => {
    const peak = estimateTrip(trip('balanced', { startDate: '2026-07-01', endDate: '2026-07-08' }), ctx);
    const off = estimateTrip(trip('balanced', { startDate: '2026-11-01', endDate: '2026-11-08' }), ctx);
    expect(peak.factors.seasonality.label).toBe('peak');
    expect(off.factors.seasonality.label).toBe('off');
    expect(peak.breakdown.accommodation.point).toBeGreaterThan(off.breakdown.accommodation.point);
  });

  it('reports data provenance in metadata', () => {
    const r = estimateTrip(trip('balanced'), ctx);
    expect(r.metadata.dataVintage).toBe('2019');
    expect(r.metadata.dataSource).toContain('2019');
    expect(r.metadata.modelVersion).toBeTruthy();
  });
});
