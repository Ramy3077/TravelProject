CREATE TABLE cities (
    id VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    iata_code VARCHAR(3) UNIQUE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
);

CREATE TABLE cost_indices (
    city_id VARCHAR(10) PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
    accommodation_low DECIMAL(10, 2),
    accommodation_mid DECIMAL(10, 2),
    food_daily DECIMAL(10, 2),
    local_transit_daily DECIMAL(10, 2)
);
