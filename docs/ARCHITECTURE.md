# Above Us — Architecture & Development Plan

Team Cosmic Compass · AARIVYN IGNITE 1.0 · "The Oldest Thing Above You"

## 1. Requirements extracted from the brief

Both attached decks carry the same content. What they actually commit to:

| # | Requirement | Source slide | Where it lives |
|---|---|---|---|
| R1 | City + observation window (24 h default) as the entry point | 2, 4, 5 | `/discover`, `POST /api/v1/discover` |
| R2 | Observer-relative pass prediction with Skyfield / SGP4 on CelesTrak GP data | 4, 6 | `backend/app/passes.py` |
| R3 | Pass rules: location, window, elevation, valid data | 5, 6 | `backend/app/discovery.py` |
| R4 | Rank eligible objects by launch date; "earliest launch among eligible candidates **in our searched dataset**" | 4, 5 | `discovery.py`, declared candidate set |
| R5 | Sourced mission stories: mission, country, status, history, sources | 4, 5 | `backend/app/data/stories.json`, `/satellites/[id]` |
| R6 | Space Graveyard: secondary archive for inactive and ended missions | 5 | `/graveyard` |
| R7 | Cache + source freshness: orbital epoch + retrieval time on every result | 4, 6 | SQLite cache, `Provenance` on every response |
| R8 | Declared candidate set and calculation settings shown to the user | 6 | `methodology` block in every discovery response |
| R9 | "Predicted passage does not guarantee optical visibility" | 4, 5 | `limitations` in API + persistent UI notices |
| R10 | Validation: compare sample passes with a trusted reference | 6 | `backend/tests/test_validation_*.py`, `docs/VALIDATION.md` |
| R11 | Audience: school students, teachers, astronomy clubs, curious public → plain language, classroom use | 2, 8 | `/explore` Educational Explorer |
| R12 | Year-1 target: pass engine + 25 curated records | 9 | 36 curated records shipped |
| R13 | Stack: Next.js → FastAPI → CelesTrak → Skyfield/SGP4 | 6 | this repo |

Out of scope (business slides 7–9): subscriptions, dashboards for schools, museum widgets, a public
educational API product. The REST API here is documented (OpenAPI) but not hardened as a product.

## 2. System overview

```
Browser (Next.js 15, React 19, TypeScript, three.js)
  │  typed fetch (types generated from OpenAPI)
  ▼
Next.js server ── rewrites /api/* ──▶ FastAPI (Python 3.13)
                                        ├─ routes        app/api.py
                                        ├─ discovery     eligibility + launch-date ranking
                                        ├─ pass engine   Skyfield find_events on SGP4
                                        ├─ sun model     illumination context (low-precision)
                                        ├─ catalog       candidate-set selection + refresh
                                        ├─ celestrak     polite HTTP client (retry, throttle)
                                        ├─ stories       curated, version-controlled JSON
                                        └─ SQLite        SATCAT rows, GP elements, fetch log
                                              ▲
                              CelesTrak ──────┘  satcat.csv (daily) · gp.php?CATNR= (≥ 6 h)
```

The 3D globe animates orbits **in the browser** with `satellite.js` (an independent SGP4
implementation) from the same element sets the API returns. It is a visualisation; every
number shown as a prediction (pass times, elevations) comes from the Skyfield backend.

## 3. Candidate-selection methodology (the "declared candidate set")

The honest version of "the oldest thing above you" is "the earliest-launched object, among a
stated set, with a predicted pass". The set is declared, versioned and returned by the API.

**Set `heritage-v1`** is rebuilt whenever SATCAT is refreshed:

1. Take CelesTrak SATCAT. Keep rows that are `OBJECT_TYPE = PAY`, Earth-centred, `ORBIT_TYPE = ORB`,
   and have no decay date.
2. Sort by `LAUNCH_DATE` ascending (tie-break: NORAD ID). Take the first **120** → reason `oldest_payload`.
3. Add every on-orbit object that has a curated story (e.g. LAGEOS 1, Hubble, ISS, Envisat) → reason `curated`.

