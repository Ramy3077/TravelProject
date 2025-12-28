package com.travel.tripcost.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.travel.tripcost.domain.CostIndex;

@Repository
public interface CostIndexRepository extends JpaRepository<CostIndex, String> {
}
