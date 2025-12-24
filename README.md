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

## 🛡 Design Philosophy
1. **Truthfulness First**: Every number is an estimate with an explicit range and confidence badge.
2. **Graceful Degradation**: External API failures shift the report to "Lower Confidence" but never result in a blank screen.
3. **Privacy**: No login required for v1; reports are immutable tokens.

---
*Created by the Project Engineering Team.*