Rocket bodies and debris are **excluded in v1**. That is a real limitation: Vanguard 1's own
upper stage (NORAD 16) shares its launch date and is not searched. The UI says "spacecraft", and
the methodology panel states the exclusion.

**Eligibility pipeline** (per object, in order; first failure is the reported exclusion reason):

| Check | Rule | Exclusion code |
|---|---|---|
| Elements exist | CelesTrak returned a GP element set | `no_elements` |
| Elements are current | `|window start − element epoch| ≤ 30 days` | `stale_elements` |
| Propagation valid | SGP4 returns no error across the window | `propagation_error` |
| Pass exists | ≥ 1 pass whose culmination is ≥ the elevation threshold, inside the window | `no_pass` |

**Ranking**: eligible objects sorted by SATCAT launch date ascending, tie-break NORAD ID.
The launch date is labelled `satcat+curated` when the curated record's independently entered
date agrees with SATCAT, `satcat` when only SATCAT is available, and a mismatch fails the test suite.

**Pass definition**: Skyfield `find_events(observer, t0, t1, altitude_degrees=threshold)`.
Rise and set are crossings of the threshold elevation (default 10°), not of the horizon.
Passes truncated by the window edge are kept and flagged `partial`. Elevation is geometric
(no atmospheric refraction).

**Illumination context** (not a visibility claim): at culmination we compute the Sun's altitude at
the observer and whether the satellite is inside Earth's cylindrical shadow, using a low-precision
solar position (≈0.01°). This yields `dark_sky_sunlit`, `twilight_sunlit`, `daylight`, or
`eclipsed`. It deliberately stops there: no magnitude estimate, no weather, no light pollution.

## 4. Data model (SQLite)

```sql
satcat(norad_id PK, name, cospar_id, object_type, ops_status, owner, launch_date, launch_site,
       decay_date, period_min, inclination_deg, apogee_km, perigee_km, orbit_center, orbit_type,
       source, source_url, retrieved_at)
gp_elements(norad_id PK, epoch, omm_json, source, source_url, retrieved_at)
gp_missing(norad_id PK, detail, source, checked_at)       -- CelesTrak answered "no GP data"
candidate_set(norad_id PK, reason, rank)
fetch_log(id PK, resource, url, ok, status, detail, started_at, duration_ms)
meta(key PK, value)                                       -- set version, snapshot manifest, refresh state
```

`source` is `live` (fetched by this server from CelesTrak) or `snapshot` (bundled capture, see §6).
Curated stories and the city gazetteer are version-controlled JSON, validated by Pydantic at
startup — content is reviewed in pull requests, not edited in a database.

## 5. API (FastAPI, `/api/v1`, OpenAPI at `/docs`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/status` | data mode, freshness, refresh state, default window start |
| GET | `/cities?q=` | bundled gazetteer search |
| POST | `/discover` | the core query: ranked eligible objects + exclusions + methodology |
| GET | `/satellites` | the declared candidate set with element freshness |
| GET | `/satellites/{norad_id}` | SATCAT record, elements (OMM + TLE), story, sources |
| GET | `/satellites/{norad_id}/passes` | passes of one object for an observer |
| GET | `/graveyard` | inactive and ended missions |
| GET | `/methodology` | rules, thresholds, limitations as data |

Every payload that contains orbital data carries `Provenance { source, source_url, retrieved_at,
element_epoch, element_age_days, freshness }`. TypeScript types are generated from the OpenAPI
schema (`npm run gen:api`), so the contract cannot drift silently.

## 6. Caching strategy and live vs. snapshot data

