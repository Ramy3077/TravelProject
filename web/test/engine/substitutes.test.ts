import { describe, expect, it } from 'vitest';
import { assessAffordability } from '@/lib/engine/afford';
import { isPlausibleSubstitute } from '@/lib/engine/substitutes';
import type { CityRecord, CostRecord } from '@/lib/engine/types';
import { LONDON, makeContext } from '../fixtures';

const city = (id: string, name: string, iso2: string, lat: number, lon: number, population: number): CityRecord => ({
  id, name, country: name, iso2, lat, lon, population,
});

const LISBON = city('lisbon', 'Lisbon', 'PT', 38.7122, -9.134, 548_703);
const PORTO = city('porto', 'Porto', 'PT', 41.1495, -8.6108, 231_800);
const SEVILLE = city('seville', 'Seville', 'ES', 37.3886, -5.9823, 688_711);
const TETOUAN = city('tetouan', 'Tetouan', 'MA', 35.5667, -5.3667, 422_757);
const TINY = city('tiny', 'Tinyville', 'PT', 38.9, -9.0, 20_000);
const MEGA = city('mega', 'Megacity', 'PT', 38.9, -9.0, 9_000_000);
const FAR_PT = city('far', 'Faraway', 'PT', 38.0, -9.0, 500_000);

describe('isPlausibleSubstitute', () => {
  it('accepts a same-country city of similar size', () => {
    expect(isPlausibleSubstitute(LISBON, PORTO)).toBe(true);
  });
  it('accepts a close neighbour in the same region', () => {
    expect(isPlausibleSubstitute(LISBON, SEVILLE)).toBe(true);
  });
  it('rejects a city across the sea in another region (Tetouan for Lisbon)', () => {
    expect(isPlausibleSubstitute(LISBON, TETOUAN)).toBe(false);
  });
  it('rejects tiny places and cities of very different size', () => {
    expect(isPlausibleSubstitute(LISBON, TINY)).toBe(false);
    expect(isPlausibleSubstitute(LISBON, MEGA)).toBe(false);
  });
  it('rejects the same city and cross-border cities beyond the radius, accepts in-country distance', () => {
    expect(isPlausibleSubstitute(LISBON, LISBON)).toBe(false);
    const barcelona = city('barcelona', 'Barcelona', 'ES', 41.3833, 2.1833, 700_000);
    expect(isPlausibleSubstitute(LISBON, barcelona)).toBe(false);
    expect(isPlausibleSubstitute(LISBON, FAR_PT)).toBe(true);
  });
});

describe('cheaper_destination lever', () => {
  const cost = (accMid: number): CostRecord => ({ foodDaily: 20, transitDaily: 4, accLow: accMid / 2, accMid, dataQuality: 1 });
  const cities = [LONDON, LISBON, PORTO, TETOUAN];
  const costs: Record<string, CostRecord> = {
    [LISBON.id]: cost(100),
    [PORTO.id]: cost(60),
    [TETOUAN.id]: cost(15),
    [LONDON.id]: cost(150),
  };
  const base = makeContext({ costs });
  const ctx = {
    ...base,
    getCity: (id: string) => cities.find((c) => c.id === id),
    costCities: () => cities,
  };
  const input = {
    originCityId: LONDON.id, destinationCityId: LISBON.id,
    startDate: '2026-07-01', endDate: '2026-07-08', travellers: 2, tier: 'balanced' as const,
  };

  it('suggests Porto, never Tetouan, for Lisbon', () => {
    const r = assessAffordability({ budget: 100, input, ctx });
    const lever = r.levers.find((l) => l.kind === 'cheaper_destination');
    expect(lever?.params?.destinationCityId).toBe(PORTO.id);
  });
});
