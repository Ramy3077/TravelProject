# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository.

## What this is

**"Can I Afford This Trip?"** — given origin, destination, dates, travellers, a travel style
(`budget` / `balanced` / `comfort`), and a **budget**, it returns: a verdict
(comfortable / feasible / tight / over), how many days you could afford, a ranked list of **ways to
bring the cost down** ("levers"), and a transparent, uncertainty-aware cost breakdown (transport,
accommodation, food, getting around) with min/max ranges and confidence tags.

The defining design goal is **graceful degradation**: the cost model is a pure internal engine that
always produces an answer; any external price feed is optional enrichment that can only raise
confidence, never block a response.

### The app is `web/` — a single TypeScript / Next.js full-stack app

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4.
- API logic lives in route handlers; all economics live in a pure, framework-free engine.
- Reference data is **baked into the repo as JSON** — no runtime database, no external API on the
  request path, no secrets needed to run.

### `api/` (Java/Spring) and `worker/` (Python) are the ORIGINAL implementation, kept for reference

They are **not built or deployed** and the live app does not use them. Do **not** wire the app back to
them. The cost logic was reimplemented in `web/src/lib/engine`; the Python seeders' logic was ported
to `web/scripts/build-dataset.ts`. (History: the project started as a Spring Boot + Python + Supabase
"trip cost decomposer" wrapping the Amadeus flight API. Amadeus is being decommissioned, Supabase's
free tier paused on inactivity, and the JVM was overkill — so it was consolidated into one TS app.
**Do not reintroduce Amadeus, Supabase, or a runtime DB.**)

## Commands (run from `web/`)

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # vitest unit tests
npm run test:watch   # vitest watch mode
npm run lint         # eslint (must be clean)
npx tsc --noEmit -p tsconfig.json   # typecheck
npm run build        # production build (does NOT need the source CSVs)

