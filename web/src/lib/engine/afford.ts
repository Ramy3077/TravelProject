import { addDays, monthOf, nightsBetween } from './date';
import { isPlausibleSubstitute } from './substitutes';
import { estimateTrip } from './estimate';
import { round } from './money';
import { ALL_TIERS, TIER_LABELS } from './tiers';
import type { AffordResult, DataContext, EstimateInput, EstimateResult, Lever, Verdict, VerdictCaveat } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Verdict thresholds: how the point estimate compares to the budget.
export function verdictFor(point: number, budget: number): Verdict {
  if (budget <= 0) return 'over';
  const ratio = point / budget;
  if (ratio <= 0.8) return 'comfortable';
  if (ratio <= 1.0) return 'feasible';
  if (ratio <= 1.1) return 'tight';
  return 'over';
}

/**
 * The verdict judges the typical figure. This flags when the high end of the
 * range undercuts it: a "comfortable" trip whose high end uses over 95% of the
 * budget, or a "within budget" trip whose high end exceeds the budget.
 */
export function caveatFor(verdict: Verdict, high: number, budget: number): VerdictCaveat | undefined {
  if (budget <= 0) return undefined;
  const ratio = high / budget;
  if (verdict === 'comfortable' && ratio > 0.95) return 'little_margin_at_high_end';
  if (verdict === 'feasible' && ratio > 1) return 'may_exceed_at_high_end';
  return undefined;
}

export interface AffordParams {
  budget: number;
  input: EstimateInput;
  ctx: DataContext;
}

/**
 * The "Can I afford this?" assessment. Builds the estimate, judges it against the
 * budget, works out how many days the budget would stretch to, and generates
 * concrete, ranked levers ("what to cut") by re-running the pure engine with
 * perturbed inputs. Pure and synchronous — same inputs, same answer.
 */
export function assessAffordability({ budget, input, ctx }: AffordParams): AffordResult {
  const base = estimateTrip(input, ctx);
  const total = base.breakdown.total;

  const verdict = verdictFor(total.point, budget);
  return {
    verdict,
    caveat: caveatFor(verdict, total.max, budget),
    budget,
    currency: base.currency,
    estimate: base,
    headroom: round(budget - total.point),
    maxAffordableDays: computeMaxDays(base, budget),
    levers: generateLevers({ budget, input, ctx, base }),
  };
}

/**
 * Most days on the ground the budget covers, holding destination + tier fixed.
 * Closed-form: total(days) = (transport − accomPerNight) + perDay × days.
 */
function computeMaxDays(base: EstimateResult, budget: number): number | undefined {
  const b = base.breakdown;
  const transport = b.transport.point; // independent of trip length
  const accomPerNight = base.nights > 0 ? b.accommodation.point / base.nights : 0;
  const foodPerDay = base.days > 0 ? b.food.point / base.days : 0;
  const localPerDay = base.days > 0 ? b.localTransport.point / base.days : 0;

  const perDay = accomPerNight + foodPerDay + localPerDay;
  if (perDay <= 0) return undefined;

  const maxDays = Math.floor((budget - (transport - accomPerNight)) / perDay);
  return maxDays >= 1 ? Math.min(maxDays, 60) : undefined;
}

interface LeverContext extends AffordParams {
  base: EstimateResult;
}

