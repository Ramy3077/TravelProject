'use client';

import React from 'react';
import { PiggyBank } from 'lucide-react';

interface BudgetInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  id?: string;
}

export function BudgetInput({ value, onChange, id }: BudgetInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-foreground">
        Your total budget
      </label>
      <div className="relative">
        <PiggyBank className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
        <span className="absolute left-10 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
        <input
          id={id}
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
          placeholder="2000"
          className="w-full pl-14 pr-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          aria-label="Total budget in US dollars"
        />
      </div>
      <p className="text-xs text-muted-foreground">All-in, for the whole trip and everyone travelling.</p>
    </div>
  );
}
