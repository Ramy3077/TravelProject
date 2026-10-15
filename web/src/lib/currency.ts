// Display-boundary currency conversion. The engine, API and dataset are all in
// USD; this module converts at the edges only (budget input, rendered figures).
import metaJson from '@/lib/data/generated/meta.json';

export type DisplayCurrency = 'GBP' | 'USD' | 'EUR';
export const CURRENCIES: DisplayCurrency[] = ['GBP', 'USD', 'EUR'];
export const DEFAULT_CURRENCY: DisplayCurrency = 'GBP';

const SYMBOLS: Record<DisplayCurrency, string> = { GBP: '£', USD: '$', EUR: '€' };

export interface FxTable {
  asOf: string;
  rates: Record<DisplayCurrency, number>;
}

export const FX: FxTable = (metaJson as unknown as { fx: FxTable }).fx;

export const symbolOf = (c: DisplayCurrency): string => SYMBOLS[c];

/** USD (engine units) to the display currency. */
export function fromUsd(usd: number, c: DisplayCurrency, fx: FxTable = FX): number {
  return usd * fx.rates[c];
}

/** Display currency to USD (engine units). */
export function toUsd(amount: number, c: DisplayCurrency, fx: FxTable = FX): number {
  return amount / fx.rates[c];
}

/** Convert between two display currencies, rounded to whole units. */
export function convert(amount: number, from: DisplayCurrency, to: DisplayCurrency, fx: FxTable = FX): number {
  return Math.round(fromUsd(toUsd(amount, from, fx), to, fx));
}

/** Format a USD engine figure in the display currency, whole units. */
export function formatUsd(usd: number, c: DisplayCurrency, fx: FxTable = FX): string {
  return `${SYMBOLS[c]}${Math.round(fromUsd(usd, c, fx)).toLocaleString('en-GB')}`;
}
