import { describe, expect, it } from 'vitest';
import { haversineKm } from '@/lib/engine/distance';

describe('haversineKm', () => {
  it('computes a known short-haul distance (London → Paris ≈ 340 km)', () => {
    const d = haversineKm(51.5072, -0.1276, 48.8566, 2.3522);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(355);
  });

  it('computes a known long-haul distance (London → New York ≈ 5570 km)', () => {
    const d = haversineKm(51.5072, -0.1276, 40.7128, -74.006);
    expect(d).toBeGreaterThan(5500);
    expect(d).toBeLessThan(5620);
  });

  it('is zero for identical points', () => {
    expect(haversineKm(10, 20, 10, 20)).toBe(0);
  });
});
