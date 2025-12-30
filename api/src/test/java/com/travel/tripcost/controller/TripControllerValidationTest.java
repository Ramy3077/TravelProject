package com.travel.tripcost.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.travel.tripcost.dto.TripResponse;
import com.travel.tripcost.provider.FlightProvider;
import com.travel.tripcost.service.TripService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = TripController.class)
class TripControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TripService tripService;

    // RealFlightProvider depends on external API; ensure it is mocked out for the
    // slice test.
    @MockBean(name = "realFlightProvider")
    private FlightProvider flightProvider;

    @Test
    void returnsBadRequestWhenTravellersOutOfRange() throws Exception {
        mockMvc.perform(get("/api/trips/estimate")
                .param("originCityId", "city1")
                .param("destinationCityId", "city2")
                .param("startDate", "2030-01-01")
                .param("endDate", "2030-01-05")
                .param("travellers", "0")
                .param("preference", "BALANCED"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void returnsOkForValidRequest() throws Exception {
        when(tripService.estimateTrip(any())).thenReturn(new TripResponse());

        mockMvc.perform(get("/api/trips/estimate")
                .param("originCityId", "city1")
                .param("destinationCityId", "city2")
                .param("startDate", "2030-01-01")
                .param("endDate", "2030-01-05")
                .param("travellers", "2")
                .param("preference", "BALANCED"))
                .andExpect(status().isOk());
    }
}
