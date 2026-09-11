"""
CRIM-SYS 2026 — PII Scrubber service (FastAPI + Presidio).

Contract:
  POST /scrub    {"text": "...", "operator": "redact"|"hash"|"mask"}
             ->  {"scrubbed_text": "...", "findings": [...], "risk": "clean"|"scrubbed"|"blocked"}
  GET  /health   -> {"status": "ok"}

Fail-safe: if scrubbing itself throws, the endpoint returns risk="blocked"
with empty text — the caller (n8n / RAG ingestion / crew pipeline) MUST treat
"blocked" as "send nothing to the LLM". A leak must never be the cheaper path.

Service-to-service auth: every request must carry
    X-Internal-Key: <INTERNAL_API_KEY>
checked in constant time (hmac.compare_digest). The key is shared only by
services on the ai-internal docker network.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_analyzer.nlp_engine import NlpEngineProvider
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

from egyptian_nid import EgyptianNationalIDRecognizer, REDACTION_LABEL

# ---------------------------------------------------------------------------
# Logging: NEVER log request bodies (they contain PII by definition).
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("presidio-scrubber")
logging.getLogger("presidio_analyzer").setLevel(logging.WARNING)

INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY or len(INTERNAL_API_KEY) < 32:
    # Fail closed at startup: an insecure deployment must not boot.
    raise RuntimeError(
        "INTERNAL_API_KEY missing or too short (>=32 chars required). "
        "Set it in .env before starting the stack."
    )

MAX_TEXT_CHARS = 200_000  # hard cap: memory + DoS guard
CONFIDENCE_THRESHOLD = float(os.environ.get("PII_CONFIDENCE_THRESHOLD", "0.5"))

# ---------------------------------------------------------------------------
# Presidio setup: Arabic spaCy NLP engine + our Egyptian NID recognizer
# + the built-in PERSON recognizer (works on ar_core_news_sm entities).
# ---------------------------------------------------------------------------
NLP_CONFIG = {
    "nlp_engine_name": "spacy",
    "models": [{"lang_code": "ar", "model_name": "ar_core_news_sm"}],
}

registry = RecognizerRegistry(supported_languages=["ar"])
registry.load_predefined_recognizers(languages=["ar"])
# Built-in recognizers registered under "en" only — re-tag for Arabic.
for rec in registry.recognizers:
    rec.supported_language = "ar"
registry.add_recognizer(EgyptianNationalIDRecognizer())

provider = NlpEngineProvider(nlp_configuration=NLP_CONFIG)
nlp_engine = provider.create_engine()

analyzer = AnalyzerEngine(
    nlp_engine=nlp_engine,
    registry=registry,
    supported_languages=["ar"],
)
anonymizer = AnonymizerEngine()


def _mask_last4(value: str) -> str:
    return "*" * max(0, len(value) - 4) + value[-4:]


def _sha256(value: str) -> str:
    # Peppered hash so hashes can't be reversed by brute-forcing known IDs.
    pepper = INTERNAL_API_KEY.encode("utf-8")
    return hashlib.sha256(pepper + value.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
class ScrubRequest(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_CHARS)
    operator: str = Field("redact", pattern="^(redact|hash|mask)$")


class ScrubResponse(BaseModel):
    scrubbed_text: str
    findings: list
    risk: str


app = FastAPI(title="CRIM-SYS PII Scrubber", docs_url=None, redoc_url=None)


@app.middleware("http")
async def _auth(request: Request, call_next):
    key = request.headers.get("X-Internal-Key", "")
    if not hmac.compare_digest(key, INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="unauthorized")
    return await call_next(request)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/scrub", response_model=ScrubResponse)
def scrub(req: ScrubRequest) -> ScrubResponse:
    if not req.text.strip():
        return ScrubResponse(scrubbed_text="", findings=[], risk="clean")
    try:
        results = analyzer.analyze(
            text=req.text,
            language="ar",
            threshold=CONFIDENCE_THRESHOLD,
            return_decision_process=False,
        )
    except Exception:  # noqa: BLE001 — fail-safe: never leak on error
        logger.exception("scrub failed — returning blocked")
        return ScrubResponse(
            scrubbed_text="",
            findings=[{"error": "scrubber_failure"}],
            risk="blocked",
        )

    findings = [
        {
            "entity": r.entity_type,
            "score": round(r.score, 2),
            "length": r.end - r.start,
        }
        for r in results
    ]

    if not results:
        return ScrubResponse(scrubbed_text=req.text, findings=[], risk="clean")

    operators = {
        "EG_NATIONAL_ID": OperatorConfig("custom", {"lambda": lambda v: REDACTION_LABEL}),
    }
    if req.operator == "redact":
        for et in {r.entity_type for r in results}:
            operators.setdefault(
                et, OperatorConfig("custom", {"lambda": lambda v, et=et: f"<{et}>"})
            )
    elif req.operator == "mask":
        for et in {r.entity_type for r in results}:
            operators.setdefault(
                et, OperatorConfig("custom", {"lambda": lambda v: _mask_last4(v)})
            )
    else:  # hash — keeps referential integrity without revealing the value
        for et in {r.entity_type for r in results}:
            operators.setdefault(
                et, OperatorConfig("custom", {"lambda": lambda v: _sha256(v)})
            )

    anonymized = anonymizer.anonymize(
        text=req.text, analyzer_results=results, operators=operators
    )
    return ScrubResponse(
        scrubbed_text=anonymized.text,
        findings=findings,
        risk="scrubbed" if findings else "clean",
    )
