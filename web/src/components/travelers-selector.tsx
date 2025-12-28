'use client';

import React from 'react';
import { Users, Minus, Plus } from 'lucide-react';

interface TravelersSelectorProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    id?: string;
}

export function TravelersSelector({
    value,
    onChange,
    min = 1,
    max = 6,
    id,
}: TravelersSelectorProps) {
    const decrement = () => {
        if (value > min) onChange(value - 1);
    };

    const increment = () => {
        if (value < max) onChange(value + 1);
    };

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="block text-foreground">
                Number of Travelers
            </label>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="size-5" />
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={decrement}
                        disabled={value <= min}
                        className="p-2 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Decrease travelers"
                    >
                        <Minus className="size-4" />
                    </button>
                    <span id={id} className="w-8 text-center text-lg font-medium">
                        {value}
                    </span>
                    <button
                        type="button"
                        onClick={increment}
                        disabled={value >= max}
                        className="p-2 rounded-lg border border-border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Increase travelers"
                    >
                        <Plus className="size-4" />
                    </button>
                </div>
                <span className="text-sm text-muted-foreground">
                    (max {max})
                </span>
            </div>
        </div>
    );
}
