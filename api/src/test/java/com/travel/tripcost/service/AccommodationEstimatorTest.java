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
class AccommodationEstimatorTest {

    @Mock
    private CostIndexRepository costIndexRepository;

    private AccommodationEstimator accommodationEstimator;

    @BeforeEach
    void setUp() {
        accommodationEstimator = new AccommodationEstimator(costIndexRepository);
    }

    @Test
    void estimate_ShouldApplyMultipliers_WhenCostsFound_CheapPreference() {
        // Given
        String cityId = "paris";
        CostIndex mockCosts = new CostIndex();
        mockCosts.setCityId(cityId);
        mockCosts.setAccommodationLow(new BigDecimal("100.00")); // Cheap rate
        mockCosts.setAccommodationMid(new BigDecimal("200.00"));

        when(costIndexRepository.findById(cityId)).thenReturn(Optional.of(mockCosts));

        // When
        // Preference "CHEAP" -> uses 100.00
        // 100 * 3 nights = 300 base
        // Min = 300 * 0.8 = 240
        // Max = 300 * 1.3 = 390
        CostRange result = accommodationEstimator.estimate(cityId, 3, "CHEAP");

        // Then
        assertNotNull(result);
        assertEquals(new BigDecimal("240.00"), result.getMin());
        assertEquals(new BigDecimal("390.00"), result.getMax());
        assertEquals("HIGH", result.getConfidence());
    }

    @Test
    void estimate_ShouldApplyMultipliers_WhenCostsFound_BalancedPreference() {
        // Given
        String cityId = "paris";
        CostIndex mockCosts = new CostIndex();
        mockCosts.setCityId(cityId);
        mockCosts.setAccommodationLow(new BigDecimal("100.00"));
        mockCosts.setAccommodationMid(new BigDecimal("200.00")); // Mid rate

        when(costIndexRepository.findById(cityId)).thenReturn(Optional.of(mockCosts));

        // When
        // Preference "BALANCED" -> uses 200.00
        // 200 * 2 nights = 400 base
        // Min = 400 * 0.8 = 320
        // Max = 400 * 1.3 = 520
        CostRange result = accommodationEstimator.estimate(cityId, 2, "BALANCED");

        // Then
        assertNotNull(result);
        assertEquals(new BigDecimal("320.00"), result.getMin());
        assertEquals(new BigDecimal("520.00"), result.getMax());
        assertEquals("HIGH", result.getConfidence());
    }

    @Test
    void estimate_ShouldUseFallback_WhenCityNotFound() {
        // Given
        when(costIndexRepository.findById(anyString())).thenReturn(Optional.empty());

        // When
        // Fallback Low = 50.00
        // Preference "CHEAP" -> uses 50.00
        // 50 * 2 nights = 100 base
        // Min = 100 * 0.8 = 80.00
        // Max = 100 * 1.3 = 130.00
        CostRange result = accommodationEstimator.estimate("unknown", 2, "CHEAP");

        // Then
        assertNotNull(result);
        assertEquals(new BigDecimal("80.00"), result.getMin());
        assertEquals(new BigDecimal("130.00"), result.getMax());
        assertEquals("LOW", result.getConfidence());
    }
}
