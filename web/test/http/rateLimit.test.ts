import { describe, expect, it } from 'vitest';
import { rateLimit } from '@/lib/http/rateLimit';

// Each test uses a unique key so the shared in-memory bucket store never bleeds
// between cases, and an explicit clock so window expiry is deterministic.
const opts = { limit: 3, windowMs: 1000 };
let n = 0;
const freshKey = () => `test-${Date.now()}-${n++}`;

describe('rateLimit', () => {
  it('allows requests up to the limit, then blocks', () => {
    const key = freshKey();
    expect(rateLimit(key, opts, 0).ok).toBe(true);
    expect(rateLimit(key, opts, 1).ok).toBe(true);
    expect(rateLimit(key, opts, 2).ok).toBe(true);
    const blocked = rateLimit(key, opts, 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('decrements remaining as the window fills', () => {
    const key = freshKey();
    expect(rateLimit(key, opts, 0).remaining).toBe(2);
    expect(rateLimit(key, opts, 1).remaining).toBe(1);
    expect(rateLimit(key, opts, 2).remaining).toBe(0);
  });

  it('frees capacity once the window slides past old hits', () => {
    const key = freshKey();
    rateLimit(key, opts, 0);
    rateLimit(key, opts, 0);
    rateLimit(key, opts, 0);
    expect(rateLimit(key, opts, 500).ok).toBe(false); // still within the 1s window
    expect(rateLimit(key, opts, 1001).ok).toBe(true); // first hits have aged out
  });

  it('tracks keys independently', () => {
    const a = freshKey();
    const b = freshKey();
    rateLimit(a, opts, 0);
    rateLimit(a, opts, 0);
    rateLimit(a, opts, 0);
    expect(rateLimit(a, opts, 0).ok).toBe(false);
    expect(rateLimit(b, opts, 0).ok).toBe(true); // a different IP is unaffected
  });
});
