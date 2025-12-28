'use client';

import React from 'react';
import { Wallet, Scale, Zap } from 'lucide-react';

export type BudgetType = 'CHEAP' | 'BALANCED' | 'FAST';

interface BudgetPreferenceProps {
    value: BudgetType;
    onChange: (value: BudgetType) => void;
}

const options: { value: BudgetType; label: string; icon: React.ElementType; description: string }[] = [
    {
        value: 'CHEAP',
        label: 'Budget',
        icon: Wallet,
        description: 'Lowest cost options',
    },
    {
        value: 'BALANCED',
        label: 'Balanced',
        icon: Scale,
        description: 'Best value for money',
    },
    {
        value: 'FAST',
        label: 'Premium',
        icon: Zap,
        description: 'Fastest & most comfortable',
    },
];

export function BudgetPreference({ value, onChange }: BudgetPreferenceProps) {
    return (
        <div className="space-y-3">
            <label className="block text-foreground">Travel Preference</label>
            <div className="grid grid-cols-3 gap-3">
                {options.map((option) => {
                    const Icon = option.icon;
                    const isSelected = value === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange(option.value)}
                            className={`p-4 rounded-lg border-2 transition-all text-center ${isSelected
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                }`}
                        >
                            <Icon
                                className={`size-6 mx-auto mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'
                                    }`}
                            />
                            <div className="font-medium text-sm">{option.label}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {option.description}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
