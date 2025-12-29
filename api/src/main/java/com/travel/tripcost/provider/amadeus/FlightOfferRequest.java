package com.travel.tripcost.provider.amadeus;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FlightOfferRequest {
    private String originLocationCode;
    private String destinationLocationCode;
    private String departureDate;
    private String returnDate;
    private int adults;
    private String travelClass;
    private String currencyCode;
    private Integer max;
}
