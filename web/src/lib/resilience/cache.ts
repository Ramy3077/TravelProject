import { LRUCache } from 'lru-cache';

// In-memory LRU with TTL — the TypeScript equivalent of the original
// @Cacheable("flightQuotes") (Caffeine, 15-min TTL, max 1000 entries).
//
// NOTE: per-instance only. If the app is ever scaled to multiple instances,
// move this to a shared store (e.g. Upstash Redis). Documented, not over-built.

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function createTtlCache<V extends NonNullable<unknown>>(
  max = 1000,
  ttl = FIFTEEN_MINUTES,
): LRUCache<string, V> {
  return new LRUCache<string, V>({ max, ttl });
}
