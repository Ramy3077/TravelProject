import { describe, expect, it } from 'vitest';
import { repository } from '@/lib/data/repository';

// Exercises the real baked dataset (so `npm run build:data` must have run).
describe('repository (baked dataset)', () => {
  it('finds London by name', () => {
    const results = repository.searchCities('London');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.name.toLowerCase() === 'london')).toBe(true);
  });

  it('caps results at 10', () => {
    expect(repository.searchCities('san').length).toBeLessThanOrEqual(10);
  });

  it('round-trips a found city through getCity', () => {
    const [first] = repository.searchCities('Paris');
    expect(first).toBeDefined();
    expect(repository.getCity(first.id)?.id).toBe(first.id);
  });

  it('exposes the dataset vintage', () => {
    expect(repository.meta().vintage).toBe('2019');
  });

  it('has cost data for a major city', () => {
    const [london] = repository.searchCities('London');
    // London is in the cost dataset; at least one field should be populated.
    const cost = repository.getCost(london.id);
    expect(cost).toBeDefined();
  });
});
