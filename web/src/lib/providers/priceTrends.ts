// Optional external enrichment seam (model-first, enrich-optional).
//
// The cost model is always the primary, always-available source. A price-trends
// API (e.g. Travelpayouts — free + affiliate-monetizable — or Kiwi Tequila) can
// OPTIONALLY refine the modelled transport cost and raise its confidence. It can
// never block or fail a request: a real implementation is wrapped in the
// CircuitBreaker (lib/resilience/circuit.ts), and the default below is a no-op.
//
// This deliberately replaces the dead-end Amadeus integration: Amadeus is
// decommissioning its self-service developer API, and for a cost *estimator*
// (not a booking engine) price *trends* fit better than live booking inventory.

export interface PriceTrendProvider {
  readonly name: string;
  /**
   * A multiplicative adjustment to the modelled transport cost for this route
   * and departure month (e.g. 0.9 when fares trend cheap), or null if no signal
   * is available. Async because a real provider does network I/O.
   */
  getTransportAdjustment(
    originIata: string | undefined,
    destIata: string | undefined,
    departISODate: string,
  ): Promise<number | null>;
}

/** Default provider: no external calls, no signal. Keeps the request path
 *  dependency-free until a real provider is wired in. */
export const nullPriceTrendProvider: PriceTrendProvider = {
  name: 'none',
  async getTransportAdjustment() {
    return null;
  },
};
