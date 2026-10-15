// Core domain types for the trip-cost engine.
//
// Everything here is plain data — no framework imports, no I/O. The engine is a
// set of pure functions over these types so it can be (a) unit-tested without a
// server or DB and (b) wrapped directly by a future LLM/agent tool layer.

/**
 * The single spend/comfort axis. Replaces the old CHEAP|BALANCED|FAST, which
 * conflated a price axis ("cheap") with a speed axis ("fast") and barely
 * differed in practice. One coherent dimension: how much you spend for comfort.
 */
export type Tier = 'budget' | 'balanced' | 'comfort';

/** How much we trust a number, surfaced to the user as a badge. */
export type Confidence = 'high' | 'medium' | 'low';

/** v1 is single-currency (USD), matching the source cost data. FX is a later enhancement. */
export type Currency = 'USD';

/** Where the destination's cost numbers came from — drives confidence + honesty in the UI. */
export type DataCoverage = 'city' | 'country-fallback' | 'global-fallback';

export interface CostRange {
  /** Low end of the plausible range. */
  min: number;
  /** High end of the plausible range. */
  max: number;
  /** Central point estimate — what the affordability check compares against. */
  point: number;
  confidence: Confidence;
}

export interface SeasonalityInfo {
  /** 1–12, the travel month at the destination. */
  month: number;
  /** Multiplier applied to season-sensitive categories (transport, accommodation). */
  multiplier: number;
  label: 'peak' | 'shoulder' | 'off';
}

export interface EstimateInput {
  originCityId: string;
  destinationCityId: string;
  /** ISO date, YYYY-MM-DD. */
  startDate: string;
  /** ISO date, YYYY-MM-DD. Must be after startDate. */
  endDate: string;
  travellers: number;
  tier: Tier;
  currency?: Currency;
}

export interface EstimateResult {
  currency: Currency;
  /** Nights = days between start and end. */
  nights: number;
  /** Days on the ground = nights + 1 (matches the original engine's convention). */
  days: number;
  breakdown: {
    transport: CostRange;
    accommodation: CostRange;
    food: CostRange;
    /** Local getting-around (metro, buses, the occasional taxi). Uses the cost
     * index field that the old engine computed but never read. */
    localTransport: CostRange;
    total: CostRange;
  };
  /** The "show your work" surface — also what an AI layer narrates from. */
  factors: {
    distanceKm: number;
    seasonality: SeasonalityInfo;
    tier: Tier;
    dataCoverage: DataCoverage;
  };
  metadata: {
    dataSource: string;
    dataVintage: string;
    generatedAt: string;
    modelVersion: string;
  };
}

// ---- Affordability ("Can I afford this?") ----

export type Verdict = 'comfortable' | 'feasible' | 'tight' | 'over';

export type LeverKind =
  | 'shorten_trip'
  | 'lower_tier'
  | 'shift_dates'
  | 'cheaper_destination'
  | 'fewer_travellers';

/**
 * A concrete, actionable way to fit the budget. Structured (not prose) so the UI
 * can render it as a clickable chip AND a future agent can re-run the engine
 * with `params` to apply it.
 */
export interface Lever {
  kind: LeverKind;
  label: string;
  estimatedSaving: number;
  resultingVerdict: Verdict;
  params?: Record<string, unknown>;
}

export interface AffordResult {
  verdict: Verdict;
  budget: number;
  currency: Currency;
  /** The full transparent breakdown behind the verdict (the "show your work"). */
  estimate: EstimateResult;
  /** budget − point estimate. Negative means over budget. */
  headroom: number;
  /** Most days you could afford at this destination/tier on the given budget. */
  maxAffordableDays?: number;
  /** Ranked best-saving-first. */
  levers: Lever[];
}

// ---- Data access (implemented by the repository; injected into the engine) ----

export interface CityRecord {
  id: string;
  name: string;
  country: string;
  /** ISO-3166 alpha-2, uppercase. */
  iso2: string;
  lat: number;
  lon: number;
  population: number;
  iata?: string;
}

export interface CostRecord {
  /** Daily food cost per person (USD). */
  foodDaily: number | null;
  /** Daily local-transit cost per person (USD). */
  transitDaily: number | null;
  /** Nightly budget-tier accommodation (USD). */
  accLow: number | null;
  /** Nightly mid-tier accommodation (USD). */
  accMid: number | null;
  /** Source dataset's 0–5 quality flag, carried through for transparency. */
  dataQuality: number | null;
}

export interface DataContext {
  getCity(id: string): CityRecord | undefined;
  getCost(cityId: string): CostRecord | undefined;
  /** Country-level median cost (by ISO-2), used when a city has no row of its own. */
  getCountryMedian(iso2: string): CostRecord | undefined;
  searchCities(query: string, limit?: number): CityRecord[];
  /** All cities that have city-level cost data — used to find cheaper nearby
   *  destinations for the affordability levers. */
  costCities(): CityRecord[];
  meta(): DatasetMeta;
}

export interface DatasetMeta {
  source: string;
  /** Base year of the cost-of-living source data. */
  vintage: string;
  /** Year the costs were inflation-adjusted to (World Bank CPI), if adjusted. */
  adjustedYear?: string;
  inflationAdjusted?: boolean;
  builtAt: string;
  cityCount: number;
  costCityCount: number;
  countryCount: number;
  /** How many countries received a CPI factor ≠ 1 during the build. */
  adjustedCountryCount?: number;
  populationThreshold: number;
  fuzzyThreshold: number;
}
