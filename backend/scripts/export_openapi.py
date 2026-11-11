"""Write the OpenAPI schema to ../frontend/src/lib/api/openapi.json (input for type generation)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from app import config
from app.main import create_app


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("openapi.json")
    schema = create_app(config.Settings(data_mode="snapshot")).openapi()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(schema, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
