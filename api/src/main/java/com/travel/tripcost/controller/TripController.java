package com.travel.tripcost.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.validation.annotation.Validated;

import com.travel.tripcost.dto.TripRequest;
import com.travel.tripcost.dto.TripResponse;
import com.travel.tripcost.service.InputValidator;
import com.travel.tripcost.service.TripService; // Added TripService import

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
@CrossOrigin
public class TripController {

    private final TripService tripService;

    @GetMapping("/estimate")
    public TripResponse estimateTripCost(@Validated TripRequest request) {

        InputValidator.validate(request);

        return tripService.estimateTrip(request);
    }
}
