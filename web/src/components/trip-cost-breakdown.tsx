'use client';

import React from 'react';
import { Plane, Hotel, Utensils, Bus, Info } from 'lucide-react';
import type { Confidence, EstimateResult } from '@/lib/api/tripApi';
import { formatUsd, type DisplayCurrency } from '@/lib/currency';


const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const confidenceConfig: Record<Confidence, { color: string; label: string }> = {
  high: { color: 'bg-green-100 text-green-800 border-green-200', label: 'High' },
  medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Medium' },
  low: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Low' },
};

export function TripCostBreakdown({ estimate, currency }: { estimate: EstimateResult; currency: DisplayCurrency }) {
  const fmt = (n: number) => formatUsd(n, currency);
  const { breakdown, factors, metadata, nights, days } = estimate;

  const sections = [
    { icon: Plane, label: 'Transport', cost: breakdown.transport, color: 'text-blue-600', bg: 'bg-blue-50' },
    { icon: Hotel, label: 'Accommodation', cost: breakdown.accommodation, color: 'text-purple-600', bg: 'bg-purple-50' },
    { icon: Utensils, label: 'Food & Dining', cost: breakdown.food, color: 'text-orange-600', bg: 'bg-orange-50' },
    { icon: Bus, label: 'Getting around', cost: breakdown.localTransport, color: 'text-teal-600', bg: 'bg-teal-50' },
  ];

  const season = factors.seasonality;
  const seasonNote = `${MONTHS[season.month - 1]} is ${season.label} season`;

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground flex items-center gap-2">
          <Info className="size-4 text-muted-foreground" />
          Cost breakdown
        </h3>
        <span className="text-xs text-muted-foreground">
          {nights} {nights === 1 ? 'night' : 'nights'} · {days} days
        </span>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          const conf = confidenceConfig[section.cost.confidence];
          return (
            <div key={section.label} className="flex items-center gap-4 p-4 bg-accent/50 rounded-lg border border-border">
              <div className={`p-3 ${section.bg} rounded-lg`}>
                <Icon className={`size-6 ${section.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-foreground font-medium">{section.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${conf.color}`}>{conf.label}</span>
                </div>
                <div className="flex items-baseline gap-2 text-muted-foreground">
                  <span>{fmt(section.cost.min)}</span>
                  <span>–</span>
                  <span>{fmt(section.cost.max)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-border space-y-1.5 text-xs text-muted-foreground">
        <p>
          {seasonNote} · transport is modelled, not a live quote.
        </p>
        <p>
          {metadata.dataSource}. Estimates only. Actual prices vary with availability, season, and how you book.
        </p>
        <p className="text-muted-foreground/70">
          Data: SimpleMaps WorldCities · OurAirports · Numbeo-derived cost of living ({metadata.dataVintage}) ·
          World Bank CPI.
        </p>
      </div>
    </div>
  );
}
