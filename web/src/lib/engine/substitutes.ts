import { haversineKm } from './distance';
import type { CityRecord } from './types';

// Coarse regions (by ISO-3166 alpha-2) so a "cheaper destination" never jumps
// across a sea or continent just because the map distance is short.
const REGIONS: Record<string, string> = {};
function region(name: string, codes: string): void {
  for (const c of codes.split(' ')) REGIONS[c] = name;
}
region(
  'europe',
  'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK',
);
region('north-africa', 'DZ EG LY MA MR TN');
region('sub-saharan-africa', 'AO BF BI BJ BW CD CF CG CI CM CV DJ ER ET GA GH GM GN GQ GW KE LR LS MG ML MU MW MZ NA NE NG RW SD SL SN SO SS ST SZ TD TG TZ UG ZA ZM ZW');
region('middle-east', 'AE BH IL IQ IR JO KW LB OM PS QA SA SY TR YE AM AZ GE');
region('central-south-asia', 'AF BD BT IN LK MV NP PK KZ KG TJ TM UZ');
region('east-asia', 'CN HK JP KP KR MN MO TW');
region('southeast-asia', 'BN ID KH LA MM MY PH SG TH TL VN');
region('north-america', 'CA US MX');
region('central-america', 'BZ CR GT HN NI PA SV BS BB CU DO HT JM TT');
region('south-america', 'AR BO BR CL CO EC GY PE PY SR UY VE');
region('oceania', 'AU FJ NZ PG SB TO VU WS');

export const SUBSTITUTE_RULES = {
  /** Max distance when staying inside one country. */
  sameCountryKm: 900,
  /** Max distance when crossing a border inside the same region. */
  sameRegionKm: 600,
  /** Candidate must be at least this fraction of the original city's population... */
  minPopulationRatio: 0.15,
  /** ...and at most this multiple of it. */
  maxPopulationRatio: 3.5,
  /** Absolute floor so tiny places are never suggested. */
  minPopulation: 200_000,
  /** Closer than this is the same metro area (a suburb), not a different trip. */
  minDistanceKm: 50,
} as const;

export function regionOf(iso2: string): string | undefined {
  return REGIONS[iso2];
}

/**
 * Whether `candidate` is a believable stand-in for `dest`: same country, or a
 * neighbour in the same world region within a sensible radius, and of broadly
 * similar city size.
 */
export function isPlausibleSubstitute(dest: CityRecord, candidate: CityRecord): boolean {
  if (candidate.id === dest.id) return false;
  const r = SUBSTITUTE_RULES;

  const pop = candidate.population;
  if (pop < r.minPopulation) return false;
  if (pop < dest.population * r.minPopulationRatio) return false;
  if (pop > dest.population * r.maxPopulationRatio) return false;

  const distance = haversineKm(dest.lat, dest.lon, candidate.lat, candidate.lon);
  if (distance < r.minDistanceKm) return false;
  if (candidate.iso2 === dest.iso2) return distance <= r.sameCountryKm;

  const a = regionOf(dest.iso2);
  const b = regionOf(candidate.iso2);
  return a !== undefined && a === b && distance <= r.sameRegionKm;
}
