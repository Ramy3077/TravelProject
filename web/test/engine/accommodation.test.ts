import { describe, expect, it } from 'vitest';
import { NIGHTLY_RATE_PREMIUM, estimateAccommodation } from '@/lib/engine/accommodation';
import type { CostRecord } from '@/lib/engine/types';

const COST: CostRecord = { foodDaily: 30, transitDaily: 8, accLow: 40, accMid: 100, dataQuality: 1 };

describe('estimateAccommodation', () => {
  it('applies the short-stay premium to the pro-rated nightly rate', () => {
    // balanced reads accMid (100), 1 night, 1 room, no season scaling.
    const r = estimateAccommodation(COST, 1, 1, 'balanced', 1, 'high');
    expect(r.point).toBe(Math.round(100 * NIGHTLY_RATE_PREMIUM)); // 250, not 100
  });

  it('scales by rooms (≈2 travellers per room), not raw head-count', () => {
    const two = estimateAccommodation(COST, 3, 2, 'balanced', 1, 'high').point; // 1 room
    const four = estimateAccommodation(COST, 3, 4, 'balanced', 1, 'high').point; // 2 rooms
    expect(four).toBe(two * 2);
    const three = estimateAccommodation(COST, 3, 3, 'balanced', 1, 'high').point; // still 2 rooms
    expect(three).toBe(four);
  });

  it('scales linearly with nights and seasonality', () => {
    const base = estimateAccommodation(COST, 2, 2, 'balanced', 1, 'high').point;
    const twiceNights = estimateAccommodation(COST, 4, 2, 'balanced', 1, 'high').point;
    const peak = estimateAccommodation(COST, 2, 2, 'balanced', 1.2, 'high').point;
    expect(twiceNights).toBe(base * 2);
    expect(peak).toBeGreaterThan(base);
  });

  it('makes comfort exceed budget (factor + price-point differences)', () => {
    const budget = estimateAccommodation(COST, 3, 2, 'budget', 1, 'high').point;
    const comfort = estimateAccommodation(COST, 3, 2, 'comfort', 1, 'high').point;
    expect(comfort).toBeGreaterThan(budget);
  });

  it('carries through the coverage-derived confidence', () => {
    expect(estimateAccommodation(COST, 1, 1, 'balanced', 1, 'medium').confidence).toBe('medium');
  });
});
