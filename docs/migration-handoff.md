# Migration Handoff — Trip Cost app → "Can I Afford This Trip?"

> **Purpose:** self-contained context to resume this work in a fresh Claude Code session.
> **Status as of 2026-05-22:** Phases 1 & 2 **complete, verified, and UNCOMMITTED**. Phase 3 pending.
> **Approved plan (full rationale):** `~/.claude/plans/generate-a-plan-on-resilient-balloon.md`

---

## TL;DR

We're converting a Java/Spring + Python-worker + Supabase "trip cost decomposer" into a **single
TypeScript/Next.js full-stack app**, reframed around the question people actually care about:
**"Can I afford this trip?"** Enter origin, destination, dates, travellers, a travel style, and a
**budget** → get a verdict (comfortable / within budget / tight / over), how many days you could
afford, a ranked list of **ways to bring the cost down**, and a transparent, uncertainty-aware
breakdown (transport, accommodation, food, getting around).

- **Phases 1 & 2 are done** and verified end-to-end in a real browser. 31 unit tests pass, typecheck +
  lint + production build are clean.
- **Nothing is committed yet** — it's a clean diff on `main` for review.
- **The legacy Java `api/` and Python `worker/` are untouched** and still present (nothing removed).
- **Phase 3 (pending):** hardening (rate limit, error boundary), then deleting the legacy modules and
  rewiring deployment to a single app.

---

## Why we're doing this (the problems being fixed)

The project began as a learning exercise and was never built to publish. Concrete issues, all addressed
by the new code:

1. **Java/Spring was overkill** for the actual logic (a Haversine calc, table lookups, a few
   multiplications, one external call) and caused slow JVM cold starts. → Collapsed into Next.js route
   handlers; no JVM.
2. **Amadeus is being decommissioned** (Self-Service developer API shutting down ~July 2026, keys
   disabled). → Removed entirely. The internal cost **model** is the resilient primary; a price-*trends*
   provider (Travelpayouts/Kiwi) is a documented, no-op seam for later. **Do not reintroduce Amadeus.**
3. **Supabase free tier paused on inactivity** (fatal with no users). → The city/cost data is static
   reference data, now **baked into the repo as JSON**. No runtime DB, no anon-key writes.
4. **The preference tiers barely differed** (`CHEAP == BALANCED` in transport; food ignored the tier;
   no real premium logic). → New `budget / balanced / comfort` tiers differ across **all** categories.
5. **Data was stale/opaque** (undocumented magic numbers from a ~2019 dataset; collected trip dates were
   never used; a transit figure was computed and never read). → Magic numbers documented; **seasonality
   now uses the dates**; transit is a real "Getting around" line; data vintage is shown in the UI.
6. **Weak security** (open CORS, only `ValidationException` handled so everything else leaked stack
   traces, exposed actuator, no rate limiting). → Same-origin (no CORS), zod validation with clean 400s,
   no actuator. (Rate limiting is the one remaining item — Phase 3.)

---

## What changed (Phases 1 & 2)

Everything new lives under **`web/`**. The product is now budget-first.

### New: the cost engine — `web/src/lib/engine/` (pure, framework-free, unit-tested)

