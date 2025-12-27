package com.travel.tripcost.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "cities")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class City {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String country;

    @Column(name = "iata_code", unique = true)
    private String iataCode;

    private Double latitude;
    private Double longitude;

    @OneToOne(mappedBy = "city", cascade = CascadeType.ALL)
    private CostIndex costIndex;

}
