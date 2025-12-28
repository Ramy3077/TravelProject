package com.travel.tripcost.dto;

import java.time.LocalDate;

import lombok.Data;

@Data
public class TripRequest {
    private String originCityId;
    private String destinationCityId;
    private LocalDate startDate;
    private LocalDate endDate;
    private int travellers; // 1-6
    private String preference; // "CHEAP", "BALANCED", "FAST"

}
