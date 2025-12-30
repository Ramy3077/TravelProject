# Trip Cost & Time Decomposer (“Why does this trip cost so much?”)

> **🚀 Status: v0.9 Public Beta**
>
> *Authentication-free, privacy-first trip estimation focused on transparency and resilience.*

A travel estimation engine that breaks down the *true* cost and time of your trip. Unlike standard booking sites, we show you the uncertainty, explicit assumptions, and what happens when you fly vs. take a train.

## ✨ Features (v0.9)

### ✅ implemented & Working
*   **Hybrid Estimation Engine**:
    *   **Primary**: Fetches live flight quotes via **Amadeus API**.
    *   **Fallback**: If APIs fail (or for cities with no airports), instantly switches to a robust internal calculation engine based on geodesic distance and regional multipliers.
*   **Detailed Cost Breakdown**: Separates Transport, Accommodation (based on real cost-of-living indices), Food, and Local Transit.
*   **Confidence Scoring**: Every estimate is tagged (`HIGH` for live data, `MEDIUM/LOW` for fallbacks).
*   **Resilience First**: Network partitions or API outages gracefully degrade the service instead of showing error pages.

### 🚧 Coming Soon (v1.0)
*   **Smart Date Shifts**: "Save 20% by flying on Tuesday instead of Saturday."
*   **Shareable Reports**: Generate a permanent link to share your trip plan with friends.
*   **User Accounts**: Save trip history (optional).

---

## 🛠 Tech Stack

| Component | Tech | Responsibility-driven Design |
| :--- | :--- | :--- |
| **Backend** | **Spring Boot 3** (Java 21) | Core logic, Circuit Breaking (Resilience4j), Amadeus Integration. |
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
*Maintained by the Trip Cost Engineering Team.*

