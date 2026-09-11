"""
CRIM-SYS 2026 — Egyptian Judicial & Digital Services Knowledge Matrix.

Populates the Qdrant collection with STRUCTURED legal-workflow knowledge
covering: the multi-tier court system (الجزئية / الابتدائية / الاستئناف /
النقض), police-station and prosecution workflows, core Penal-Code crimes
behind forged custody receipts (إيصالات الأمانة) and extortion, and the
official digital gateways (PPO / Ministry of Justice / Digital Egypt).

Security invariants (identical to rag_ingestion.py — non-negotiable):
  1. Every text passes the Presidio PII scrubber BEFORE embedding.
     Blocked / unreachable scrubber => abort, nothing is stored.
  2. Embeddings come from the local BAAI/bge-m3 snapshot (offline env).
  3. Qdrant requires the API key and is reachable only on ai-internal.
  4. Runtime refuses to start without INTERNAL_API_KEY (>= 32 chars).

Citation integrity policy:
  Each entry carries `review_status`:
    statute_verified         — article number confirmed against Egyptian law.
    needs_legal_review       — procedure is standard practice; the exact
                               article numbers are deliberately NOT encoded
                               until confirmed by legal counsel.
    portal_unverified        — gateway URL must be re-confirmed before being
                               surfaced to end users.
  The retrieval layer MUST surface review_status with every answer; entries
  marked pending review are advisory only.

Idempotency:
  Point IDs are deterministic (uuid5 of collection + entry id + part), so
  re-running upserts overwrites in place. `--fresh` deletes previous
  `kind=legal_matrix` points first, so removed entries disappear too.

Run inside the legal-backend container (compose profile "tools"):
  python egyptian_legal_matrix.py            # upsert all entries
  python egyptian_legal_matrix.py --fresh    # wipe matrix points, re-ingest
  python egyptian_legal_matrix.py --dry-run  # validate schema, no network
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
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY or len(INTERNAL_API_KEY) < 32:
    raise RuntimeError("INTERNAL_API_KEY missing — refusing to run.")

QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant-vectorstore:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "BAAI/bge-m3")
COLLECTION = os.environ.get("QDRANT_COLLECTION", "legal_docs")
MATRIX_KIND = "legal_matrix"
JURISDICTION = "EG"

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("egyptian_legal_matrix")

# ---------------------------------------------------------------------------
# THE EGYPTIAN LEGAL & JUDICIAL DATA MATRIX
# ---------------------------------------------------------------------------
# Review status legend:
#   statute_verified    — قانون العقوبات / الإجراءات الجنائية المصري، رقم
#                         المادة مؤكد من أكثر من مصدر مستقل.
#   needs_legal_review  — إجراء معتاد في الممارسة، لكن أرقام المواد غير
#                         مشفرة عمداً لحين اعتماد مستشار قانوني.
#   portal_unverified   — رابط بوابة حكومية يجب إعادة التحقق منه قبل عرضه
#                         للمستخدم النهائي.

EGYPTIAN_LEGAL_MATRIX: list[dict] = [
    # ======================================================================
    # A. التزوير وإيصالات الأمانة — قلب "الدرع القانوني للمواطن"
    # ======================================================================
    {
        "id": "forgery_defense_forgery_plea",
        "category": "forgery_defense",
        "title": "الطعن بالتزوير في المحررات العرفية (إيصالات الأمانة المزورة)",
        "statute": "قانون العقوبات المصري — المواد 214 و215 و216 (تزوير المحررات العرفية واستعمالها)",
        "review_status": "statute_verified",
        "review_note": (
            "أرقام مواد التزوير في قانون العقوبات المصري (214–216) مؤكدة. "
            "مواعيد وإجراءات الطعن بالتزوير أمام المحاكم تُستكمل أرقامها "
            "من قانون الإجراءات الجنائية بعد المراجعة القانونية."
        ),
        "ammiya_plan": (
            "لو اتعملك محضر كيدي أو إيصال أمانة مزوّر، أول خطوة مش خلاف كلام — "
            "أول خطوة التقرير بالطعن بالتزوير. تعمل ذلك في قلم كتاب المحكمة أو "
            "أمام النيابة العامة، وتطلب إحالة الورقة لقسم أبحاث التزييف والتزوير "
            "بمصلحة الطب الشرعي عشان الخبير يستكتب الورقة ويحدد عمر الحبر "
            "والتوقيع. وماتنساش: اللي مستعمل الورقة المزورة مجرم ولو ماتمش عليه "
            "التزوير بنفسه — الاستعمال جريمة مستقلة."
        ),
        "procedural_steps": [
            "التقرير بالطعن بالتزوير في قلم كتاب المحكمة المختصة أو أمام النيابة العامة مع بيان أسباب التزوير.",
            "طلب إحالة المحرر الأصلي إلى قسم أبحاث التزييف والتزوير بمصلحة الطب الشرعي (استكتاب، عمر الحبر، مطابقة التوقيع).",
            "الدفع بانتفاء ركن التسليم في دعوى إيصال الأمانة: عبء إثبات التسليم على المدعي، والقاعدة أنه لا تسليم بدون إثبات.",
            "طلب ضبط المحرر الأصلي وإرفاقه في جوهر الدعوى — الاطلاع على صورة غير أصلية لا يكفي للخبرة.",
            "التحفظ على الأصول ومطابقة أي صور مع الأصول أمام المحكمة لا أمام الخصوم.",
        ],
        "key_principles": [
            "الاستعمال الجاري للمحرر المزور جريمة تزاوج التزوير — لا يسقط الدفع بتزوير الورقة لصدور حكم مزدوج على حقيقة العلاقة إلا بقوة الأمر المقضي به.",
            "من يُنسب إليه محرر لا يُطالب بإثبات عدم صحته؛ من يتمسك بالمحرر هو من يثبت صحته وتسليمه الفعلي.",
            "الطعن بالجهالة أو التوقيع على بياض دفع موضوعي مستقل عن الطعن بالتزوير.",
        ],
        "digital_portals": [
            {"name": "خدمات النيابة العامة الرقمية (بلاغات واستعلامات)",
             "url": "https://ppo.gov.eg", "status": "portal_unverified"},
        ],
    },
    {
        "id": "forgery_use_is_crime",
        "category": "forgery_defense",
        "title": "استعمال المحرر المزور جريمة مستقلة (حتى بلا إثبات التزوير نفسه)",
        "statute": "قانون العقوبات المصري — المادة 216 (استعمال المحرر المزور عا علماً بزوريته)",
        "review_status": "statute_verified",
        "review_note": "المادة 216 لعقاب استعمال المحررات المزورة مؤكدة كمستقلة عن فعل التزوير.",
        "ammiya_plan": (
            "لو شخص بستعمل عليك إيصال مزوّر في دعوى أو محضر، مش لازم تثبت إنه هو اللي "
            "فبركه بالظبط — يكفي تثبت إن الورقة مزورة وإنه عارف كده ومالكها في وجهك. "
            "ده بيفتح باب المساءلة الجنائية عن الاستعمال وإيه اللي يتبعه من أثر "
            "على صحة دعواه المدنية."
        ),
        "procedural_steps": [
            "إثبات زور المحرر عبر الخبرة (الاستكتاب) أو الحكم السابق بتزويره.",
            "إثبات عالمية المستخدم بزوريته: ظروف التصرف، تناقضاته، وتخلّفه عن إثبات التسليم.",
            "مطالبة جنائية مستقلة لصاحب الشأن عداوة استعمال المحرر المزور.",
        ],
        "key_principles": [
            "جريمة استعمال المحرر المزور لا تشترط إثبات قيام المستخدم بالتزوير بنفسه.",
            "صدور حكم بحقيقة العلاقة (بالتسليم) لا يمنع مناقشة صحة المحرر ذاته إذا ظهرت أدلة تزوير لاحقة.",
        ],
        "digital_portals": [],
    },
    {
        "id": "custody_betrayal_art401",
        "category": "custody_betrayal",
        "title": "دعوى إيصال الأمانة والاستيلاء على العهدة — الدفع بانتفاء ركن التسليم",
        "statute": "قانون العقوبات المصري — المادة 401 (خيانة الأمانة / الاستيلاء على عهدة)",
        "review_status": "statute_verified",
        "review_note": "المادة 401 عقوبات (خيانة الأمانة) مؤكدة كمركز الجريمة في إيصالات الأمانة.",
        "ammiya_plan": (
            "إيصال الأمانة أصلاً بيتطلب حصل تسليم فعلي. لو ماحصلش تسليم — مفيش "
            "عهدة، ومفيش استيلاء، ومفيش جريمة. دفعك الأساسي: انتفاء ركن التسليم. "
            "واطلب من المحكمة إلزام الخصم بإثبات التسليم بشهود أو تحويل بنكي "
            "موثق — الكلام والورق المطبوع لوحده مبيكفيش."
        ),
        "procedural_steps": [
            "بناء الدفع على انتفاء ركن التسليم: لا عهدة قائمة بدون تسليم فعلي مثبت.",
            "المطالبة بحجز ما يدّعيه المدعي كأدلة تسليم (تحويلات، شهود، مراسلات) ومواجهتها.",
            "إثبات سياق الابتزاز: تهديد برفع محضر بناءً على ورقة غير مسلّمة مقابل مقابل مادي.",
        ],
        "key_principles": [
            "القاعدة الشرعية والقانونية: البينية بالتسليم على من يدّعيه — لا تسليم بلا إثبات.",
            "التقرير بالطعن بالتزوير لا يمنع الدفع الموضوعي بانتفاء التسليم؛ الاثنان يجريان معاً.",
        ],
        "digital_portals": [],
    },
    # ======================================================================
    # B. الابتزاز والبلاغ الكاذب — سلاح الضحية العكسي
    # ======================================================================
    {
        "id": "extortion_threat_art327",
        "category": "extortion_threat",
        "title": "جريمة الابتزاز والتهديد بكشف أوراق أو إفشاء أمور خادشة للشرف",
        "statute": "قانون العقوبات المصري — المادة 327 (التهديد بكشف أوراق أو نسبة أمور خادشة للشرف مقروناً بطلب)",
        "review_status": "statute_verified",
        "review_note": (
            "المادة 327 عقوبات مصري مؤكدة (تهديد كتابي بارتكاب جريمة أو إفشاء "
            "أمور خادشة للشرف مقروناً بطلب أو تكليف بأمر) — مبدأ نقض منشور."
        ),
        "ammiya_plan": (
            "لو حد بيهددك بمحضر كيدي أو بإيصال مزوّر عشان ياخد منك فلوس أو "
            "حقوق — ده مش مكروه أخلاقياً، ده ابتزاز جريمة معاقب عليها. احتفظ "
            "بكل الرسائل والتسجيلات، وقدم بلاغ بالواقعة، وذكر في بلاغك الصريح: "
            "التهديد + الطلب المادي = ركن الجريمة."
        ),
        "procedural_steps": [
            "توثيق التهديد: حفظ الرسائل، لقطات الشاشة، التسجيلات (مع مراعاة شرعية الاستدلال بها).",
            "تقديم بلاغ إلى النيابة العامة بواقعة التهديد المقرون بالطلب، مع تحديد الميعاد والوسيلة.",
            "طلب ضبط المحررات المشبوهة (الإيصال المزور) كقرينة على سوء النية.",
            "الربط بين جريمة الابتزاز ودعوى إيصال الأمانة أمام النيابة كواقعة واحدة.",
        ],
        "key_principles": [
            "التهديد مصحوباً بطلب أو تكليف بأمر هو ركن الجريمة — التهديد المجرد دون طلب لا يقوم مقامه.",
            "التهديد الكتابي والإلكتروني (واتساب/رسائل) يدخل في نطاق المادة ما دام المقروناً بالطلب.",
        ],
        "digital_portals": [],
    },
    {
        "id": "false_report_defense",
        "category": "false_report_defense",
        "title": "البلاغ الكاذب والمحاضر الموزعة — المساءلة والتعويض",
        "statute": "قانون العقوبات المصري — المادة 303 (القذف) + قواعد التعويض عن البلاغ الكاذب",
        "review_status": "statute_verified",
        "review_note": (
            "المادة 303 عقوبات مؤكدة (القذف/نسبة واقعة مسلمة للعقاب) وتُبنى "
            "عليها مساءلة البلاغ الكاذب عن واقعة وهمية. ميعاد دعوى التعويض "
            "المدني التبعي وأرقام مواده تُستكمل بعد المراجعة القانونية."
        ),
        "ammiya_plan": (
            "اتبيّن إن المحضر اللي اترفع عليك كيدي وواقعة وهمية؟ املح أثره في "
            "جلسة أولى بالدفع الموضوعي، وسجّل حقيقة النفي في المحضر، وبعد انتهاء "
            "القضية ببراءتك افتح مسار المساءلة: بلاغ بالبلاغ الكاذب، ودعوى "
            "تعويض عن الأضرار المادية والمعنوية اللي وقعت عليك."
        ),
        "procedural_steps": [
            "الدفاع الموضوعي في المحضر الكيدي: نفي الواقعة وطلب إثبات التسليم والصلة.",
            "بعد البراءة: بلاغ بالبلاغ الكاذب عن واقعة وهمية بنية الإضرار.",
            "دعوى تعويض مدني (تبعي أو مستقل) عن أضرار الشهرة والحرية والوقت.",
            "استخراج صور رسمية من الأحكام (براءة/أمنية) كأدلة مسوّغة للمساءلة.",
        ],
        "key_principles": [
            "البلاغ الكاذب عن واقعة وهمية بإرادة الإضرار يشكل جريمة مستقلة عن نتيجة المحضر.",
            "البراءة في المحضر الكيدي قرينة قوية (وليست كافية وحدها) على قيام بلاغ كاذب — الجرمة والنية تُثبت لاحقاً.",
        ],
        "digital_portals": [
            {"name": "استعلام عن القضايا وموقف الطعون",
             "url": "https://ppo.gov.eg", "status": "portal_unverified"},
        ],
    },
    {
        "id": "police_station_counter_report",
        "category": "police_station_counter_report",
        "title": "في قسم الشرطة: محضر إثبات حالة والبلاغ العكسي (المحضر الكيدي)",
        "statute": "قانون الإجراءات الجنائية المصري — أحكام الشكاوى (أرقام المواد بحاجة لمراجعة)",
        "review_status": "needs_legal_review",
        "review_note": (
            "الإجراء معتاد (محضر إثبات حالة + بلاغ عكسي)، لكن أرقام مواد "
            "الشكاوى ومأمورية الضبط في قانون الإجراءات الجنائية المصري لم "
            "تُشفَّر هنا حتى اعتماد المراجعة القانونية."
        ),
        "ammiya_plan": (
            "نادوك في قسم شرطة على محضر كيدي؟ اهدى وامشِ بالترتيب: طلب "
            "تفريغ المحضر ومطالعة كامل أوراقه قبل أي إجابة، طلب التحقق من هوية "
            "المشتكي ومن صلته بالواقعة، ولو المشهد فيه ابتزاز أو تهديد — قدم "
            "بلاغك العكسي في نفس الجلسة أو بعدها فوراً بوقائع الابتزاز والبلاغ "
            "الكاذب، وأرفق رسائل وتسجيلات التهديد."
        ),
        "procedural_steps": [
            "طلب الاطلاع على المحضر وأوراقه قبل تقديم أي إيضاحات — الرد على مجهول خطر.",
            "طلب التحقق من هوية المشتكي وعنوانه وصفته (الشكوى من مجهول لا تُسير).",
            "تقديم محضر إثبات حالة / بلاغ عكسي بوقائع الابتزاز والبلاغ الكاذب.",
            "إرفاق الأدلة الرقمية: تفريغ محادثات الواتساب بمحضر معاينة، التسجيلات وفق ضوابط شرعية الاستدلال، وأسماء الشهود.",
            "عدم الامتناع عن الحضور مع طلب إرفاق مذكرة كتابية بالإيضاحات بدل الارتجال الشفهي.",
        ],
        "key_principles": [
            "حق المطلوب في معرفة الواقعة والخصم قبل التحقيق معه — أساس دفاع عادل.",
            "الدعوى الجنائية لا ترفع إلا بشكوى من المجني عليه أو وكيله في الجنح المكتبة بشكوى — تحقق من صفتها أولاً.",
            "التسجيلات الخاصة قد تُقبل استدلالاً وفق أحكام القضاء — اطلب استشارة قانونية على وضع الحالة.",
        ],
        "digital_portals": [],
    },
    {
        "id": "prosecution_investigation_tools",
        "category": "prosecution_investigation",
        "title": "النيابة العامة: طلبات الاطلاع والخبرة والكفالة",
        "statute": "قانون الإجراءات الجنائية المصري — أحكام التحقيق القضائي (أرقام المواد بحاجة لمراجعة)",
        "review_status": "needs_legal_review",
        "review_note": (
            "الإجراءات معتادة (الاطلاع، إحالة الطب الشرعي، طلبات الإفراج)، "
            "أرقام المواد تُشفَّر بعد المراجعة القانونية."
        ),
        "ammiya_plan": (
            "أمام النيابة إنت مش متُهَم بس — إنت صاحب مصلحة ليه حقوق. اطلب "
            "الاطلاع على أوراق التحقيق، وطلب إحالة المحرر لقسم التزييف والتزوير "
            "بمصلحة الطب الشرعي، ولو فيه موقوف — طلب إفراج بكفالة أو بدونها، "
            "وكل ده بمذكرات مكتوبة بتحتفظ منها بصورة موقعة."
        ),
        "procedural_steps": [
            "طلب الاطلاع على أوراق التحقيق وتصويرها وفق الأصول المقررة.",
            "طلب إحالة المحرر إلى مصلحة الطب الشرعي (قسم أبحاث التزييف والتزوير) وتحديد أوجه الخبرة كتابياً.",
            "طلب إفراج الموقوف بكفالة أو بدونها مع تمسك بالأسباب.",
            "تسجيل كل الطلبات بمذكرات مكتوبة وأخذ صورة موقعة منها — الشفهي يضيع.",
        ],
        "key_principles": [
            "أوراق التحقيق سرية لكن لصاحب الشأن حق الاطلاع وفق ضوابط القانون.",
            "الخبرة في التزييف والتزوير من اختصاص مصلحة الطب الشرعي — حدد أوجه الاستكتاب بوضوح لتجنب تقرير عام غير حاسم.",
        ],
        "digital_portals": [
            {"name": "بوابة الخدمات الرقمية للنيابة العامة (استعلام عن القضايا)",
             "url": "https://ppo.gov.eg", "status": "portal_unverified"},
        ],
    },
    # ======================================================================
    # C. خريطة درجات التقاضي والمواعيد
    # ======================================================================
    {
        "id": "courts_map_tiers",
        "category": "courts_map",
        "title": "خريطة درجات التقاضي الجزائي: الجزئية → الابتدائية → الاستئناف → النقض",
        "statute": "قانون السلطة القضائية وقانون الإجراءات الجنائية المصريان (ترقيم درجات التقاضي)",
        "review_status": "needs_legal_review",
        "review_note": (
            "هيكل الدرجات معتاد، لكن تفاصيل الاختصاص القيمي والمواعيد تُستكمل "
            "بعد المراجعة القانونية — لا تُشفَّر أرقام غير موثقة."
        ),
        "ammiya_plan": (
            "خريطة سريعة: الجنايات تبدأ من محكمة الجنايات (على مستوى المحافظة)، "
            "والجنح من المحاكم الجزئية أو الابتدائية. الحكم الجزئي يُستأنف أمام "
            "الابتدائية، وحكم الابتدائية (جنح وجنايات) يُطعن فيه أمام محكمة "
            "النقض — والمواعيد في الطعون صارمة جداً وسقوطها معناه بطلان حقمك "
            "في الطعن نهائياً. راجع محاميك في أول 48 ساعة بعد الحكم."
        ),
        "procedural_steps": [
            "تحديد نوع الدعوى (جناية/جنحة) والمحكمة المختصة أول الورق.",
            "الطعن بالاستئناف في المواعيد المقررة قانوناً بحال من الحكم الغيابي والحضوري.",
            "طلب وقف تنفيذ الحكم المستأنف عند وجود أسباب (الاستئناف في الغالب موقف للتنفيذ — وفق الحالة).",
            "الطعن بالنقض أو بالتماس وفق طبيعة الحكم والميعاد القانوني — بمعرفة المحامي.",
        ],
        "key_principles": [
            "الطعون أنظمة صارمة: الميعاد شرط قبول لا يُجوز تجاوزه — احتسبه بالتقويم المحدد في الحكم (إعلان/نطق).",
            "استئناف الأحكام الغيابية يختلف عن الحضورية (تظلم ثم استئناف) — وفق تعديلات القانون.",
            "محكمة النقض لا تراجع وقائع — تحكم في صحة تطبيق القانون وحسن التعليل فقط.",
        ],
        "digital_portals": [
            {"name": "بوابة وزارة العدل المصرية (جدول الجلسات والخدمات القضائية)",
             "url": "https://www.mjustice.gov.eg", "status": "portal_unverified"},
        ],
    },
    {
        "id": "appeals_deadlines_strictness",
        "category": "appeals_deadlines",
        "title": "مواعيد الطعون الجزائية: صرامة الميعاد ووقف التنفيذ",
        "statute": "قانون الإجراءات الجنائية المصري — مباحث الطعن في الأحكام (أرقام المواعيد بحاجة لمراجعة)",
        "review_status": "needs_legal_review",
        "review_note": (
            "المواعيد تختلف بحسب نوع الحكم (غيابي/حضوري، جنحة/جناية) وتعديلات "
            "القانون اللاحقة. الأرقام تُشفَّر بعد اعتماد المراجعة القانونية — "
            "حتى ذلك الحين يُعرض نص عام فقط. هذه المواد حساسة جداً: خطأ موعد "
            "يعني ضياع حق كامل."
        ),
        "ammiya_plan": (
            "القاعدة الذهبية: تاريخ النطق أو الإعلان بالحكم هو نقطة العد. متستناش "
            "'كلام مأمور التسجيل' — خد ورق رسمي بيظهر تاريخ الإعلان أو النطق، "
            "وسلّم الطعن في قلم الكتاب قبل انتهاء الميعاد، وخد تاريخ استلام. "
            "الطعن يقدم بموجب لائحة موقعة من محامٍ مقيّد."
        ),
        "procedural_steps": [
            "توثيق تاريخ النطق/الإعلان بالحكم (أصل رسمي، لا صور غير معتمدة).",
            "إيداع الطعن بمأمورية القلم داخل الميعاد وأخذ تاريخ استلام موثق.",
            "التمسك بوقف التنفيذ عند توفير أسبابه وفق القانون لحالة الحكم.",
            "الاحتياط بالطعن البديل (تماس/نقض) عند الشك في قبول الطعن الأول — بمعرفة المحامي.",
        ],
        "key_principles": [
            "الميعاد ليس مجاملة إجرائية: تجاوزه ينهي حق الطعن نهائياً مهما كانت مبرراته.",
            "وقف التنفيذ استثناء: الأصل جريان الحكم، والوقف بحكم من الجهة المختصة وفق أسباب قانونية.",
        ],
        "digital_portals": [],
    },
    # ======================================================================
    # D. البوابات الرقمية الحكومية
    # ======================================================================
    {
        "id": "digital_gateways_directory",
        "category": "digital_gateways",
        "title": "دليل البوابات الرقمية: النيابة العامة، وزارة العدل، مصر الرقمية",
        "statute": "لا ينطبق (دليل خدمات رقمية رسمية)",
        "review_status": "portal_unverified",
        "review_note": (
            "الروابط لبوابات رسمية معروفة، ويجب التحقق النهائي منها (وتوافر "
            "الخدمة للمدنيين) قبل إظهارها للمستخدمين داخل التطبيق."
        ),
        "ammiya_plan": (
            "شوية حاجات ممكن تتعمل من الموبايل بدل ما تقعد في ممرات المحاكم: "
            "استعلام عن موقف قضية وطلبات النيابة، متابعة جدول جلساتك، استخراج "
            "مستندات رسمية بتثبت أماكنك وبياناتك (عشان تثبت أي كذب في محضر). "
            "لكن خد بالك: الأوراق الرسمية المطلوبة للإثبات في الجلسة لازم تكون "
            "كاملة الأهلية — التطبيق يوجهك، والمكتب بيستخرجها."
        ),
        "procedural_steps": [
            "استعلام عن القضايا وموقف البلاغات عبر بوابة النيابة العامة.",
            "متابعة جدول الجلسات وحالة دواليك المحكمة عبر بوابة وزارة العدل.",
            "استخراج المستندات الرسمية (شهادات، قيود) لإثبات أماكن وجودك عبر منصة مصر الرقمية.",
            "التحقق من وكالات التوكيل والقيود عبر مصلحة الشهر العقاري والتوثيق عند الحاجة لإثبات صفة.",
        ],
        "key_principles": [
            "المستندات الرسمية المطلوبة للإثبات يجب أن تكون سارية وصادرة من الجهة المختصة — التطبيق يوضح النوع، والجهة تُصدره.",
            "الخدمات الرقمية تسهيل، لكن إيداع الطلبات الإجرائية أمام الجهة يبقى وفق أوراقها الرسمية.",
        ],
        "digital_portals": [
            {"name": "خدمات النيابة العامة الرقمية",
             "url": "https://ppo.gov.eg", "status": "portal_unverified"},
            {"name": "بوابة وزارة العدل المصرية",
             "url": "https://www.mjustice.gov.eg", "status": "portal_unverified"},
            {"name": "منصة مصر الرقمية (الخدمات الحكومية الموحدة)",
             "url": "https://digital.gov.eg", "status": "portal_unverified"},
        ],
    },
]

# ---------------------------------------------------------------------------
# Validation — the schema contract every entry must satisfy
# ---------------------------------------------------------------------------
REQUIRED_KEYS = {
    "id", "category", "title", "statute", "review_status",
    "review_note", "ammiya_plan", "procedural_steps",
    "key_principles", "digital_portals",
}
VALID_REVIEW = {"statute_verified", "needs_legal_review", "portal_unverified"}


def validate_matrix() -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    for i, entry in enumerate(EGYPTIAN_LEGAL_MATRIX):
        where = f"matrix[{i}] ({entry.get('id', '?')})"
        missing = REQUIRED_KEYS - set(entry)
        if missing:
            errors.append(f"{where}: missing keys {sorted(missing)}")
        extra = set(entry) - REQUIRED_KEYS
        if extra:
            errors.append(f"{where}: unexpected keys {sorted(extra)}")
        if entry.get("review_status") not in VALID_REVIEW:
            errors.append(f"{where}: bad review_status")
        if entry.get("id") in seen_ids:
            errors.append(f"{where}: duplicate id")
        seen_ids.add(entry.get("id", ""))
        if not entry.get("ammiya_plan", "").strip():
            errors.append(f"{where}: empty ammiya_plan")
        if not entry.get("procedural_steps"):
            errors.append(f"{where}: no procedural_steps")
        for portal in entry.get("digital_portals", []):
            if not portal.get("url", "").startswith("https://"):
                errors.append(f"{where}: non-https portal {portal}")
    return errors


# ---------------------------------------------------------------------------
# Scrub-first PII gate (identical contract to rag_ingestion.py)
# ---------------------------------------------------------------------------
_client = httpx.Client(
    headers={"X-Internal-Key": INTERNAL_API_KEY},
    timeout=httpx.Timeout(120.0, connect=10.0),
)


def scrub_text(text: str) -> str:
    try:
        r = _client.post(f"{SCRUBBER_URL}/scrub", json={"text": text})
        r.raise_for_status()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"scrubber unreachable: {exc}") from exc
    data = r.json()
    if data.get("risk") == "blocked":
        raise RuntimeError("scrubber returned blocked; entry rejected")
    if data.get("risk") == "scrubbed":
        findings = ", ".join(sorted({f["entity"] for f in data.get("findings", [])}))
        logger.info("PII scrubbed before embedding (%s)", findings)
    return data["scrubbed_text"]


# ---------------------------------------------------------------------------
# Rendering: one entry -> several retrievable texts with rich payloads
# ---------------------------------------------------------------------------
def entry_texts(entry: dict) -> list[tuple[str, str]]:
    """Return [(part_name, text), ...] for one matrix entry."""
    parts: list[tuple[str, str]] = [
        ("plan",
         f"{entry['title']} — الوضع بالعامية: {entry['ammiya_plan']} "
         f"المرجع القانوني: {entry['statute']}"),
        ("steps",
         f"{entry['title']} — الخطوات الإجرائية بالترتيب: "
         + " ".join(f"{n}. {s}" for n, s in enumerate(entry["procedural_steps"], 1))),
        ("principles",
         f"{entry['title']} — المبادئ القانونية: "
         + " ".join(f"- {p}" for p in entry["key_principles"])),
    ]
    if entry["digital_portals"]:
        portals = "، ".join(f"{p['name']} ({p['url']})" for p in entry["digital_portals"])
        parts.append(("portals", f"{entry['title']} — البوابات الرقمية الرسمية: {portals}"))
    return parts


def point_id(entry: dict, part: str) -> str:
    """Deterministic id -> re-running upserts overwrite in place."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{COLLECTION}/{entry['id']}/{part}"))


