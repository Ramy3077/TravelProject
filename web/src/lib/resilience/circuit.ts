// A small, dependency-free circuit breaker — the TypeScript port of the
// Resilience4j @CircuitBreaker the original Java app wrapped its flight calls in.
// Defaults mirror the old application.yml tuning: 50% failure rate over a
// sliding window of 10 calls, 60s open before a half-open trial.
//
// Used to guard any *optional* external enrichment (e.g. a price-trends API).
// The core cost model never goes through here — it always works — so an open
// circuit degrades gracefully to the model instead of failing the request.

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitOptions {
  failureRateThreshold?: number; // percent, 0–100
  slidingWindowSize?: number;
  openMs?: number;
  minimumCalls?: number;
}

const DEFAULTS: Required<CircuitOptions> = {
  failureRateThreshold: 50,
  slidingWindowSize: 10,
  openMs: 60_000,
  minimumCalls: 5,
};

export class CircuitBreaker {
  private opts: Required<CircuitOptions>;
  private outcomes: boolean[] = []; // true = success
  private state: CircuitState = 'closed';
  private openedAt = 0;

  constructor(
    private readonly label: string,
    opts: CircuitOptions = {},
    private readonly now: () => number = Date.now,
  ) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  getState(): CircuitState {
    if (this.state === 'open' && this.now() - this.openedAt >= this.opts.openMs) {
      this.state = 'half-open';
    }
    return this.state;
  }

  /**
   * Run `fn`, falling back to `fallback` if the circuit is open or `fn` throws.
   * Never rejects: callers always get a usable value (the whole point of
   * graceful degradation).
   */
  async run<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.getState() === 'open') {
      return fallback();
    }
    try {
      const result = await fn();
      this.record(true);
      return result;
    } catch {
      this.record(false);
      return fallback();
    }
  }

  private record(success: boolean): void {
    this.outcomes.push(success);
    if (this.outcomes.length > this.opts.slidingWindowSize) {
      this.outcomes.shift();
    }

    if (this.state === 'half-open') {
      // One probe decides: success closes, failure re-opens.
      this.state = success ? 'closed' : 'open';
      if (!success) this.openedAt = this.now();
      if (success) this.outcomes = [];
      return;
    }

    if (this.outcomes.length >= this.opts.minimumCalls) {
      const failures = this.outcomes.filter((ok) => !ok).length;
      const failureRate = (failures / this.outcomes.length) * 100;
      if (failureRate >= this.opts.failureRateThreshold) {
        this.state = 'open';
        this.openedAt = this.now();
      }
    }
  }
}
