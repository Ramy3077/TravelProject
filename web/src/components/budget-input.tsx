'use client';

import React from 'react';
import { CURRENCIES, symbolOf, type DisplayCurrency } from '@/lib/currency';

interface BudgetInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  currency: DisplayCurrency;
  onCurrencyChange: (c: DisplayCurrency) => void;
  id?: string;
}

export function BudgetInput({ value, onChange, currency, onCurrencyChange, id }: BudgetInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-foreground">
        Your total budget
      </label>
      <div className="flex gap-2">
        <select
          id={`${id}-currency`}
          value={currency}
          onChange={(e) => onCurrencyChange(e.target.value as DisplayCurrency)}
          aria-label="Currency"
          className="py-3 pl-3 pr-2 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {symbolOf(c)} {c}
            </option>
          ))}
        </select>
        <input
          id={id}
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
          placeholder="e.g. 1500"
          className="w-full px-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:italic placeholder:text-muted-foreground/60"
        />
      </div>
      <p className="text-xs text-muted-foreground">All-in, for the whole trip and everyone travelling.</p>
    </div>
  );
}
