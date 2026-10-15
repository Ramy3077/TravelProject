'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Plane, Loader2, AlertCircle, Wallet } from 'lucide-react';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { DatePicker } from '@/components/date-picker';
import { TravelersSelector } from '@/components/travelers-selector';
import { BudgetPreference } from '@/components/budget-preference';
import { BudgetInput } from '@/components/budget-input';
import { AffordabilityVerdict } from '@/components/affordability-verdict';
import { WhatToCut } from '@/components/what-to-cut';
import { TripCostBreakdown } from '@/components/trip-cost-breakdown';
import { DEFAULT_CURRENCY, FX, convert, toUsd, type DisplayCurrency } from '@/lib/currency';
import { assessAfford, type AffordResult, type City, type Lever, type Tier } from '@/lib/api/tripApi';

const todayISO = () => new Date().toISOString().split('T')[0];
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
};

interface Example {
  label: string;
  origin: City;
  destination: City;
  nights: number;
  travellers: number;
  budgetGbp: number;
  tier: Tier;
}

// Budgets are in GBP; picking an example switches the form to GBP.
const EXAMPLES: Example[] = [
  {
    label: 'London to Lisbon, 5 nights, 2 people, £1,500',
    origin: { id: '1826645935', name: 'London', country: 'United Kingdom' },
    destination: { id: '1620619017', name: 'Lisbon', country: 'Portugal' },
    nights: 5, travellers: 2, budgetGbp: 1500, tier: 'balanced',
  },
  {
    label: 'London to Rome, 4 nights, 2 people, £700',
    origin: { id: '1826645935', name: 'London', country: 'United Kingdom' },
    destination: { id: '1380382862', name: 'Rome', country: 'Italy' },
    nights: 4, travellers: 2, budgetGbp: 700, tier: 'balanced',
  },
  {
    label: 'London to Tokyo, 10 nights, 1 person, £3,000',
    origin: { id: '1826645935', name: 'London', country: 'United Kingdom' },
    destination: { id: '1392685764', name: 'Tokyo', country: 'Japan' },
    nights: 10, travellers: 1, budgetGbp: 3000, tier: 'balanced',
  },
];

