package com.travel.tripcost.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import com.travel.tripcost.domain.City;

public interface CityRepository extends JpaRepository<City, String> {

    List<City> findByNameContainingIgnoreCase(String name, Pageable pageable);
}