| File | Responsibility |
|---|---|
| `types.ts` | All domain types (`Tier`, `Confidence`, `CostRange`, `EstimateInput/Result`, `AffordResult`, `Lever`, `DataContext`, …). The stable contract a future AI layer will call. |
| `estimate.ts` | `estimateTrip(input, ctx)` — builds the transparent breakdown. Pure & synchronous. |
| `afford.ts` | `assessAffordability({budget, input, ctx})` — verdict, headroom, `maxAffordableDays`, and ranked `levers`. `verdictFor(point, budget)`. |
| `tiers.ts` | `TIERS` — single source of truth for how `budget/balanced/comfort` change every category (fixes the old CHEAP==BALANCED bug). |
| `seasonality.ts` | Hemisphere-aware peak/shoulder/off multiplier from the trip month (uses the dates the old app ignored). |
| `distance.ts` | Haversine (ported verbatim from the Java `DistanceService`). |
| `transport.ts`, `accommodation.ts`, `food.ts`, `localTransport.ts` | Per-category estimators. `localTransport` is the once-orphaned transit figure, now used. |
| `cost.ts` | `resolveCost` fallback chain: city → country median → global default, with `coverageConfidence`. |
| `money.ts` | `rangeFrom`, `sumRanges`, `weakestConfidence`, rounding. |
| `date.ts` | `nightsBetween`, `monthOf`, `addDays` (UTC, on `YYYY-MM-DD`). |
| `errors.ts` | `EngineError` (`UNKNOWN_CITY` / `INVALID_INPUT`). |
| `parse.ts` | **AI seam (stub):** `parseTripQuery(text)` — swap the body for an LLM call later. |

**Tier behavior (verify against `tiers.ts`):** budget < balanced < comfort across transport per-km,
accommodation tier+factor, food factor, and local-transport factor.

**Verdict thresholds (`afford.ts`):** `point/budget` ≤ 0.8 = comfortable, ≤ 1.0 = feasible, ≤ 1.1 =
tight, else over.

**Levers generated (re-running the pure engine with perturbations):** `lower_tier`, `shorten_trip`,
`shift_dates` (cheaper season), `cheaper_destination` (nearby city with cost data), `fewer_travellers`.
Each carries structured `params` so the UI applies it and an AI agent could too.

### New: data layer — `web/src/lib/data/`

- `repository.ts` — in-memory `DataContext` over the baked JSON (`import 'server-only'`, never bundled
  client-side). Implements `getCity`, `getCost`, `getCountryMedian`, `searchCities`, `costCities`, `meta`.
- `generated/{cities,costs,countryMedians,meta}.json` — **committed** baked dataset (~1.4 MB). Built by:
- `web/scripts/build-dataset.ts` — TS port of the Python seeders (`worker/seed_cities.py` +
  `seed_costs.py`). Reads `worker/data/*.csv`, documents the magic numbers, emits the JSON. Run via
  `npm run build:data`. Output stats: **8,271 cities** (4,527 with city-level cost), **200 country medians**.

### New: API routes — `web/src/app/api/`

- `POST /api/trips/afford` — the headline endpoint (verdict + levers + full estimate).
- `POST /api/trips/estimate` — transparent breakdown (cached via LRU).
- `GET  /api/locations/cities?q=` — autocomplete (≤10 results, server-filtered).
- `GET  /api/health` — `{status:'ok'}` (replaces the exposed Spring actuator).

### New: resilience / providers / validation / http

- `lib/resilience/circuit.ts` — dependency-free circuit breaker (port of the Resilience4j config; unit-tested).
- `lib/resilience/cache.ts` — LRU+TTL (port of `@Cacheable`, 15 min / 1000).
- `lib/providers/priceTrends.ts` — `PriceTrendProvider` interface + `nullPriceTrendProvider` (no-op; the Amadeus replacement seam).
- `lib/validation/schemas.ts` — zod schemas (`estimateInputSchema`, `affordInputSchema`, `citiesQuerySchema`); trip rules (origin≠dest, end>start, ≤30 nights, travellers 1–8, budget>0).
- `lib/http/errors.ts` — safe error mapper (zod → 400 with field messages, `EngineError` → 400/404, unknown → generic 500, **never leaks stack traces**).

### Frontend — `web/src/`

- `app/page.tsx` — reworked to budget-first. Calls `/api/trips/afford`. Tapping a lever applies it and recalculates.
- New components: `budget-input.tsx`, `affordability-verdict.tsx`, `what-to-cut.tsx`.
- Updated: `trip-cost-breakdown.tsx` (4 categories incl. "Getting around", lowercase confidence, season + vintage footer), `budget-preference.tsx` (now `budget/balanced/comfort`), `lib/api/tripApi.ts` (same-origin; drops `NEXT_PUBLIC_API_URL`; shares engine types), `app/layout.tsx` (real title/description).

