import type { Tier } from './types';

/**
 * The single source of truth for how a tier changes spend across EVERY category.
 *
 * The old engine had two bugs this fixes: (1) transport used 0.30/km for FAST and
 * 0.12/km for everything else, so CHEAP and BALANCED were identical; (2) food
 * ignored the tier entirely. Here all three tiers differ in transport,
 * accommodation, food, and local transport.
 */
export interface TierConfig {
  /** Multiplier on the modelled (distance-band) round-trip economy fare. budget
   *  ≈ basic-economy/low-cost carrier, balanced = standard economy, comfort
   *  ≈ premium-economy / flexible fare. See transport.ts for the fare curve. */
  transportFactor: number;
  /** Which accommodation price point to read from the cost data. */
  accomKey: 'accLow' | 'accMid';
  /** Multiplier on the chosen accommodation rate (lets "comfort" exceed mid-tier
   *  even though the source data only has low/mid). */
  accomFactor: number;
  /** Multiplier on daily food spend. */
  foodFactor: number;
  /** Multiplier on daily local-transport spend. */
  localFactor: number;
}

export const TIERS: Record<Tier, TierConfig> = {
  budget: {
    transportFactor: 0.8,
    accomKey: 'accLow',
    accomFactor: 1.0,
    foodFactor: 0.85,
    localFactor: 0.8,
  },
  balanced: {
    transportFactor: 1.0,
    accomKey: 'accMid',
    accomFactor: 1.0,
    foodFactor: 1.0,
    localFactor: 1.0,
  },
  comfort: {
    transportFactor: 2.0,
    accomKey: 'accMid',
    accomFactor: 1.6,
    foodFactor: 1.4,
    localFactor: 1.3,
  },
};

export const TIER_LABELS: Record<Tier, string> = {
  budget: 'Budget',
  balanced: 'Balanced',
  comfort: 'Comfort',
};

export const ALL_TIERS: Tier[] = ['budget', 'balanced', 'comfort'];