export default function Home() {
  const [origin, setOrigin] = useState<City | null>(null);
  const [destination, setDestination] = useState<City | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState(2);
  const [tier, setTier] = useState<Tier>('balanced');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AffordResult | null>(null);
  const [budget, setBudget] = useState<number | ''>('');
  const [currency, setCurrency] = useState<DisplayCurrency>(DEFAULT_CURRENCY);
  const resultsRef = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(false);

  // After a submit, bring the verdict into view and move focus to it.
  useEffect(() => {
    if (!result || !shouldScroll.current) return;
    shouldScroll.current = false;
    const el = resultsRef.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  }, [result]);

  const changeCurrency = (next: DisplayCurrency) => {
    if (typeof budget === 'number') setBudget(convert(budget, currency, next));
    setCurrency(next);
  };


  const isFormValid =
    origin && destination && startDate && endDate && origin.id !== destination.id && typeof budget === 'number' && budget > 0;

  // Run the affordability check from current form state, optionally overridden
  // by a lever the user tapped.
  const runAssess = async (override: Partial<{ originCityId: string; destinationCityId: string; startDate: string; endDate: string; travellers: number; tier: Tier; budget: number }> = {}) => {
    if (!origin || !destination || typeof budget !== 'number') return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await assessAfford({
        originCityId: origin.id,
        destinationCityId: destination.id,
        startDate,
        endDate,
        travellers: travelers,
        tier,
        budget: toUsd(budget, currency),
        ...override,
      });
      shouldScroll.current = true;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check affordability');
    } finally {
      setIsLoading(false);
    }
  };

  // Apply a "what to cut" suggestion: reflect it in the form, then recalculate.
  const applyLever = (lever: Lever) => {
    const p = lever.params ?? {};
    const override: Parameters<typeof runAssess>[0] = {};
    if (lever.kind === 'lower_tier' && typeof p.tier === 'string') {
      setTier(p.tier as Tier);
      override.tier = p.tier as Tier;
    }
    if ((lever.kind === 'shorten_trip' || lever.kind === 'shift_dates') && typeof p.endDate === 'string') {
      setEndDate(p.endDate);
      override.endDate = p.endDate;
    }
    if (lever.kind === 'shift_dates' && typeof p.startDate === 'string') {
      setStartDate(p.startDate);
      override.startDate = p.startDate;
    }
    if (lever.kind === 'fewer_travellers' && typeof p.travellers === 'number') {
      setTravelers(p.travellers);
      override.travellers = p.travellers;
    }
    if (lever.kind === 'cheaper_destination' && typeof p.destinationCityId === 'string') {
      setDestination({ id: p.destinationCityId, name: String(p.name ?? 'Selected city'), country: '' });
      override.destinationCityId = p.destinationCityId;
    }
    void runAssess(override);
  };

  // Fill the form from an example and run it straight away. Budget is sent in USD.
  const runExample = async (ex: Example) => {
    const start = addDaysISO(todayISO(), 45);
    const end = addDaysISO(start, ex.nights);
    setOrigin(ex.origin);
    setDestination(ex.destination);
    setStartDate(start);
    setEndDate(end);
    setTravelers(ex.travellers);
    setTier(ex.tier);
    setCurrency('GBP');
    setBudget(ex.budgetGbp);
    setIsLoading(true);
    setError(null);
    try {
      const res = await assessAfford({
        originCityId: ex.origin.id,
        destinationCityId: ex.destination.id,
        startDate: start,
        endDate: end,
        travellers: ex.travellers,
        tier: ex.tier,
        budget: toUsd(ex.budgetGbp, 'GBP'),
      });
      shouldScroll.current = true;
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check affordability');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary text-primary-foreground rounded-lg">
              <Wallet className="size-6" />
            </div>
            <div>
              <h1 className="text-foreground text-xl font-semibold">Can I Afford This Trip?</h1>
              <p className="text-muted-foreground">An all-in cost estimate, and how to fit your budget.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-foreground font-medium mb-1">Your trip</h2>
                <p className="text-muted-foreground">Tell us the plan and your budget.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Try an example</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => void runExample(ex)}
                      disabled={isLoading}
                      className="text-sm px-3 py-1.5 rounded-full border border-border bg-accent/50 hover:border-primary/50 hover:bg-accent transition-all text-left"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <CityAutocomplete label="Travelling from" value={origin} onChange={setOrigin} placeholder="Where are you starting?" id="origin-city" />
                <CityAutocomplete label="Destination" value={destination} onChange={setDestination} placeholder="Where do you want to go?" id="destination-city" />

                <div className="grid sm:grid-cols-2 gap-4">
                  <DatePicker label="Start Date" value={startDate} onChange={setStartDate} min={todayISO()} id="start-date" />
                  <DatePicker label="End Date" value={endDate} onChange={setEndDate} min={startDate || todayISO()} id="end-date" />
                </div>

                <TravelersSelector value={travelers} onChange={setTravelers} max={8} id="travelers-count" />
                <BudgetPreference value={tier} onChange={setTier} />
                <BudgetInput value={budget} onChange={setBudget} currency={currency} onCurrencyChange={changeCurrency} id="budget" />

                {error && (
                  <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                    <AlertCircle className="size-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={() => runAssess()}
                  disabled={!isFormValid || isLoading}
                  className={`w-full py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 ${
                    isFormValid && !isLoading
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Checking…
                    </>
                  ) : (
                    'Can I afford it?'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:sticky lg:top-8 lg:self-start space-y-6">
            {result ? (
              <div ref={resultsRef} role="region" tabIndex={-1} aria-label="Your result" className="space-y-6 outline-none scroll-mt-4">
                <AffordabilityVerdict result={result} currency={currency} />
                <WhatToCut levers={result.levers} onApply={applyLever} currency={currency} />
                <TripCostBreakdown estimate={result.estimate} currency={currency} />
              </div>
            ) : (
              <div className="bg-card border border-border border-dashed rounded-xl p-12 text-center">
                <div className="inline-flex p-4 bg-muted rounded-full mb-4">
                  <Plane className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-foreground mb-2 font-medium">Dreaming of a trip?</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Enter where you want to go, your dates, and your budget. We&apos;ll tell you if it&apos;s doable and
                  how to make it fit.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 text-xs text-muted-foreground">
        Figures are estimates from a 2019 cost-of-living dataset adjusted for inflation, plus modelled fares. Not live
        prices. Currency conversion uses fixed reference rates as of {FX.asOf} (1 USD = {FX.rates.GBP} GBP, {FX.rates.EUR} EUR),
        not live rates.
      </footer>
    </div>
  );
}
