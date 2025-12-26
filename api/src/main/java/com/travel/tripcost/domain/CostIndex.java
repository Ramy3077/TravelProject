package com.travel.tripcost.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;

@Entity
@Table(name = "cost_indices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CostIndex {

    @Id
    @Column(name = "city_id")
    private String cityId;

    @OneToOne
    @MapsId
    @JoinColumn(name = "city_id")
    private City city;

    @Column(name = "accommodation_low")
    private BigDecimal accommodationLow;

    @Column(name = "accommodation_mid")
    private BigDecimal accommodationMid;

    @Column(name = "food_daily")
    private BigDecimal foodDaily;

    @Column(name = "local_transit_daily")
    private BigDecimal localTransitDaily;

}