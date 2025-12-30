package com.travel.tripcost.service;

import com.travel.tripcost.domain.CostIndex;
import com.travel.tripcost.dto.TripResponse.CostRange;
import com.travel.tripcost.repository.CostIndexRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FoodEstimatorTest {

    @Mock
    private CostIndexRepository costIndexRepository;

    private FoodEstimator foodEstimator;

    @BeforeEach
    void setUp() {
        foodEstimator = new FoodEstimator(costIndexRepository);
    }

    @Test
    void estimate_ShouldApplyMultipliers_WhenCostsFound() {
        // Given
        String cityId = "nyc";
        CostIndex mockCosts = new CostIndex();
        mockCosts.setCityId(cityId);
        mockCosts.setFoodDaily(new BigDecimal("100.00"));

        when(costIndexRepository.findById(cityId)).thenReturn(Optional.of(mockCosts));

        // When
        // 100 * 5 days * 2 travellers = 1000 base
        // Min = 1000 * 0.8 = 800
        // Max = 1000 * 1.3 = 1300
        CostRange result = foodEstimator.estimate(cityId, 5, 2);

        // Then
        assertNotNull(result);
        assertEquals(new BigDecimal("800.00"), result.getMin());
        assertEquals(new BigDecimal("1300.00"), result.getMax());
        assertEquals("HIGH", result.getConfidence());
    }

    @Test
    void estimate_ShouldUseFallback_WhenCityNotFound() {
        // Given
        when(costIndexRepository.findById(anyString())).thenReturn(Optional.empty());

        // When
        // Fallback is 40.00
        // 40 * 1 day * 1 traveller = 40 base
        // Min = 40 * 0.8 = 32.00
        // Max = 40 * 1.3 = 52.00
        CostRange result = foodEstimator.estimate("unknown", 1, 1);

        // Then
        assertNotNull(result);
        assertEquals(new BigDecimal("32.00"), result.getMin());
        assertEquals(new BigDecimal("52.00"), result.getMax());
        assertEquals("LOW", result.getConfidence());
    }
}
