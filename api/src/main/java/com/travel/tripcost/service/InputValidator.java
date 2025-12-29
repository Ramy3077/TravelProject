package com.travel.tripcost.service;

import com.travel.tripcost.dto.TripRequest;
import com.travel.tripcost.exception.ValidationException;

public class InputValidator {
    public static void validate(TripRequest request) throws ValidationException {

        if (request.getOriginCityId().equals(request.getDestinationCityId())) {
            throw new ValidationException("Origin and destination cities must be different");
        }

        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new ValidationException("End date must be after start date");
        }

    }

}