function generateLevers({ budget, input, ctx, base }: LeverContext): Lever[] {
  const basePoint = base.breakdown.total.point;
  const levers: Lever[] = [];

  const add = (
    kind: Lever['kind'],
    label: string,
    override: Partial<EstimateInput>,
    params: Record<string, unknown>,
  ): void => {
    let est: EstimateResult;
    try {
      est = estimateTrip({ ...input, ...override }, ctx);
    } catch {
      return;
    }
    const saving = round(basePoint - est.breakdown.total.point);
    if (saving <= 0) return;
    levers.push({
      kind,
      label,
      estimatedSaving: saving,
      resultingVerdict: verdictFor(est.breakdown.total.point, budget),
      params,
    });
  };

  // 1. Drop a tier.
  const tierIdx = ALL_TIERS.indexOf(input.tier);
  if (tierIdx > 0) {
    const cheaper = ALL_TIERS[tierIdx - 1];
    add('lower_tier', `Switch to the ${TIER_LABELS[cheaper]} tier`, { tier: cheaper }, { tier: cheaper });
  }

  // 2. Shorten the trip (~40% fewer nights).
  const nights = nightsBetween(input.startDate, input.endDate);
  if (nights > 2) {
    const newNights = Math.max(1, Math.round(nights * 0.6));
    if (newNights < nights) {
      const endDate = addDays(input.startDate, newNights);
      add(
        'shorten_trip',
        `Shorten to ${newNights} night${newNights === 1 ? '' : 's'}`,
        { endDate },
        { endDate, nights: newNights },
      );
    }
  }

  // 3. Shift to a cheaper season (look forward only, so we never suggest the past).
  {
    let best: { start: string; end: string; est: EstimateResult } | null = null;
    for (const delta of [30, 60, 90]) {
      const start = addDays(input.startDate, delta);
      const end = addDays(input.endDate, delta);
      let est: EstimateResult;
      try {
        est = estimateTrip({ ...input, startDate: start, endDate: end }, ctx);
      } catch {
        continue;
      }
      if (est.breakdown.total.point < basePoint && (!best || est.breakdown.total.point < best.est.breakdown.total.point)) {
        best = { start, end, est };
      }
    }
    if (best) {
      levers.push({
        kind: 'shift_dates',
        label: `Travel in ${MONTH_NAMES[monthOf(best.start) - 1]} instead (cheaper season)`,
        estimatedSaving: round(basePoint - best.est.breakdown.total.point),
        resultingVerdict: verdictFor(best.est.breakdown.total.point, budget),
        params: { startDate: best.start, endDate: best.end },
      });
    }
  }

  // 4. A cheaper, plausible substitute destination: same country, or a
  //    neighbour in the same region, of similar city size (see substitutes.ts).
  const dest = ctx.getCity(input.destinationCityId);
  if (dest) {
    const nearby = ctx
      .costCities()
      .filter((c) => c.id !== input.originCityId && isPlausibleSubstitute(dest, c))
      .map((c) => ({ c }))
      .sort((a, b) => (ctx.getCost(a.c.id)?.accMid ?? Infinity) - (ctx.getCost(b.c.id)?.accMid ?? Infinity))
      .slice(0, 6);

    let best: { name: string; country: string; id: string; est: EstimateResult } | null = null;
    for (const { c } of nearby) {
      let est: EstimateResult;
      try {
        est = estimateTrip({ ...input, destinationCityId: c.id }, ctx);
      } catch {
        continue;
      }
      if (est.breakdown.total.point < basePoint && (!best || est.breakdown.total.point < best.est.breakdown.total.point)) {
        best = { name: c.name, country: c.country, id: c.id, est };
      }
    }
    if (best) {
      levers.push({
        kind: 'cheaper_destination',
        label: `Try ${best.name}, ${best.country} instead`,
        estimatedSaving: round(basePoint - best.est.breakdown.total.point),
        resultingVerdict: verdictFor(best.est.breakdown.total.point, budget),
        params: { destinationCityId: best.id, name: best.name, country: best.country },
      });
    }
  }

  // 5. Travel with fewer people.
  if (input.travellers > 1) {
    add(
      'fewer_travellers',
      `Travel with ${input.travellers - 1} instead of ${input.travellers}`,
      { travellers: input.travellers - 1 },
      { travellers: input.travellers - 1 },
    );
  }

  return levers.sort((a, b) => b.estimatedSaving - a.estimatedSaving).slice(0, 5);
}
