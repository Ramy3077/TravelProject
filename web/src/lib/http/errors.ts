import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { EngineError } from '@/lib/engine/errors';

interface ErrorBody {
  error: string;
  message: string;
  fields?: Record<string, string>;
}

const json = (body: ErrorBody, status: number) => NextResponse.json(body, { status });

/**
 * Map any thrown value to a clean HTTP response. Crucially, unknown errors never
 * leak a stack trace or internal detail to the client (the original Java app
 * only handled ValidationException, so everything else surfaced Spring's
 * whitelabel page) — they're logged server-side and returned as a generic 500.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      fields[issue.path.join('.') || '_'] = issue.message;
    }
    return json({ error: 'VALIDATION_FAILED', message: 'Invalid request', fields }, 400);
  }

  if (err instanceof EngineError) {
    const status = err.code === 'UNKNOWN_CITY' ? 404 : 400;
    return json({ error: err.code, message: err.message }, status);
  }

  console.error('Unhandled error in route handler:', err);
  return json({ error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' }, 500);
}
