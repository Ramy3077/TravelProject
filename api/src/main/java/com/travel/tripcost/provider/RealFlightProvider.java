package com.travel.tripcost.provider;

import com.travel.tripcost.dto.TripResponse.CostRange;
import com.travel.tripcost.provider.amadeus.AmadeusApiClient;
import com.travel.tripcost.provider.amadeus.FlightOfferRequest;
import com.travel.tripcost.provider.amadeus.FlightOfferResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component("realFlightProvider")
@Primary
public class RealFlightProvider implements FlightProvider {

    private final AmadeusApiClient amadeusApiClient;
    private final FlightProvider fallbackProvider;

    public RealFlightProvider(AmadeusApiClient amadeusApiClient,
            @Qualifier("mockFlightProvider") FlightProvider fallbackProvider) {
        this.amadeusApiClient = amadeusApiClient;
        this.fallbackProvider = fallbackProvider;
    }

    @Override
    @Cacheable(value = "flightQuotes", key = "#originIata + #destIata + #startDate + #endDate + #travelers + #preference")
    @CircuitBreaker(name = "flightApi", fallbackMethod = "fallbackQuote")
    public CostRange getFlightQuote(String originIata, String destIata,
            String startDate, String endDate,
            int travelers, String preference, double distanceKm) {
        log.info("Fetching live flight offers from Amadeus for {} -> {} ({} travelers, {} - {})", originIata,
                destIata, travelers, startDate, endDate);

        FlightOfferRequest request = FlightOfferRequest.builder()
                .originLocationCode(originIata)
                .destinationLocationCode(destIata)
                .departureDate(startDate)
                .returnDate(endDate)
                .adults(travelers)
                .travelClass(mapPreferenceToTravelClass(preference))
                .build();

        FlightOfferResponse response = amadeusApiClient.searchFlights(request);
        List<FlightOfferResponse.FlightOffer> offers = response != null ? response.getData() : List.of();

        if (offers == null || offers.isEmpty()) {
            throw new IllegalStateException("Amadeus returned no flight offers");
        }

        List<BigDecimal> totals = offers.stream()
                .filter(o -> o.getPrice() != null && o.getPrice().getGrandTotal() != null)
                .map(o -> new BigDecimal(o.getPrice().getGrandTotal()))
                .toList();

        if (totals.isEmpty()) {
            throw new IllegalStateException("Amadeus flight offers missing price information");
        }

        CostRange range = new CostRange();
        range.setMin(totals.stream().min(Comparator.naturalOrder()).orElseThrow());
        range.setMax(totals.stream().max(Comparator.naturalOrder()).orElseThrow());
        range.setConfidence("HIGH");

        return range;
    }

    public CostRange fallbackQuote(String originIata, String destIata,
            String startDate, String endDate,
            int travelers, String preference, double distanceKm,
            Throwable t) {
        log.warn("Circuit breaker fallback triggered: {}", t.getMessage());
        return fallbackProvider.getFlightQuote(originIata, destIata, startDate, endDate, travelers, preference,
                distanceKm);
    }

    private String mapPreferenceToTravelClass(String preference) {
        if (preference == null) {
            return "ECONOMY";
        }
        return switch (preference) {
            case "FAST" -> "BUSINESS";
            case "BALANCED", "CHEAP" -> "ECONOMY";
            default -> "ECONOMY";
        };
    }
}
