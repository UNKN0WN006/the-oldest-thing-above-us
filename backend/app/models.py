"""Typed API contracts. The frontend's TypeScript types are generated from these."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from . import config

DataSource = Literal["live", "snapshot"]
DataMode = Literal["live", "mixed", "snapshot"]
Freshness = Literal["fresh", "aging", "stale"]
ExclusionReason = Literal["no_elements", "stale_elements", "propagation_error", "no_pass"]
Illumination = Literal["dark_sky_sunlit", "twilight_sunlit", "daylight", "eclipsed"]
LaunchDateVerification = Literal["satcat+curated", "satcat", "mismatch"]
Fate = Literal["orbiting_silent", "orbiting_passive", "orbiting_active", "reentered", "unknown"]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorBody(ApiModel):
    code: str
    message: str
    details: list[dict] | None = None


class ErrorResponse(ApiModel):
    error: ErrorBody


class SourceLink(ApiModel):
    title: str
    publisher: str
    url: str
    kind: Literal["orbital_data", "catalogue", "mission_record"]
    note: str | None = None


class Provenance(ApiModel):
    """Where an element set came from and how old it is relative to the prediction."""
    source: DataSource
    source_url: str
    retrieved_at: datetime
    element_epoch: datetime
    element_age_days: float = Field(description="Reference time minus element epoch, in days.")
    freshness: Freshness


class SatelliteSummary(ApiModel):
    norad_id: int
    name: str = Field(description="Catalogue name from SATCAT.")
    display_name: str
    cospar_id: str
    object_type: str
    owner_code: str
    country: str
    launch_date: str
    launch_year: int
    launch_date_verification: LaunchDateVerification
    decay_date: str | None
    on_orbit: bool
    ops_status_code: str
    ops_status_label: str
    period_min: float | None
    inclination_deg: float | None
    apogee_km: float | None
    perigee_km: float | None
    has_story: bool
    tagline: str | None
    fate: Fate
    fate_label: str
    in_candidate_set: bool
    set_reason: Literal["oldest_payload", "curated"] | None
    catalogue_source: DataSource
    catalogue_retrieved_at: datetime


class PassPointModel(ApiModel):
    time: datetime
    azimuth_deg: float
    elevation_deg: float
    compass: str


class TrackPoint(ApiModel):
    time: datetime
    azimuth_deg: float
    elevation_deg: float


class PassModel(ApiModel):
    start: PassPointModel
    culmination: PassPointModel
    end: PassPointModel
    duration_s: float
    starts_before_window: bool
    ends_after_window: bool
    range_km: float
    sun_altitude_deg: float
    satellite_sunlit: bool
    illumination: Illumination
    illumination_label: str
    track: list[TrackPoint]


class ObserverModel(ApiModel):
    latitude_deg: float = Field(ge=-90, le=90)
    longitude_deg: float = Field(ge=-180, le=180)
    elevation_m: float = Field(default=0, ge=-500, le=9000)
    place_name: str | None = Field(default=None, max_length=120)


class DiscoverRequest(ApiModel):
    observer: ObserverModel
    start: datetime | None = Field(
        default=None, description="Window start (UTC). Defaults to the server's reference time.")
    hours: float = Field(default=config.DEFAULT_WINDOW_HOURS, gt=0, le=config.MAX_WINDOW_HOURS)
    min_elevation_deg: float = Field(default=config.DEFAULT_MIN_ELEVATION_DEG, ge=0, le=89)


class Candidate(ApiModel):
    rank: int
    satellite: SatelliteSummary
    provenance: Provenance
    pass_count: int
    highest_elevation_deg: float
    passes: list[PassModel]


class Exclusion(ApiModel):
    norad_id: int
    name: str
    launch_date: str
    reason: ExclusionReason
    detail: str


class Methodology(ApiModel):
    candidate_set_version: str
    candidate_set_description: str
    candidate_count: int
    eligibility_rules: list[str]
    ranking_rule: str
    pass_definition: str
    propagator: str
    max_element_age_days: float
    min_elevation_deg: float
    window_hours: float


class DiscoverResponse(ApiModel):
    generated_at: datetime
    data_mode: DataMode
    observer: ObserverModel
    window_start: datetime
    window_end: datetime
    min_elevation_deg: float
    oldest: Candidate | None
    candidates: list[Candidate]
    excluded: list[Exclusion]
    exclusion_counts: dict[str, int]
    methodology: Methodology
    limitations: list[str]
    sources: list[SourceLink]


class Elements(ApiModel):
    omm: dict
    tle_line1: str | None
    tle_line2: str | None
    provenance: Provenance
    semi_major_axis_km: float
    period_min: float
    apogee_km: float
    perigee_km: float
    inclination_deg: float
    eccentricity: float


class TimelineEventModel(ApiModel):
    date: str
    label: str


class Story(ApiModel):
    title: str
    tagline: str
    country: str
    operator: str
    mission_type: str
    last_contact: str | None
    summary: str
    significance: str
    facts: list[str]
    timeline: list[TimelineEventModel]
    editorial_status: Literal["draft"]
    editorial_note: str


class SatelliteDetail(ApiModel):
    satellite: SatelliteSummary
    story: Story | None
    elements: Elements | None
    elements_unavailable_reason: str | None
    sources: list[SourceLink]
    limitations: list[str]


class SatelliteListItem(ApiModel):
    satellite: SatelliteSummary
    provenance: Provenance | None
    tle_line1: str | None
    tle_line2: str | None


class SatelliteList(ApiModel):
    reference_time: datetime
    candidate_set_version: str
    items: list[SatelliteListItem]


class PassesResponse(ApiModel):
    generated_at: datetime
    satellite: SatelliteSummary
    observer: ObserverModel
    window_start: datetime
    window_end: datetime
    min_elevation_deg: float
    provenance: Provenance | None
    passes: list[PassModel]
    not_computed_reason: ExclusionReason | None
    not_computed_detail: str | None
    limitations: list[str]


class GraveyardEntry(ApiModel):
    satellite: SatelliteSummary
    summary: str | None
    last_contact: str | None
    years_in_orbit: float


class GraveyardResponse(ApiModel):
    generated_at: datetime
    still_orbiting: list[GraveyardEntry]
    reentered: list[GraveyardEntry]
    note: str


class City(ApiModel):
    id: str
    name: str
    region: str
    country: str
    latitude_deg: float
    longitude_deg: float
    timezone: str


class CityList(ApiModel):
    items: list[City]
    note: str


class RefreshState(ApiModel):
    running: bool
    last_started_at: datetime | None
    last_finished_at: datetime | None
    last_error: str | None
    gp_done: int
    gp_total: int


class Status(ApiModel):
    server_time: datetime
    data_mode: DataMode
    data_mode_label: str
    default_window_start: datetime
    snapshot_captured_at: datetime | None
    candidate_set_version: str
    candidate_count: int
    elements_live: int
    elements_snapshot: int
    elements_missing: int
    satcat_source: DataSource | None
    satcat_retrieved_at: datetime | None
    oldest_element_epoch: datetime | None
    newest_element_epoch: datetime | None
    oldest_element_retrieval: datetime | None
    newest_element_retrieval: datetime | None
    refresh: RefreshState | None


class MethodologyDoc(ApiModel):
    methodology: Methodology
    exclusion_reasons: dict[str, str]
    illumination_labels: dict[str, str]
    freshness_rules: dict[str, str]
    limitations: list[str]
    sources: list[SourceLink]
    validation_summary: str
