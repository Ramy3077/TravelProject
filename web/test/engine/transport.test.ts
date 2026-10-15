import { describe, expect, it } from 'vitest';
import { bandedFare, estimateTransport } from '@/lib/engine/transport';
import { ALL_TIERS } from '@/lib/engine/tiers';

describe('bandedFare', () => {
  it('increases monotonically with distance', () => {
    const ds = [0, 200, 500, 1000, 2000, 4000, 6000, 9000, 12000, 18000];
    const fares = ds.map(bandedFare);
    for (let i = 1; i < fares.length; i++) {
      expect(fares[i]).toBeGreaterThan(fares[i - 1]);
    }
  });

  it('is non-linear: cost per km falls as distance grows (the whole point of bands)', () => {
    const perKmShort = bandedFare(500) / 500;
    const perKmMedium = bandedFare(2500) / 2500;
    const perKmLong = bandedFare(8000) / 8000;
    expect(perKmShort).toBeGreaterThan(perKmMedium);
    expect(perKmMedium).toBeGreaterThan(perKmLong);
  });

  it('keeps long-haul per-km in a realistic ballpark (~$0.06–0.10/km round trip)', () => {
    const perKm = bandedFare(8000) / 8000;
    expect(perKm).toBeGreaterThan(0.05);
    expect(perKm).toBeLessThan(0.16);
  });

  it('has a positive floor for very short distances', () => {
    expect(bandedFare(0)).toBeGreaterThan(0);
    expect(bandedFare(50)).toBeGreaterThanOrEqual(bandedFare(0));
  });

  it('extrapolates beyond the last anchor without collapsing', () => {
    expect(bandedFare(20000)).toBeGreaterThan(bandedFare(15000));
  });
});

describe('estimateTransport', () => {
  const KM = 1500;

  it('scales with the number of travellers', () => {
    const one = estimateTransport(KM, 1, 'balanced', 1).point;
    const two = estimateTransport(KM, 2, 'balanced', 1).point;
    expect(two).toBe(one * 2);
  });

  it('orders the tiers budget < balanced < comfort', () => {
    const [budget, balanced, comfort] = ALL_TIERS.map(
      (t) => estimateTransport(KM, 2, t, 1).point,
    );
    expect(budget).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(comfort);
  });

  it('applies the seasonality multiplier', () => {
    const off = estimateTransport(KM, 2, 'balanced', 0.85).point;
    const peak = estimateTransport(KM, 2, 'balanced', 1.2).point;
    expect(peak).toBeGreaterThan(off);
  });

  it('returns a medium-confidence range bracketing the point', () => {
    const r = estimateTransport(KM, 2, 'balanced', 1);
    expect(r.confidence).toBe('medium');
    expect(r.min).toBeLessThan(r.point);
    expect(r.max).toBeGreaterThan(r.point);
  });
});
