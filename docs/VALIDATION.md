# Validation

What was checked, against what, with which tolerances, and what the checks do **not** establish.

## 1. Pass predictions vs. an independent implementation (PyEphem)

**Reference.** PyEphem 4.2 (`ephem`), built on XEphem's `libastro`. It has its own SGP4/SDP4 code
and its own Earth-rotation and topocentric transformation, sharing no code with Skyfield or the
`sgp4` package.

**Method.** For 10 spacecraft × 3 sites (Kolkata, London, Sydney), 24-hour window, 10° threshold,
Above Us computes passes with Skyfield. For every complete pass the reference is evaluated at
Skyfield's rise, culmination and set times with refraction off, and the reference's own elevation
maximum is located on a 0.25–0.5 s grid around the culmination.

**Results** (reproduce with `python -m scripts.validate_reference`):

Bundled capture of 2026-11-11T11:15Z — 126 complete passes:

| NORAD | Object | Passes | max Δ elevation at peak | max Δ elevation at rise/set | max Δ peak time | max Δ range |
|---|---|---|---|---|---|---|
| 5 | Vanguard 1 | 11 | 0.002° | 0.010° | 0.25 s | 0.08 km |
| 22 | Explorer 7 | 12 | 0.011° | 0.013° | 0.00 s | 0.08 km |
| 29 | TIROS 1 | 14 | 0.006° | 0.005° | 0.00 s | 0.06 km |
| 340 | Telstar 1 | 15 | 0.002° | 0.007° | 0.25 s | 0.10 km |
| 503 | Relay 1 | 13 | 0.002° | 0.012° | 0.50 s | 0.09 km |
| 8820 | LAGEOS 1 | 16 | 0.016° | 0.010° | 0.25 s | 0.83 km |
| 13777 | IRAS | 14 | 0.005° | 0.013° | 0.00 s | 0.09 km |
| 20580 | Hubble | 10 | 0.005° | 0.004° | 0.00 s | 0.07 km |
| 25544 | ISS | 11 | 0.010° | 0.019° | 0.00 s | 0.07 km |
| 27386 | Envisat | 11 | 0.006° | 0.016° | 0.00 s | 0.09 km |
| | **All** | **126** | **0.016°** | **0.019°** | **0.50 s** | **0.83 km** |

Elements fetched live from CelesTrak by a running server (2026-11-11, 127 complete passes):
worst case 0.016° at peak, 0.021° at rise/set, 0.50 s in peak time, 0.83 km in range.

**Tolerances enforced in the test suite** (`backend/tests/test_validation_reference.py`):
0.05° elevation, 2 s culmination time, 2 km range, 0.1° great-circle azimuth. The reference must
also agree that Vanguard 1 never reaches 10° over London (the negative case).

## 2. Propagator vs. published reference vectors

The `sgp4` package ships the verification TLEs and expected state vectors from Vallado, Crawford,
Hujsak & Kelso, *Revisiting Spacetrack Report #3* (AIAA 2006-6753). The test propagates every
verification object and requires positions to match the published output to better than 1 m
(more than 400 state vectors).

## 3. Browser visualisation vs. backend

The globe uses `satellite.js`. `frontend/src/lib/orbit.test.ts` compares its sub-satellite points
with Skyfield's for 7 spacecraft × 5 instants (LEO, MEO, eccentric and geosynchronous orbits).
Required agreement: 0.05° in latitude and longitude, 1.5 km in height. The fixture is generated
by the backend from the bundled capture.

## 4. Catalogue cross-checks

- Every curated launch date must equal the CelesTrak SATCAT launch date (36 records, 0 mismatches).
- Every curated "re-entered" status must agree with SATCAT's decay field, and vice versa.

## 5. Solar geometry

The low-precision Sun model is checked against calendar facts: Sun at the zenith on the equator
at the March 2026 equinox, at 23.44° N at the June solstice, below −12° at 80° N in December.

## What this does not establish

- **These are software-vs-software comparisons using the same element sets.** They show the
  calculation is implemented correctly. They say nothing about how well the element sets
  themselves describe the real orbit, which is the dominant error source.
- **No comparison with an external pass-prediction service has been made.** Heavens-Above and
  N2YO (named in the brief as references) were not reachable from the build environment. A manual
  spot-check of 3–5 passes against one of them is the recommended next step before a demo.
- **No observations.** Nothing here has been compared with the sky.
- **Narrative text is unverified.** Mission stories are an editorial draft; only dates and status
  are machine-checked. NSSDCA links are built from the international designator and were not
  fetched during the build.
