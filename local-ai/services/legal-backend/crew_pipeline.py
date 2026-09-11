"""
CRIM-SYS 2026 — CrewAI legal pipeline (local-only).

Crew (3 agents, sequential):
  1. محلل الإجراءات الجنائية  — case analysis: facts → legal characterization
  2. باحث السوابق القضائية     — retrieves supporting precedent from Qdrant (RAG)
  3. مبسط المفاهيم القانونية   — plain-Arabic explainer; MANDATORY context =
     the combined outputs of agents 1 & 2 (enforced by the task definition).

Fail-safe (non-negotiable):
  Every crew output passes evaluate_rag_response() (Ragas). If faithfulness
  < 0.95, the pipeline returns the pre-approved legal hold message and NEVER
  the model text. Ragas needs an evaluator LLM — we point it at the same
  local Ollama instance (qwen2.5:7b) so the whole loop stays offline.

Models: Ollama `qwen2.5:7b` (primary) or `jais-family-13b` (Arabic-native).
Both must be pulled on the host:  ollama pull qwen2.5:7b
"""

from __future__ import annotations

import hmac
import logging
import os
import uuid
from typing import Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Environment (injected by compose — no secrets in code)
# ---------------------------------------------------------------------------
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY or len(INTERNAL_API_KEY) < 32:
    raise RuntimeError("INTERNAL_API_KEY missing — refusing to boot.")

SCRUBBER_URL = os.environ.get("SCRUBBER_URL", "http://presidio-scrubber:8100")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant-vectorstore:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
QDRANT_COLLECTION = os.environ.get("QDRANT_COLLECTION", "legal_docs")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://ollama-engine:11434")
PRIMARY_MODEL = os.environ.get("PRIMARY_MODEL", "qwen2.5:7b")
ALTERNATE_MODEL = os.environ.get("ALTERNATE_MODEL", "jais-family-13b")
FAITHFULNESS_THRESHOLD = float(os.environ.get("FAITHFULNESS_THRESHOLD", "0.95"))

logger = logging.getLogger("crew_pipeline")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_client = httpx.Client(
    headers={"X-Internal-Key": INTERNAL_API_KEY},
    timeout=httpx.Timeout(300.0, connect=10.0),
)

# ---------------------------------------------------------------------------
# The pre-approved legal hold message (fail-safe output)
# ---------------------------------------------------------------------------
LEGAL_HOLD_MESSAGE_AR = (
    "⚠️ تنويه قانوني إلزامي — تم حجب الإجابة.\n"
    "لم يحقق التحليل الآلي عتبة الدقة المطلوبة (0.95)، لذلك لا يمكن عرض نتيجته.\n"
    "لا تُعتمد على أي مخرجات آلية في هذا الأمر؛\n"
    "راجع ملف القضية الأصلي واستشر المحامي المسؤول عنها.\n"
    "— نظام إدارة القضايا الجنائية CRIM-SYS 2026 — أداة تنظيمية مساعدة فقط، "
    "ولاتستبدل الاستشارة القانونية."
)

RETRIEVAL_FAILURE_MESSAGE_AR = (
    "⚠️ خدمة التحليل غير متاحة حالياً (تعذر الاسترجاع من قاعدة السوابق).\n"
    "أعد المحاولة لاحقاً أو راجع الملف الورقي.\n"
    "— أداة تنظيمية مساعدة فقط ولا تُغني عن الاستشارة القانونية."
)

# ---------------------------------------------------------------------------
# PII scrub gate — identical policy to ingestion (fail-safe: block)
# ---------------------------------------------------------------------------
def scrub_or_block(text: str) -> Optional[str]:
    """Returns scrubbed text, or None if the text must not reach the LLM."""
    try:
        r = _client.post(f"{SCRUBBER_URL}/scrub", json={"text": text})
        r.raise_for_status()
        data = r.json()
    except (httpx.HTTPError, ValueError):
        logger.exception("scrubber unreachable — blocking request")
        return None
    if data.get("risk") == "blocked":
        return None
    return data["scrubbed_text"]


# ---------------------------------------------------------------------------
# RAG retrieval from Qdrant (bge-m3 dense vectors, local)
# ---------------------------------------------------------------------------
_embed_model = None


def _get_embed_model():
    global _embed_model
    if _embed_model is None:
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding

        _embed_model = HuggingFaceEmbedding(
            model_name=os.environ.get("EMBED_MODEL", "BAAI/bge-m3"), device="cpu"
        )
    return _embed_model


def retrieve(query: str, top_k: int = 5) -> list[str]:
    """Scrubbed-context retrieval: query is scrubbed, stored text is scrubbed."""
    from qdrant_client import QdrantClient

    clean_query = scrub_or_block(query)
    if clean_query is None:
        return []

    vector = _get_embed_model().get_text_embedding(clean_query)
    client = QdrantClient(
        url=QDRANT_URL, api_key=QDRANT_API_KEY or None, timeout=30
    )
    try:
        hits = client.query_points(
            collection_name=QDRANT_COLLECTION,
            query=vector,
            limit=top_k,
            with_payload=True,
        ).points
    finally:
        client.close()
    return [str(p.payload.get("text", "")) for p in hits if p.payload]


