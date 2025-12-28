'use client';

import React from 'react';
import { Calendar } from 'lucide-react';

interface DatePickerProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    min?: string;
    id?: string;
}

export function DatePicker({
    label,
    value,
    onChange,
    min,
    id,
}: DatePickerProps) {
    return (
        <div className="space-y-2">
            <label htmlFor={id} className="block text-foreground">
                {label}
            </label>
            <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
                <input
                    id={id}
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    min={min}
                    className="w-full pl-10 pr-4 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                    aria-label={label}
                />
            </div>
        </div>
    );
}
