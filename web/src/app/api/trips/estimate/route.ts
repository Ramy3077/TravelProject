import { NextResponse, type NextRequest } from 'next/server';
import { repository } from '@/lib/data/repository';
import { estimateTrip } from '@/lib/engine/estimate';
import { EngineError } from '@/lib/engine/errors';
import type { EstimateResult } from '@/lib/engine/types';
import { errorResponse } from '@/lib/http/errors';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/http/rateLimit';
import { createTtlCache } from '@/lib/resilience/cache';
import { estimateInputSchema } from '@/lib/validation/schemas';

// Cache identical estimates (the TS equivalent of the old @Cacheable). Keyed on
// the full request so a repeated query is instant.
const cache = createTtlCache<EstimateResult>();

const cacheKey = (i: ReturnType<typeof estimateInputSchema.parse>): string =>
  `${i.originCityId}|${i.destinationCityId}|${i.startDate}|${i.endDate}|${i.travellers}|${i.tier}|${i.currency ?? 'USD'}`;

// POST /api/trips/estimate  → transparent cost breakdown (the "show your work").
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, RATE_LIMITS.estimate);
  if (limited) return limited;
  try {
    const body = await req.json().catch(() => null);
    if (body === null) throw new EngineError('INVALID_INPUT', 'Request body must be valid JSON');

    const input = estimateInputSchema.parse(body);

    const key = cacheKey(input);
    const hit = cache.get(key);
    if (hit) return NextResponse.json(hit);

    const result = estimateTrip(input, repository);
    cache.set(key, result);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