# ---------------------------------------------------------------------------
# CrewAI + local Ollama
# ---------------------------------------------------------------------------
def build_crew():
    from crewai import Agent, Crew, Process, Task
    from crewai_tools import tool
    from langchain_ollama import ChatOllama

    llm = ChatOllama(
        base_url=OLLAMA_BASE_URL,
        model=PRIMARY_MODEL,
        temperature=0.1,  # legal work: near-deterministic
        num_ctx=8192,
    )

    @tool("بحث في السوابق القضائية")
    def precedent_search(query: str) -> str:
        """يبحث في قاعدة السوابق والنصوص القانونية المحلية (منقّاة من البيانات الشخصية)."""
        chunks = retrieve(query, top_k=5)
        if not chunks:
            return "لا توجد نتائج ذات صلة في القاعدة المحلية."
        return "\n---\n".join(chunks)

    # -- Agent 1: case analysis -------------------------------------------------
    analyst = Agent(
        role="محلل إجراءات جنائية",
        goal="تحليل وقائع القضية وتوصيفها قانونياً وفق قانون الإجراءات الجنائية المصري",
        backstory=(
            "خبير إجراءات جزائية مصري يعمل داخل مكتب محاماة؛ يلتزم بالنصوص "
            "والمواعيد ولا يخترع أحكاماً."
        ),
        llm=llm,
        tools=[],
        allow_delegation=False,
        verbose=False,
    )

    # -- Agent 2: precedent researcher (has the RAG tool) -----------------------
    researcher = Agent(
        role="باحث سوابق قضائية",
        goal="استرجاع أقرب النصوص والسوابق ذات الصلة من القاعدة المحلية الموثقة",
        backstory=(
            "باحث قانوني دقيق يستشهد فقط بما يعود من أداة البحث المحلية، "
            "وينسب كل اقتباس إلى مصدره."
        ),
        llm=llm,
        tools=[precedent_search],
        allow_delegation=False,
        verbose=False,
    )

    # -- Agent 3: plain-Arabic simplifier (MANDATORY upstream context) ----------
    simplifier = Agent(
        role="مبسط المفاهيم القانونية",
        goal="إعادة صياغة التحليل والسوابق بلغة عربية مبسطة للمحامي غير المتخصص",
        backstory=(
            "كاتب قانوني يشرح دون تغيير المعنى؛ لا يضيف معلومة لم ترد في "
            "المحتوى الممرر إليه."
        ),
        llm=llm,
        tools=[],
        allow_delegation=False,
        verbose=False,
    )

    task_analyze = Task(
        description=(
            "حلل وقائع القضية التالية:\n{question}\n\n"
            "حدد التوصيف الجنائي، والمدة الإجرائية المعنية، وأي إشكالات شكلية."
        ),
        expected_output="تحليل منظم في نقاط، بالعربية، بلا استنتاجات غير مسندة.",
        agent=analyst,
    )

    task_precedent = Task(
        description=(
            "بناءً على تحليل الزميل:\n{context}\n"
            "استخدم أداة البحث المحلية لاسترجاع النصوص والسوابق ذات الصلة، "
            "ووثّق كل اقتباس بمصدره من القاعدة."
        ),
        expected_output="قائمة سوابق/نصوص مرقمة مع مصدر كل واحد منها.",
        agent=researcher,
        context=[task_analyze],  # analyst output flows in automatically
    )

    task_simplify = Task(
        description=(
            "أعد صياغة ما يلي بلغة مبسطة دون إضافة أي معلومة جديدة:\n"
            "التحليل:\n{analysis}\n\nالسوابق:\n{precedent}\n"
            "اختم بجملة إخلاء مسؤولية واحدة."
        ),
        expected_output="شرح مبسط بالعربية + سطر إخلاء مسؤولية.",
        agent=simplifier,
        # MANDATORY context: task_simplify CANNOT run without both upstream
        # outputs — CrewAI injects them verbatim into the prompt.
        context=[task_analyze, task_precedent],
    )

    crew = Crew(
        agents=[analyst, researcher, simplifier],
        tasks=[task_analyze, task_precedent, task_simplify],
        process=Process.sequential,
        verbose=False,
    )
    return crew


# ---------------------------------------------------------------------------
# Ragas evaluation gate (faithfulness >= 0.95 or bust)
# ---------------------------------------------------------------------------
def _ollama_generate(prompt: str) -> str:
    r = _client.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={"model": PRIMARY_MODEL, "prompt": prompt, "stream": False},
    )
    r.raise_for_status()
    return r.json()["response"]


