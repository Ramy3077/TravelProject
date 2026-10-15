'use client';

import React from 'react';
import { Scissors, TrendingDown, ChevronRight } from 'lucide-react';
import type { Lever } from '@/lib/api/tripApi';
import { formatUsd, type DisplayCurrency } from '@/lib/currency';


interface WhatToCutProps {
  levers: Lever[];
  onApply: (lever: Lever) => void;
  currency: DisplayCurrency;
}

export function WhatToCut({ levers, onApply, currency }: WhatToCutProps) {
  const fmt = (n: number) => formatUsd(n, currency);
  if (levers.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-3">
      <h3 className="text-foreground flex items-center gap-2">
        <Scissors className="size-4 text-muted-foreground" />
        Ways to bring it down
      </h3>
      <ul className="space-y-2">
        {levers.map((lever, i) => (
          <li key={`${lever.kind}-${i}`}>
            <button
              type="button"
              onClick={() => onApply(lever)}
              className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all"
            >
              <div className="p-2 rounded-lg bg-green-50 shrink-0">
                <TrendingDown className="size-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-foreground truncate">{lever.label}</div>
                <div className="text-xs text-muted-foreground">Save about {fmt(lever.estimatedSaving)}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Tap a suggestion to apply it and recalculate.</p>
    </div>
  );
}
