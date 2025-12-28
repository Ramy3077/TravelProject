// API Client for Trip Cost Estimator
// Connects to Spring Boot backend on localhost:8080

// In development, if we are accessing via IP (like on a phone), 
// we want to point to the backend on that same IP.
const getApiBase = () => {
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
        return process.env.NEXT_PUBLIC_API_URL;
    }
    if (typeof window !== 'undefined') {
        return `http://${window.location.hostname}:8080`;
    }
    return 'http://localhost:8080';
};

const API_BASE = getApiBase();

// Types matching our backend DTOs
export interface City {
    id: string;
    name: string;
    country: string;
    latitude?: number;
    longitude?: number;
}

export interface TripRequest {
    originCityId: string;
    destinationCityId: string;
    startDate: string;  // ISO format YYYY-MM-DD
    endDate: string;
    travellers: number;
    preference: 'CHEAP' | 'BALANCED' | 'FAST';
}

export interface CostRange {
    min: number;
    max: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface TripResponse {
    breakdown: {
        transport: CostRange;
        accommodation: CostRange;
        food: CostRange;
        total: CostRange;
    };
    alternatives: unknown[];
    metadata: {
        dataSource: string;
        generatedAt: string;
    };
}

export interface ApiError {
    status: number;
    error: string;
    message: string;
    timestamp: string;
}

/**
 * Search cities by name prefix
 * @param query - Search term (min 2 chars)
 * @returns Array of matching cities
 */
export async function searchCities(query: string): Promise<City[]> {
    if (query.length < 2) return [];

    const res = await fetch(`${API_BASE}/api/locations/cities?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
        throw new Error('Failed to fetch cities');
    }
    return res.json();
}

/**
 * Get trip cost estimate from fallback engine
 * @param params - Trip parameters
 * @returns Cost breakdown
 */
export async function estimateTrip(params: TripRequest): Promise<TripResponse> {
    const query = new URLSearchParams({
        originCityId: params.originCityId,
        destinationCityId: params.destinationCityId,
        startDate: params.startDate,
        endDate: params.endDate,
        travellers: params.travellers.toString(),
        preference: params.preference,
    });

    const res = await fetch(`${API_BASE}/api/trips/estimate?${query}`);

    if (!res.ok) {
        const error: ApiError = await res.json();
        throw new Error(error.message || 'Estimation failed');
    }

    return res.json();
}
