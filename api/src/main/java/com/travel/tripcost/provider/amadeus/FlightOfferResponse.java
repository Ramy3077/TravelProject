package com.travel.tripcost.provider.amadeus;

import java.util.List;
import lombok.Data;

@Data
public class FlightOfferResponse {
    private List<FlightOffer> data;
    private Dictionaries dictionaries;

    @Data
    public static class FlightOffer {
        private String type;
        private String id;
        private Price price;
        private List<Itinerary> itineraries;
    }

    @Data
    public static class Price {
        private String currency;
        private String total;
        private String grandTotal;
    }

    @Data
    public static class Itinerary {
        private String duration;
        private List<Segment> segments;
    }

    @Data
    public static class Segment {
        private Leg departure;
        private Leg arrival;
        private String carrierCode;
        private String number;
    }

    @Data
    public static class Leg {
        private String iataCode;
        private String at;
    }

    @Data
    public static class Dictionaries {
        private java.util.Map<String, String> carriers;
    }
}
