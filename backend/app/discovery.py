"""Eligibility filtering and launch-date ranking — the core of "the oldest thing above you"."""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta

from . import config
from .db import Database, GpRow, SatcatRow, parse_iso
from .models import (
    Candidate,
    DiscoverRequest,
    DiscoverResponse,
    Elements,
    Exclusion,
    Methodology,
    PassModel,
    PassPointModel,
    Provenance,
    SatelliteSummary,
    SourceLink,
    TrackPoint,
)
from .passes import (
    Observer,
    Pass,
    PropagationError,
    compass,
    find_passes,
    satellite_from_omm,
    tle_lines,
)
from .stories import FATE_LABELS, nssdca_url, stories_by_id

MU_EARTH = 398600.4418  # km^3/s^2
EARTH_RADIUS_KM = 6378.137

LIMITATIONS = [
    "A predicted pass is a statement about geometry. It does not mean the object will be "
    "visible: most of these spacecraft are small and faint, and many need a telescope.",
    "Weather, moonlight, light pollution and the object's brightness are not modelled.",
    "Predictions use SGP4 with publicly released element sets. Accuracy degrades with element "
    "age; times can be off by seconds for fresh elements and by minutes for older ones.",
    "\"Oldest\" means the earliest launch date among the declared candidate set with a "
    "qualifying pass — not among everything in orbit. Rocket bodies and debris are not searched.",
    "Rise and set are crossings of the elevation threshold, not of the true horizon. Elevation "
    "is geometric, with no correction for atmospheric refraction.",
]

EXCLUSION_TEXT = {
    "no_elements": "CelesTrak publishes no GP element set for this object, so no pass can be "
                   "computed.",
    "stale_elements": f"The newest element set is more than {config.MAX_ELEMENT_AGE_DAYS:.0f} "
                      "days from the window start; propagating it would not be trustworthy.",
    "propagation_error": "SGP4 reported an error while propagating this object.",
    "no_pass": "No pass reaches the elevation threshold inside the window.",
}

ILLUMINATION_TEXT = {
    "dark_sky_sunlit": "Dark sky, satellite in sunlight — the geometry optical observers look for",
    "twilight_sunlit": "Twilight sky, satellite in sunlight",
    "daylight": "Daylight at the observer",
    "eclipsed": "Satellite in Earth's shadow",
}

OPS_STATUS = {
    "+": "Operational", "-": "Non-operational", "P": "Partially operational",
    "B": "Backup / standby", "S": "Spare", "X": "Extended mission", "D": "Decayed",
    "?": "Unknown", "": "No status recorded",
}

COUNTRIES = {
    "US": "United States", "CIS": "USSR / Russia", "CA": "Canada", "FR": "France",
    "UK": "United Kingdom", "PRC": "China", "IND": "India", "JPN": "Japan", "ESA": "Europe (ESA)",
    "ISS": "International", "GER": "Germany", "IT": "Italy", "AUS": "Australia",
    "ESRO": "Europe (ESRO)", "NATO": "NATO", "ITSO": "Intelsat", "FGER": "France / Germany",
}

SOURCES_COMMON = [
    SourceLink(title="GP orbital element sets", publisher="CelesTrak",
               url="https://celestrak.org/NORAD/documentation/gp-data-formats.php",
               kind="orbital_data"),
    SourceLink(title="Satellite Catalog (SATCAT)", publisher="CelesTrak",
               url="https://celestrak.org/satcat/", kind="catalogue"),
]


def describe_methodology(candidate_count: int, min_elevation: float, hours: float) -> Methodology:
    return Methodology(
        candidate_set_version=config.CANDIDATE_SET_VERSION,
        candidate_set_description=(
            f"The {config.OLDEST_PAYLOAD_COUNT} earliest-launched payloads that CelesTrak SATCAT "
            "lists as still in Earth orbit, plus every on-orbit spacecraft with a curated story. "
            "Rocket bodies and debris are not included."),
        candidate_count=candidate_count,
        eligibility_rules=[
            "A GP element set is available from CelesTrak.",
            f"The element epoch is within {config.MAX_ELEMENT_AGE_DAYS:.0f} days of the window "
            "start.",
            "SGP4 propagates the object across the window without error.",
            f"At least one pass culminates at or above {min_elevation:g}° elevation inside the "
            f"{hours:g}-hour window.",
        ],
        ranking_rule="Eligible objects are ordered by SATCAT launch date, earliest first; ties "
                     "are broken by catalogue number.",
        pass_definition="An interval in which geometric elevation at the observer is at or above "
                        "the threshold (Skyfield find_events). Passes cut by the window edge are "
                        "kept and flagged as partial.",
        propagator="SGP4/SDP4 (sgp4 library) via Skyfield, WGS84 observer, built-in timescale.",
        max_element_age_days=config.MAX_ELEMENT_AGE_DAYS,
        min_elevation_deg=min_elevation,
        window_hours=hours,
    )


