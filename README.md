# Trip Cost & Time Decomposer (“Why does this trip cost so much?”)

A transparent, cached, and explainable travel estimation engine that breaks down the true cost and time of your trip.

## 🚀 Mission
Provide travelers with a realistic view of their journey beyond just the flight price. Most trip planners hide uncertainty; we embrace it by using ranges, confidence levels, and explicit assumptions.

## ✨ Core Features
- **Total Trip Cost Breakdown**: Ranges for transport, mid-range accommodation, food, and local transit.
- **Door-to-Door Time Breakdown**: Estimates for airport buffers, flight time, and transfers.
- **Cheaper Alternatives**: Intelligent date-shift suggestions (±1-3 days) with explained trade-offs.
- **Resilient Estimates**: Always produces a report, even when external APIs are down, using a high-quality internal fallback engine.
- **Shareable Reports**: Immutable, no-login-required links to share trip estimates with others.

## 🛠 Tech Stack
- **Backend**: Spring Boot (Java) - Core logic, API, and provider integration.
- **Frontend**: Next.js (TypeScript) - Premium, interactive dashboard.
- **Worker**: Python - ETL and data seeding for city indices.
- **Database**: PostgreSQL - For caching and reference datasets.
- **Infrastructure**: Dockerized services for consistent development and deployment.

## � Data Setup
This project requires external datasets for city geographic data and cost indices. Due to size and licensing, these are excluded from version control.

### Sourcing the Data
1. **Cities**: Download from [SimpleMaps (World Cities Database)](https://simplemaps.com/data/world-cities) - *Basic (Free) Plan*. Save as `worker/data/worldcities.csv`.
2. **Cost Indices**: Download from [Kaggle (Global Cost of Living)](https://www.kaggle.com/datasets/mvieira101/global-cost-of-living/data?select=cost-of-living_v2.csv). Save as `worker/data/cost-of-living_v2.csv`.
3. **Airports**: Download from [GitHub (lxndrblz/Airports)](https://github.com/lxndrblz/Airports/blob/main/airports.csv). Save as `worker/data/airports.csv`.

### Seeding the Database
Ensure your `.env` is configured, then run:
```bash
cd worker
pip install -r requirements.txt
python seed_cities.py  # Tier 1: 48k Cities
python seed_costs.py   # Tier 2: Cost Indices for ~2.7k cities
```

## �🛡 Design Philosophy
1. **Truthfulness First**: Every number is an estimate with an explicit range and confidence badge.
2. **Graceful Degradation**: External API failures shift the report to "Lower Confidence" but never result in a blank screen.
3. **Privacy**: No login required for v1; reports are immutable tokens.

---
*Created by the Project Engineering Team.*
