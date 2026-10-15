import type { Confidence, CostRange } from './types';

/** Round to whole currency units — estimates this fuzzy don't merit cents. */
export const round = (n: number): number => Math.round(n);

/**
 * Build a CostRange from a central value and a +/- band, rounding consistently.
 * `lowFactor`/`highFactor` express the plausible spread (e.g. 0.8–1.3).
 */
export function rangeFrom(
  point: number,
  lowFactor: number,
  highFactor: number,
  confidence: Confidence,
): CostRange {
  return {
    min: round(point * lowFactor),
    max: round(point * highFactor),
    point: round(point),
    confidence,
  };
}

/** Confidence ordering, most → least trusted. */
const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

/** Combined confidence = the most conservative (lowest) of the parts. */
export function weakestConfidence(confidences: Confidence[]): Confidence {
  return confidences.reduce((worst, c) => (RANK[c] < RANK[worst] ? c : worst), 'high' as Confidence);
}

/** Sum several ranges into one (used for the trip total). */
export function sumRanges(ranges: CostRange[]): CostRange {
  return {
    min: round(ranges.reduce((s, r) => s + r.min, 0)),
    max: round(ranges.reduce((s, r) => s + r.max, 0)),
    point: round(ranges.reduce((s, r) => s + r.point, 0)),
    confidence: weakestConfidence(ranges.map((r) => r.confidence)),
  };
}
