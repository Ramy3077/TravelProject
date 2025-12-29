package com.travel.tripcost.provider.amadeus;

import com.travel.tripcost.provider.AmadeusTokenService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Service
@RequiredArgsConstructor
public class AmadeusApiClient {

    private final RestTemplate restTemplate;
    private final AmadeusTokenService tokenService;

    @Value("${amadeus.api.url:https://test.api.amadeus.com}")
    private String apiUrl;

    @Value("${amadeus.default.currency:USD}")
    private String defaultCurrency;

    @Value("${amadeus.default.max:5}")
    private int defaultMax;

    public FlightOfferResponse searchFlights(FlightOfferRequest request) {
        FlightOfferRequest enriched = applyDefaults(request);
        validate(enriched);
        return execute(enriched, true);
    }

    @SuppressWarnings("null")
    private FlightOfferResponse execute(FlightOfferRequest request, boolean allowRetry) {
        String accessToken = tokenService.getAccessToken();
        if (accessToken == null) {
            throw new IllegalStateException("Failed to obtain access token from Amadeus");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        String url = buildUrl(request);
        try {
            ResponseEntity<FlightOfferResponse> response = restTemplate.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), FlightOfferResponse.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }
            throw new RuntimeException("Amadeus flight search failed: " + response.getStatusCode());
        } catch (HttpClientErrorException.Unauthorized ex) {
            if (allowRetry) {
                log.warn("Amadeus returned 401 (token expired). Refreshing token and retrying once.");
                tokenService.invalidateToken();
                return execute(request, false);
            }
            throw ex;
        } catch (HttpClientErrorException.TooManyRequests ex) {
            log.warn("Amadeus rate limit exceeded (429). Consider reducing request frequency. Body: {}",
                    ex.getResponseBodyAsString());
            throw new RuntimeException("Amadeus API rate limit exceeded. Please try again later.", ex);
        } catch (HttpStatusCodeException ex) {
            log.error("Amadeus call failed with status {} and body {}", ex.getStatusCode(),
                    ex.getResponseBodyAsString());
            throw ex;
        } catch (RestClientException ex) {
            log.error("Amadeus call failed: {}", ex.getMessage());
            throw ex;
        }
    }

    private String buildUrl(FlightOfferRequest request) {
        UriComponentsBuilder builder = UriComponentsBuilder
                .fromHttpUrl(apiUrl + "/v2/shopping/flight-offers")
                .queryParam("originLocationCode", request.getOriginLocationCode())
                .queryParam("destinationLocationCode", request.getDestinationLocationCode())
                .queryParam("departureDate", request.getDepartureDate())
                .queryParam("adults", request.getAdults())
                .queryParam("currencyCode", request.getCurrencyCode())
                .queryParam("max", request.getMax());

        if (request.getReturnDate() != null && !request.getReturnDate().isBlank()) {
            builder.queryParam("returnDate", request.getReturnDate());
        }
        if (request.getTravelClass() != null && !request.getTravelClass().isBlank()) {
            builder.queryParam("travelClass", request.getTravelClass());
        }
        return builder.toUriString();
    }

    private FlightOfferRequest applyDefaults(FlightOfferRequest request) {
        return FlightOfferRequest.builder()
                .originLocationCode(request.getOriginLocationCode())
                .destinationLocationCode(request.getDestinationLocationCode())
                .departureDate(request.getDepartureDate())
                .returnDate(request.getReturnDate())
                .adults(request.getAdults())
                .travelClass(request.getTravelClass())
                .currencyCode(request.getCurrencyCode() == null || request.getCurrencyCode().isBlank()
                        ? defaultCurrency
                        : request.getCurrencyCode())
                .max(request.getMax() == null ? defaultMax : request.getMax())
                .build();
    }

    private void validate(FlightOfferRequest request) {
        if (request.getOriginLocationCode() == null || request.getOriginLocationCode().isBlank()) {
            throw new IllegalArgumentException("originLocationCode is required");
        }
        if (request.getDestinationLocationCode() == null || request.getDestinationLocationCode().isBlank()) {
            throw new IllegalArgumentException("destinationLocationCode is required");
        }
        if (request.getDepartureDate() == null || request.getDepartureDate().isBlank()) {
            throw new IllegalArgumentException("departureDate is required");
        }
        if (request.getAdults() <= 0) {
            throw new IllegalArgumentException("adults must be >= 1");
        }
    }
}