### Dependencies added (`web/package.json`)

- Runtime: `zod`, `lru-cache`, `server-only`.
- Dev: `vitest`, `papaparse` + `@types/papaparse`, `fastest-levenshtein`, `tsx`.
- Scripts: `build:data` (regenerate dataset), `test` (vitest), `build` = `next build` (does **not** depend on CSVs — the JSON is committed).

---

## How to run & verify

```bash
cd web
npm install
npm run dev        # http://localhost:3000  (the new app)
npm test           # 31 unit tests, all green
npm run build      # production build, passes
npm run build:data # (optional) regenerate the baked dataset from worker/data/*.csv
```

**Known-good baseline (browser-verified):** London → Paris, 2026-08-01→08-10, 2 travellers, Balanced,
budget $2,500 → **"Comfortably affordable, $707 to spare, ~14 days affordable"**, 5 ranked levers, full
breakdown. Tier totals differ (budget < balanced < comfort). Invalid input (end<start) → clean 400, no
stack trace.

---

## Current state

- **Quality gates:** TypeScript typecheck clean · ESLint 0 problems · 31 vitest tests pass · `next build` passes · full browser flow + interactive lever-apply verified.
- **Uncommitted.** Review with `git status` and `git diff -- web`. (Commit only when you decide to.)
- **Untouched legacy:** the entire Java `api/`, the Python `worker/`, `docker-compose.yml`, `.github/workflows/cd.yml` all still present and working.

---

## Key decisions (and one judgment call)

- **Data store = JSON-in-memory behind a `DataContext` interface**, not SQLite (the plan named SQLite as
  primary). Reason: avoids `better-sqlite3` native-binding friction across dev/CI/deploy; the dataset is
  small; it's swappable later via the same interface. **Revisit if you'd prefer SQLite.**
- **Single currency: USD** for v1 (matches the source cost data; the UI uses `$`). Multi-currency/FX is later.
- **AI is deferred but seamed:** `parseTripQuery` stub, structured `Lever.params`, and the `factors`
  block in `EstimateResult` mean an LLM/agent layer can be added with minimal refactor.

---

## Next steps — Phase 3 (NOT yet started)

