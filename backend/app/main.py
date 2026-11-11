"""FastAPI application factory."""
from __future__ import annotations

import logging
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config
from .catalog import RefreshService, seed_from_snapshot
from .celestrak import CelesTrakClient
from .db import Database, parse_iso, utcnow

log = logging.getLogger("aboveus")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


class AppState:
    """Everything a request handler needs; attached to app.state.aboveus."""

    def __init__(self, settings: config.Settings, db: Database,
                 refresh: RefreshService | None):
        self.settings = settings
        self.db = db
        self.refresh = refresh
        self._cache: dict[Any, tuple[float, Any]] = {}
        self._cache_lock = threading.Lock()

    @property
    def data_mode(self) -> str:
        """Report mixed sources explicitly, rather than overstating live-data coverage."""
        if self.settings.data_mode == "snapshot":
            return "snapshot"
        candidate_ids = {norad_id for norad_id, _, _ in self.db.candidate_set()}
        sources = {row.source for norad_id, row in self.db.all_gp().items()
                   if norad_id in candidate_ids}
        if "live" not in sources:
            return "snapshot"
        return "mixed" if "snapshot" in sources else "live"

    def reference_time(self) -> datetime:
        """Default window start: now for live data, the capture time for archived data."""
        if self.settings.data_mode == "snapshot":
            captured = self.db.get_meta("snapshot_captured_at")
            if captured:
                return parse_iso(captured)
        return utcnow().replace(second=0, microsecond=0)

    def cached(self, key: Any, compute: Any) -> Any:
        now = time.monotonic()
        with self._cache_lock:
            hit = self._cache.get(key)
            if hit and now - hit[0] < config.DISCOVERY_CACHE_SECONDS:
                return hit[1]
        value = compute()
        with self._cache_lock:
            if len(self._cache) > 256:
                self._cache.clear()
            self._cache[key] = (now, value)
        return value


def create_app(settings: config.Settings | None = None, db: Database | None = None,
               client: CelesTrakClient | None = None) -> FastAPI:
    settings = settings or config.Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database = db or Database(settings.db_path)
        if not database.candidate_set():
            if not seed_from_snapshot(database):
                log.warning("no bundled snapshot; the cache is empty until CelesTrak answers")
        refresh = None
        ct = None
        if settings.data_mode == "live":
            ct = client or CelesTrakClient(database)
            refresh = RefreshService(database, ct)
            refresh.start_background()
        app.state.aboveus = AppState(settings, database, refresh)
        yield
        if refresh is not None:
            refresh.stop()
        if ct is not None:
            ct.close()
        if db is None:
            database.close()

    app = FastAPI(
        title="Above Us API",
        version="0.1.0",
        description="Observer-relative pass discovery for heritage spacecraft. Predictions are "
                    "geometric; a predicted pass does not guarantee optical visibility.",
        lifespan=lifespan,
    )
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins),
                       allow_methods=["GET", "POST"], allow_headers=["*"])

    def error(status: int, code: str, message: str, details: Any = None) -> JSONResponse:
        body: dict[str, Any] = {"code": code, "message": message}
        if details is not None:
            body["details"] = details
        return JSONResponse(status_code=status, content={"error": body})

    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return error(exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]}
                   for e in exc.errors()]
        return error(422, "invalid_request", "The request has invalid or missing fields.",
                     details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return error(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled error", exc_info=exc)
        return error(500, "internal_error", "The server failed to complete the request.")

    from .api import router
    app.include_router(router, prefix="/api/v1")
    return app


app = create_app()
