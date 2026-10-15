/**
 * Fetches per-country inflation factors from the World Bank and commits them to
 * scripts/cpi-factors.json, so the dataset build (build-dataset.ts) can adjust
 * the ~2019 cost-of-living numbers to recent prices WITHOUT a network call —
 * the committed JSON keeps `npm run build:data` offline and reproducible.
 *
 * factor[country] = CPI[latest ≤ TARGET_YEAR] / CPI[BASE_YEAR]
 *
 * Indicator FP.CPI.TOTL is the Consumer Price Index (2010 = 100). The World Bank
 * API is free and needs no key. Run occasionally to refresh:  npm run fetch:cpi
 *
 * Verified example: France 2019=110.05 → 2024=126.51 → factor ≈ 1.15.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(SCRIPT_DIR, 'cpi-factors.json');

const INDICATOR = 'FP.CPI.TOTL';
const BASE_YEAR = 2019;
const TARGET_YEAR = 2024; // latest year the API currently carries CPI for most countries
const ENDPOINT =
  `https://api.worldbank.org/v2/country/all/indicator/${INDICATOR}` +
  `?format=json&per_page=25000&date=${BASE_YEAR}:${TARGET_YEAR}`;

interface WbRow {
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
}

const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

async function main(): Promise<void> {
  console.log(`Fetching ${INDICATOR} (${BASE_YEAR}–${TARGET_YEAR}) from the World Bank…`);
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`World Bank API returned ${res.status}`);
  const payload = (await res.json()) as [unknown, WbRow[] | null];
  const meta = payload[0] as { lastupdated?: string };
  const rows = payload[1];
  if (!Array.isArray(rows)) throw new Error('Unexpected World Bank response shape');

  // Collect CPI by ISO-2 country code → { year: value }. World Bank `country.id`
  // is the ISO-2 code for real countries; aggregates (e.g. "EU", "ZG", "1A") are
  // dropped by the /^[A-Z]{2}$/ filter below and, even if any slip through, will
  // simply never match a city's ISO-2 at apply time.
  const byCountry = new Map<string, Map<number, number>>();
  for (const r of rows) {
    const iso2 = r.country?.id?.toUpperCase();
    const year = Number(r.date);
    const value = typeof r.value === 'number' ? r.value : null;
    if (!iso2 || !/^[A-Z]{2}$/.test(iso2) || value === null || !Number.isFinite(value)) continue;
    if (!byCountry.has(iso2)) byCountry.set(iso2, new Map());
    byCountry.get(iso2)!.set(year, value);
  }

  const factors: Record<string, number> = {};
  for (const [iso2, series] of byCountry) {
    const base = series.get(BASE_YEAR);
    if (!base || base <= 0) continue; // need a 2019 anchor
    // Prefer the most recent year available, walking back from TARGET_YEAR.
    let target: number | undefined;
    for (let y = TARGET_YEAR; y > BASE_YEAR; y--) {
      const v = series.get(y);
      if (v && v > 0) {
        target = v;
        break;
      }
    }
    if (!target) continue;
    const factor = round4(target / base);
    // Guard against absurd values (hyperinflation outliers we'd rather not bake).
    if (factor >= 1 && factor <= 5) factors[iso2] = factor;
  }

  const out = {
    meta: {
      indicator: INDICATOR,
      baseYear: BASE_YEAR,
      targetYear: TARGET_YEAR,
      source: 'World Bank (FP.CPI.TOTL, CPI 2010=100)',
      lastUpdated: meta?.lastupdated ?? null,
      generatedAt: new Date().toISOString(),
      countryCount: Object.keys(factors).length,
    },
    factors,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(
    `Wrote ${out.meta.countryCount} country factors → ${OUT_FILE}\n` +
      `  e.g. FR=${factors.FR}, US=${factors.US}, JP=${factors.JP}, GB=${factors.GB}, TR=${factors.TR ?? 'n/a'}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