def freshness(age_days: float) -> str:
    a = abs(age_days)
    return "fresh" if a <= config.FRESH_DAYS else "aging" if a <= config.MAX_ELEMENT_AGE_DAYS \
        else "stale"


def provenance(gp: GpRow, reference: datetime) -> Provenance:
    epoch = parse_iso(gp.epoch)
    age = (reference - epoch).total_seconds() / 86400
    return Provenance(source=gp.source, source_url=gp.source_url,  # type: ignore[arg-type]
                      retrieved_at=parse_iso(gp.retrieved_at), element_epoch=epoch,
                      element_age_days=round(age, 3), freshness=freshness(age))  # type: ignore[arg-type]


ACRONYMS = {"TIROS", "MIDAS", "SECOR", "GGSE", "TRAAC", "ANNA", "SOLRAD", "GREB", "OSCAR"}


def pretty_name(name: str) -> str:
    """Title-case catalogue names for display, keeping designators and acronyms intact."""
    return " ".join(w if any(c.isdigit() for c in w) or len(w) <= 3 or "(" in w or "/" in w
                    or w in ACRONYMS else w.capitalize() for w in name.split())


def summarize(row: SatcatRow, set_reasons: dict[int, str]) -> SatelliteSummary:
    story = stories_by_id().get(row.norad_id)
    if story is None:
        verification = "satcat"
        fate = "unknown" if row.on_orbit else "reentered"
    else:
        verification = "satcat+curated" if story.launch_date == row.launch_date else "mismatch"
        fate = story.fate
    fate_label = FATE_LABELS.get(fate) or (
        "In orbit; operating status not curated" if row.on_orbit else FATE_LABELS["reentered"])
    return SatelliteSummary(
        norad_id=row.norad_id, name=row.name,
        display_name=story.title if story else pretty_name(row.name),
        cospar_id=row.cospar_id, object_type=row.object_type, owner_code=row.owner,
        country=story.country if story else COUNTRIES.get(row.owner, row.owner or "Unknown"),
        launch_date=row.launch_date, launch_year=int(row.launch_date[:4]),
        launch_date_verification=verification,  # type: ignore[arg-type]
        decay_date=row.decay_date, on_orbit=row.on_orbit, ops_status_code=row.ops_status,
        ops_status_label=OPS_STATUS.get(row.ops_status, row.ops_status),
        period_min=row.period_min, inclination_deg=row.inclination_deg,
        apogee_km=row.apogee_km, perigee_km=row.perigee_km,
        has_story=story is not None, tagline=story.tagline if story else None,
        fate=fate, fate_label=fate_label,  # type: ignore[arg-type]
        in_candidate_set=row.norad_id in set_reasons,
        set_reason=set_reasons.get(row.norad_id),  # type: ignore[arg-type]
        catalogue_source=row.source,  # type: ignore[arg-type]
        catalogue_retrieved_at=parse_iso(row.retrieved_at),
    )


def elements_model(gp: GpRow, reference: datetime) -> Elements:
    omm = gp.omm
    n = float(omm["MEAN_MOTION"]) * 2 * math.pi / 86400  # rad/s
    a = (MU_EARTH / n ** 2) ** (1 / 3)
    e = float(omm["ECCENTRICITY"])
    lines = None
    try:
        lines = tle_lines(satellite_from_omm(omm))
    except PropagationError:
        pass
    return Elements(
        omm=omm, tle_line1=lines[0] if lines else None, tle_line2=lines[1] if lines else None,
        provenance=provenance(gp, reference), semi_major_axis_km=round(a, 1),
        period_min=round(1440 / float(omm["MEAN_MOTION"]), 2),
        apogee_km=round(a * (1 + e) - EARTH_RADIUS_KM, 1),
        perigee_km=round(a * (1 - e) - EARTH_RADIUS_KM, 1),
        inclination_deg=float(omm["INCLINATION"]), eccentricity=e,
    )


def satellite_sources(row: SatcatRow, has_elements: bool) -> list[SourceLink]:
    out = [
        SourceLink(title=f"SATCAT record for {row.cospar_id} (launch date, owner, status)",
                   publisher="CelesTrak", url=config.satcat_record_url(row.norad_id),
                   kind="catalogue"),
        SourceLink(title=f"NSSDCA Master Catalog entry {row.cospar_id}",
                   publisher="NASA Space Science Data Coordinated Archive",
                   url=nssdca_url(row.cospar_id), kind="mission_record",
                   note="Link built from the international designator; NSSDCA does not hold an "
                        "entry for every object."),
    ]
    if has_elements:
        out.insert(0, SourceLink(title="Current GP element set (OMM/JSON)", publisher="CelesTrak",
                                 url=config.gp_url(row.norad_id), kind="orbital_data"))
    return out


