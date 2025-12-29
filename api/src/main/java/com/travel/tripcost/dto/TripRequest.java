package com.travel.tripcost.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class TripRequest {
    @NotBlank(message = "Origin is required")
    private String originCityId;

    @NotBlank(message = "Destination is required")
    private String destinationCityId;

    @NotNull
    @FutureOrPresent
    private LocalDate startDate;

    @NotNull
    @FutureOrPresent
    private LocalDate endDate;

    @NotBlank(message = "Number of travellers is required")
    @Min(1)
    @Max(6)
    private int travellers;

    @NotBlank(message = "Preference is required")
    @Pattern(regexp = "CHEAP|BALANCED|FAST")
    private String preference;

}
