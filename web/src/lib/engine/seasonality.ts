import type { SeasonalityInfo } from './types';

// Heuristic, hemisphere-aware seasonality. The original engine collected the
// trip dates but never used them — this is the cheapest "feels smart" win.
//
// This is deliberately coarse: a month-bucket multiplier keyed off the
// destination's hemisphere (peak = local summer + the December holidays). It is
// NOT destination-specific event data (no "Rio in Carnival") — that would need a
// real events/seasonality feed and is a future enhancement.

const MULTIPLIER: Record<SeasonalityInfo['label'], number> = {
  peak: 1.2,
  shoulder: 1.0,
  off: 0.85,
};

// Months are 1–12.
const NORTHERN: Record<number, SeasonalityInfo['label']> = {
  1: 'off',
  2: 'off',
  3: 'off',
  4: 'shoulder',
  5: 'shoulder',
  6: 'peak',
  7: 'peak',
  8: 'peak',
  9: 'shoulder',
  10: 'shoulder',
  11: 'off',
  12: 'peak', // December holidays
};

const SOUTHERN: Record<number, SeasonalityInfo['label']> = {
  1: 'peak', // local summer
  2: 'peak',
  3: 'shoulder',
  4: 'shoulder',
  5: 'off',
  6: 'off',
  7: 'off',
  8: 'off',
  9: 'shoulder',
  10: 'shoulder',
  11: 'shoulder',
  12: 'peak', // December holidays
};

/** @param destLat destination latitude (sign selects the hemisphere). */
export function seasonality(month: number, destLat: number): SeasonalityInfo {
  const table = destLat >= 0 ? NORTHERN : SOUTHERN;
  const label = table[month] ?? 'shoulder';
  return { month, multiplier: MULTIPLIER[label], label };
}
