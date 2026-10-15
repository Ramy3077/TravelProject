/**
 * Builds the baked reference dataset the app ships with.
 *
 * This is the TypeScript port of the old Python seeders (worker/seed_cities.py +
 * worker/seed_costs.py). The crucial change: instead of POSTing to a live
 * Supabase Postgres (which paused on inactivity and used an anon key for
 * writes), it emits committed JSON files. The "database" becomes static data in
 * the repo — no runtime DB, no pausing, no keys on the request path.
 *
 * Run with:  npm run build:data
 * Inputs:    worldcities.csv, airports.csv, cost-of-living_v2.csv
 * Outputs:   src/lib/data/generated/{cities,costs,countryMedians,meta}.json
 */
import { distance } from 'fastest-levenshtein';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(SCRIPT_DIR, '../src/lib/data/generated');

// ---- tunables -------------------------------------------------------------
const POPULATION_THRESHOLD = 100_000; // searchable cities; cost-matched cities are kept regardless
const FUZZY_THRESHOLD = 85; // Levenshtein-ratio %, matching the old thefuzz cutoff
const DATA_VINTAGE = '2019'; // cost-of-living source dataset is ~2019

// Per-country inflation factors (World Bank CPI), committed by scripts/fetch-cpi.ts.
// We multiply the ~2019 cost numbers by these at build time so the baked dataset
// reflects ~recent prices instead of 6-year-old ones. Countries with no factor
// (or an excluded hyperinflation outlier) keep a factor of 1.0 — conservative.
interface CpiFile {
  meta: { baseYear: number; targetYear: number; source: string; lastUpdated: string | null };
  factors: Record<string, number>;
}
const CPI = JSON.parse(fs.readFileSync(path.join(SCRIPT_DIR, 'cpi-factors.json'), 'utf8')) as CpiFile;
const ADJUST_YEAR = String(CPI.meta.targetYear);
const DATA_SOURCE =
  `SimpleMaps worldcities + OurAirports + Kaggle Cost of Living v2 (~${DATA_VINTAGE}), ` +
  `CPI-adjusted to ${ADJUST_YEAR} (World Bank ${CPI.meta.source.includes('FP.CPI') ? 'FP.CPI.TOTL' : 'CPI'})`;

// Cost-of-living column legend (best-effort mapping of the source's obfuscated
// x1..x55 columns) and the derivations the old seeder used — now documented:
//   x1  ≈ inexpensive restaurant meal  → food/day  = x1 × 3 meals
//   x28 ≈ one-way local transit ticket → transit/day = x28 × 2.5 trips
//   x48 ≈ 1-bed rent, city centre (mo) → accom mid/night = x48 / 30
//   x49 ≈ 1-bed rent, outside centre   → accom low/night = x49 / 30
const MEALS_PER_DAY = 3;
const TRANSIT_TRIPS_PER_DAY = 2.5;
const DAYS_PER_MONTH = 30;

// Major-city IATA overrides, ported verbatim from seed_cities.py.
const OVERRIDE_IATA: Record<string, string> = {
  'london|GB': 'LON',
  'new york|US': 'NYC',
  'tokyo|JP': 'TYO',
  'paris|FR': 'PAR',
  'rome|IT': 'ROM',
  'moscow|RU': 'MOW',
  'beijing|CN': 'BJS',
  'bangkok|TH': 'BKK',
  'dubai|AE': 'DXB',
  'sao paulo|BR': 'SAO',
  'rio de janeiro|BR': 'RIO',
};

// ---- helpers --------------------------------------------------------------
const normalize = (t: unknown): string =>
  typeof t === 'string'
    ? t
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
    : '';

const ratio = (a: string, b: string): number => {
  const m = Math.max(a.length, b.length);
  return m === 0 ? 100 : (1 - distance(a, b) / m) * 100;
};

const safeFloat = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return round2(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
};

function readCsv<T>(file: string): T[] {
  const text = fs.readFileSync(file, 'utf8');
  const parsed = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === 'string' ? v.trim() : v),
  });
  return parsed.data;
}

function resolveInputDir(): string {
  const candidates = [
    process.env.DATA_SRC_DIR,
    path.resolve(SCRIPT_DIR, '../data-src'),
    path.resolve(SCRIPT_DIR, '../../worker/data'),
  ].filter(Boolean) as string[];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'worldcities.csv'))) return dir;
  }
  throw new Error(
    `Could not find worldcities.csv. Looked in:\n  ${candidates.join('\n  ')}\n` +
      `Set DATA_SRC_DIR to the folder containing the 3 source CSVs.`,
  );
}