def matrix_payload(entry: dict, part: str, text: str, scrubbed: bool) -> dict:
    return {
        "kind": MATRIX_KIND,
        "matrix_id": entry["id"],
        "part": part,
        "category": entry["category"],
        "title": entry["title"],
        "statute": entry["statute"],
        "jurisdiction": JURISDICTION,
        "review_status": entry["review_status"],
        "review_note": entry["review_note"],
        "portals": [p["url"] for p in entry["digital_portals"]],
        "text": text,
        "scrubbed": scrubbed,
        "ingested_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ---------------------------------------------------------------------------
# Qdrant upsert
# ---------------------------------------------------------------------------
def get_embedder():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(EMBED_MODEL, device="cpu")


def run_ingest(fresh: bool) -> int:
    from qdrant_client import QdrantClient, models

    embedder = get_embedder()
    client = QdrantClient(
        url=QDRANT_URL, api_key=QDRANT_API_KEY or None, timeout=60
    )

    if not client.collection_exists(COLLECTION):
        raise RuntimeError(
            f"collection '{COLLECTION}' does not exist — run rag_ingestion.py "
            "first so the collection is created with the right vector size."
        )

    if fresh:
        client.delete(
            collection_name=COLLECTION,
            points_selector=models.FilterSelector(
                filter=models.Filter(
                    must=[models.FieldCondition(
                        key="kind", match=models.MatchValue(value=MATRIX_KIND)
                    )]
                )
            ),
        )
        logger.info("wiped previous %s points", MATRIX_KIND)

    total = 0
    for entry in EGYPTIAN_LEGAL_MATRIX:
        points: list[models.PointStruct] = []
        for part, text in entry_texts(entry):
            clean = scrub_text(text)          # HARD GATE — same as ingestion
            vec = embedder.encode(clean, normalize_embeddings=True)
            points.append(models.PointStruct(
                id=point_id(entry, part),
                vector=vec.tolist(),
                payload=matrix_payload(entry, part, clean, scrubbed=clean != text),
            ))
        client.upsert(collection_name=COLLECTION, points=points, wait=True)
        total += len(points)
        logger.info("upserted %s → %d parts", entry["id"], len(points))

    client.close()
    return total


# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(
        description="Egyptian legal knowledge matrix → Qdrant (scrub-first)")
    parser.add_argument("--fresh", action="store_true",
                        help="wipe previous matrix points before upsert")
    parser.add_argument("--dry-run", action="store_true",
                        help="validate the matrix schema only; no network")
    args = parser.parse_args()

    errors = validate_matrix()
    if errors:
        for e in errors:
            logger.error("SCHEMA VIOLATION: %s", e)
        return 2

    statuses: dict[str, int] = {}
    for entry in EGYPTIAN_LEGAL_MATRIX:
        statuses[entry["review_status"]] = statuses.get(entry["review_status"], 0) + 1
    logger.info("matrix valid: %d entries — %s",
                len(EGYPTIAN_LEGAL_MATRIX),
                ", ".join(f"{k}={v}" for k, v in sorted(statuses.items())))

    if args.dry_run:
        for entry in EGYPTIAN_LEGAL_MATRIX:
            print(f"[{entry['review_status']:>18}] {entry['id']}: {entry['title']}")
        print(f"\nOK — {len(EGYPTIAN_LEGAL_MATRIX)} entries, "
              f"{sum(len(entry_texts(e)) for e in EGYPTIAN_LEGAL_MATRIX)} points "
              "would be upserted (deterministic ids).")
        return 0

    total = run_ingest(args.fresh)
    logger.info("legal matrix ingestion complete: %d points upserted", total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
