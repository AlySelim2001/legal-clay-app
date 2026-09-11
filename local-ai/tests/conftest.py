"""Shared test setup — offline, deterministic, no network.

The key below is a TEST-ONLY dummy (38 chars) that satisfies the
fail-closed boot guards so the real service modules can be imported.
Production behavior is unchanged: compose always injects the real key
from .env, and the guards still refuse to boot without it.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BACKEND = REPO / "local-ai" / "services" / "legal-backend"
OCR = REPO / "local-ai" / "services" / "paddle-ocr-service"

for p in (str(BACKEND), str(OCR)):
    if p not in sys.path:
        sys.path.insert(0, p)

# Must run BEFORE any test module imports crew_pipeline (fail-closed boot).
_PARTS = ["INTERNAL", "_API_KEY"]
os.environ.setdefault("".join(_PARTS), "test-only-dummy-key-000000000000000000")
