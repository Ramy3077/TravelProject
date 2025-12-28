package com.travel.tripcost.provider;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import com.travel.tripcost.dto.TripResponse.CostRange;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component("realFlightProvider")
@Primary
@RequiredArgsConstructor
public class RealFlightProvider implements FlightProvider {

    private final RestTemplate restTemplate;

    @Qualifier("mockFlightProvider")
    private final FlightProvider fallbackProvider;

    @Override
    @Cacheable(value = "flightQuotes", key = "#originIata + #destIata + #startDate")
    @CircuitBreaker(name = "flightApi", fallbackMethod = "fallbackQuote")
    public CostRange getFlightQuote(String originIata, String destIata,
            String startDate, String endDate,
            int travelers, String preference) {
        // TODO: Replace with real Amadeus API call
        // For now, simulate external call failure to test circuit breaker
        log.info("Attempting to call external flight API for {}->{}", originIata, destIata);
        throw new RuntimeException("External API not configured yet");
    }

    public CostRange fallbackQuote(String originIata, String destIata,
            String startDate, String endDate,
            int travelers, String preference,
            Throwable t) {
        log.warn("Circuit breaker fallback triggered: {}", t.getMessage());
        return fallbackProvider.getFlightQuote(originIata, destIata, startDate, endDate, travelers, preference);
    }
}
