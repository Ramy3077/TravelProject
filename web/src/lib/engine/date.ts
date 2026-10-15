// Date helpers operating on YYYY-MM-DD strings in UTC, to avoid local-timezone
// drift. Mirrors the original engine's day-count convention.

const MS_PER_DAY = 86_400_000;

const parseUtc = (isoDate: string): number => Date.parse(`${isoDate}T00:00:00Z`);

/** Whole nights between two dates (end − start). */
export function nightsBetween(startDate: string, endDate: string): number {
  return Math.round((parseUtc(endDate) - parseUtc(startDate)) / MS_PER_DAY);
}

/** Month (1–12) of an ISO date. */
export function monthOf(isoDate: string): number {
  return new Date(parseUtc(isoDate)).getUTCMonth() + 1;
}

/** Add `days` to an ISO date, returning a new YYYY-MM-DD string. */
export function addDays(isoDate: string, days: number): string {
  return new Date(parseUtc(isoDate) + days * MS_PER_DAY).toISOString().slice(0, 10);
}
