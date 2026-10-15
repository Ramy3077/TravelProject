import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as citiesGET } from '@/app/api/locations/cities/route';
import { POST as affordPOST } from '@/app/api/trips/afford/route';
import { POST as estimatePOST } from '@/app/api/trips/estimate/route';
import { GET as healthGET } from '@/app/api/health/route';
import { RATE_LIMITS } from '@/lib/http/rateLimit';
import type { AffordResult } from '@/lib/engine/types';

// Integration tests: call the real Next.js route handlers with real requests,
// over the real baked dataset. Nothing is mocked. Each test sends its own
// X-Forwarded-For so the in-memory rate limiter never carries state between them.

let ipCounter = 0;
const freshIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

function get(path: string, ip = freshIp()): NextRequest {
  return new NextRequest(`http://localhost${path}`, { headers: { 'x-forwarded-for': ip } });
}

function post(path: string, body: unknown, ip = freshIp()): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function cityId(name: string): Promise<string> {
  const res = citiesGET(get(`/api/locations/cities?q=${encodeURIComponent(name)}`));
  const list = (await res.json()) as { id: string; name: string }[];
  const match = list.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!match) throw new Error(`${name} not found in dataset`);
  return match.id;
}

async function trip() {
  return {
    originCityId: await cityId('London'),
    destinationCityId: await cityId('Paris'),
    startDate: '2026-08-01',
    endDate: '2026-08-08',
    travellers: 2,
    tier: 'balanced' as const,
  };
}

describe('GET /api/locations/cities', () => {
  it('returns at most 10 matches with id, name and country only', async () => {
    const res = citiesGET(get('/api/locations/cities?q=lon'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body.length).toBeGreaterThan(0);
    expect(body.length).toBeLessThanOrEqual(10);
    for (const c of body) expect(Object.keys(c).sort()).toEqual(['country', 'id', 'name']);
  });

  it('returns an empty list, not an error, for a one-letter query', async () => {
    const res = citiesGET(get('/api/locations/cities?q=l'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('returns 429 with Retry-After once the per-IP limit is spent', async () => {
    const ip = freshIp();
    for (let i = 0; i < RATE_LIMITS.cities.limit; i++) {
      expect(citiesGET(get('/api/locations/cities?q=par', ip)).status).toBe(200);
    }
    const res = citiesGET(get('/api/locations/cities?q=par', ip));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await res.json()).error).toBe('RATE_LIMITED');
    // A different client is unaffected.
    expect(citiesGET(get('/api/locations/cities?q=par')).status).toBe(200);
  });
});

describe('POST /api/trips/afford', () => {
  it('returns a verdict, levers and a breakdown for London to Paris', async () => {
    const res = await affordPOST(post('/api/trips/afford', { ...(await trip()), budget: 2500 }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as AffordResult;
    expect(['comfortable', 'feasible', 'tight', 'over']).toContain(body.verdict);
    expect(body.budget).toBe(2500);
    expect(body.headroom).toBe(2500 - body.estimate.breakdown.total.point);
    expect(body.estimate.breakdown.total.point).toBeGreaterThan(0);
    expect(body.levers.length).toBeGreaterThan(0);
    const savings = body.levers.map((l) => l.estimatedSaving);
    expect(savings).toEqual([...savings].sort((a, b) => b - a));
  });

  it('a smaller budget gives a worse or equal verdict for the same trip', async () => {
    const order = ['comfortable', 'feasible', 'tight', 'over'];
    const t = await trip();
    const rich = (await (await affordPOST(post('/api/trips/afford', { ...t, budget: 20_000 }))).json()) as AffordResult;
    const poor = (await (await affordPOST(post('/api/trips/afford', { ...t, budget: 100 }))).json()) as AffordResult;
    expect(rich.verdict).toBe('comfortable');
    expect(poor.verdict).toBe('over');
    expect(order.indexOf(poor.verdict)).toBeGreaterThan(order.indexOf(rich.verdict));
  });

  it('returns 400 with field messages when the end date is before the start date', async () => {
    const res = await affordPOST(
      post('/api/trips/afford', { ...(await trip()), startDate: '2026-08-08', endDate: '2026-08-01', budget: 2500 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(body.fields.endDate).toMatch(/after start/);
  });

  it('returns 400 for a missing budget and for a body that is not JSON', async () => {
    const missing = await affordPOST(post('/api/trips/afford', await trip()));
    expect(missing.status).toBe(400);
    expect((await missing.json()).fields).toHaveProperty('budget');

    const garbage = await affordPOST(post('/api/trips/afford', '{not json'));
    expect(garbage.status).toBe(400);
    expect((await garbage.json()).error).toBe('INVALID_INPUT');
  });

  it('returns 404 for a city id that is not in the dataset', async () => {
    const res = await affordPOST(
      post('/api/trips/afford', { ...(await trip()), destinationCityId: 'no-such-city', budget: 2500 }),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('UNKNOWN_CITY');
  });

  it('returns 429 after the per-IP limit and never runs the engine for the blocked call', async () => {
    const ip = freshIp();
    const t = await trip();
    for (let i = 0; i < RATE_LIMITS.afford.limit; i++) {
      // Invalid bodies still count against the limit, and are cheap.
      expect((await affordPOST(post('/api/trips/afford', {}, ip))).status).toBe(400);
    }
    const res = await affordPOST(post('/api/trips/afford', { ...t, budget: 2500 }, ip));
    expect(res.status).toBe(429);
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0');
  });
});

describe('POST /api/trips/estimate and GET /api/health', () => {
  it('estimate returns the same total as afford for the same trip', async () => {
    const t = await trip();
    const est = await (await estimatePOST(post('/api/trips/estimate', t))).json();
    const aff = (await (await affordPOST(post('/api/trips/afford', { ...t, budget: 2500 }))).json()) as AffordResult;
    expect(est.breakdown.total.point).toBe(aff.estimate.breakdown.total.point);
  });

  it('health returns ok', async () => {
    const res = healthGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
