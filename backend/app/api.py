"""HTTP routes. Handlers are sync so CPU-bound propagation runs in FastAPI's thread pool."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Query, Request

from . import cities, config
from .db import parse_iso, utcnow
from .discovery import (
    EXCLUSION_TEXT,
    ILLUMINATION_TEXT,
    LIMITATIONS,
    SOURCES_COMMON,
    describe_methodology,
    discover,
    elements_model,
    evaluate,
    pass_model,
    provenance,
    satellite_sources,
    summarize,
)
from .models import (
    CityList,
    DiscoverRequest,
    DiscoverResponse,
    ErrorResponse,
    GraveyardEntry,
    GraveyardResponse,
    MethodologyDoc,
    ObserverModel,
    PassesResponse,
    RefreshState,
    SatelliteDetail,
    SatelliteList,
    SatelliteListItem,
    Status,
    Story,
)
from .passes import Observer, PropagationError, satellite_from_omm, tle_lines
from .stories import load_stories, stories_by_id

router = APIRouter()
ERRORS: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse}, 422: {"model": ErrorResponse},
}

MODE_LABELS = {
    "live": "Live — available orbital elements retrieved from CelesTrak",
    "mixed": "Mixed — some elements refreshed; others still from the archived capture",
    "snapshot": "Demonstration — archived CelesTrak capture, not current data",
}


def _state(request: Request):
    return request.app.state.aboveus


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


def _reasons(db) -> dict[int, str]:
    return {nid: reason for nid, reason, _ in db.candidate_set()}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/status", response_model=Status)
def status(request: Request) -> Status:
    st = _state(request)
    db = st.db
    ids = [nid for nid, _, _ in db.candidate_set()]
    gp = {nid: g for nid, g in db.all_gp().items() if nid in ids}
    epochs = sorted(parse_iso(g.epoch) for g in gp.values())
    fetched = sorted(parse_iso(g.retrieved_at) for g in gp.values())
    snap = db.get_meta("snapshot_captured_at")
    satcat_at = db.get_meta("satcat_retrieved_at")
    mode = st.data_mode
    return Status(
        server_time=utcnow(), data_mode=mode, data_mode_label=MODE_LABELS[mode],
        default_window_start=st.reference_time(),
        snapshot_captured_at=parse_iso(snap) if snap else None,
        candidate_set_version=config.CANDIDATE_SET_VERSION, candidate_count=len(ids),
        elements_live=sum(g.source == "live" for g in gp.values()),
        elements_snapshot=sum(g.source == "snapshot" for g in gp.values()),
        elements_missing=len(ids) - len(gp),
        satcat_source=db.get_meta("satcat_source"),
        satcat_retrieved_at=parse_iso(satcat_at) if satcat_at else None,
        oldest_element_epoch=epochs[0] if epochs else None,
        newest_element_epoch=epochs[-1] if epochs else None,
        oldest_element_retrieval=fetched[0] if fetched else None,
        newest_element_retrieval=fetched[-1] if fetched else None,
        refresh=RefreshState(**st.refresh.state) if st.refresh else None,
    )


@router.get("/cities", response_model=CityList)
def list_cities(q: Annotated[str | None, Query(max_length=80)] = None) -> CityList:
    return CityList(items=cities.search(q), note=cities.note())


@router.post("/discover", response_model=DiscoverResponse, responses=ERRORS)
def post_discover(req: DiscoverRequest, request: Request) -> DiscoverResponse:
    st = _state(request)
    start = _as_utc(req.start) if req.start else st.reference_time()
    start = start.replace(microsecond=0)
    mode = st.data_mode
    key = ("discover", round(req.observer.latitude_deg, 3), round(req.observer.longitude_deg, 3),
           round(req.observer.elevation_m), req.observer.place_name, start, req.hours,
           req.min_elevation_deg, mode, st.db.revision())
    return st.cached(key, lambda: discover(st.db, req, start, mode, utcnow()))


@router.get("/satellites", response_model=SatelliteList)
def list_satellites(request: Request) -> SatelliteList:
    st = _state(request)
    db = st.db
    reference = st.reference_time()

    def build() -> SatelliteList:
        reasons = _reasons(db)
        gp_all = db.all_gp()
        items = []
        for nid in reasons:
            row = db.get_satcat(nid)
            if row is None:
                continue
            gp = gp_all.get(nid)
            lines = None
            if gp is not None:
                try:
                    lines = tle_lines(satellite_from_omm(gp.omm))
                except PropagationError:
                    lines = None
            items.append(SatelliteListItem(
                satellite=summarize(row, reasons),
                provenance=provenance(gp, reference) if gp else None,
                tle_line1=lines[0] if lines else None, tle_line2=lines[1] if lines else None))
        items.sort(key=lambda i: (i.satellite.launch_date, i.satellite.norad_id))
        return SatelliteList(reference_time=reference,
                             candidate_set_version=config.CANDIDATE_SET_VERSION, items=items)

    return st.cached(("satellites", reference, db.revision()), build)


def _row_or_404(db, norad_id: int):
    from .main import ApiError
    row = db.get_satcat(norad_id)
    if row is None:
        raise ApiError(404, "satellite_not_found",
                       f"NORAD {norad_id} is not in the Above Us dataset.")
    return row


@router.get("/satellites/{norad_id}", response_model=SatelliteDetail, responses=ERRORS)
def get_satellite(norad_id: int, request: Request) -> SatelliteDetail:
    st = _state(request)
    db = st.db
    row = _row_or_404(db, norad_id)
    gp = db.get_gp(norad_id)
    record = stories_by_id().get(norad_id)
    story = None
    if record is not None:
        story = Story(**record.model_dump(exclude={"norad_id", "launch_date", "fate"}),
                      editorial_status="draft", editorial_note=load_stories().editorial_note)
    reason = None
    if gp is None:
        if not row.on_orbit:
            reason = "This object is no longer in orbit, so there are no current elements."
        else:
            missing = db.gp_missing().get(norad_id)
            reason = (EXCLUSION_TEXT["no_elements"] if missing
                      else "No element set has been retrieved for this object.")
    return SatelliteDetail(
        satellite=summarize(row, _reasons(db)), story=story,
        elements=elements_model(gp, st.reference_time()) if gp else None,
        elements_unavailable_reason=reason,
        sources=satellite_sources(row, gp is not None), limitations=LIMITATIONS,
    )


@router.get("/satellites/{norad_id}/passes", response_model=PassesResponse, responses=ERRORS)
def get_passes(
    norad_id: int, request: Request,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
    elevation_m: Annotated[float, Query(ge=-500, le=9000)] = 0,
    start: datetime | None = None,
    hours: Annotated[float, Query(gt=0, le=config.MAX_WINDOW_HOURS)] = config.DEFAULT_WINDOW_HOURS,
    min_elevation_deg: Annotated[float, Query(ge=0, le=89)] = config.DEFAULT_MIN_ELEVATION_DEG,
) -> PassesResponse:
    st = _state(request)
    db = st.db
    row = _row_or_404(db, norad_id)
    t0 = (_as_utc(start) if start else st.reference_time()).replace(microsecond=0)
    t1 = t0 + timedelta(hours=hours)
    gp = db.get_gp(norad_id)
    missing = db.gp_missing().get(norad_id)
    ev = evaluate(gp, missing["detail"] if missing else None, Observer(lat, lon, elevation_m),
                  t0, t1, min_elevation_deg, track_points=31)
    return PassesResponse(
        generated_at=utcnow(), satellite=summarize(row, _reasons(db)),
        observer=ObserverModel(latitude_deg=lat, longitude_deg=lon, elevation_m=elevation_m),
        window_start=t0, window_end=t1, min_elevation_deg=min_elevation_deg,
        provenance=provenance(gp, t0) if gp else None,
        passes=[pass_model(p) for p in ev.passes or []],
        not_computed_reason=ev.reason, not_computed_detail=ev.detail,  # type: ignore[arg-type]
        limitations=LIMITATIONS,
    )


@router.get("/graveyard", response_model=GraveyardResponse)
def graveyard(request: Request) -> GraveyardResponse:
    st = _state(request)
    db = st.db
    reasons = _reasons(db)
    stories = stories_by_id()
    today = utcnow().date()
    orbiting: list[GraveyardEntry] = []
    reentered: list[GraveyardEntry] = []
    for row in db.all_satcat():
        summary = summarize(row, reasons)
        if summary.fate == "orbiting_active":
            continue
        story = stories.get(row.norad_id)
        launch = datetime.strptime(row.launch_date, "%Y-%m-%d").date()
        end = datetime.strptime(row.decay_date, "%Y-%m-%d").date() if row.decay_date else today
        entry = GraveyardEntry(satellite=summary, summary=story.summary if story else None,
                               last_contact=story.last_contact if story else None,
                               years_in_orbit=round((end - launch).days / 365.25, 2))
        (orbiting if row.on_orbit else reentered).append(entry)
    return GraveyardResponse(
        generated_at=utcnow(), still_orbiting=orbiting, reentered=reentered,
        note="Catalogue status comes from CelesTrak SATCAT. A blank operational status in SATCAT "
             "means 'not recorded', not 'working'; entries without a curated story are listed "
             "from the catalogue alone.",
    )


@router.get("/methodology", response_model=MethodologyDoc)
def methodology(request: Request) -> MethodologyDoc:
    st = _state(request)
    return MethodologyDoc(
        methodology=describe_methodology(len(st.db.candidate_set()),
                                         config.DEFAULT_MIN_ELEVATION_DEG,
                                         config.DEFAULT_WINDOW_HOURS),
        exclusion_reasons=EXCLUSION_TEXT, illumination_labels=ILLUMINATION_TEXT,
        freshness_rules={
            "fresh": f"Element epoch within {config.FRESH_DAYS:.0f} days of the window start.",
            "aging": f"Between {config.FRESH_DAYS:.0f} and {config.MAX_ELEMENT_AGE_DAYS:.0f} "
                     "days: still propagated, shown with a caution.",
            "stale": f"More than {config.MAX_ELEMENT_AGE_DAYS:.0f} days: not propagated.",
        },
        limitations=LIMITATIONS, sources=SOURCES_COMMON,
        validation_summary="Pass times and elevations are regression-tested against PyEphem "
                           "(an independent SGP4 and topocentric implementation) and the SGP4 "
                           "propagator against the Vallado et al. verification vectors. See "
                           "docs/VALIDATION.md for tolerances and results.",
    )