# Data (only needed to refresh the baked dataset):
npm run fetch:cpi    # World Bank CPI → scripts/cpi-factors.json (committed)
npm run build:data   # worker/data/*.csv → src/lib/data/generated/*.json (committed)
```

The legacy Java suite still runs (`mvn -f api/pom.xml test`) but is reference-only.

## Architecture: the resilience chain (the heart of the app)

`POST /api/trips/afford` → zod-validate → `assessAffordability({ budget, input, ctx })`:

1. `estimateTrip(input, ctx)` builds the transparent breakdown — **pure and synchronous**:
   - **Transport** (`engine/transport.ts`): a non-linear **distance-band** airfare curve
     (`bandedFare`) × per-tier factor × seasonality. Always a model estimate → confidence capped at
     `medium`.
   - **Accommodation / food / getting-around**: from cost-of-living data via `resolveCost`
     (`engine/cost.ts`) with a fallback chain **city → country median → global default**, each step
     lowering confidence (`high → medium → low`).
   - **Seasonality** (`engine/seasonality.ts`): hemisphere-aware peak/shoulder/off multiplier from the
     trip month (uses the dates the old app collected but ignored).
2. **Verdict**: point estimate vs budget — ≤0.8 comfortable, ≤1.0 feasible, ≤1.1 tight, else over
   (`engine/afford.ts` `verdictFor`).
3. **`maxAffordableDays`**: closed-form solve of nights against the budget.
4. **Levers**: re-run the pure engine with perturbed inputs (`lower_tier`, `shorten_trip`,
   `shift_dates`, `cheaper_destination`, `fewer_travellers`), keep those that save money, rank by
   saving. Each carries machine-readable `params` so the UI applies it and a future agent could too.

`POST /api/trips/estimate` returns just the breakdown (LRU-cached). `GET /api/locations/cities?q=`
is autocomplete (≤10 server-filtered results). `GET /api/health` → `{status:'ok'}`.

**Route handlers are thin** (~20 lines: rate-limit → zod validate → call engine → map errors → JSON).
Keep economics in `engine/`, not in routes.

## The engine (`web/src/lib/engine/`) — pure, framework-free, unit-tested

No `fetch`, no `fs`, no Next imports — so it's testable without a server and directly callable by a
future LLM/agent layer.

| File | Responsibility |
|---|---|
| `types.ts` | All domain types (the stable contract an AI layer would call). |
| `estimate.ts` | `estimateTrip` — the breakdown. `MODEL_VERSION` lives here. |
| `afford.ts` | `assessAffordability`, `verdictFor`, lever generation. |
| `tiers.ts` | `TIERS` — single source of truth for how `budget/balanced/comfort` differ across **every** category. |
| `transport.ts` | Distance-band fare model (`bandedFare` anchors + `estimateTransport`). |
| `accommodation.ts` | Nightly lodging; applies `NIGHTLY_RATE_PREMIUM` (rent→short-stay). |
| `food.ts`, `localTransport.ts` | Per-tier daily-spend categories. |
| `cost.ts` | `resolveCost` fallback chain + `coverageConfidence` + `GLOBAL_DEFAULT_COST`. |
| `seasonality.ts`, `distance.ts` (Haversine), `money.ts`, `date.ts`, `errors.ts` | supporting. |
| `parse.ts` | **AI seam (stub):** `parseTripQuery` — swap the body for an LLM call later. |

## Data: baked static dataset (no runtime DB)

`web/src/lib/data/repository.ts` is an in-memory `DataContext` over committed JSON in
`generated/{cities,costs,countryMedians,meta}.json`. It's `import 'server-only'` so the ~1.4 MB never
enters the client bundle.

Built by **`web/scripts/build-dataset.ts`** (TS port of the Python `seed_cities.py` + `seed_costs.py`)
from `worker/data/*.csv` (gitignored source). Current: **8,271 cities** (4,527 with city-level cost),
**200 country medians**. Documented derivations (named constants): `food = x1 × 3 meals`,
`transit = x28 × 2.5 trips`, `accMid = x48/30`, `accLow = x49/30`.

**Inflation adjustment:** the ~2019 cost numbers are multiplied by per-country **World Bank CPI**
factors (`FP.CPI.TOTL`, 2019→2024) at build time. Factors are fetched by `scripts/fetch-cpi.ts` and
committed to `scripts/cpi-factors.json` so `build:data` stays offline/reproducible. Hyperinflation
outliers (factor >5, e.g. Turkey/Argentina) are excluded → default to 1.0 (conservative).
`meta.json` records `vintage`, `adjustedYear`, `inflationAdjusted`, `adjustedCountryCount`.

**The baked JSON is committed; `npm run build` does NOT need the CSVs.** Only run `build:data` to
refresh data.

## Modeling notes (documented heuristics, not magic numbers)

- **Tiers** differ across **all** categories (`tiers.ts`): transport factor, accommodation key+factor,
  food factor, local-transport factor. (Fixes the old `CHEAP == BALANCED` bug.)
- **Transport** is non-linear per km — short hops cost more per km than long-haul (`transport.ts`
  anchors). The fare is round-trip economy at the balanced tier; tier factor scales the cabin.
- **Accommodation** source figures are pro-rated monthly rent; `NIGHTLY_RATE_PREMIUM` (2.5×) converts
  to a realistic short-stay nightly rate. Scales by rooms (~2 travellers/room), not head-count.
- **Confidence** is data-driven (coverage tier), not a binary city/no-city flag.

## Security posture

- **Same-origin** (no CORS) — API routes live in the same app; `NEXT_PUBLIC_API_URL` is gone.
- **zod validation** (`validation/schemas.ts`): tier enum, ISO dates, `end>start`, `origin≠dest`,
  ≤30 nights, travellers 1–8, budget>0.
- **Safe error mapping** (`http/errors.ts`): zod→400 with field messages, `EngineError`→400/404,
  unknown→generic 500 (logged server-side, **never leaks a stack trace**). `app/error.tsx` is the UI
  boundary so the client never shows a raw stack.
- **IP rate limiting** (`http/rateLimit.ts`): sliding-window per IP on estimate/afford/cities
  (`RATE_LIMITS`). In-memory / per-instance (documented Upstash path for multi-instance).
- No actuator, no DB credentials, no API keys on the request path.

## Conventions & gotchas

- **The cost model is the always-available primary.** External price-trends providers
  (`providers/priceTrends.ts`, currently the `nullPriceTrendProvider`) are optional enrichment behind
  the circuit breaker (`resilience/circuit.ts`); they can raise confidence but never block an answer.
- `resilience/{circuit,cache}.ts` are dependency-free ports of Resilience4j (50%/window-10/60s) and
  Caffeine (`@Cacheable`, 15 min / 1000). Both are unit-tested.
- The Turbopack workspace root is pinned in `web/next.config.ts` (a stray parent-dir lockfile
  otherwise triggers a wrong-root warning). `output: 'standalone'` for container deploys.
- Tests live in `web/test/` (vitest): engine, affordability, resilience, rate limiting, repository.
  `test/server-only-stub.ts` neutralizes the `server-only` import so the repository is testable.
- `.claude/` is **gitignored** (it holds a local bypass-permissions default + machine-specific
  allowlist — must not ship publicly). `worker/data/*.csv`, `.venv/`, build logs, `.env` are ignored.
- The file `worker/<style>@charset "UTF-8";html{font-family` is stray junk from an accidental write —
  not source; safe to delete.

## CI/CD

- **CI** (`.github/workflows/ci.yml`): `web` job runs `npm ci → lint → tsc → test → build` (the active
  product). `api` (`mvn test`), `worker`, and `docker-build` jobs validate the reference modules.
- **CD** (`.github/workflows/cd.yml`): on a `v*` tag, builds the single `web` image and deploys
  `travel-web` to Cloud Run (`europe-west1`). No API, no DB, no Amadeus, no `NEXT_PUBLIC_API_URL`.
  Vercel (`vercel --prod` from `web/`) is an even simpler alternative — the data is baked, so there's
  no cold-DB problem.

## Docs that are partly aspirational (trust the code)

`TASKS.md` and `infra/` describe the original plan; the code is the source of truth. `City.id` is a
numeric string from `worldcities.csv` (e.g. `"1250015082"`), not the `XX_YYY` format `TASKS.md`
describes.
