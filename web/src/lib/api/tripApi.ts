// API client for the Trip Cost app.
//
// Same-origin: the API now lives in this same Next.js app (route handlers under
// /api/*), so there is no separate backend URL and no NEXT_PUBLIC_API_URL to
// bake in at build time. Types are shared with the engine — one source of truth.

import type { AffordResult, EstimateInput, EstimateResult } from '@/lib/engine/types';

export type { AffordResult, Confidence, EstimateInput, EstimateResult, CostRange, Lever, Tier, Verdict } from '@/lib/engine/types';

export interface City {
  id: string;
  name: string;
  country: string;
}

export type AffordRequest = EstimateInput & { budget: number };

interface ApiErrorBody {
  error: string;
  message: string;
  fields?: Record<string, string>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ApiErrorBody | null;
    const detail = err?.fields ? Object.values(err.fields)[0] : undefined;
    throw new Error(detail || err?.message || 'Request failed');
  }
  return res.json() as Promise<T>;
}

/** Search cities by name (min 2 chars). Returns up to 10 matches. */
export async function searchCities(query: string): Promise<City[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`/api/locations/cities?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search cities');
  return res.json();
}

/** Transparent cost breakdown for a trip. */
export function estimateTrip(input: EstimateInput): Promise<EstimateResult> {
  return postJson<EstimateResult>('/api/trips/estimate', input);
}

/** "Can I afford this?" — verdict, headroom, max affordable days, and ways to save. */
export function assessAfford(req: AffordRequest): Promise<AffordResult> {
  return postJson<AffordResult>('/api/trips/afford', req);
}