def _ragas_evaluators():
    """
    Ragas evaluators backed by the SAME local Ollama instance — the eval
    loop never leaves the machine. Uses the canonical Langchain wrappers
    (langchain-ollama ships with CrewAI's dependency tree).
    """
    from langchain_ollama import ChatOllama, OllamaEmbeddings
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.llms import LangchainLLMWrapper

    eval_llm = LangchainLLMWrapper(
        ChatOllama(base_url=OLLAMA_BASE_URL, model=PRIMARY_MODEL, temperature=0.0)
    )
    eval_embeddings = LangchainEmbeddingsWrapper(
        OllamaEmbeddings(base_url=OLLAMA_BASE_URL, model="nomic-embed-text")
    )
    return eval_llm, eval_embeddings


def evaluate_rag_response(
    question: str, answer: str, contexts: list[str]
) -> float:
    """
    Ragas faithfulness ∈ [0,1]. Returns 0.0 on ANY evaluation error —
    evaluation failure must block, never pass.
    """
    try:
        from ragas import evaluate
        from ragas.metrics import faithfulness

        if not contexts or not answer.strip():
            return 0.0

        eval_llm, eval_embeddings = _ragas_evaluators()
        result = evaluate(
            dataset={
                "question": [question],
                "answer": [answer],
                "contexts": [contexts],
                "ground_truth": [""],
            },
            metrics=[faithfulness],
            llm=eval_llm,
            embeddings=eval_embeddings,
            raise_exceptions=False,
        )
        score = float(result["faithfulness"])
        logger.info("ragas faithfulness=%.3f (threshold=%.2f)",
                    score, FAITHFULNESS_THRESHOLD)
        return score
    except Exception:  # noqa: BLE001
        logger.exception("ragas evaluation failed — treating as unfaithful")
        return 0.0


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
class AnalyzeRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=20_000)


class AnalyzeResponse(BaseModel):
    status: str  # "ok" | "blocked" | "held"
    answer: str
    faithfulness: Optional[float] = None
    trace_id: str


app = FastAPI(title="CRIM-SYS legal-backend", docs_url=None, redoc_url=None)


@app.middleware("http")
async def _auth(request, call_next):
    key = request.headers.get("X-Internal-Key", "")
    if not hmac.compare_digest(key, INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="unauthorized")
    return await call_next(request)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest, x_internal_key: str = Header(default="")) -> AnalyzeResponse:
    import hmac as _hmac

    if not _hmac.compare_digest(x_internal_key, INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="unauthorized")

    trace_id = uuid.uuid4().hex[:12]

    # ---- Gate 1: scrub the incoming question (fail-safe) --------------------
    clean_question = scrub_or_block(req.question)
    if clean_question is None:
        logger.warning("[%s] blocked at scrub gate", trace_id)
        return AnalyzeResponse(
            status="blocked",
            answer=LEGAL_HOLD_MESSAGE_AR,
            trace_id=trace_id,
        )

    # ---- Retrieve scrubbed context ------------------------------------------
    contexts = retrieve(clean_question, top_k=5)
    if not contexts:
        logger.warning("[%s] retrieval empty — hold", trace_id)
        return AnalyzeResponse(
            status="held",
            answer=RETRIEVAL_FAILURE_MESSAGE_AR,
            trace_id=trace_id,
        )

    # ---- Run the crew --------------------------------------------------------
    try:
        crew = build_crew()
        inputs = {
            "question": clean_question,
            "context": "\n".join(contexts)[:6000],
            "analysis": "",
            "precedent": "",
        }
        result = crew.kickoff(inputs=inputs)
        raw_answer = str(getattr(result, "final", None) or result)
    except Exception:  # noqa: BLE001
        logger.exception("[%s] crew execution failed — hold", trace_id)
        return AnalyzeResponse(
            status="held",
            answer=RETRIEVAL_FAILURE_MESSAGE_AR,
            trace_id=trace_id,
        )

    # ---- Gate 2: Ragas faithfulness ≥ 0.95 ----------------------------------
    score = evaluate_rag_response(clean_question, raw_answer, contexts)
    if score < FAITHFULNESS_THRESHOLD:
        logger.warning("[%s] faithfulness %.3f < %.2f — HELD",
                       trace_id, score, FAITHFULNESS_THRESHOLD)
        return AnalyzeResponse(
            status="held",
            answer=LEGAL_HOLD_MESSAGE_AR,
            faithfulness=round(score, 3),
            trace_id=trace_id,
        )

    # ---- Gate 3: scrub the OUTPUT too (model could regurgitate PII) ---------
    scrubbed_answer = scrub_or_block(raw_answer)
    if scrubbed_answer is None:
        return AnalyzeResponse(
            status="blocked",
            answer=LEGAL_HOLD_MESSAGE_AR,
            faithfulness=round(score, 3),
            trace_id=trace_id,
        )

    logger.info("[%s] ok faithfulness=%.3f", trace_id, score)
    return AnalyzeResponse(
        status="ok",
        answer=scrubbed_answer,
        faithfulness=round(score, 3),
        trace_id=trace_id,
    )
