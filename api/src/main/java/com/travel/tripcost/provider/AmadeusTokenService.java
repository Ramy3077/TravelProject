package com.travel.tripcost.provider;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;

/**
 * Manages Amadeus OAuth2 access tokens.
 * Automatically fetches and caches tokens, refreshing them before expiration.
 */
@Slf4j
@Service
public class AmadeusTokenService {

    private final RestTemplate restTemplate;

    @Value("${amadeus.api.url:https://test.api.amadeus.com}")
    private String apiUrl;

    @Value("${amadeus.client.id:}")
    private String clientId;

    @Value("${amadeus.client.secret:}")
    private String clientSecret;

    // Token cache
    private String cachedToken;
    private Instant tokenExpiry;

    public AmadeusTokenService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Returns a valid access token.
     * If cached token is still valid (with 60s buffer), returns it.
     * Otherwise, fetches a new token from Amadeus.
     */
    public synchronized String getAccessToken() {
        // Check if we have a valid cached token (with 60s safety buffer)
        if (cachedToken != null && tokenExpiry != null
                && Instant.now().plusSeconds(60).isBefore(tokenExpiry)) {
            log.debug("Using cached Amadeus token (expires at {})", tokenExpiry);
            return cachedToken;
        }

        log.info("Fetching new Amadeus access token...");
        return fetchNewToken();
    }

    private String fetchNewToken() {
        ensureCredentialsPresent();
        String tokenUrl = apiUrl + "/v1/security/oauth2/token";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "client_credentials");
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("null")
            ResponseEntity<TokenResponse> response = restTemplate.exchange(
                    tokenUrl,
                    HttpMethod.POST,
                    request,
                    TokenResponse.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                TokenResponse tokenResponse = java.util.Objects.requireNonNull(response.getBody());
                cachedToken = tokenResponse.access_token;
                tokenExpiry = Instant.now().plusSeconds(tokenResponse.expires_in);
                log.info("Successfully obtained Amadeus token (expires in {} seconds)", tokenResponse.expires_in);
                return cachedToken;
            } else {
                throw new RuntimeException("Failed to get Amadeus token: " + response.getStatusCode());
            }
        } catch (Exception e) {
            log.error("Failed to fetch Amadeus token: {}", e.getMessage());
            throw new RuntimeException("Amadeus authentication failed", e);
        }
    }

    /**
     * Force refresh the token (useful if we get a 401 during API call)
     */
    public synchronized void invalidateToken() {
        log.info("Invalidating cached Amadeus token");
        cachedToken = null;
        tokenExpiry = null;
    }

    private void ensureCredentialsPresent() {
        if (clientId == null || clientId.isBlank() || clientSecret == null || clientSecret.isBlank()) {
            throw new IllegalStateException(
                    "Amadeus credentials are missing. Please set amadeus.client.id and amadeus.client.secret (env: AMADEUS_CLIENT_ID/AMADEUS_CLIENT_SECRET).");
        }
    }

    // DTO for token response (fields must match JSON keys)
    @SuppressWarnings("unused")
    private static class TokenResponse {
        public String access_token;
        public int expires_in;
    }
}
