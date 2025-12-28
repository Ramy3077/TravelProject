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

        // For Phase 2, Min = Max since we have specific data points
        // Confidence is HIGH if data exists, LOW if fallback
        CostRange range = new CostRange();
        range.setMin(total);
        range.setMax(total);
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
