"""Curated mission records. Version-controlled content, validated at import time."""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field

from . import config

Fate = Literal["orbiting_silent", "orbiting_passive", "orbiting_active", "reentered"]

FATE_LABELS: dict[str, str] = {
    "orbiting_silent": "Silent, still in orbit",
    "orbiting_passive": "Passive, still in scientific use",
    "orbiting_active": "Operating",
    "reentered": "Re-entered the atmosphere",
}


class TimelineEvent(BaseModel):
    date: str = Field(pattern=r"^\d{4}(-\d{2}){0,2}$")
    label: str


class StoryRecord(BaseModel):
    norad_id: int
    title: str
    tagline: str
    launch_date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    country: str
    operator: str
    mission_type: str
    fate: Fate
    last_contact: str | None = None
    summary: str
    significance: str
    facts: list[str] = []
    timeline: list[TimelineEvent] = []


class StoryFile(BaseModel):
    editorial_note: str
    stories: list[StoryRecord]


@lru_cache(maxsize=1)
def load_stories() -> StoryFile:
    raw = json.loads((config.DATA_DIR / "stories.json").read_text(encoding="utf-8"))
    parsed = StoryFile.model_validate(raw)
    ids = [s.norad_id for s in parsed.stories]
    if len(ids) != len(set(ids)):
        raise ValueError("stories.json contains duplicate NORAD ids")
    return parsed


def stories_by_id() -> dict[int, StoryRecord]:
    return {s.norad_id: s for s in load_stories().stories}


def nssdca_url(cospar_id: str) -> str:
    return f"https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id={cospar_id}"
