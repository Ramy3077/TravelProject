package com.travel.tripcost.service;

import java.math.BigDecimal;
import org.springframework.stereotype.Service;
import com.travel.tripcost.domain.CostIndex;
import com.travel.tripcost.dto.TripResponse.CostRange;
import com.travel.tripcost.repository.CostIndexRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class FoodEstimator {

    private final CostIndexRepository costIndexRepository;

    public CostRange estimate(String destCityId, int days, int travellers) {
        CostIndex costs = costIndexRepository.findById(java.util.Objects.requireNonNull(destCityId))
                .orElse(getFallbackCosts());

        BigDecimal dailyFood = costs.getFoodDaily();

        BigDecimal total = dailyFood.multiply(BigDecimal.valueOf(days))
                .multiply(BigDecimal.valueOf(travellers));

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
        fallback.setFoodDaily(BigDecimal.valueOf(40)); // Global fallback $40
        return fallback;
    }
}
