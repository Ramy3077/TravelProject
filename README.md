# Can I Afford This Trip?

> Enter where you're going, when, how many of you, your travel style, and a **budget** — get a
> straight answer: **can you afford it?** Plus how many days you *could* afford, a ranked list of
> ways to bring the cost down, and a transparent, uncertainty-aware breakdown of where the money goes.

A single **TypeScript / Next.js** full-stack app. No login, no tracking, no external API on the
request path, and no database to keep warm — the reference data ships baked into the build, so the
app always returns an answer.

```
You: London → Paris, 1–10 Aug, 2 travellers, Balanced, budget $2,500
App: Over budget by ~$400 (est. $2,900).  You could afford ~8 days on this budget.
     Ways to fit it:  • Shorten to 5 nights        (save ~$1,110)
                      • Travel with 1 fewer person  (save ~$740)
                      • Switch to the Budget tier   (save ~$615)
                      • Travel in September          (save ~$280, cheaper season)
                      • Try a cheaper nearby city    (save ~$1,200)
     Breakdown: transport $279 · accommodation $1,412 · food $1,091 · getting around $115
```

---

## Why it's built this way

This began as a learning project (a Spring Boot + Python + Supabase "trip cost decomposer") and was
deliberately reshaped into something publishable. The interesting decisions:

- **Graceful degradation is the default, not a fallback path.** The cost engine is a pure, internal
  model that *always* produces an answer. Any external price feed is *optional enrichment* that can
  only raise confidence — there is structurally no dependency to fail. The old design wrapped a live
  flight API (Amadeus) in a circuit breaker; Amadeus is being decommissioned, so it's gone, but the
  resilience pattern (circuit breaker + cache) is ported to TS and kept as a documented seam.
- **No runtime database.** City and cost-of-living data is static reference data, so it's processed
  at build time into committed JSON loaded once into memory (`import 'server-only'` keeps the ~1.4 MB
  dataset out of the client bundle). No DB to provision, pause, or pay for.
- **Honest about uncertainty.** Every line carries a min–max range and a confidence tag derived from
  *data coverage* (city-level → country-median → global default). The data vintage and sources are
  shown in the UI.
- **The numbers are modelled, and the model is documented.** Airfare uses a non-linear
  **distance-band** curve (short hops cost more per km than long-haul); 2019 cost data is
  **inflation-adjusted to 2024** via the World Bank CPI at build time; nightly lodging applies a
  documented short-stay premium over pro-rated rent. No magic numbers — see [`web/src/lib/engine`](web/src/lib/engine).
- **AI-ready, but no AI yet.** The engine is a set of pure functions over a stable typed contract,
  the "ways to cut" levers carry machine-readable `params`, and there's a `parseTripQuery` stub — so
  a natural-language / agent layer can be added later without a refactor.

---

## How it works — the resilience chain

```
POST /api/trips/afford
   └─ zod validation ──→ assessAffordability(budget, input, ctx)
                              ├─ estimateTrip(input, ctx)            ← pure, synchronous
                              │     ├─ transport   (distance bands × tier × season)
                              │     ├─ accommodation, food, getting-around
                              │     │     └─ resolveCost: city → country median → global default
                              │     │            (confidence: high → medium → low)
                              │     └─ seasonality (hemisphere-aware, from the trip dates)
                              ├─ verdict   (point estimate vs budget: comfortable/feasible/tight/over)
                              ├─ maxAffordableDays
                              └─ levers    (re-run the engine with perturbed inputs, rank by saving)
```

The engine in [`web/src/lib/engine`](web/src/lib/engine) is framework-free and unit-tested — no
`fetch`, no `fs`, no Next imports — which is what makes it both trivially testable and directly
callable by a future tool/agent layer.

## Project structure

```
web/                         # the app (this is the product)
  src/app/                   # Next.js App Router
    page.tsx                 #   budget-first UI
    api/                     #   route handlers (~20 lines each: validate → engine → map errors)
    error.tsx                #   error boundary (never shows a raw stack)
  src/lib/
    engine/                  # PURE cost engine — the heart of the app
    data/                    # in-memory repository over the baked dataset (server-only)
    resilience/              # dependency-free circuit breaker + LRU/TTL cache
    providers/               # price-trends seam (null provider by default)
    validation/              # zod schemas
    http/                    # safe error mapper + IP rate limiter
  scripts/
    build-dataset.ts         # CSV → committed JSON (ports the old Python seeders)
    fetch-cpi.ts             # World Bank CPI → committed inflation factors
  test/                      # vitest (engine, resilience, http, data)

api/      worker/            # ORIGINAL Java/Spring + Python implementation — kept for reference only
infra/                       # deployment notes
```

> **`api/` and `worker/` are the original learning-project implementation, preserved for reference.**
> They are not built or deployed by CI/CD and the live app does not use them. The cost logic now lives
> in `web/src/lib/engine`; the Python seeders' logic now lives in `web/scripts/build-dataset.ts`.

## Quick start

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (vitest)
npm run build      # production build (does NOT need the source CSVs — JSON is committed)
```

That's it — no env vars, no database, no API keys.

### Regenerating the dataset (optional)

The processed dataset is committed, so you only need this to refresh the data:

```bash
npm run fetch:cpi    # refresh World Bank inflation factors → scripts/cpi-factors.json
npm run build:data   # rebuild the baked dataset from worker/data/*.csv (gitignored source CSVs)
```

## Tech & engineering notes

| Area | Choice |
| :--- | :--- |
| **Stack** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 |
| **Validation** | zod schemas; all errors mapped to clean JSON (no leaked stack traces) |
| **Resilience** | hand-rolled circuit breaker + LRU/TTL cache (ports of Resilience4j + Caffeine) |
| **Security** | same-origin (no CORS), zod validation, IP rate limiting, no exposed internals |
| **Data** | 8,271 cities (4,527 with city-level cost), 200 country medians; CPI-adjusted to 2024 |
| **Testing** | vitest — engine, affordability, resilience, rate limiting, repository |
| **Deploy** | one container (`output: standalone`) → Cloud Run, or `vercel --prod` from `web/` |

## Data sources & attribution

- **SimpleMaps World Cities** — city names, coordinates, population.
- **OurAirports** — IATA codes.
- **Cost of Living** (Numbeo-derived, Kaggle, ~2019) — food, transit, rent indices.
- **World Bank** — Consumer Price Index (`FP.CPI.TOTL`), used to inflation-adjust costs to 2024 (open data).

Costs are **estimates**, not quotes — actual prices vary with availability, season, and how you book.

## Known limitations (by design)

- Single currency (USD) for v1.
- Seasonality is a coarse, hemisphere-aware month bucket, not event-level data ("Rio at Carnival").
- Accommodation is derived from cost-of-living rent indices with a documented short-stay premium, not
  live listings.
- Transport is a calibrated model, not a live fare. The provider seam exists to add a real
  price-trends feed (e.g. Travelpayouts) later.

---

*Originally a Spring Boot learning project; rebuilt as a single TypeScript app focused on the question
travellers actually ask.*
