package com.travel.tripcost.service;

import org.springframework.stereotype.Service;

@Service
public class TransportEstimator {
    public double[] costRange(double distanceKM, int travellers, String preference) {
        double minCost;
        double maxCost;
        double multiplier;

        if (preference.equals("CHEAP")) {
            multiplier = 0.8;
        } else if (preference.equals("BALANCED")) {
            multiplier = 1;
        } else {
            multiplier = 1.5;
        }

        if (distanceKM < 500) {
            minCost = 50;
            maxCost = 100;
        } else if (distanceKM <= 2000) {
            minCost = 100;
            maxCost = 250;
        } else {
            minCost = 250;
            maxCost = 600;
        }

        minCost = minCost * multiplier * travellers;
        maxCost = maxCost * multiplier * travellers;

        return new double[] { minCost, maxCost };
    }

}
