"""Bundled gazetteer. Deliberately small and offline: no third-party geocoder is contacted."""
from __future__ import annotations

import json
import unicodedata
from functools import lru_cache

from . import config
from .models import City


def _fold(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


@lru_cache(maxsize=1)
def _load() -> tuple[str, list[City]]:
    raw = json.loads((config.DATA_DIR / "cities.json").read_text(encoding="utf-8"))
    return raw["note"], [City(**c) for c in raw["cities"]]


def note() -> str:
    return _load()[0]


def search(query: str | None, limit: int = 100) -> list[City]:
    cities = _load()[1]
    if not query or not query.strip():
        return cities[:limit]
    q = _fold(query.strip())
    starts = [c for c in cities if _fold(c.name).startswith(q)]
    contains = [c for c in cities if c not in starts
                and (q in _fold(c.name) or q in _fold(c.country) or q in _fold(c.region))]
    return (starts + contains)[:limit]


def get(city_id: str) -> City | None:
    return next((c for c in _load()[1] if c.id == city_id), None)
