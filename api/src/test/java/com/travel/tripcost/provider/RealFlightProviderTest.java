package com.travel.tripcost.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.travel.tripcost.dto.TripResponse.CostRange;
import com.travel.tripcost.provider.amadeus.AmadeusApiClient;
import com.travel.tripcost.provider.amadeus.FlightOfferResponse;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RealFlightProviderTest {

    @Mock
    private AmadeusApiClient amadeusApiClient;

    @Mock
    private FlightProvider fallbackProvider;

    @InjectMocks
    private RealFlightProvider realFlightProvider;

    @Test
    void mapsAmadeusPricesToCostRange() {
        FlightOfferResponse response = new FlightOfferResponse();
        FlightOfferResponse.Price price1 = new FlightOfferResponse.Price();
        price1.setGrandTotal("100.00");
        FlightOfferResponse.FlightOffer offer1 = new FlightOfferResponse.FlightOffer();
        offer1.setPrice(price1);

        FlightOfferResponse.Price price2 = new FlightOfferResponse.Price();
        price2.setGrandTotal("250.50");
        FlightOfferResponse.FlightOffer offer2 = new FlightOfferResponse.FlightOffer();
        offer2.setPrice(price2);

        response.setData(List.of(offer1, offer2));
        when(amadeusApiClient.searchFlights(any())).thenReturn(response);

        CostRange range = realFlightProvider.getFlightQuote(
                "LON", "PAR", "2026-06-01", "2026-06-05", 2, "FAST");

        assertThat(range.getMin()).isEqualTo(new BigDecimal("100.00"));
        assertThat(range.getMax()).isEqualTo(new BigDecimal("250.50"));
        assertThat(range.getConfidence()).isEqualTo("HIGH");

        ArgumentCaptor<com.travel.tripcost.provider.amadeus.FlightOfferRequest> requestCaptor = ArgumentCaptor
                .forClass(com.travel.tripcost.provider.amadeus.FlightOfferRequest.class);
        verify(amadeusApiClient).searchFlights(requestCaptor.capture());
        assertThat(requestCaptor.getValue().getTravelClass()).isEqualTo("BUSINESS");
    }

    @Test
    void fallbackMethodDelegatesToMockProvider() {
        CostRange fallbackRange = new CostRange();
        fallbackRange.setMin(BigDecimal.ONE);
        fallbackRange.setMax(BigDecimal.TEN);
        fallbackRange.setConfidence("MEDIUM");
        when(fallbackProvider.getFlightQuote(any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(fallbackRange);

        CostRange result = realFlightProvider.fallbackQuote(
                "LON", "PAR", "2026-06-01", "2026-06-05", 1, "BALANCED", new RuntimeException("boom"));

        assertThat(result).isEqualTo(fallbackRange);
        verify(fallbackProvider).getFlightQuote("LON", "PAR", "2026-06-01", "2026-06-05", 1, "BALANCED");
    }
}
