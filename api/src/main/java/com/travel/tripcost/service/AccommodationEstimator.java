package com.travel.tripcost.service;

import java.math.BigDecimal;
import org.springframework.stereotype.Service;
import com.travel.tripcost.domain.CostIndex;
import com.travel.tripcost.dto.TripResponse.CostRange;
import com.travel.tripcost.repository.CostIndexRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AccommodationEstimator {

    private final CostIndexRepository costIndexRepository;

    public CostRange estimate(String destCityId, int nights, String preference) {
        // Fetch costs or use Fallback defaults if global data is missing
        CostIndex costs = costIndexRepository.findById(java.util.Objects.requireNonNull(destCityId))
                .orElse(getFallbackCosts());

        BigDecimal dailyRate = preference.equals("CHEAP")
                ? costs.getAccommodationLow()
                : costs.getAccommodationMid();

        BigDecimal total = dailyRate.multiply(BigDecimal.valueOf(nights));

        // Apply buffer: 0.8x for budget, 1.3x for splurge
        BigDecimal minTotal = total.multiply(new BigDecimal("0.8"));
        BigDecimal maxTotal = total.multiply(new BigDecimal("1.3"));

        CostRange range = new CostRange();
        range.setMin(minTotal.setScale(2, java.math.RoundingMode.HALF_UP));
        range.setMax(maxTotal.setScale(2, java.math.RoundingMode.HALF_UP));
        range.setConfidence(costs.getCityId() == null ? "LOW" : "HIGH");

        return range;
    }

    private CostIndex getFallbackCosts() {
        CostIndex fallback = new CostIndex();
        fallback.setAccommodationLow(BigDecimal.valueOf(50));
        fallback.setAccommodationMid(BigDecimal.valueOf(100));
        return fallback;
    }
}
