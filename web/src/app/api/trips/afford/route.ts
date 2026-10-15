import { NextResponse, type NextRequest } from 'next/server';
import { repository } from '@/lib/data/repository';
import { assessAffordability } from '@/lib/engine/afford';
import { EngineError } from '@/lib/engine/errors';
import { errorResponse } from '@/lib/http/errors';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/http/rateLimit';
import { affordInputSchema } from '@/lib/validation/schemas';

// POST /api/trips/afford  → "Can I afford this?" verdict + ranked ways to fit the budget.
export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, RATE_LIMITS.afford);
  if (limited) return limited;
  try {
    const body = await req.json().catch(() => null);
    if (body === null) throw new EngineError('INVALID_INPUT', 'Request body must be valid JSON');

    const { budget, ...input } = affordInputSchema.parse(body);
    const result = assessAffordability({ budget, input, ctx: repository });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
