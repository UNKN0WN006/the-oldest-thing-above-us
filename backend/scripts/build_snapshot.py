"""Capture a real CelesTrak snapshot for offline demos and tests.

    python -m scripts.build_snapshot

Writes app/data/snapshot/snapshot.json. The result is genuine CelesTrak data frozen at the
capture time; the application always labels it "snapshot", never "live".
"""
from __future__ import annotations

import json
import sys

from app import config
from app.catalog import build_snapshot
from app.celestrak import CelesTrakClient


def main() -> int:
    client = CelesTrakClient()
    try:
        snap = build_snapshot(
            client, progress=lambda i, n, nid: print(f"\rGP {i}/{n} (NORAD {nid})   ", end="",
                                                      file=sys.stderr))
    finally:
        client.close()
    config.SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    out = config.SNAPSHOT_DIR / "snapshot.json"
    out.write_text(json.dumps(snap, indent=1) + "\n", encoding="utf-8")
    print(f"\nWrote {out}: {len(snap['satcat'])} SATCAT rows, {len(snap['gp'])} element sets, "
          f"{len(snap['gp_missing'])} without GP data", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
