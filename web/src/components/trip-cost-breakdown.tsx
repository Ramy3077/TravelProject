'use client';

import React from 'react';
import { Plane, Hotel, Utensils, DollarSign, TrendingUp, TrendingDown, Info, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { CostRange, TripResponse } from '@/lib/api/tripApi';
import { BudgetType } from './budget-preference';

interface TripCostBreakdownProps {
    data: TripResponse;
    budgetType: BudgetType;
}

const confidenceConfig = {
    HIGH: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'High Confidence' },
    MEDIUM: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertCircle, label: 'Medium Confidence' },
    LOW: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle, label: 'Low Confidence' },
};

const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function TripCostBreakdown({ data, budgetType }: TripCostBreakdownProps) {
    const { breakdown, metadata } = data;

    const sections = [
        {
            icon: Plane,
            label: 'Transport',
            cost: breakdown.transport,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
        {
            icon: Hotel,
            label: 'Accommodation',
            cost: breakdown.accommodation,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
        },
        {
            icon: Utensils,
            label: 'Food & Dining',
            cost: breakdown.food,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
        },
    ];

    const totalConfidence = confidenceConfig[breakdown.total.confidence];
    const TotalIcon = totalConfidence.icon;

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
            {/* Header with Total Cost */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-foreground">Trip Cost Estimate</h2>
                    <div className={`px-3 py-1 rounded-full border text-sm flex items-center gap-1.5 ${totalConfidence.color}`}>
                        <TotalIcon className="size-4" />
                        {totalConfidence.label}
                    </div>
                </div>

                <div className="bg-linear-to-br from-primary to-primary/80 text-primary-foreground rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <DollarSign className="size-5" />
                        <span>Total Estimated Cost</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-semibold">
                            {formatCurrency(breakdown.total.min)}
                        </span>
                        <span className="text-xl opacity-75">-</span>
                        <span className="text-4xl font-semibold">
                            {formatCurrency(breakdown.total.max)}
                        </span>
                    </div>
                    <div className="mt-2 text-sm opacity-75">
                        Based on {budgetType.toLowerCase()} preference
                    </div>
                </div>
            </div>

            {/* Cost Breakdown Sections */}
            <div className="space-y-3">
                <h3 className="text-foreground flex items-center gap-2">
                    <Info className="size-4 text-muted-foreground" />
                    Cost Breakdown
                </h3>
                <div className="space-y-3">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        const range = section.cost.max - section.cost.min;
                        const isLowVariance = range < section.cost.min * 0.3;
                        const sectionConfidence = confidenceConfig[section.cost.confidence];

                        return (
                            <div
                                key={section.label}
                                className="flex items-center gap-4 p-4 bg-accent/50 rounded-lg border border-border"
                            >
                                <div className={`p-3 ${section.bgColor} rounded-lg`}>
                                    <Icon className={`size-6 ${section.color}`} />
                                </div>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-foreground font-medium">{section.label}</span>
                                        {isLowVariance ? (
                                            <TrendingUp className="size-4 text-green-600" />
                                        ) : (
                                            <TrendingDown className="size-4 text-orange-600" />
                                        )}
                                        <span className={`text-xs px-2 py-0.5 rounded ${sectionConfidence.color}`}>
                                            {section.cost.confidence}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2 text-muted-foreground">
                                        <span>{formatCurrency(section.cost.min)}</span>
                                        <span>-</span>
                                        <span>{formatCurrency(section.cost.max)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Info Footer */}
            <div className="pt-4 border-t border-border space-y-2">
                <p className="text-sm text-muted-foreground">
                    Prices are estimates and may vary based on availability, season, and booking timing.
                </p>
                <p className="text-xs text-muted-foreground">
                    Data source: {metadata.dataSource} | Generated: {new Date(metadata.generatedAt).toLocaleString()}
                </p>
            </div>
        </div>
    );
}
