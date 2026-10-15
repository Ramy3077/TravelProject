import type { CityRecord, CostRecord, DataContext, DatasetMeta } from '@/lib/engine/types';

// A tiny, deterministic data context for engine tests — independent of the
// baked dataset so tests pin behavior, not data.

export const LONDON: CityRecord = {
  id: 'london',
  name: 'London',
  country: 'United Kingdom',
  iso2: 'GB',
  lat: 51.5072,
  lon: -0.1276,
  population: 9000000,
  iata: 'LON',
};

export const PARIS: CityRecord = {
  id: 'paris',
  name: 'Paris',
  country: 'France',
  iso2: 'FR',
  lat: 48.8566,
  lon: 2.3522,
  population: 11000000,
  iata: 'PAR',
};

export const SYDNEY: CityRecord = {
  id: 'sydney',
  name: 'Sydney',
  country: 'Australia',
  iso2: 'AU',
  lat: -33.8688,
  lon: 151.2093,
  population: 5000000,
  iata: 'SYD',
};

const PARIS_COST: CostRecord = {
  foodDaily: 30,
  transitDaily: 8,
  accLow: 60,
  accMid: 120,
  dataQuality: 1,
};

const META: DatasetMeta = {
  source: 'test',
  vintage: '2019',
  builtAt: '2024-01-01T00:00:00Z',
  cityCount: 3,
  costCityCount: 1,
  countryCount: 1,
  populationThreshold: 100000,
  fuzzyThreshold: 85,
};

interface FixtureOptions {
  /** Cost data per city id. Omit a city to exercise the fallback chain. */
  costs?: Record<string, CostRecord>;
  countryMedians?: Record<string, CostRecord>;
}

export function makeContext(opts: FixtureOptions = {}): DataContext {
  const cities = new Map<string, CityRecord>([
    [LONDON.id, LONDON],
    [PARIS.id, PARIS],
    [SYDNEY.id, SYDNEY],
  ]);
  const costs = opts.costs ?? { [PARIS.id]: PARIS_COST };
  const countryMedians = opts.countryMedians ?? {};

  const cityList = [LONDON, PARIS, SYDNEY];
  return {
    getCity: (id) => cities.get(id),
    getCost: (id) => costs[id],
    getCountryMedian: (iso2) => countryMedians[iso2],
    searchCities: () => [],
    costCities: () => cityList.filter((c) => costs[c.id] !== undefined),
    meta: () => META,
  };
}
