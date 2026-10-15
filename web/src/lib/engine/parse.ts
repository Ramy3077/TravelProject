import type { EstimateInput } from './types';

/**
 * AI seam (intentionally a stub for now).
 *
 * The product roadmap includes natural-language input ("a week in Japan in
 * spring for two, mid-range"). When that lands, the body of this function is
 * swapped for an LLM call that returns structured fields — everything
 * downstream already speaks `EstimateInput`, so nothing else has to change.
 *
 * For now it does nothing; the structured form is the only supported input.
 */
export function parseTripQuery(_text: string): Partial<EstimateInput> {
  return {};
}
