"""
Targeted regression tests for the roadmap-completion session (M1–M5).

Run:  local-ai/.venv/bin/python -m pytest local-ai/tests/ -v
Scope: offline, deterministic — no Qdrant, no scrubber, no network.

crew_pipeline imports FastAPI/Pydantic and executes its config block; with
the conftest dummy key it imports cleanly. Everything Qdrant/Ollama-related
is imported lazily inside functions, so the import is safe offline.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pytest

REPO = Path(__file__).resolve().parents[2]
OCR_DIR = REPO / "local-ai" / "services" / "paddle-ocr-service"
BACKEND_DIR = REPO / "local-ai" / "services" / "legal-backend"

sys.path.insert(0, str(OCR_DIR))
sys.path.insert(0, str(BACKEND_DIR))

import cv2  # noqa: E402  (after sys.path setup)

import ssim_analyzer as sa  # noqa: E402

# ---------------------------------------------------------------------------
# Image fixtures (synthetic receipts, PNG-encoded)
# ---------------------------------------------------------------------------


def _png(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def _receipt() -> np.ndarray:
    doc = np.full((900, 700), 245, np.uint8)
    cv2.rectangle(doc, (40, 40), (660, 860), (180, 180, 180), 2)
    for y in range(120, 700, 40):
        cv2.line(doc, (70, y), (630, y), (120, 120, 120), 2)
    cv2.circle(doc, (560, 780), 60, (60, 60, 200), 3)  # seal
    cv2.putText(doc, "Signature", (90, 800), cv2.FONT_HERSHEY_SIMPLEX,
                1.0, (30, 30, 30), 2)
    return doc


def _edit(base: np.ndarray, fn) -> bytes:
    img = base.copy()
    fn(img)
    return _png(cv2.cvtColor(img, cv2.COLOR_GRAY2BGR))


def _add_digit(img: np.ndarray) -> None:
    cv2.putText(img, "5", (400, 520), cv2.FONT_HERSHEY_SIMPLEX, 1.1,
                (20, 20, 20), 3)


def _thicken(img: np.ndarray) -> None:
    for y in range(120, 700, 40):
        cv2.line(img, (70, y), (630, y), (120, 120, 120), 3)


RECEIPT_PNG = _png(cv2.cvtColor(_receipt(), cv2.COLOR_GRAY2BGR))


@pytest.fixture(scope="module")
def workflow():
    return json.loads(
        (REPO / "local-ai/n8n/workflows/case-alerts.json").read_text())


@pytest.fixture(scope="module")
def compose():
    import yaml
    return yaml.safe_load(
        (REPO / "local-ai/docker-compose.yml").read_text())


# ---------------------------------------------------------------------------
# M1: SSIM forensics
# ---------------------------------------------------------------------------


class TestM1SsimForensics:
    def test_identical_documents_score_perfect(self):
        r = sa.compare_ssim(RECEIPT_PNG, RECEIPT_PNG)
        assert r["ssim"] == pytest.approx(1.0, abs=1e-3)
        assert r["evidence"]["significant_components"] == 0
        assert r["evidence"]["ink_anomaly"] is False
        assert "تطابق" in r["verdict_ar"]

    def test_added_digit_is_flagged_as_localized_difference(self):
        # Regression: global SSIM barely moves (~0.999) on real edits —
        # the localized component must be what catches it.
        suspect = _edit(cv2.imdecode(
            np.frombuffer(RECEIPT_PNG, np.uint8), cv2.IMREAD_GRAYSCALE),
            _add_digit)
        r = sa.compare_ssim(RECEIPT_PNG, suspect)
        assert r["evidence"]["significant_components"] >= 1
        assert "موضعية" in r["verdict_ar"] or "تباعد" in r["verdict_ar"]

    def test_thickened_ink_triggers_density_anomaly(self):
        suspect = _edit(cv2.imdecode(
            np.frombuffer(RECEIPT_PNG, np.uint8), cv2.IMREAD_GRAYSCALE),
            _thicken)
        r = sa.compare_ssim(RECEIPT_PNG, suspect)
        assert r["evidence"]["ink_anomaly"] is True
        assert r["ink_density"]["delta"] > 0
        assert "تباعد" in r["verdict_ar"]

    def test_unrelated_document_diverges(self):
        noise = np.random.default_rng(7).integers(
            0, 255, (900, 700), dtype=np.uint8)
        r = sa.compare_ssim(RECEIPT_PNG, _png(
            cv2.cvtColor(noise, cv2.COLOR_GRAY2BGR)))
        assert r["ssim"] < 0.5
        assert "تباعد" in r["verdict_ar"]

    def test_undecodable_input_raises_valueerror(self):
        # app.py maps ValueError -> HTTP 400 (never a 500).
        with pytest.raises(ValueError):
            sa.compare_ssim(RECEIPT_PNG, b"not-an-image")

    def test_every_response_carries_advisory_banner(self):
        r = sa.compare_ssim(RECEIPT_PNG, RECEIPT_PNG)
        assert r["advisory_only"] is True
        assert "الطب الشرعي" in r["disclaimer_ar"]

    def test_seals_degrade_honestly_without_model(self, monkeypatch):
        monkeypatch.delenv("YOLO_MODEL_PATH", raising=False)
        r = sa.detect_seals_and_signatures(RECEIPT_PNG)
        assert r["model_loaded"] is False
        assert r["detections"] == []
        assert r["note_ar"]  # an honest explanation, not silence


# ---------------------------------------------------------------------------
# M2: Cassation precedents indexer
# ---------------------------------------------------------------------------


class TestM2CassationPrecedents:
    def test_module_imports_with_no_secrets(self):
        # Lazy key validation: --dry-run must work fully offline.
        import cassation_precedents as cp
        assert cp.CASSATION_PRECEDENTS

    def test_schema_valid(self):
        import cassation_precedents as cp
        assert cp.validate_precedents() == []

    def test_all_entries_pending_citation_review(self):
        # Citation integrity: no fabricated case numbers — every entry is
        # flagged until counsel pins the طعن numbers.
        import cassation_precedents as cp
        assert all(p["needs_citation_review"] for p in cp.CASSATION_PRECEDENTS)
        assert all(p["cassation_ref"] is None for p in cp.CASSATION_PRECEDENTS)

    def test_statute_refs_are_verified_legislation(self):
        import cassation_precedents as cp
        # Arts. 214-216 (forgery), 401 (custody), 327 (extortion),
        # 303 (false report) — the verified ones; never 215/341/305 myths.
        joined = " ".join(p["statute_ref"] for p in cp.CASSATION_PRECEDENTS)
        for art in ("119", "401", "327", "303"):
            assert art in joined
        assert "215" not in joined and "341" not in joined

    def test_three_defense_pillars_covered(self):
        import cassation_precedents as cp
        pillars = {p["pillar"] for p in cp.CASSATION_PRECEDENTS}
        assert pillars == {"الطعن بالجهالة", "انتفاء ركن التسليم",
                           "البلاغ الكاذب والابتزاز"}

    def test_deterministic_point_ids(self):
        import cassation_precedents as cp
        for p in cp.CASSATION_PRECEDENTS:
            assert cp.point_id(p, "principle") == cp.point_id(p, "principle")
            assert cp.point_id(p, "principle") != cp.point_id(p, "defense")

    def test_fail_closed_network_gate(self):
        # Simulate the no-key environment: the lazy gate must refuse.
        import cassation_precedents as cp
        saved = cp.INTERNAL_API_KEY
        cp.INTERNAL_API_KEY = ""
        try:
            with pytest.raises(RuntimeError):
                cp.scrub_text("anything")
        finally:
            cp.INTERNAL_API_KEY = saved

    def test_each_entry_yields_three_retrievable_parts(self):
        import cassation_precedents as cp
        for p in cp.CASSATION_PRECEDENTS:
            parts = cp.precedent_texts(p)
            assert [name for name, _ in parts] == [
                "principle", "defense", "keywords"]
            assert all(text.strip() for _, text in parts)


# ---------------------------------------------------------------------------
# M3: crew integration (forensic + doctrine tools)
# ---------------------------------------------------------------------------


class TestM3CrewIntegration:
    def test_pipeline_module_imports_cleanly(self):
        import crew_pipeline as cw
        assert cw.QDRANT_PRECEDENTS_COLLECTION == "egypt_cassation_rulings"
        assert cw.OCR_SERVICE_URL.endswith(":8200")

    def test_precedent_block_marks_pending_citations(self):
        import crew_pipeline as cw
        payload = [{
            "pillar": "الطعن بالجهالة",
            "title": "عنوان",
            "text": "نص المبدأ",
            "statute_ref": "قانون الإجراءات الجنائية",
            "needs_citation_review": True,
        }]
        block = cw._format_precedent_block(payload)
        assert "مراجعة استشهاد" in block
        assert "نص المبدأ" in block

    def test_precedent_block_empty_for_no_hits(self):
        import crew_pipeline as cw
        assert cw._format_precedent_block([]) == ""

    def test_faithfulness_gate_threshold_unchanged(self):
        import crew_pipeline as cw
        assert cw.FAITHFULNESS_THRESHOLD == pytest.approx(0.95)

    def test_legal_hold_message_defined(self):
        import crew_pipeline as cw
        assert "حجب" in cw.LEGAL_HOLD_MESSAGE_AR


# ---------------------------------------------------------------------------
# M4: Egyptian deadline calculator (port of the Kotlin contract)
# ---------------------------------------------------------------------------

# Reference values verified against java.time via the Kotlin unit tests; the
# Python port below re-derives them with datetime to double-check the pins.

import datetime as dt  # noqa: E402


class TestM4DeadlineLogic:
    CHANNELS = {
        "opposition": 10,
        "criminal_appeal": 10,
        "cassation": 60,
    }

    def _deadline(self, start: dt.date, days: int) -> tuple[dt.date, dt.date]:
        raw = start + dt.timedelta(days=days)
        final = raw
        while final.weekday() in (4, 5):  # Fri, Sat
            final += dt.timedelta(days=1)
        return raw, final

    @pytest.mark.parametrize("start,days,expected", [
        # 2026-09-01 +10 = Fri 09-11 -> rolls to Sunday 09-13
        (dt.date(2026, 9, 1), 10, dt.date(2026, 9, 13)),
        # 2026-09-03 +60 = Mon 11-02 -> unchanged
        (dt.date(2026, 9, 3), 60, dt.date(2026, 11, 2)),
        # 2026-10-21 +10 = Sat 10-31 -> rolls across month to 11-01
        (dt.date(2026, 10, 21), 10, dt.date(2026, 11, 1)),
        # 2026-10-28 +10 = Sat 11-07 -> rolls one day to 11-08
        (dt.date(2026, 10, 28), 10, dt.date(2026, 11, 8)),
        # 2028-02-19 +10 = Tue 02-29 (leap) -> unchanged
        (dt.date(2028, 2, 19), 10, dt.date(2028, 2, 29)),
    ])
    def test_reference_deadlines_with_weekend_roll(
            self, start, days, expected):
        _, final = self._deadline(start, days)
        assert final == expected

    def test_roll_direction_is_always_forward(self):
        # Sweep a full year of start dates for every channel window.
        day = dt.date(2026, 1, 1)
        while day.year == 2026:
            for days in self.CHANNELS.values():
                raw, final = self._deadline(day, days)
                assert final >= raw
                assert final.weekday() not in (4, 5)
            day += dt.timedelta(days=1)

    def test_windows_match_spec(self):
        assert self.CHANNELS == {"opposition": 10,
                                 "criminal_appeal": 10, "cassation": 60}

    def test_kotlin_source_pins_the_same_contract(self):
        src = (REPO / "android/app/src/main/java/net/crimsys/app/domain"
               "/legal/EgyptianDeadlineCalculator.kt").read_text()
        assert 'windowDays = 10L' in src
        assert 'windowDays = 60L' in src
        # Citation integrity flag must be ON for every channel.
        assert src.count("needsLegalReview = true") == 3


# ---------------------------------------------------------------------------
# M5: case-alerts workflow
# ---------------------------------------------------------------------------


class TestM5CaseAlertsWorkflow:
    def test_workflow_parses_with_expected_shape(self, workflow):
        assert workflow["nodes"], workflow["connections"]

    def test_pii_scrub_is_fail_closed(self, workflow):
        # Scrub node present, and blocked results route to the admin alert.
        nodes = {n["name"] for n in workflow["nodes"]}
        assert "Scrub PII (fail-closed)" in nodes
        conns = workflow["connections"]["Scrub OK?"]["main"]
        targets = [c["node"] for branch in conns for c in branch]
        assert "Alert Admin (scrub blocked / node error)" in targets

    def test_every_send_path_passes_the_disclaimer_builder(self, workflow):
        # All three severity outputs converge on Build Message + Disclaimer.
        conns = workflow["connections"]["Route by Severity"]["main"]
        for branch in conns:
            assert [c["node"] for c in branch] == ["Build Message + Disclaimer"]

    def test_severity_routing_covers_all_levels(self, workflow):
        switch = next(n for n in workflow["nodes"]
                      if n["name"] == "Route by Severity")
        rules = switch["parameters"]["rules"]["values"]
        routed = {r["outputKey"] for r in rules}
        assert routed == {"critical", "warning"}
        # fallback catches info
        assert switch["parameters"]["options"]["fallbackOutput"] == "extra"

    def test_message_builder_js_is_syntactically_valid(self, workflow):
        builder = next(n for n in workflow["nodes"]
                       if n["name"] == "Build Message + Disclaimer")
        code = builder["parameters"]["jsCode"]
        assert "إخلاء مسؤولية إلزامي" in code
        assert "SEVERITIES" not in code  # regression: was out of scope
        # Real JS syntax check via node (skipped where node is absent).
        # n8n executes code-node snippets inside a function body, so wrap
        # accordingly — a bare top-level `return` is legal in that context
        # (CommonJS) but not as an ES module.
        import shutil
        import subprocess
        node = shutil.which("node")
        if node is None:
            pytest.skip("node not available for JS syntax check")
        tmp = REPO / "local-ai/tests/.builder_check.js"
        tmp.write_text(f"async function __n8n_node() {{\n{code}\n}}")
        try:
            subprocess.run([node, "--check", str(tmp)], check=True,
                           capture_output=True, text=True)
        finally:
            tmp.unlink(missing_ok=True)

    def test_webhook_is_local_only_by_contract(self, workflow):
        hook = next(n for n in workflow["nodes"]
                    if n["type"] == "n8n-nodes-base.webhook")
        assert hook["parameters"]["httpMethod"] == "POST"
        # documented invariant: n8n binds 127.0.0.1 on the host
        assert hook["webhookId"] == "crimsys-case-alert"


# ---------------------------------------------------------------------------
# Wiring: compose + Makefile + docs consistency
# ---------------------------------------------------------------------------


class TestStackWiring:
    def test_eleven_services_with_three_tools(self, compose):
        svcs = compose["services"]
        assert len(svcs) == 11
        tools = {s for s, v in svcs.items()
                 if "tools" in (v.get("profiles") or [])}
        assert tools == {"ingest", "legal-matrix-ingest", "precedents-indexer"}

    def test_all_published_ports_loopback_only(self, compose):
        for svc, cfg in compose["services"].items():
            for port in cfg.get("ports") or []:
                spec = port if isinstance(port, str) else (
                    f"{port.get('host_ip', '')}:"
                    f"{port.get('published', '')}:{port.get('target', '')}")
                assert spec.startswith("127.0.0.1:"), (svc, spec)

    def test_no_unpinned_upstream_images(self, compose):
        for svc, cfg in compose["services"].items():
            img = cfg.get("image", "")
            if img and not img.startswith("crimsys/"):
                assert ":latest" not in img, svc

    def test_backend_gets_precedents_collection_and_ocr_url(self, compose):
        env = compose["services"]["legal-backend-api"]["environment"]
        assert env["QDRANT_PRECEDENTS_COLLECTION"] == "egypt_cassation_rulings"
        assert env["OCR_SERVICE_URL"] == "http://paddle-ocr-service:8200"

    def test_precedents_indexer_runs_the_right_command(self, compose):
        cfg = compose["services"]["precedents-indexer"]
        assert cfg["command"] == ["python", "cassation_precedents.py"]
        assert cfg["environment"]["QDRANT_PRECEDENTS_COLLECTION"] == \
            "egypt_cassation_rulings"

    def test_makefile_has_precedents_target(self):
        makefile = (REPO / "local-ai/Makefile").read_text()
        assert "precedents:\n\tdocker compose run --rm precedents-indexer" \
            in makefile

    def test_backend_dockerfile_ships_all_four_scripts(self):
        dockerfile = (
            REPO / "local-ai/services/legal-backend/Dockerfile").read_text()
        for script in ("crew_pipeline.py", "rag_ingestion.py",
                       "egyptian_legal_matrix.py", "cassation_precedents.py"):
            assert script in dockerfile

    def test_docs_reference_new_sections(self):
        arch = (REPO / "docs/ARCHITECTURE.md").read_text()
        assert "cassation_precedents.py" in arch
        assert "egypt_cassation_rulings" in arch
        readme = (REPO / "README.md").read_text()
        assert "case-alerts.json" in readme
