package com.travel.tripcost.provider;

import org.springframework.stereotype.Component;
import com.travel.tripcost.dto.TripResponse.CostRange;
import java.math.BigDecimal;

@Component("mockFlightProvider")
public class MockFlightProvider implements FlightProvider {

    @Override
    public CostRange getFlightQuote(String originIata, String destinationIata, String startDate, String endDate,
            int travelers, String preference) {

        // Simulate a delay + return mock data
        try {
            // A realistic 1 second delay
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            // Restore interrupted state
            Thread.currentThread().interrupt();
        }
        CostRange range = new CostRange();
        range.setMin(BigDecimal.valueOf(150 * travelers));
        range.setMax(BigDecimal.valueOf(300 * travelers));
        range.setConfidence("MEDIUM");
        return range;
    }

}
