package com.travel.tripcost.dto;

import java.math.BigDecimal;
import java.util.List;
import lombok.Data;

@Data
public class TripResponse {
    private Breakdown breakdown; // Nested object
    private List<Alternative> alternatives;
    private Metadata metadata;

    // Nested classes (:
    @Data
    public static class Breakdown {
        private CostRange transport;
        private CostRange accommodation;
        private CostRange food;
        private CostRange total;
    }

    @Data
    public static class CostRange {
        private BigDecimal min;
        private BigDecimal max;
        private String confidence; // "HIGH", "MEDIUM", "LOW"
    }

    @Data
    public static class Metadata {
        private String dataSource; // "Fallback" or "Live"
        private String generatedAt; // ISO timestamp
    }

    @Data
    public static class Alternative {
        private String cityName;
        private BigDecimal estimatedSaving;
    }

}
