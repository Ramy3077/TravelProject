import 'server-only';

import type { CityRecord, CostRecord, DataContext, DatasetMeta } from '@/lib/engine/types';
import citiesJson from './generated/cities.json';
import costsJson from './generated/costs.json';
import countryMediansJson from './generated/countryMedians.json';
import metaJson from './generated/meta.json';

// In-memory repository over the baked dataset. This replaces the JPA repositories
// + Supabase Postgres entirely: the data is static reference data shipped with
// the app, loaded once into memory on the server. No DB connection, no pausing,
// no credentials. `import 'server-only'` guarantees this (and the ~1.4 MB of
// JSON) never leaks into the client bundle.

const cities = citiesJson as unknown as CityRecord[];
const costs = costsJson as unknown as Record<string, CostRecord>;
const countryMedians = countryMediansJson as unknown as Record<string, CostRecord>;
const meta = metaJson as unknown as DatasetMeta;

const cityById = new Map<string, CityRecord>(cities.map((c) => [c.id, c]));
const cityCostList = cities.filter((c) => costs[c.id] !== undefined);

// cities.json is pre-sorted by population descending, so a linear scan yields
// the most relevant matches first.
function searchCities(query: string, limit = 10): CityRecord[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const startsWith: CityRecord[] = [];
  const contains: CityRecord[] = [];
  for (const c of cities) {
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) {
      startsWith.push(c);
      if (startsWith.length >= limit) break; // already the `limit` most-populous prefix matches
    } else if (contains.length < limit && name.includes(q)) {
      contains.push(c);
    }
  }
  return [...startsWith, ...contains].slice(0, limit);
}

export const repository: DataContext = {
  getCity: (id) => cityById.get(id),
  getCost: (cityId) => costs[cityId],
  getCountryMedian: (iso2) => countryMedians[iso2],
  searchCities,
  costCities: () => cityCostList,
  meta: () => meta,
};
