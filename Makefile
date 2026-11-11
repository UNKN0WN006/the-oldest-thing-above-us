.PHONY: install dev check test-live e2e snapshot types

install:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -q -e ".[dev]"
	cd frontend && npm install --no-audit --no-fund

dev:
	@echo "API  → http://localhost:8000/docs    Web → http://localhost:3000"
	@set -e; \
	 (cd backend && .venv/bin/uvicorn app.main:app --port 8000) & api_pid=$$!; \
	 trap 'kill $$api_pid 2>/dev/null || true; wait $$api_pid 2>/dev/null || true' EXIT INT TERM; \
	 cd frontend && npm run dev

check:
	cd backend && .venv/bin/ruff check . && .venv/bin/mypy app && .venv/bin/python -m pytest -q
	cd frontend && npm run lint && npm run typecheck && npm test

test-live:
	cd backend && .venv/bin/python -m pytest -q -m live

e2e:
	cd frontend && npx playwright test --trace off

snapshot:
	cd backend && .venv/bin/python -m scripts.build_snapshot

types:
	cd backend && .venv/bin/python -m scripts.export_openapi ../frontend/src/lib/api/openapi.json
	cd frontend && npm run gen:api
