import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '@/lib/resilience/circuit';

describe('CircuitBreaker', () => {
  it('returns the live value while calls succeed', async () => {
    const cb = new CircuitBreaker('test');
    expect(await cb.run(async () => 'live', () => 'fallback')).toBe('live');
  });

  it('falls back on failure and never rejects', async () => {
    const cb = new CircuitBreaker('test');
    const value = await cb.run(
      async () => {
        throw new Error('boom');
      },
      () => 'fallback',
    );
    expect(value).toBe('fallback');
  });

  it('opens after the failure threshold, short-circuits, then recovers half-open', async () => {
    let now = 0;
    const cb = new CircuitBreaker(
      'test',
      { minimumCalls: 5, slidingWindowSize: 10, failureRateThreshold: 50, openMs: 1000 },
      () => now,
    );

    for (let i = 0; i < 5; i++) {
      await cb.run(async () => {
        throw new Error('x');
      }, () => 'fb');
    }
    expect(cb.getState()).toBe('open');

    // While open, the guarded function must not run.
    let called = false;
    const whileOpen = await cb.run(async () => {
      called = true;
      return 'live';
    }, () => 'fb');
    expect(called).toBe(false);
    expect(whileOpen).toBe('fb');

    // After the open window, a successful probe closes the circuit.
    now += 1000;
    expect(cb.getState()).toBe('half-open');
    const probe = await cb.run(async () => 'live', () => 'fb');
    expect(probe).toBe('live');
    expect(cb.getState()).toBe('closed');
  });
});
