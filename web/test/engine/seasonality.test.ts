import { describe, expect, it } from 'vitest';
import { seasonality } from '@/lib/engine/seasonality';

describe('seasonality', () => {
  it('treats northern-hemisphere summer as peak', () => {
    const s = seasonality(7, 48.85); // July, Paris
    expect(s.label).toBe('peak');
    expect(s.multiplier).toBeGreaterThan(1);
  });

  it('treats northern-hemisphere late autumn as off-season', () => {
    expect(seasonality(11, 48.85).label).toBe('off');
  });

  it('inverts for the southern hemisphere', () => {
    expect(seasonality(7, -33.87).label).toBe('off'); // July is winter in Sydney
    expect(seasonality(1, -33.87).label).toBe('peak'); // January is summer
  });
});
