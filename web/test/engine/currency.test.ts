import { describe, expect, it } from 'vitest';
import { assessAffordability } from '@/lib/engine/afford';
import { convert, formatUsd, fromUsd, FX, toUsd, type FxTable } from '@/lib/currency';
import { LONDON, PARIS, makeContext } from '../fixtures';

const fx: FxTable = { asOf: '2026-01-01', rates: { USD: 1, GBP: 0.8, EUR: 0.9 } };

describe('currency conversion at the display boundary', () => {
  it('converts to and from USD with the stored rates', () => {
    expect(fromUsd(100, 'GBP', fx)).toBeCloseTo(80);
    expect(toUsd(80, 'GBP', fx)).toBeCloseTo(100);
    expect(convert(1500, 'GBP', 'EUR', fx)).toBe(1688);
    expect(convert(1500, 'USD', 'USD', fx)).toBe(1500);
  });

  it('formats with the right symbol', () => {
    expect(formatUsd(1000, 'GBP', fx)).toBe('£800');
    expect(formatUsd(1000, 'USD', fx)).toBe('$1,000');
    expect(formatUsd(1000, 'EUR', fx)).toBe('€900');
  });

  it('ships rates and a date in the dataset meta', () => {
    expect(FX.rates.USD).toBe(1);
    expect(FX.rates.GBP).toBeGreaterThan(0);
    expect(FX.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps the engine in USD: a GBP budget converted at the edge gives the same verdict as the USD equivalent', () => {
    const ctx = makeContext();
    const input = {
      originCityId: LONDON.id, destinationCityId: PARIS.id,
      startDate: '2026-07-01', endDate: '2026-07-08', travellers: 2, tier: 'balanced' as const,
    };
    const usdBudget = 2500;
    const gbpBudget = Math.round(fromUsd(usdBudget, 'GBP', fx));
    const direct = assessAffordability({ budget: usdBudget, input, ctx });
    const viaGbp = assessAffordability({ budget: toUsd(gbpBudget, 'GBP', fx), input, ctx });
    expect(direct.currency).toBe('USD');
    expect(viaGbp.verdict).toBe(direct.verdict);
    // Displayed estimate equals engine USD figure converted once.
    expect(formatUsd(direct.estimate.breakdown.total.point, 'GBP', fx)).toBe(
      `£${Math.round(direct.estimate.breakdown.total.point * 0.8).toLocaleString('en-GB')}`,
    );
  });
});
