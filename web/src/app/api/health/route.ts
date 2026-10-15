import { NextResponse } from 'next/server';

// Minimal liveness endpoint. Replaces the Spring Actuator endpoints
// (/api/health|mappings|circuitbreakers) — which leaked internal mappings and
// circuit-breaker state — with a single, detail-free OK.
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
