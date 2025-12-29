package com.travel.tripcost.provider;

import org.springframework.stereotype.Component;
import com.travel.tripcost.dto.TripResponse.CostRange;
import java.math.BigDecimal;

@Component("mockFlightProvider")
public class MockFlightProvider implements FlightProvider {

    @Override
    public CostRange getFlightQuote(String originIata, String destinationIata, String startDate, String endDate,
            int travelers, String preference, double distanceKm) {

        // Simulate a delay + return mock data
        try {
            // A realistic 1 second delay
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            // Restore interrupted state
            Thread.currentThread().interrupt();
        }

        // Base price + (Cost per KM * Distance)
        double basePrice = 50.0;
        double costPerKm = "FAST".equalsIgnoreCase(preference) ? 0.30 : 0.12;

        double estimatedPerPerson = basePrice + (distanceKm * costPerKm);

        CostRange range = new CostRange();
        range.setMin(BigDecimal.valueOf(estimatedPerPerson * 0.9 * travelers));
        range.setMax(BigDecimal.valueOf(estimatedPerPerson * 1.1 * travelers));
        range.setConfidence("MEDIUM");
        return range;
    }

}
