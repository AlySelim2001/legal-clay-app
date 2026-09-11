# CRIM-SYS 2026 — local AI stack shortcuts
# Prereq: local-ai/.env filled in (see README.md).

SHELL := /bin/bash
KEY := $(shell grep -E '^INTERNAL_API_KEY=' .env 2>/dev/null | cut -d= -f2)

.PHONY: up down build env models ingest smoke ask import-n8n logs

env:
	bash scripts/gen-env.sh

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

models:
	bash scripts/prepare-models.sh

ingest:
	docker compose run --rm ingest

logs:
	docker compose logs -f --tail=100

# End-to-end health: every internal service must answer with {"status":"ok"}
smoke:
	@test -n "$(KEY)" || (echo "INTERNAL_API_KEY not found in .env"; exit 1)
	@for svc in "scrubber 8100" "ocr 8200" "backend 8300" "scraper 8400"; do \
		name=$$(echo $$svc | cut -d' ' -f1); port=$$(echo $$svc | cut -d' ' -f2); \
		code=$$(curl -s -o /dev/null -w '%{http_code}' -H "X-Internal-Key: $(KEY)" \
			http://127.0.0.1:$$port/health); \
		echo "$$name: $$code"; \
		[ "$$code" = "200" ] || exit 1; \
	done
	@echo "All services healthy."

# Ask the pipeline (fail-safe gates included). Usage: make ask Q="سؤالك القانوني"
ask:
	@test -n "$(Q)" || (echo "usage: make ask Q=\"...\""; exit 1)
	@curl -s -X POST http://127.0.0.1:8300/analyze \
		-H "X-Internal-Key: $(KEY)" -H "Content-Type: application/json" \
		-d "{\"question\": \"$(Q)\"}" | python3 -m json.tool

import-n8n:
	@echo "Open http://127.0.0.1:5678 → Workflows → Import from File →"
	@echo "  n8n/workflows/daily-court-monitor.json"
	@echo "Then activate it. Credentials stay in n8n env (TELEGRAM_*)."
