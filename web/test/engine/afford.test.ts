import { describe, expect, it } from 'vitest';
import { assessAffordability, verdictFor } from '@/lib/engine/afford';
import { estimateTrip } from '@/lib/engine/estimate';
import type { EstimateInput } from '@/lib/engine/types';
import { LONDON, PARIS, makeContext } from '../fixtures';

const input: EstimateInput = {
  originCityId: LONDON.id,
  destinationCityId: PARIS.id,
  startDate: '2026-07-01',
  endDate: '2026-07-08',
  travellers: 2,
  tier: 'comfort',
};

describe('verdictFor', () => {
  it('classifies the budget ratio into bands', () => {
    expect(verdictFor(80, 100)).toBe('comfortable');
    expect(verdictFor(95, 100)).toBe('feasible');
    expect(verdictFor(105, 100)).toBe('tight');
    expect(verdictFor(200, 100)).toBe('over');
  });
});

describe('assessAffordability', () => {
  const ctx = makeContext();
  const point = estimateTrip(input, ctx).breakdown.total.point;

  it('says comfortable with positive headroom for a generous budget', () => {
    const r = assessAffordability({ budget: Math.round(point * 1.5), input, ctx });
    expect(r.verdict).toBe('comfortable');
    expect(r.headroom).toBeGreaterThan(0);
  });

  it('says over with negative headroom for a small budget', () => {
    const r = assessAffordability({ budget: Math.round(point * 0.8), input, ctx });
    expect(r.verdict).toBe('over');
    expect(r.headroom).toBeLessThan(0);
  });

  it('returns more affordable days as the budget grows', () => {
    const small = assessAffordability({ budget: point, input, ctx }).maxAffordableDays ?? 0;
    const large = assessAffordability({ budget: Math.round(point * 2), input, ctx }).maxAffordableDays ?? 0;
    expect(large).toBeGreaterThanOrEqual(small);
  });

  it('offers ranked, real-saving levers when over budget', () => {
    const r = assessAffordability({ budget: Math.round(point * 0.7), input, ctx });
    expect(r.levers.length).toBeGreaterThan(0);
    // every lever genuinely saves money
    expect(r.levers.every((l) => l.estimatedSaving > 0)).toBe(true);
    // ranked best-saving-first
    const savings = r.levers.map((l) => l.estimatedSaving);
    expect([...savings].sort((a, b) => b - a)).toEqual(savings);
  });

  it('suggests dropping a tier and travelling with fewer people', () => {
    const r = assessAffordability({ budget: Math.round(point * 0.7), input, ctx });
    const kinds = r.levers.map((l) => l.kind);
    expect(kinds).toContain('lower_tier');
    expect(kinds).toContain('fewer_travellers');
  });

  it('suggests a cheaper nearby destination when one with cost data exists', () => {
    // Add a cheap city ~near Paris with its own cost row.
    const BRUSSELS = {
      id: 'brussels',
      name: 'Brussels',
      country: 'Belgium',
      iso2: 'BE',
      lat: 50.8503,
      lon: 4.3517,
      population: 1800000,
      iata: 'BRU',
    };
    const ctxWithNeighbour = {
      ...makeContext({
        costs: {
          [PARIS.id]: { foodDaily: 30, transitDaily: 8, accLow: 60, accMid: 120, dataQuality: 1 },
          [BRUSSELS.id]: { foodDaily: 18, transitDaily: 5, accLow: 35, accMid: 70, dataQuality: 1 },
        },
      }),
      getCity: (id: string) =>
        id === BRUSSELS.id ? BRUSSELS : makeContext().getCity(id),
      costCities: () => [PARIS, BRUSSELS],
    };
    const r = assessAffordability({ budget: Math.round(point * 0.7), input, ctx: ctxWithNeighbour });
    expect(r.levers.some((l) => l.kind === 'cheaper_destination')).toBe(true);
  });
});