def pass_model(p: Pass) -> PassModel:
    def pt(x) -> PassPointModel:
        return PassPointModel(time=x.time, azimuth_deg=round(x.azimuth_deg, 2),
                              elevation_deg=round(x.elevation_deg, 2),
                              compass=compass(x.azimuth_deg))
    return PassModel(
        start=pt(p.start), culmination=pt(p.culmination), end=pt(p.end),
        duration_s=round(p.duration_s, 1), starts_before_window=p.starts_before_window,
        ends_after_window=p.ends_after_window, range_km=round(p.range_km, 1),
        sun_altitude_deg=round(p.sun_altitude_deg, 1), satellite_sunlit=p.satellite_sunlit,
        illumination=p.illumination,  # type: ignore[arg-type]
        illumination_label=ILLUMINATION_TEXT[p.illumination],
        track=[TrackPoint(time=t.time, azimuth_deg=round(t.azimuth_deg, 2),
                          elevation_deg=round(t.elevation_deg, 2)) for t in p.track],
    )


@dataclass
class Evaluation:
    passes: list[Pass] | None
    reason: str | None
    detail: str | None


def evaluate(gp: GpRow | None, missing_detail: str | None, observer: Observer, start: datetime,
             end: datetime, min_elevation: float, track_points: int = 0) -> Evaluation:
    """Run the eligibility pipeline for one object. First failing rule wins."""
    if gp is None:
        return Evaluation(None, "no_elements",
                          missing_detail or "No element set has been retrieved yet.")
    age = (start - parse_iso(gp.epoch)).total_seconds() / 86400
    if abs(age) > config.MAX_ELEMENT_AGE_DAYS:
        return Evaluation(None, "stale_elements",
                          f"Element epoch {gp.epoch[:10]} is {abs(age):.0f} days from the window "
                          "start.")
    try:
        sat = satellite_from_omm(gp.omm)
        passes = find_passes(sat, observer, start, end, min_elevation, track_points)
    except PropagationError as exc:
        return Evaluation(None, "propagation_error", str(exc))
    if not passes:
        return Evaluation([], "no_pass", EXCLUSION_TEXT["no_pass"])
    return Evaluation(passes, None, None)


def discover(db: Database, req: DiscoverRequest, start: datetime, data_mode: str,
             generated_at: datetime) -> DiscoverResponse:
    end = start + timedelta(hours=req.hours)
    observer = Observer(req.observer.latitude_deg, req.observer.longitude_deg,
                        req.observer.elevation_m)
    candidates = db.candidate_set()
    reasons = {nid: reason for nid, reason, _ in candidates}
    gp_all, missing = db.all_gp(), db.gp_missing()

    eligible: list[tuple[SatcatRow, GpRow, list[Pass]]] = []
    excluded: list[Exclusion] = []
    for nid, _, _ in candidates:
        row = db.get_satcat(nid)
        if row is None:
            continue
        gp = gp_all.get(nid)
        ev = evaluate(gp, (missing.get(nid) or {}).get("detail"), observer, start, end,
                      req.min_elevation_deg, track_points=31)
        if ev.reason is None and gp is not None and ev.passes:
            eligible.append((row, gp, ev.passes))
        else:
            excluded.append(Exclusion(norad_id=nid, name=row.name, launch_date=row.launch_date,
                                      reason=ev.reason, detail=ev.detail or ""))  # type: ignore[arg-type]

    eligible.sort(key=lambda item: (item[0].launch_date, item[0].norad_id))
    ranked = [
        Candidate(rank=i + 1, satellite=summarize(row, reasons),
                  provenance=provenance(gp, start), pass_count=len(passes),
                  highest_elevation_deg=round(max(p.culmination.elevation_deg for p in passes), 2),
                  passes=[pass_model(p) for p in passes])
        for i, (row, gp, passes) in enumerate(eligible)
    ]
    counts: dict[str, int] = {}
    for ex in excluded:
        counts[ex.reason] = counts.get(ex.reason, 0) + 1
    excluded.sort(key=lambda e: (e.launch_date, e.norad_id))
    return DiscoverResponse(
        generated_at=generated_at, data_mode=data_mode,  # type: ignore[arg-type]
        observer=req.observer, window_start=start, window_end=end,
        min_elevation_deg=req.min_elevation_deg, oldest=ranked[0] if ranked else None,
        candidates=ranked, excluded=excluded, exclusion_counts=counts,
        methodology=describe_methodology(len(candidates), req.min_elevation_deg, req.hours),
        limitations=LIMITATIONS, sources=SOURCES_COMMON,
    )