| Resource | Upstream | TTL | Notes |
|---|---|---|---|
| SATCAT | `celestrak.org/pub/satcat.csv` | 24 h | one request; candidate set rebuilt after refresh |
| GP elements | `celestrak.org/NORAD/elements/gp.php?CATNR=n&FORMAT=JSON` | 6 h (CelesTrak's stated minimum is 2 h) | sequential, 1 s spacing, 3 retries with backoff; 1 h cool-down after repeated failures |
| Discovery results | computed | 10 min, in-memory | keyed on rounded location, window, threshold, aggregate data mode, data revision |

On upstream failure the last good row is served and its age is shown; nothing is invented.

**Per-record data sources and aggregate status:**

- **live** — fetched from CelesTrak by this server; `retrieved_at` is the fetch time.
- **snapshot** — a real CelesTrak capture committed to the repo (`backend/app/data/snapshot/`),
  used to seed an empty database and for tests/demos (`ABOVEUS_DATA_MODE=snapshot`). It is genuine
  orbital data, but frozen: in snapshot mode the default prediction window starts at the capture
  time and the UI shows a "Demonstration — archived data" banner. As the snapshot ages past 30
  days, objects drop out as `stale_elements` rather than being propagated beyond their validity.
- **mock** — none in the application. Test doubles exist only under `tests/` (a fake HTTP transport
  for the CelesTrak client).
- **mixed (aggregate status)** — some candidate elements have been fetched live and others still
  come from the archive. The dashboard and discovery results show this explicitly, while each
  candidate's provenance continues to identify the underlying source and epoch.

## 7. Frontend

Next.js App Router, strict TypeScript, hand-written CSS (design tokens, no dashboard kit), three.js.

| Route | Experience |
|---|---|
| `/` | Cinematic hero: interactive Earth, real orbits of heritage spacecraft, pick one to read its story; city search |
| `/discover` | City + window + threshold → the oldest eligible spacecraft, ranked list, pass sky-charts, exclusions, methodology |
| `/satellites/[id]` | Satellite History: story, timeline, orbit, sources, element freshness |
| `/graveyard` | Space Graveyard: silent-but-orbiting vs. re-entered missions on a timeline |
| `/explore` | Educational Explorer: orbit-period lab, element-set decoder, prediction-drift and pass-geometry explainers, classroom prompts |
| `/methodology` | How it works, what it cannot tell you, sources |

Accessibility: the globe is a progressive enhancement — every selectable satellite is also a real
button in a list; animation has pause/speed controls and honours `prefers-reduced-motion`; colour
is never the only signal; all times are shown in UTC and city-local time.

## 8. Assumptions

- "Verified launch date" means the SATCAT launch date (UTC), cross-checked against the curated record.
- A "city" is a point (city-centre coordinates, sea-level). A few km of offset moves pass times by seconds.
- Curated narratives are an editorial draft written for this build and linked to NASA NSSDCA and
  CelesTrak records. Launch dates, decay dates and status are machine-checked against SATCAT; the
  narrative sentences still need a human editorial pass against the linked sources (flagged in the UI).

## 9. Technical risks

| Risk | Mitigation |
|---|---|
| SGP4 accuracy decays with element age (km/day for LEO) | 30-day hard cut-off, freshness badge, epoch shown on every result |
| CelesTrak rate limits / outages | TTLs at or above CelesTrak guidance, throttled sequential fetch, cache-first serving, snapshot seed |
| Some old objects have no public GP data | reported as `no_elements`, counted in the exclusion summary |
| "Oldest" depends on the candidate set | set is declared, versioned, and shown; wording is "among the spacecraft we searched" |
| Users read "pass" as "you will see it" | persistent limitation notice, illumination context, no magnitude claims |
| WebGL unavailable | list-based selection and all data work without the canvas |
| Single SQLite file | sufficient for a read-heavy cache; swap for Postgres behind `db.py` if multi-instance |

## 10. Development plan (vertical slices, each validated before the next)

1. **Data slice** — CelesTrak client, SQLite cache, candidate set, snapshot capture. *Check:* unit tests, real fetch.
2. **Science slice** — pass engine, illumination, eligibility, ranking. *Check:* unit tests + independent reference comparison (PyEphem, Vallado SGP4 vectors).
3. **API slice** — typed contracts, error model, OpenAPI export. *Check:* integration tests.
4. **Discovery UI slice** — city → ranked result → sources. *Check:* type-check, component tests, e2e.
5. **Globe + home slice** — 3D Earth, orbits, selection. *Check:* e2e render + cross-check of browser vs. backend positions.
6. **History, Graveyard, Explorer, Methodology slices.** *Check:* e2e.
7. **Hardening** — lint, type-check, production build, full test run against live data.
