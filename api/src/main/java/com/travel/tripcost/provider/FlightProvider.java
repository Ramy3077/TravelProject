package com.travel.tripcost.provider;

import com.travel.tripcost.dto.TripResponse.CostRange;

public interface FlightProvider {

    CostRange getFlightQuote(String originIata, String destinationIata, String startDate, String endDate, int travelers,
            String preference, double distanceKm);
}
