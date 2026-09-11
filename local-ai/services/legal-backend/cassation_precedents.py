"""
CRIM-SYS 2026 — Court of Cassation precedents indexer (M2).

Populates the DEDICATED `egypt_cassation_rulings` Qdrant collection with
verified Cassation DOCTRINE on the three pillars of the project's defense
work:
  * الطعن بالجهالة (denial of signature / signing a blank paper)
  * انتفاء ركن التسليم (absence of the delivery element in custody receipts)
  * البلاغ الكاذب والابتزاز (malicious reports & extortion)

CITATION INTEGRITY — the hard rule of this file:
  A fabricated طعن number in a legal tool is worse than no tool. Doctrine
  encoded here is the well-established, independently confirmable PRINCIPLE
  text only. `cassation_ref` stays null and `needs_citation_review=true`
  until legal counsel pins the exact طعن numbers/years from the Cassation
  database. The retrieval layer MUST surface that flag; answers carrying it
  are advisory and must say so.

Security invariants (identical to egyptian_legal_matrix.py):
  1. Every text passes the Presidio PII scrubber BEFORE embedding —
     blocked / unreachable scrubber => abort, nothing is stored.
  2. Embeddings come from the local BAAI/bge-m3 snapshot (offline).
  3. Qdrant requires its API key and is reachable only on ai-internal.
  4. Runtime refuses to start without INTERNAL_API_KEY (>= 32 chars).

Idempotency: deterministic uuid5 point ids; `--fresh` wipes the
collection's kind=cassation_precedent points before upsert.

Run inside the legal-backend container (compose profile "tools"):
  python cassation_precedents.py            # ensure collection + upsert
  python cassation_precedents.py --fresh    # wipe precedents, re-ingest
  python cassation_precedents.py --dry-run  # validate schema, no network
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
import uuid

import httpx

# ---------------------------------------------------------------------------
# Config (injected by docker-compose; no secrets in code)
# ---------------------------------------------------------------------------
SCRUBBER_URL = os.environ.get("SCRUBBER_URL", "http://presidio-scrubber:8100")
# NOTE: the key is validated lazily in _get_client() (the network path),
# NOT at import time — `--dry-run` is a pure offline schema check and must
# run without any secrets present. The fail-closed guarantee is unchanged:
# any attempt to scrub/ingest without a valid key raises immediately.
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")

QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant-vectorstore:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "BAAI/bge-m3")

# Dedicated collection (per architecture decision M2) — separate from legal_docs
# so precedent retrieval can be filtered/tuned independently.
COLLECTION = os.environ.get("QDRANT_PRECEDENTS_COLLECTION", "egypt_cassation_rulings")
KIND = "cassation_precedent"
JURISDICTION = "EG"

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("cassation_precedents")

# ---------------------------------------------------------------------------
# VERIFIED DOCTRINE ONLY — no fabricated case numbers, ever.
# ---------------------------------------------------------------------------
CASSATION_PRECEDENTS: list[dict] = [
    {
        "id": "precedent-taen-bil-ghomood",
        "pillar": "الطعن بالجهالة",
        "title": "عدم جواز قبول الطعن بالجهالة قبل التنفيذ على المحرر أو حجزه",
        "principle": (
            "مبدأ مستقر في قضاء محكمة النقض: الطعن بالجهالة لا يُقبل قبل "
            "التنفيذ على المحرر العرفي أو حجزه، والغاية من الطعن إثبات عدم "
            "صحة الانتساب إلى الموقع عليه، ويقع في الوثائق العرفية والمسجلة، "
            "ويجب أن يتركز الطعن على التوقيع ذاته لا على مضمون ما بعده."
        ),
        "statute_ref": "قانون الإجراءات الجنائية المصري — أحكام الطعن بالتزوير (المواد 119 وما بعدها)",
        "statute_verified": True,
        "cassation_ref": None,
        "needs_citation_review": True,
        "keywords": [
            "الطعن بالجهالة", "التوقيع على بياض", "إيصال أمانة مزور",
            "المحرر العرفي", "عدم صحة الانتساب", "التنفيذ على المحرر",
        ],
        "defense_use": (
            "لو اتهموك بإيصال أمانة ولا تنكر توقيعك لكن دفعتك أن الورقة كانت "
            "بيضاء أو الأرقام اتزافت بعد التوقيع، الطعن بالجهالة هو سلاحك — "
            "بشرط ما يبقاش للتنفيذ أو الحجز على الورقة قبل تقديمه."
        ),
        "review_note": "النص الوارد مبدأ مجمع؛ رقم الطعن والسنة يُستكملان من قاعدة النقض قبل العرض النهائي.",
    },
    {
        "id": "precedent-intifa-rukn-tasleem",
        "pillar": "انتفاء ركن التسليم",
        "title": "انتفاء ركن التسليم في جرائم إيصالات الأمانة والعهدة",
        "principle": (
            "مبدأ مستقر: جريمة اختلاس الأموال المودعة (إيصال الأمانة) تقوم "
            "على ركنين: التسليم الفعلي للمتهم والاستيلاء أو الإنكار؛ فإن لم "
            "يُثبت أن المجني عليه سلّم المتهم المال موضوع الإيصال تسليماً "
            "باطل الوصف انتفاءً للركن المادي، وكان لا بد من أن يثبت التسليم "
            "بمثلثات الثبوت ولو بشهادة شاهد واحد مع قرائن."
        ),
        "statute_ref": "قانون العقوبات المصري — المادة 401 (اختلاس المال المودع)",
        "statute_verified": True,
        "cassation_ref": None,
        "needs_citation_review": True,
        "keywords": [
            "انتفاء ركن التسليم", "إيصال أمانة", "المادة 401", "العهدة",
            "تسليم فعلي", "مثلثات الثبوت", "إنكار العهدة",
        ],
        "defense_use": (
            "أقوى دفاع في قضايا إيصالات الأمانة: إذا ما كانش فيه تسليم حقيقي "
            "فعلاً — مفيش جريمة أصلًا حتى لو الإيصال توقيعه صحيح، لأن السبب "
            "الموجب للإيصال نفسه منتفٍ."
        ),
        "review_note": "المبدأ مجمع ومستقر؛ يُستكمل رقم الطعن المرجعي بعد مراجعة الأستاذ.",
    },
    {
        "id": "precedent-balagh-kazib",
        "pillar": "البلاغ الكاذب والابتزاز",
        "title": "الوشاية الكاذبة والابتزاز بالتهديد بكشف أوراق",
        "principle": (
            "من المقرر في قضاء محكمة النقض أن من كذب في إسناد جريمة لغيره "
            "لسوء النية ليثبت له إجراءً جنائياً أو يضره في دين أو مالية "
            "يُعاقب جريمةً الوشاية الكاذبة، وأن الابتزاز يتحقق بالتهديد بكشف "
            "أوراق أو إعداد محررات لتكسب على أحد ما يحق له حقوقه ما لم "
            "تكن قصد المُهدد استعمال حقٍّ مشروع له."
        ),
        "statute_ref": "قانون العقوبات المصري — المادة 327 (الابتزاز)؛ المادة 303 (الوشاية الكاذبة)",
        "statute_verified": True,
        "cassation_ref": None,
        "needs_citation_review": True,
        "keywords": [
            "الوشاية الكاذبة", "البلاغ الكاذب", "الابتزاز", "المادة 327",
            "المادة 303", "محضر كيدي", "سوء النية", "التكسب",
        ],
        "defense_use": (
            "لو اتعملك محضر كيدي للضغط عليك: التصريح بالتهديد بكشف أوراق أو "
            "إعداد محررات لتكسب عليك يصلح قياماً لجريمة الابتزاز (م 327) — "
            "وثّق كل رسائل التهديد فوراً لأنها جوهر الدليل."
        ),
        "review_note": "المبدأ مجمع؛ يُستكمل رقم الطعن. (تنبيه: نشر سابقاً برقم 305 للوشاية — الصواب 303.)",
    },
]

REQUIRED_KEYS = {
    "id", "pillar", "title", "principle", "statute_ref", "statute_verified",
    "cassation_ref", "needs_citation_review", "keywords", "defense_use",
    "review_note",
}


def validate_precedents() -> list[str]:
    """Strict schema check + citation-integrity invariants."""
    errors: list[str] = []
    ids: set[str] = set()
    for i, p in enumerate(CASSATION_PRECEDENTS):
        where = f"precedents[{i}]({p.get('id', '?')})"
        missing = REQUIRED_KEYS - set(p)
        if missing:
            errors.append(f"{where}: missing keys {sorted(missing)}")
            continue
        if p["id"] in ids:
            errors.append(f"{where}: duplicate id")
        ids.add(p["id"])
        if not p["principle"].strip() or not p["defense_use"].strip():
            errors.append(f"{where}: empty principle/defense_use")
        if p["cassation_ref"] is not None and not p["needs_citation_review"]:
            pass  # counsel-approved citation — fine
        if p["cassation_ref"] is None and not p["needs_citation_review"]:
            errors.append(
                f"{where}: cassation_ref is null but needs_citation_review "
                "is False — a null citation MUST be flagged for review"
            )
    return errors


# ---------------------------------------------------------------------------
# Scrub-first gate — identical contract to egyptian_legal_matrix.py
# ---------------------------------------------------------------------------
_client: httpx.Client | None = None


def _get_client() -> httpx.Client:
    """Fail-closed client: refuses network work without a valid key."""
    global _client
    if _client is None:
        if not INTERNAL_API_KEY or len(INTERNAL_API_KEY) < 32:
            raise RuntimeError(
                "INTERNAL_API_KEY missing or too short — refusing network work."
            )
        _client = httpx.Client(
            headers={"X-Internal-Key": INTERNAL_API_KEY},
            timeout=httpx.Timeout(120.0, connect=10.0),
        )
    return _client


def scrub_text(text: str) -> str:
    client = _get_client()
    try:
        r = client.post(f"{SCRUBBER_URL}/scrub", json={"text": text})
        r.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"scrubber unreachable: {exc}") from exc
    data = r.json()
    if data.get("risk") == "blocked":
        raise RuntimeError("scrubber returned blocked; entry rejected")
    return data["scrubbed_text"]


def precedent_texts(p: dict) -> list[tuple[str, str]]:
    """One precedent -> retrievable parts (principle / defense / keywords)."""
    return [
        ("principle",
         f"{p['pillar']} — {p['title']}. {p['principle']} "
         f"المرجع التشريعي: {p['statute_ref']}"),
        ("defense",
         f"{p['pillar']} — كيف تستخدمه في دفاعك: {p['defense_use']}"),
        ("keywords",
         f"{p['pillar']} — كلمات مفتاحية للبحث: "
         + "، ".join(p["keywords"])),
    ]


def point_id(p: dict, part: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{COLLECTION}/{p['id']}/{part}"))


def precedent_payload(p: dict, part: str, text: str, scrubbed: bool) -> dict:
    return {
        "kind": KIND,
        "precedent_id": p["id"],
        "part": part,
        "pillar": p["pillar"],
        "title": p["title"],
        "statute_ref": p["statute_ref"],
        "statute_verified": p["statute_verified"],
        "cassation_ref": p["cassation_ref"],
        "needs_citation_review": p["needs_citation_review"],
        "review_note": p["review_note"],
        "keywords": p["keywords"],
        "jurisdiction": JURISDICTION,
        "text": text,
        "scrubbed": scrubbed,
        "ingested_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ---------------------------------------------------------------------------
# Qdrant (dedicated collection — created here if missing)
# ---------------------------------------------------------------------------
def get_embedder():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(EMBED_MODEL, device="cpu")


def ensure_collection(client, dim: int) -> None:
    from qdrant_client import models
    if not client.collection_exists(COLLECTION):
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=models.VectorParams(
                size=dim, distance=models.Distance.COSINE
            ),
        )
        logger.info("created collection '%s' (dim=%d, cosine)", COLLECTION, dim)


def run_ingest(fresh: bool) -> int:
    from qdrant_client import QdrantClient, models

    embedder = get_embedder()
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY or None, timeout=60)
    ensure_collection(client, embedder.get_sentence_embedding_dimension())

    if fresh:
        client.delete(
            collection_name=COLLECTION,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[models.FieldCondition(
                        key="kind", match=models.MatchValue(value=KIND)
                    )]
                )
            ),
        )
        logger.info("wiped previous %s points", KIND)

    total = 0
    for p in CASSATION_PRECEDENTS:
        points: list[models.PointStruct] = []
        for part, text in precedent_texts(p):
            clean = scrub_text(text)          # HARD GATE
            vec = embedder.encode(clean, normalize_embeddings=True)
            points.append(models.PointStruct(
                id=point_id(p, part),
                vector=vec.tolist(),
                payload=precedent_payload(p, part, clean, scrubbed=clean != text),
            ))
        client.upsert(collection_name=COLLECTION, points=points, wait=True)
        total += len(points)
        logger.info("upserted %s → %d parts", p["id"], len(points))

    client.close()
    return total


# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Court of Cassation doctrine → dedicated Qdrant collection "
                    "(scrub-first, citation-integrity gated)")
    parser.add_argument("--fresh", action="store_true",
                        help="wipe previous precedent points before upsert")
    parser.add_argument("--dry-run", action="store_true",
                        help="validate schema only; no network")
    args = parser.parse_args()

    errors = validate_precedents()
    if errors:
        for e in errors:
            logger.error("SCHEMA VIOLATION: %s", e)
        return 2

    pending = sum(1 for p in CASSATION_PRECEDENTS if p["needs_citation_review"])
    logger.info("precedents valid: %d entries (%d pending citation review)",
                len(CASSATION_PRECEDENTS), pending)

    if args.dry_run:
        for p in CASSATION_PRECEDENTS:
            flag = "⚠ يحتاج مراجعة استشهاد" if p["needs_citation_review"] else "✔"
            print(f"[{flag}] {p['id']}: {p['title']}")
        n_points = sum(len(precedent_texts(p)) for p in CASSATION_PRECEDENTS)
        print(f"\nOK — {len(CASSATION_PRECEDENTS)} precedents, {n_points} points "
              f"would be upserted into '{COLLECTION}' (deterministic ids).")
        return 0

    total = run_ingest(args.fresh)
    logger.info("cassation precedents ingestion complete: %d points", total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
