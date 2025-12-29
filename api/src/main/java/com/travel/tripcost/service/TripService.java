package com.travel.tripcost.service;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Service;

import com.travel.tripcost.domain.City;
import com.travel.tripcost.dto.TripRequest;
import com.travel.tripcost.dto.TripResponse;
import com.travel.tripcost.dto.TripResponse.CostRange;
import com.travel.tripcost.provider.FlightProvider;
import com.travel.tripcost.repository.CityRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;

@Slf4j
@Service
@RequiredArgsConstructor
public class TripService {

        private final CityRepository cityRepository;
        private final DistanceService distanceService;

        @Qualifier("realFlightProvider")
        private final FlightProvider flightProvider;

        @Qualifier("mockFlightProvider")
        private final FlightProvider mockFlightProvider;

        private final AccommodationEstimator accommodationEstimator;
        private final FoodEstimator foodEstimator;

        public TripResponse estimateTrip(TripRequest request) {

                // 1. Fetch Cities
                City origin = cityRepository.findById(java.util.Objects.requireNonNull(request.getOriginCityId()))
                                .orElseThrow(() -> new IllegalArgumentException("Invalid Origin City ID"));
                City dest = cityRepository.findById(java.util.Objects.requireNonNull(request.getDestinationCityId()))
                                .orElseThrow(() -> new IllegalArgumentException("Invalid Destination City ID"));

                // 2. Core Calculations
                double distanceKm = distanceService.calculateDistanceKm(
                                origin.getLatitude(), origin.getLongitude(),
                                dest.getLatitude(), dest.getLongitude());

                int nights = (int) ChronoUnit.DAYS.between(request.getStartDate(), request.getEndDate());
                int days = nights + 1;

                // 3. Get Estimates
                // Transport (using FlightProvider with Circuit Breaker)
                // IATA codes are populated from external database (worker/seed_cities.py)
                // If IATA codes are missing, fall back to MockFlightProvider

                boolean hasIataCodes = hasIataCode(origin) && hasIataCode(dest);
                CostRange transportCost;

                if (hasIataCodes) {
                        // Use real Amadeus API with IATA codes
                        String originIata = origin.getIataCode();
                        String destIata = dest.getIataCode();

                        transportCost = flightProvider.getFlightQuote(
                                        originIata,
                                        destIata,
                                        request.getStartDate().toString(),
                                        request.getEndDate().toString(),
                                        request.getTravellers(),
                                        request.getPreference());
                } else {
                        // Fallback to mock provider for cities without IATA codes
                        log.warn("Missing IATA codes - Origin: {} ({}), Dest: {} ({}). Using fallback estimator.",
                                        origin.getName(), origin.getIataCode(),
                                        dest.getName(), dest.getIataCode());

                        transportCost = mockFlightProvider.getFlightQuote(
                                        origin.getId(), // Mock provider uses city IDs, not IATA
                                        dest.getId(),
                                        request.getStartDate().toString(),
                                        request.getEndDate().toString(),
                                        request.getTravellers(),
                                        request.getPreference());
                }

                // Accommodation
                CostRange accommodationCost = accommodationEstimator.estimate(dest.getId(), nights,
                                request.getPreference());

                // Food
                CostRange foodCost = foodEstimator.estimate(dest.getId(), days, request.getTravellers());

                // 4. Calculate Total
                BigDecimal totalMin = transportCost.getMin().add(accommodationCost.getMin()).add(foodCost.getMin());
                BigDecimal totalMax = transportCost.getMax().add(accommodationCost.getMax()).add(foodCost.getMax());

                CostRange totalCost = new CostRange();
                totalCost.setMin(totalMin);
                totalCost.setMax(totalMax);
                totalCost.setConfidence("MEDIUM");

                // 5. Build Response
                TripResponse response = new TripResponse();

                TripResponse.Breakdown breakdown = new TripResponse.Breakdown();
                breakdown.setTransport(transportCost);
                breakdown.setAccommodation(accommodationCost);
                breakdown.setFood(foodCost);
                breakdown.setTotal(totalCost);
                response.setBreakdown(breakdown);

                TripResponse.Metadata metadata = new TripResponse.Metadata();
                metadata.setDataSource("HIGH".equalsIgnoreCase(transportCost.getConfidence()) ? "Amadeus Live"
                                : "Fallback Engine");
                metadata.setGeneratedAt(java.time.Instant.now().toString());
                response.setMetadata(metadata);

                response.setAlternatives(List.of());

                return response;
        }

        private boolean hasIataCode(City city) {
                return city.getIataCode() != null && !city.getIataCode().isBlank();
        }
}
