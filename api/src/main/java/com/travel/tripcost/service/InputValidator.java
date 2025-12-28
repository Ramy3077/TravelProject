package com.travel.tripcost.service;

import java.time.LocalDate;
import com.travel.tripcost.dto.TripRequest;
import com.travel.tripcost.exception.ValidationException;

public class InputValidator {
    public static void validate(TripRequest request) throws ValidationException {
        if (request == null) {
            throw new ValidationException("Request is null");
        }

        if (request.getOriginCityId() == null || request.getDestinationCityId() == null) {
            throw new ValidationException("Origin and destination city IDs are required");
        }
        if (request.getOriginCityId().equals(request.getDestinationCityId())) {
            throw new ValidationException("Origin and destination cities must be different");
        }

        if (request.getStartDate() == null || request.getEndDate() == null) {
            throw new ValidationException("Start and end dates are required");
        }

        if (request.getStartDate().isBefore(LocalDate.now()) || request.getEndDate().isBefore(request.getStartDate())) {
            throw new ValidationException("Start date must be after today and end date must be after start date");
        }

        if (request.getTravellers() < 1 || request.getTravellers() > 6) {
            throw new ValidationException("Number of travellers must be between 1 and 6");
        }

        if (request.getPreference() == null || !request.getPreference().matches("CHEAP|BALANCED|FAST")) {
            throw new ValidationException("Preference must be CHEAP, BALANCED, or FAST");
        }

    }

}
