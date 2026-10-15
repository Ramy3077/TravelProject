'use client';

import React from 'react';
import { CheckCircle2, ThumbsUp, AlertTriangle, XCircle, CalendarRange } from 'lucide-react';
import type { AffordResult, Verdict } from '@/lib/api/tripApi';
import { formatUsd, type DisplayCurrency } from '@/lib/currency';


const VERDICTS: Record<
  Verdict,
  { label: string; icon: React.ElementType; text: string; bar: string; ring: string }
> = {
  comfortable: { label: 'Comfortably affordable', icon: CheckCircle2, text: 'text-green-700', bar: 'bg-green-500', ring: 'bg-green-100 text-green-700' },
  feasible: { label: 'Within budget', icon: ThumbsUp, text: 'text-blue-700', bar: 'bg-blue-500', ring: 'bg-blue-100 text-blue-700' },
  tight: { label: "It'll be tight", icon: AlertTriangle, text: 'text-amber-700', bar: 'bg-amber-500', ring: 'bg-amber-100 text-amber-700' },
  over: { label: 'Over budget', icon: XCircle, text: 'text-red-700', bar: 'bg-red-500', ring: 'bg-red-100 text-red-700' },
};

export function AffordabilityVerdict({ result, currency }: { result: AffordResult; currency: DisplayCurrency }) {
  const fmt = (n: number) => formatUsd(n, currency);
  const v = VERDICTS[result.verdict];
  const Icon = v.icon;
  const total = result.estimate.breakdown.total;
  const pct = Math.min(100, Math.round((total.point / result.budget) * 100));
  const over = result.headroom < 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-full ${v.ring}`}>
          <Icon className="size-7" />
        </div>
        <div>
          <h2 className={`text-xl font-semibold ${v.text}`}>{v.label}</h2>
          <p className="text-muted-foreground">
            Estimated {fmt(total.min)} – {fmt(total.max)} for this trip
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Estimated spend (typical {fmt(total.point)})</span>
          <span>Budget {fmt(result.budget)}</span>
        </div>
        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
          <div className={`h-full ${v.bar} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <p className={`text-sm font-medium ${over ? 'text-red-700' : 'text-green-700'}`}>
          {over
            ? `${fmt(Math.abs(result.headroom))} over your budget`
            : `${fmt(result.headroom)} to spare`}
        </p>
      </div>

      {result.maxAffordableDays != null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-t border-border pt-4">
          <CalendarRange className="size-4 shrink-0" />
          <span>
            On {fmt(result.budget)} you could afford about{' '}
            <span className="text-foreground font-medium">{result.maxAffordableDays} days</span> at this destination
            and style.
          </span>
        </div>
      )}
    </div>
  );
}
