package com.travel.tripcost.service;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.springframework.stereotype.Service;

import com.travel.tripcost.domain.City;
import com.travel.tripcost.dto.TripRequest;
import com.travel.tripcost.dto.TripResponse;
import com.travel.tripcost.dto.TripResponse.CostRange;
import com.travel.tripcost.repository.CityRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TripService {

    private final CityRepository cityRepository;
    private final DistanceService distanceService;
    private final TransportEstimator transportEstimator;
    private final AccommodationEstimator accommodationEstimator;
    private final FoodEstimator foodEstimator;

    public TripResponse estimateTrip(TripRequest request) {

        // 1. Fetch Cities
        City origin = cityRepository.findById(request.getOriginCityId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid Origin City ID"));
        City dest = cityRepository.findById(request.getDestinationCityId())
                .orElseThrow(() -> new IllegalArgumentException("Invalid Destination City ID"));

        // 2. Core Calculations
        double distanceKm = distanceService.calculateDistanceKm(
                origin.getLatitude(), origin.getLongitude(),
                dest.getLatitude(), dest.getLongitude());

        int nights = (int) ChronoUnit.DAYS.between(request.getStartDate(), request.getEndDate());
        int days = nights + 1;

        // 3. Get Estimates
        // Transport
        double[] transportPrices = transportEstimator.costRange(distanceKm, request.getTravellers(),
                request.getPreference());
        CostRange transportCost = new CostRange();
        transportCost.setMin(BigDecimal.valueOf(transportPrices[0]));
        transportCost.setMax(BigDecimal.valueOf(transportPrices[1]));
        transportCost.setConfidence("LOW");

        // Accommodation
        CostRange accommodationCost = accommodationEstimator.estimate(dest.getId(), nights, request.getPreference());

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
        metadata.setDataSource("Fallback Engine");
        metadata.setGeneratedAt(java.time.Instant.now().toString());
        response.setMetadata(metadata);

        response.setAlternatives(List.of());

        return response;
    }
}