### 3a. Non-destructive hardening
- [ ] **IP rate limiting** — add `web/src/lib/http/rateLimit.ts` (token-bucket / sliding window) and apply
      it in the `estimate`, `afford`, and `cities` routes. (In-memory is fine for one instance; note
      Upstash Redis as the multi-instance path — don't over-build.)
- [ ] **Error boundary** — add `web/src/app/error.tsx` so the UI never shows a raw stack trace.
- [ ] **Pin the Turbopack workspace root** in `web/next.config.ts` to silence the build warning. (There's
      a stray `~/package-lock.json` in the home dir that Next picks up as a competing workspace root.)

### 3b. Destructive cleanup + deploy (these will run WITHOUT prompting — see bypass note below)
- [ ] **Delete the Java `api/` module** (Spring, Amadeus client/token, Resilience4j, Flyway, JPA — all of it).
- [ ] **Delete the Python `worker/`** — but **keep `worker/data/*.csv`** as build input for `build:data`
      (or relocate them to `web/data-src/`). The seeder logic now lives in `scripts/build-dataset.ts`.
- [ ] **Delete the stray junk file** `worker/<style>@charset "UTF-8";html{font-family`.
- [ ] **Rewrite `.github/workflows/cd.yml`** to build & deploy the single Next app (Vercel — simplest,
      data is baked so no cold-DB problem — or one Cloud Run `web` service). Drop the API build/deploy
      steps and the `PROD_DB_*` / `SPRING_*` secrets.
- [ ] **Remove `docker-compose.yml`** `db`/`api` services (or the whole file).
- [ ] **Update `CLAUDE.md` and `README.md`** to describe the new single-app TS architecture.

### 3c. Phase 4 — AI (later, optional)
- Wrap `estimateTrip` / `assessAffordability` as LLM tools; implement `parseTripQuery` for natural-language
  input ("a week in Japan in spring for two, mid-range"); narrate the top-3 levers as "ways to save $X".
  All seams already exist.

### 3d. Data realism & fares (improves the two biggest weaknesses)
- [ ] **Transport:** switch the linear model to **distance bands** (free, no API).
- [ ] **Cost data:** **inflation-adjust 2019 → present** via the free World Bank CPI API at build time, then optionally refresh the base data (updated Kaggle CSV and/or WhereNext).
- [ ] **Optional:** wire **Travelpayouts** (free, affiliate) into the price-trends seam to calibrate fares.
- See the **"Researched options"** section below for verified endpoints, licensing, and recommended order.

---

## Researched options: fix 2019 staleness + transport without Amadeus (added 2026-05-22)

> Context: transport is currently a **linear** distance model ([`web/src/lib/engine/transport.ts`](web/src/lib/engine/transport.ts) + [`tiers.ts`](web/src/lib/engine/tiers.ts)) and the cost data is **raw ~2019** and **not inflation-adjusted**. We made staleness *visible* (vintage in the UI) but did **not** correct it. Below is researched, verified (2026) guidance. **All of it is localized to `scripts/build-dataset.ts` (data) and `transport.ts`/`tiers.ts` (model) — no architecture change.**

### A. Make transport realistic with NO API (do first — free, zero dependencies)
Real airfare is strongly **non-linear** per km: short hops cost more per km, long-haul is cheaper per km. Approx per-passenger benchmarks (one-way, economy):
- Short-haul ~500–800 km: **$40–120**
- Medium-haul ~1,000–2,500 km: **$70–200**
- Long-haul narrowbody ~2,500–4,500 km: **$120–350**
- Long-haul widebody 6,000 km+: **$250–700+** (≈ $0.06/km)

→ Replace the linear `transportBase + km × perKm` with **distance bands** (interpolate within a band), scaled per tier + season. Keeps confidence "medium", no external dep, much better shape than today's straight line. Source: [ScrapingBee – Top Flight APIs 2026](https://www.scrapingbee.com/blog/top-flights-apis-for-travel-apps/) and general airfare-per-km figures.

### B. Optional fare *enrichment* via the existing provider seam (free, affiliate)
- **Travelpayouts Data API** — FREE (requires affiliate signup + token). Cheapest-fare + month "price-calendar" endpoints, JSON, **cache-based** (designed for precompute/static, not per-request) → ideal to *calibrate* the model offline. Wire into [`web/src/lib/providers/priceTrends.ts`](web/src/lib/providers/priceTrends.ts) behind the circuit breaker. **Bonus: affiliate = a real monetization story.** Docs: [travelpayouts.github.io/slate](https://travelpayouts.github.io/slate/), [overview blog](https://www.travelpayouts.com/blog/flight-apis-and-travel-project-ideas/).
- **Kiwi Tequila** — now **invite-only / requires 50,000 MAU** ([tequila.kiwi.com](https://tequila.kiwi.com/)) → not available to us; **drop it.**
- **Skyscanner** = partner-only. **Amadeus** = being decommissioned. Don't use either.

### C. Fix 2019 staleness — QUICK WIN (free, no key, keeps current data)
- **World Bank CPI API** — FREE, **no API key**. Indicator `FP.CPI.TOTL` (CPI, 2010=100), per country, through 2024. At build time compute `factor = CPI[2024] / CPI[2019]` per ISO country and multiply the 2019 costs. **Verified working:** France 2019=110.05 → 2024=126.51 (**×1.15**). Endpoint: `https://api.worldbank.org/v2/country/{ISO2}/indicator/FP.CPI.TOTL?format=json&date=2019:2024`. Cache the per-country factors to a small committed JSON so the build stays offline-reproducible. Also drop the cost-category confidence a notch (label: "inflation-adjusted estimate"). Refs: [indicator page](https://data.worldbank.org/indicator/FP.CPI.TOTL).

### D. Fix staleness BETTER — refresh the base data (free options)
- **WhereNext open API** — FREE JSON/CSV, **no auth**, **CC BY 4.0 (must credit "WhereNext (getwherenext.com)")**, **2026.1 data (updated Apr 2026)**. **Verified shape:** `country_code, country, region, cost_index, monthly_estimate_usd` (absolute USD), `grocery_index, rent_index, utilities_index, transport_index` (relative). **95 countries, NO cities.** `GET https://getwherenext.com/api/data/cost-of-living` (+ `/csv`), 100 req/hr, cached 24h. Best use: a **country-level refresh/rescaling layer** (and to sanity-check our 2019 numbers) — *not* a city-level replacement. Refs: [WhereNext data](https://getwherenext.com/data), [2026 cost-of-living index](https://getwherenext.com/data/cost-of-living-2026).
- **Updated Kaggle CSV** — e.g. [World Cost of Living & Quality of Life (2024–2025)](https://www.kaggle.com/datasets/abdullahmeo/world-cost-of-living-and-quality-of-life-20242025) or [Global Cost of Living (4,500+ cities)](https://www.kaggle.com/datasets/mvieira101/global-cost-of-living). These are the **same kind of Numbeo-derived CSV we already parse** → near drop-in swap in `build-dataset.ts` for **city-level** coverage. ⚠️ Check each dataset's license before shipping publicly (several are crowdsourced/Numbeo-derived).
- **Numbeo API** — fresh + true city-level, but **paid** ($50–500/mo; cost estimator ~$260/mo — [pricing](https://www.numbeo.com/common/api.jsp)). Only worth it if monetizing.

### Recommended sequencing (cheapest → most effort)
1. **Transport → distance bands (A)** — immediate, free, biggest realism win.
2. **Costs → World Bank CPI inflation-adjust (C)** — small build-step change; keeps existing city coverage; honest "adjusted to 2024" label.
3. **Costs → refresh base data (D)** — swap to an updated Kaggle 2024–25 CSV for city-level and/or layer WhereNext for country-level (with attribution).
4. **Later → Travelpayouts enrichment (B)** behind the provider seam (+ affiliate revenue).

### Licensing note (matters for a public product)
World Bank = open. WhereNext = **CC BY 4.0 (attribution required)**. Kaggle datasets = **varies, verify each**. Numbeo = paid/commercial. Add a "Data sources" credit in the UI/README when shipping.

## Gotchas & things to know

- **The baked JSON is committed; `npm run build` does not need the CSVs.** Regenerate only when refreshing
  data via `npm run build:data` (needs `worker/data/*.csv`, which are gitignored).
- **Dev port:** defaults to 3000; during this session I used `PORT=3100` to avoid clashes.
- **`server-only`** guards `repository.ts` so the ~1.4 MB dataset never enters the client bundle.
- **Permission mode is now `bypassPermissions` for this project** (set in `.claude/settings.json`). In a
  new session Claude will **not prompt before any action**, including the destructive Phase 3 deletions.
  Two cautions: (1) `.claude/settings.json` is **not gitignored**, so this would be committed and apply to
  anyone who clones this public repo — consider moving it to `.claude/settings.local.json` + gitignoring,
  or gitignoring `.claude/`; (2) the safety net for destructive steps is off.
- **Plan & memory:** the full approved plan is at `~/.claude/plans/generate-a-plan-on-resilient-balloon.md`;
  a project memory (`ts-migration-state`) also records this state.

---

## Suggested first moves in a new chat

1. Read this file + `CLAUDE.md` + the plan file above.
2. `cd web && npm install && npm test && npm run build` — confirm everything is still green.
3. Decide: commit Phases 1–2 first (recommended), then proceed with Phase 3.
4. Do **3a** (non-destructive) first; confirm intent before **3b** (deletions + deploy), even though
   bypass mode means Claude won't auto-prompt.
