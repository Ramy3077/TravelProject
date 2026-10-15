import { LRUCache } from 'lru-cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * A small, dependency-light IP rate limiter. The original Java app had none —
 * any client could hammer the endpoints. This is a sliding-window log keyed by
 * client IP, held in an LRU so idle IPs are evicted automatically.
 *
 * In-memory and therefore PER-INSTANCE: correct for a single Next.js instance
 * (the intended deploy). If the app is ever scaled horizontally, swap the bucket
 * store for a shared one (e.g. Upstash Redis) behind this same interface. This is
 * documented and deliberately not over-built.
 */

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the caller may retry (only meaningful when !ok). */
  retryAfterSec: number;
}

// One bucket (array of request timestamps) per key. TTL well past the largest
// window so entries self-expire; max caps memory under a flood of distinct IPs.
const buckets = new LRUCache<string, number[]>({ max: 20_000, ttl: 10 * 60_000 });

/**
 * Record a hit for `key` and report whether it is within the limit. Pure-ish:
 * the only side effect is updating the shared bucket store. `now` is injectable
 * for tests.
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    const oldest = recent[0];
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { ok: false, limit, remaining: 0, retryAfterSec };
  }

  recent.push(now);
  buckets.set(key, recent);
  return { ok: true, limit, remaining: limit - recent.length, retryAfterSec: 0 };
}

/**
 * Best-effort client IP. Behind Vercel/Cloud Run the real client is the first
 * entry of X-Forwarded-For (Next removed `request.ip`). Falls back to a shared
 * bucket if no header is present — fine for local dev.
 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'local';
}

function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  );
}

/**
 * Enforce a per-IP limit for a route. Returns a ready-to-send 429 response when
 * the caller is over the limit, or `null` to proceed. Usage in a handler:
 *
 *   const limited = enforceRateLimit(req, { limit: 60, windowMs: 60_000 });
 *   if (limited) return limited;
 */
export function enforceRateLimit(req: NextRequest, opts: RateLimitOptions): NextResponse | null {
  const result = rateLimit(clientIp(req), opts);
  return result.ok ? null : tooManyRequests(result);
}

// Sensible defaults per route shape. The POST estimate/afford endpoints do real
// work; the cities autocomplete is client-debounced but fires more often.
export const RATE_LIMITS = {
  estimate: { limit: 60, windowMs: 60_000 },
  afford: { limit: 60, windowMs: 60_000 },
  cities: { limit: 120, windowMs: 60_000 },
} as const;
