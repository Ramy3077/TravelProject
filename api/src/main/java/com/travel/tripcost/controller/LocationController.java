package com.travel.tripcost.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.travel.tripcost.domain.City;
import com.travel.tripcost.repository.CityRepository;
import java.util.List;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
@CrossOrigin
public class LocationController {

    private final CityRepository cityRepository;

    @GetMapping("/cities")
    public List<City> getCities(@RequestParam("q") String query) {
        if (query == null || query.length() < 2) {
            return List.of();
        }
        return cityRepository.findByNameContainingIgnoreCase(query);
    }

}