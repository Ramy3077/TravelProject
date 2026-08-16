# Trip Cost & Time Decomposer (“Why does this trip cost so much?”)

> **🚀 Status: v0.9 Public Beta**
>
> *Authentication-free, privacy-first trip estimation focused on transparency and resilience.*

A travel estimation engine that breaks down the *true* cost and time of your trip. Unlike standard booking sites, we show you the uncertainty, explicit assumptions, and what happens when you fly vs. take a train.

## ✨ Features (v0.9)

> **On live flight data.** The Amadeus integration this shipped with **no longer
> serves requests**, so the deployed system runs entirely on its own estimation
> engine. That is the case it was designed for, and it is worth being plain about:
> the engine, not the API call, is the substance of this project.

### ✅ Implemented & working
*   **Estimation Engine**:
    *   **Own engine (currently the only live path)**: geodesic distance and regional multipliers, producing a usable estimate with no upstream provider at all.
    *   **Optional live provider**: a flight provider can sit in front of it as the primary source. Resilience4j circuit breaking makes the swap invisible to the caller. The Amadeus client is still wired up and tested, but the upstream no longer returns data.
*   **Detailed Cost Breakdown**: Separates Transport, Accommodation (based on real cost-of-living indices), Food, and Local Transit.
*   **Confidence Scoring**: Every estimate is tagged with the path that produced it (`HIGH` for live provider data, `MEDIUM/LOW` for the internal engine), so a number is never presented as more certain than it is.
*   **Resilience First**: Network partitions or API outages gracefully degrade the service instead of showing error pages.

### 🚧 Coming Soon (v1.0)
*   **Smart Date Shifts**: "Save 20% by flying on Tuesday instead of Saturday."
*   **Shareable Reports**: Generate a permanent link to share your trip plan with friends.
*   **User Accounts**: Save trip history (optional).

---

## 🛠 Tech Stack

| Component | Tech | Responsibility-driven Design |
| :--- | :--- | :--- |
| **Backend** | **Spring Boot 3** (Java 21) | Estimation engine, circuit breaking (Resilience4j), pluggable flight provider. |
| **Frontend** | **Next.js 14** (TypeScript) | Interactive dashboard, Shadcn UI components. |
| **Worker** | **Python** | ETL pipeline for seeding city & cost-of-living data. |
| **Database** | **PostgreSQL 15** | Relational data for caching and reference datasets. |
| **Infra** | **Docker Compose** | Orchestration for local development. |

---

## ⚡ Quick Start (Local Dev)

### Prerequisites
*   Docker & Docker Compose
*   Java 21+
*   Node.js 20+
*   Amadeus API Keys (Free Tier) - *Optional (System will use fallback engine without them)*

### 1. Configure Environment
Create a `.env` file in the root directory:
```bash
# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=secret
POSTGRES_DB=travel

# Amadeus API (Optional - Leave blank to test Fallback Engine)
AMADEUS_CLIENT_ID=your_client_id
AMADEUS_CLIENT_SECRET=your_client_secret
```

### 2. Seed Data
Populate the database with cities and cost indices (run once):
```bash
docker-compose up -d db
cd worker
pip install -r requirements.txt
python seed_cities.py
```

### 3. Run the Stack
```bash
# Start Backend & DB
docker-compose up -d --build

# Start Frontend (in a separate terminal)
cd web
npm install
npm run dev
```
Visit `http://localhost:3000` to start planning.

---

---
Built by [Ramy Mekhzer](https://github.com/Ramy3077) - MEng Computer Science & Software Engineering, University of Birmingham.

