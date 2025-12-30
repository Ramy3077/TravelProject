package com.travel.tripcost.e2e;

import static org.assertj.core.api.Assertions.assertThat;

import com.travel.tripcost.domain.City;
import com.travel.tripcost.domain.CostIndex;
import com.travel.tripcost.dto.TripResponse;
import com.travel.tripcost.dto.TripResponse.CostRange;
import com.travel.tripcost.provider.FlightProvider;
import com.travel.tripcost.repository.CityRepository;
import com.travel.tripcost.repository.CostIndexRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.annotation.DirtiesContext;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:triptest;DB_CLOSE_DELAY=-1;MODE=PostgreSQL"
})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class TripEstimateSmokeTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private CityRepository cityRepository;

    @Autowired
    private CostIndexRepository costIndexRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockBean(name = "realFlightProvider")
    private FlightProvider flightProvider;

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    private String randomIata() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 3).toUpperCase();
    }

    @BeforeEach
    void setupData() {
        // Ensure clean state to avoid unique index violations on iata_code
        jdbcTemplate.update("DELETE FROM cost_indices");
        jdbcTemplate.update("DELETE FROM cities");

        String originIata = randomIata();
        String destIata = randomIata();

        City origin = new City("ORIG", "Origin City", "UK", originIata, 51.5, -0.1, null);
        City dest = new City("DEST", "Dest City", "FR", destIata, 48.8, 2.35, null);
        cityRepository.save(origin);
        cityRepository.save(dest);

        CostIndex destCosts = new CostIndex();
        destCosts.setCity(dest);
        destCosts.setAccommodationLow(BigDecimal.valueOf(50));
        destCosts.setAccommodationMid(BigDecimal.valueOf(80));
        destCosts.setFoodDaily(BigDecimal.valueOf(40));
        destCosts.setLocalTransitDaily(BigDecimal.valueOf(10));
        dest.setCostIndex(destCosts);
        // Persist via city cascade to satisfy shared PK mapping
        cityRepository.saveAndFlush(dest);

        CostRange flightRange = new CostRange();
        flightRange.setMin(BigDecimal.valueOf(100));
        flightRange.setMax(BigDecimal.valueOf(200));
        flightRange.setConfidence("HIGH");
        Mockito.when(flightProvider.getFlightQuote(Mockito.any(), Mockito.any(), Mockito.any(), Mockito.any(),
                Mockito.anyInt(), Mockito.any(), Mockito.anyDouble())).thenReturn(flightRange);
    }

    @Test
    void estimateEndpointRespondsWith200AndBody() {
        LocalDate start = LocalDate.now().plusDays(30);
        LocalDate end = start.plusDays(4);

        String url = baseUrl() + "/api/trips/estimate"
                + "?originCityId=ORIG"
                + "&destinationCityId=DEST"
                + "&startDate=" + start
                + "&endDate=" + end
                + "&travellers=2"
                + "&preference=BALANCED";

        ResponseEntity<TripResponse> response = restTemplate.getForEntity(url, TripResponse.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getBreakdown()).isNotNull();
        assertThat(response.getBody().getBreakdown().getTransport().getMin()).isEqualTo(BigDecimal.valueOf(100));
    }

    @Test
    void estimateEndpointReturnsBadRequestOnValidationError() {
        LocalDate start = LocalDate.now().minusDays(1);
        LocalDate end = start.plusDays(2);

        String url = baseUrl() + "/api/trips/estimate"
                + "?originCityId=ORIG"
                + "&destinationCityId=DEST"
                + "&startDate=" + start
                + "&endDate=" + end
                + "&travellers=0"
                + "&preference=BALANCED";

        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
