'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { searchCities, City } from '@/lib/api/tripApi';

interface CityAutocompleteProps {
    label: string;
    value: City | null;
    onChange: (city: City | null) => void;
    placeholder?: string;
    id?: string;
}

export function CityAutocomplete({
    label,
    value,
    onChange,
    placeholder = 'Enter city name',
    id,
}: CityAutocompleteProps) {
    const [inputValue, setInputValue] = useState(value?.name || '');
    const [isFocused, setIsFocused] = useState(false);
    const [cities, setCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Debounced search
    useEffect(() => {
        if (inputValue.length < 2) {
            setCities([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            setError(null);
            try {
                const results = await searchCities(inputValue);
                setCities(results);
            } catch (err) {
                setError('Failed to search cities');
                setCities([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [inputValue]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        onChange(null); // Clear selection when typing
    };

    const handleCitySelect = (city: City) => {
        setInputValue(`${city.name}, ${city.country}`);
        onChange(city);
        setCities([]);
        setIsFocused(false);
    };

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="block text-foreground">
                {label}
            </label>
            <div className="relative">
                <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                    <input
                        id={id}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                        placeholder={placeholder}
                        className="w-full pl-10 pr-10 py-3 bg-input-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        aria-label={label}
                    />
                    {isLoading ? (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground animate-spin" />
                    ) : (
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                    )}
                </div>

                {isFocused && cities.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {cities.map((city) => (
                            <button
                                key={city.id}
                                onClick={() => handleCitySelect(city)}
                                className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3"
                            >
                                <MapPin className="size-4 text-muted-foreground" />
                                <span>{city.name}, {city.country}</span>
                            </button>
                        ))}
                    </div>
                )}

                {isFocused && inputValue.length >= 2 && cities.length === 0 && !isLoading && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-4 text-center text-muted-foreground">
                        {error || 'No cities found'}
                    </div>
                )}
            </div>
        </div>
    );
}
