# Above Us — the oldest thing above you

Team Cosmic Compass · AARIVYN IGNITE 1.0

Pick a city. Above Us predicts which historic spacecraft pass over it, ranks them by launch date,
and tells the story of the oldest one — with sources, orbital-data timestamps and stated limits.

> A predicted pass is geometry. It does not mean the spacecraft will be visible.

- **Architecture and plan:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Validation results:** [docs/VALIDATION.md](docs/VALIDATION.md)

## What is real, what is archived, what is not done

| Area | State |
|---|---|
| Orbital elements + catalogue | Refreshed from CelesTrak (GP per object, SATCAT daily), cached in SQLite with retrieval time and element epoch on every result; the application distinguishes live, mixed, and archived datasets |
| Pass prediction | **Real**: Skyfield `find_events` on SGP4/SDP4, WGS84 observer |
| Candidate set | `heritage-v1`: the 120 earliest-launched on-orbit payloads + curated spacecraft (130 objects today). Rocket bodies and debris are **not** searched |
| Bundled snapshot | A **real CelesTrak capture** (2026-11-11) used to seed an empty database, for tests and offline demos. Always labelled "archived/demonstration" in the UI; never presented as live |
| Mock data | **None** in the application. One fake HTTP transport exists in `backend/tests/test_celestrak.py` |
| Mission stories | 36 curated records. **Editorial draft**: dates and status are machine-checked against SATCAT; narrative sentences have not been reviewed against the linked sources |
| City search | Bundled list of 77 cities (hand-compiled coordinates) + exact coordinates. No geocoding service |
| Illumination labels | Low-precision Sun + cylindrical shadow. Context only; no brightness or visibility estimate |
| External reference check | Done against PyEphem and Vallado vectors. **Not done** against Heavens-Above/N2YO |
| Classroom activities | Four **draft** prompts, untested with users |
| Accounts, subscriptions, saved activities, museum widgets | Not built (business roadmap items) |

## Run it

Requirements: Python ≥ 3.11, Node ≥ 20.

```bash
make install     # backend venv + frontend packages
make dev         # API on :8000 (live CelesTrak), web on :3000
```

Or by hand:

```bash
cd backend && python -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/uvicorn app.main:app --port 8000
```

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000. On first start the API seeds itself from the bundled snapshot (the UI
shows the "Demonstration data" banner). In the default `live` mode, new requests use today's date
and archived elements may be excluded as stale. The backend refreshes from CelesTrak in the background, one object
per second. A partial refresh is labelled **Mixed sources** until archived records have been replaced.
Each result retains its own data-source label and element epoch.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `ABOVEUS_DATA_MODE` | `live` | `snapshot` never contacts CelesTrak and predicts for the capture period |
| `ABOVEUS_DB_PATH` | `var/aboveus.sqlite3` | SQLite cache location |
| `ABOVEUS_CORS_ORIGINS` | localhost:3000 | comma-separated origins |
| `ABOVEUS_API_URL` (frontend) | `http://127.0.0.1:8000` | where Next.js proxies `/api/*` |

## Test it

```bash
make check       # lint + types + unit/integration tests (backend and frontend)
make e2e         # Playwright against the real stack in snapshot mode
make test-live   # two tests that call celestrak.org
```

| Suite | Count | What it covers |
|---|---|---|
| `backend/tests` | 87 | candidate selection, CelesTrak client (retry, no-GP, validation), pass engine, eligibility and ranking, API contracts and error envelope, PyEphem + Vallado reference validation |
| `backend/tests -m live` | 2 | real CelesTrak fetch + propagation |
| `frontend` vitest | 54 | formatting, orbit maths, satellite.js vs Skyfield cross-check, components |
| `frontend/e2e` | 29 | home globe, discovery, error/empty states, history, graveyard, explorer, method, mobile layout, a11y basics |

## Repository layout

```
backend/
  app/
    main.py        app factory, error envelope, lifecycle
    api.py         routes
    models.py      Pydantic API contracts (source of the TypeScript types)
    discovery.py   eligibility pipeline + launch-date ranking
    passes.py      Skyfield/SGP4 pass engine
    sun.py         illumination context
    catalog.py     candidate set, snapshot seed, background refresh
    celestrak.py   HTTP client
    db.py          SQLite schema and access
    stories.py     curated-record loader
    data/          stories.json, cities.json, snapshot/snapshot.json
  scripts/         build_snapshot, export_openapi, validate_reference
  tests/
frontend/
  src/app/         routes: /, /discover, /satellites/[id], /graveyard, /explore, /methodology
  src/components/  globe (three.js), discover, history, graveyard, explore
  src/lib/         typed API client, generated schema, orbit maths, formatting
  e2e/             Playwright
docs/
```

Regenerate API types after changing `models.py`:

```bash
cd backend && .venv/bin/python -m scripts.export_openapi ../frontend/src/lib/api/openapi.json
cd ../frontend && npm run gen:api
```

## Being a good CelesTrak citizen

GP element sets are re-requested at most every 6 hours per object (CelesTrak's floor is 2 hours),
sequentially, one per second. SATCAT is fetched once a day. After repeated upstream failures the
refresher backs off for an hour and keeps serving the last good data with its age shown.

## Data credits

Orbital elements and SATCAT: [CelesTrak](https://celestrak.org) (Dr T. S. Kelso). Coastlines:
Natural Earth via `world-atlas` (public domain). Propagation: `sgp4`, Skyfield (Brandon Rhodes).
