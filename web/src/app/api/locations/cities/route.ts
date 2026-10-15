import { NextResponse, type NextRequest } from 'next/server';
import { repository } from '@/lib/data/repository';
import { errorResponse } from '@/lib/http/errors';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/http/rateLimit';
import { citiesQuerySchema } from '@/lib/validation/schemas';

// GET /api/locations/cities?q=lon  → up to 10 matching cities.
// Same-origin (no CORS), server-side filtered over the baked dataset; the
// client only ever receives ≤10 results, never the full city list.
export function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, RATE_LIMITS.cities);
  if (limited) return limited;
  try {
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const parsed = citiesQuerySchema.safeParse({ q });
    // A too-short/invalid query is not an error here — just no suggestions.
    if (!parsed.success) return NextResponse.json([]);

    const results = repository.searchCities(parsed.data.q).map((c) => ({
      id: c.id,
      name: c.name,
      country: c.country,
    }));
    return NextResponse.json(results);
  } catch (err) {
    return errorResponse(err);
  }
}
