package com.travel.tripcost.provider.amadeus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.travel.tripcost.config.RestTemplateConfig;
import com.travel.tripcost.provider.AmadeusTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;

import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

@SpringBootTest(classes = { AmadeusApiClient.class, AmadeusTokenService.class, RestTemplateConfig.class })
@SuppressWarnings("null")
@TestPropertySource(properties = {
        "amadeus.client.id=testId",
        "amadeus.client.secret=testSecret",
        "amadeus.api.url=https://test.api.amadeus.com",
        "amadeus.default.currency=USD",
        "amadeus.default.max=3"
})
class AmadeusApiClientTest {

    @Autowired
    private AmadeusApiClient apiClient;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private com.travel.tripcost.provider.AmadeusTokenService tokenService;

    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        tokenService.invalidateToken();
        server = MockRestServiceServer.bindTo(restTemplate).build();
    }

    @Test
    void searchFlightsReturnsOffers() {
        server.expect(once(),
                requestTo("https://test.api.amadeus.com/v1/security/oauth2/token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"access_token\":\"token123\",\"expires_in\":3600}",
                        MediaType.APPLICATION_JSON));

        server.expect(once(),
                requestTo(org.hamcrest.Matchers.startsWith(
                        "https://test.api.amadeus.com/v2/shopping/flight-offers")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer token123"))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {"price": {"currency": "USD", "grandTotal": "256.00"}},
                            {"price": {"currency": "USD", "grandTotal": "300.00"}}
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        FlightOfferResponse response = apiClient.searchFlights(FlightOfferRequest.builder()
                .originLocationCode("LON")
                .destinationLocationCode("PAR")
                .departureDate("2026-06-01")
                .returnDate("2026-06-05")
                .adults(2)
                .travelClass("ECONOMY")
                .build());

        assertThat(response.getData()).hasSize(2);
        assertThat(response.getData().getFirst().getPrice().getGrandTotal()).isEqualTo("256.00");
        server.verify();
    }

    @Test
    void refreshesTokenOn401() {
        // First token fetch
        server.expect(once(),
                requestTo("https://test.api.amadeus.com/v1/security/oauth2/token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"access_token\":\"old-token\",\"expires_in\":1}",
                        MediaType.APPLICATION_JSON));

        // First flight call fails with 401
        server.expect(once(),
                requestTo(org.hamcrest.Matchers.startsWith(
                        "https://test.api.amadeus.com/v2/shopping/flight-offers")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer old-token"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        // Token refresh
        server.expect(once(),
                requestTo("https://test.api.amadeus.com/v1/security/oauth2/token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"access_token\":\"new-token\",\"expires_in\":3600}",
                        MediaType.APPLICATION_JSON));

        // Second flight call succeeds
        server.expect(once(),
                requestTo(org.hamcrest.Matchers.startsWith(
                        "https://test.api.amadeus.com/v2/shopping/flight-offers")))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer new-token"))
                .andRespond(withSuccess("""
                        {
                          "data": [
                            {"price": {"currency": "USD", "grandTotal": "123.45"}}
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        FlightOfferResponse response = apiClient.searchFlights(FlightOfferRequest.builder()
                .originLocationCode("LON")
                .destinationLocationCode("PAR")
                .departureDate("2026-06-01")
                .adults(1)
                .build());

        assertThat(response.getData()).hasSize(1);
        assertThat(response.getData().getFirst().getPrice().getGrandTotal()).isEqualTo("123.45");
        server.verify();
    }
}
