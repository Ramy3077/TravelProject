'use client';

import React, { useState } from 'react';
import { Plane, Loader2, AlertCircle } from 'lucide-react';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { DatePicker } from '@/components/date-picker';
import { TravelersSelector } from '@/components/travelers-selector';
import { BudgetPreference, BudgetType } from '@/components/budget-preference';
import { TripCostBreakdown } from '@/components/trip-cost-breakdown';
import { City, TripResponse, estimateTrip } from '@/lib/api/tripApi';

export default function Home() {
  // Form State
  const [origin, setOrigin] = useState<City | null>(null);
  const [destination, setDestination] = useState<City | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState(2);
  const [budgetType, setBudgetType] = useState<BudgetType>('BALANCED');

  // API State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TripResponse | null>(null);

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const isFormValid = origin && destination && startDate && endDate && origin.id !== destination.id;

  const handleEstimate = async () => {
    if (!isFormValid || !origin || !destination) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await estimateTrip({
        originCityId: origin.id,
        destinationCityId: destination.id,
        startDate,
        endDate,
        travellers: travelers,
        preference: budgetType,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate trip cost');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary text-primary-foreground rounded-lg">
              <Plane className="size-6" />
            </div>
            <div>
              <h1 className="text-foreground">Trip Cost Estimator</h1>
              <p className="text-muted-foreground">
                Plan your journey with accurate cost predictions
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Trip Request Form */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-foreground mb-1">Trip Details</h2>
                <p className="text-muted-foreground">
                  Enter your travel information to get a cost estimate
                </p>
              </div>

              <div className="space-y-5">
                <CityAutocomplete
                  label="Origin City"
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Where are you traveling from?"
                  id="origin-city"
                />

                <CityAutocomplete
                  label="Destination City"
                  value={destination}
                  onChange={setDestination}
                  placeholder="Where are you going?"
                  id="destination-city"
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <DatePicker
                    label="Start Date"
                    value={startDate}
                    onChange={setStartDate}
                    min={getTodayDate()}
                    id="start-date"
                  />

                  <DatePicker
                    label="End Date"
                    value={endDate}
                    onChange={setEndDate}
                    min={startDate || getTodayDate()}
                    id="end-date"
                  />
                </div>

                <TravelersSelector
                  value={travelers}
                  onChange={setTravelers}
                  id="travelers-count"
                />

                <BudgetPreference value={budgetType} onChange={setBudgetType} />

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                    <AlertCircle className="size-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={handleEstimate}
                  disabled={!isFormValid || isLoading}
                  className={`w-full py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 ${isFormValid && !isLoading
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  aria-label="Calculate trip estimate"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-5 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    'Calculate Estimate'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Trip Cost Breakdown */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            {result ? (
              <TripCostBreakdown data={result} budgetType={budgetType} />
            ) : (
              <div className="bg-card border border-border border-dashed rounded-xl p-12 text-center">
                <div className="inline-flex p-4 bg-muted rounded-full mb-4">
                  <Plane className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-foreground mb-2">Ready to Plan?</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Fill in your trip details on the left and click &quot;Calculate Estimate&quot; to see
                  your personalized cost breakdown
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