// ---- types for raw CSV rows ----------------------------------------------
interface WorldCityRow {
  city: string;
  city_ascii: string;
  lat: string;
  lng: string;
  country: string;
  iso2: string;
  population: string;
  id: string;
}
interface AirportRow {
  city_code: string;
  country: string;
  city: string;
}
type CostRow = Record<string, string>; // city, country, x1..x55, data_quality

interface OutCity {
  id: string;
  name: string;
  country: string;
  iso2: string;
  lat: number;
  lon: number;
  population: number;
  iata?: string;
}
interface OutCost {
  foodDaily: number | null;
  transitDaily: number | null;
  accLow: number | null;
  accMid: number | null;
  dataQuality: number | null;
}

// ---- build ----------------------------------------------------------------
function build(): void {
  const inputDir = resolveInputDir();
  console.log(`Reading source CSVs from ${inputDir}`);

  // 1. Cities
  const rawCities = readCsv<WorldCityRow>(path.join(inputDir, 'worldcities.csv'));
  const cities: OutCity[] = [];
  for (const r of rawCities) {
    const lat = safeFloat(r.lat);
    const lon = safeFloat(r.lng);
    if (!r.id || lat === null || lon === null) continue;
    cities.push({
      id: String(r.id),
      name: r.city_ascii || r.city,
      country: r.country,
      iso2: String(r.iso2).toUpperCase(),
      lat,
      lon,
      population: safeFloat(r.population) ?? 0,
      iata: undefined,
    });
  }
  // Biggest city wins a name collision within a country.
  cities.sort((a, b) => b.population - a.population);
  console.log(`Parsed ${cities.length} cities`);

  // 2. IATA lookup from airports
  const iataLookup = new Map<string, string>();
  try {
    const airports = readCsv<AirportRow>(path.join(inputDir, 'airports.csv'));
    for (const a of airports) {
      const city = normalize(a.city);
      const iso2 = String(a.country ?? '').toUpperCase();
      const code = String(a.city_code ?? '').trim();
      if (!city || !iso2 || !code) continue;
      const key = `${city}|${iso2}`;
      if (!iataLookup.has(key)) iataLookup.set(key, code);
    }
    console.log(`IATA lookup size: ${iataLookup.size}`);
  } catch (e) {
    console.warn(`Skipping airports: ${(e as Error).message}`);
  }

  // 3. Assign IATA (greedy: first city to claim a code keeps it)
  const usedCodes = new Set<string>();
  let iataMatched = 0;
  for (const c of cities) {
    const key = `${normalize(c.name)}|${c.iso2}`;
    let iata: string | undefined = OVERRIDE_IATA[key] ?? iataLookup.get(key);
    if (iata && usedCodes.has(iata)) iata = undefined;
    if (iata) {
      usedCodes.add(iata);
      c.iata = iata;
      iataMatched++;
    }
  }
  console.log(`Assigned IATA codes to ${iataMatched} cities`);

  // 4. Index cities by country → name → id (first/biggest wins)
  const byCountry = new Map<string, Map<string, string>>();
  const cityById = new Map<string, OutCity>();
  for (const c of cities) {
    cityById.set(c.id, c);
    const ck = normalize(c.country);
    if (!byCountry.has(ck)) byCountry.set(ck, new Map());
    const bucket = byCountry.get(ck)!;
    const nk = normalize(c.name);
    if (!bucket.has(nk)) bucket.set(nk, c.id);
  }
  const countryKeys = [...byCountry.keys()];

  // 5. Match cost rows → cities (exact then fuzzy, mirroring seed_costs.py)
  const costRows = readCsv<CostRow>(path.join(inputDir, 'cost-of-living_v2.csv'));
  const costs = new Map<string, OutCost>();
  const countryAgg = new Map<string, { food: number[]; transit: number[]; accLow: number[]; accMid: number[] }>();
  const countryFuzzyCache = new Map<string, string | null>();
  const adjustedCountries = new Set<string>();
  let matched = 0;
  let fuzzy = 0;

  for (const row of costRows) {
    const rawCity = row.city ?? row.City;
    const rawCountry = row.country ?? row.Country;
    if (!rawCity || !rawCountry) continue;

    const targetCountry = normalize(rawCountry);
    const targetCity = normalize(rawCity);

    // country bucket (exact → fuzzy ≥ threshold, cached)
    let bucket = byCountry.get(targetCountry);
    if (!bucket) {
      let key = countryFuzzyCache.get(targetCountry);
      if (key === undefined) {
        key = bestMatch(targetCountry, countryKeys);
        countryFuzzyCache.set(targetCountry, key);
      }
      if (key) bucket = byCountry.get(key);
    }
    if (!bucket) continue;

    // city within bucket (exact → fuzzy)
    let cityId = bucket.get(targetCity);
    if (!cityId) {
      const key = bestMatch(targetCity, [...bucket.keys()]);
      if (key) {
        cityId = bucket.get(key);
        fuzzy++;
      }
    }
    if (!cityId) continue;

    const x1 = safeFloat(row.x1);
    const x28 = safeFloat(row.x28);
    const x48 = safeFloat(row.x48);
    const x49 = safeFloat(row.x49);

    // Inflation-adjust the derived costs by the destination country's CPI factor.
    const iso2 = cityById.get(cityId)!.iso2;
    const factor = CPI.factors[iso2] ?? 1;
    if (factor !== 1) adjustedCountries.add(iso2);
    const adj = (v: number | null): number | null => (v === null ? null : round2(v * factor));

    const cost: OutCost = {
      foodDaily: adj(x1 !== null ? x1 * MEALS_PER_DAY : null),
      transitDaily: adj(x28 !== null ? x28 * TRANSIT_TRIPS_PER_DAY : null),
      accMid: adj(x48 !== null ? x48 / DAYS_PER_MONTH : null),
      accLow: adj(x49 !== null ? x49 / DAYS_PER_MONTH : null),
      dataQuality: safeFloat(row.data_quality),
    };
    if (cost.foodDaily === null && cost.transitDaily === null && cost.accMid === null && cost.accLow === null) {
      continue;
    }

    costs.set(cityId, cost);
    matched++;

    // accumulate for country medians (from the already-adjusted values)
    if (!countryAgg.has(iso2)) countryAgg.set(iso2, { food: [], transit: [], accLow: [], accMid: [] });
    const agg = countryAgg.get(iso2)!;
    if (cost.foodDaily !== null) agg.food.push(cost.foodDaily);
    if (cost.transitDaily !== null) agg.transit.push(cost.transitDaily);
    if (cost.accLow !== null) agg.accLow.push(cost.accLow);
    if (cost.accMid !== null) agg.accMid.push(cost.accMid);
  }
  console.log(`Matched ${matched}/${costRows.length} cost rows (${fuzzy} via fuzzy)`);

  // 6. Country medians
  const countryMedians: Record<string, OutCost> = {};
  for (const [iso2, agg] of countryAgg) {
    countryMedians[iso2] = {
      foodDaily: median(agg.food),
      transitDaily: median(agg.transit),
      accLow: median(agg.accLow),
      accMid: median(agg.accMid),
      dataQuality: null,
    };
  }

  // 7. Keep cities that are searchable (≥ threshold pop) OR have cost data
  const keptCities = cities.filter((c) => c.population >= POPULATION_THRESHOLD || costs.has(c.id));
  const keptCosts: Record<string, OutCost> = {};
  for (const c of keptCities) {
    const cost = costs.get(c.id);
    if (cost) keptCosts[c.id] = cost;
  }

  const meta = {
    source: DATA_SOURCE,
    vintage: DATA_VINTAGE,
    adjustedYear: ADJUST_YEAR,
    inflationAdjusted: true,
    builtAt: new Date().toISOString(),
    cityCount: keptCities.length,
    costCityCount: Object.keys(keptCosts).length,
    countryCount: Object.keys(countryMedians).length,
    adjustedCountryCount: adjustedCountries.size,
    populationThreshold: POPULATION_THRESHOLD,
    fuzzyThreshold: FUZZY_THRESHOLD,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  writeJson('cities.json', keptCities);
  writeJson('costs.json', keptCosts);
  writeJson('countryMedians.json', countryMedians);
  writeJson('meta.json', meta);

  console.log(
    `\nDone. ${meta.cityCount} cities (${meta.costCityCount} with city-level cost, ` +
      `${meta.countryCount} country medians). CPI-adjusted ${meta.adjustedCountryCount} countries ` +
      `from ${DATA_VINTAGE} → ${ADJUST_YEAR}. Output → ${OUT_DIR}`,
  );

  function bestMatch(target: string, candidates: string[]): string | null {
    let best: string | null = null;
    let bestScore = 0;
    for (const cand of candidates) {
      const score = ratio(target, cand);
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    return bestScore >= FUZZY_THRESHOLD ? best : null;
  }

  function writeJson(name: string, data: unknown): void {
    fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(data));
  }
}

build();
