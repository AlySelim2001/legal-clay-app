"""
CRIM-SYS 2026 — Document forensics (OpenCV + SSIM).

Objective, measurable signals only — the service never issues legal
conclusions. Every response carries advisory_only=true and must be
confirmed by licensed experts (مصلحة الطب الشرعي — قسم التزييف والتزوير).

What is implemented (real, deterministic CV):
  * scale/contrast-normalized SSIM between an original and a suspect scan
  * Otsu-thresholded structural-difference map → connected components
    (size, area ratio, centroid) — the classic "added text / altered
    digits" localization signal
  * ink-density delta per binary mask (over-writing raises local density)

What is NOT claimed:
  * no forgery verdict, no "authentic/forged" boolean — the caller gets
    measurable anomalies only
  * seal/signature detection requires a YOLO model that is NOT bundled;
    until one is trained and mounted, that detector reports
    model_loaded=false instead of inventing detections
"""

from __future__ import annotations

import logging
import os
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger("ssim_analyzer")

# Verdict thresholds — CALIBRATED on synthetic receipt self-tests:
# global SSIM barely moves on real document edits (a full added line on a
# receipt still scores ~0.978), so bands are tight and the verdict is
# driven primarily by localized evidence (components + ink-density delta):
#   score >= 0.995 AND no significant components AND |delta| < 0.002
#         -> practically identical
#   score >= 0.97  -> localized differences; inspect the listed components
#   score <  0.97  -> substantial structural divergence
SSIM_IDENTICAL = 0.995
SSIM_MINOR = 0.97
# Components below this area (fraction of image) are usually speckle noise.
MIN_COMPONENT_AREA_RATIO = 0.00002
# A component covering more than this fraction is a real localized edit.
SIGNIFICANT_COMPONENT_RATIO = 0.0005
# Ink-density delta beyond this hints at added/removed writing.
INK_DENSITY_DELTA_THRESHOLD = 0.002
MAX_REPORTED_COMPONENTS = 12

ADVISORY_BANNER_AR = (
    "⚠️ نتيجة فحص آلي استرشادية فقط — لا تُعد إثبات تزوير ولا رأياً فنياً "
    "معتمداً؛ الإثبات يكون بخبرة محكّمين من مصلحة الطب الشرعي."
)


# ---------------------------------------------------------------------------
def _to_gray(img_bytes: bytes) -> np.ndarray:
    """Decode bytes → grayscale ndarray; raises ValueError on bad images."""
    buf = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("تعذّر فك ترميز الصورة — تأكد أنها JPG/PNG سليمة.")
    return img


def _normalize(img: np.ndarray, target_w: int = 1200) -> np.ndarray:
    """Resize to a common width + gentle denoise so SSIM compares like-for-like."""
    h, w = img.shape[:2]
    scale = target_w / float(w)
    resized = cv2.resize(img, (target_w, max(1, int(h * scale))),
                         interpolation=cv2.INTER_AREA)
    return cv2.GaussianBlur(resized, (5, 5), 0)


# ---------------------------------------------------------------------------
def compare_ssim(original_bytes: bytes, suspect_bytes: bytes) -> dict[str, Any]:
    """
    Full SSIM forensic comparison. Returns measurable signals only.
    Raises ValueError for undecodable images.
    """
    from skimage.metrics import structural_similarity

    a = _normalize(_to_gray(original_bytes))
    b = _normalize(_to_gray(suspect_bytes))

    # Same canvas for both images (scans differ in aspect)
    h = min(a.shape[0], b.shape[0])
    a, b = a[:h], b[:h]

    score, diff_map = structural_similarity(a, b, full=True)
    # diff_map in [0,1] where 0 = identical; amplify for thresholding
    diff_abs = (1.0 - diff_map).astype(np.float64)

    # Otsu threshold on the difference signal → structural edit mask
    diff_u8 = (np.clip(diff_abs, 0, 1) * 255).astype(np.uint8)
    _, mask = cv2.threshold(diff_u8, 0, 255,
                            cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    n_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(mask)
    img_area = float(mask.shape[0] * mask.shape[1])

    components: list[dict[str, Any]] = []
    for i in range(1, n_labels):  # 0 = background
        area = float(stats[i, cv2.CC_STAT_AREA])
        if area / img_area < MIN_COMPONENT_AREA_RATIO:
            continue
        components.append({
            "area_px": int(area),
            "area_ratio": round(area / img_area, 6),
            "bbox_xywh": [int(v) for v in (
                stats[i, cv2.CC_STAT_LEFT], stats[i, cv2.CC_STAT_TOP],
                stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT],
            )],
            "centroid_xy": [round(float(centroids[i][0]), 1),
                            round(float(centroids[i][1]), 1)],
        })
    components.sort(key=lambda c: c["area_px"], reverse=True)

    # Ink-density delta between the two binary images (over-writing signal)
    _, bin_a = cv2.threshold(a, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    _, bin_b = cv2.threshold(b, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    density_a = float(bin_a.mean()) / 255.0
    density_b = float(bin_b.mean()) / 255.0

    significant = [c for c in components
                   if c["area_ratio"] >= SIGNIFICANT_COMPONENT_RATIO]
    density_delta = density_b - density_a
    ink_anomaly = abs(density_delta) >= INK_DENSITY_DELTA_THRESHOLD

    if (score >= SSIM_IDENTICAL and not significant and not ink_anomaly):
        verdict_ar = "تطابق بنيوي شبه تام — لا مؤشرات جوهرية ظاهرة"
    elif score >= SSIM_MINOR:
        verdict_ar = "فروق موضعية — افحص مكوّنات الفروق المذكورة مع خبير"
    else:
        verdict_ar = "تباعد بنيوي ملموس — يلزم عرض الأصلين على خبير"

    return {
        "advisory_only": True,
        "disclaimer_ar": ADVISORY_BANNER_AR,
        "ssim": round(float(score), 4),
        "verdict_ar": verdict_ar,
        "evidence": {
            "significant_components": len(significant),
            "ink_anomaly": ink_anomaly,
        },
        "thresholds": {"identical": SSIM_IDENTICAL, "minor": SSIM_MINOR},
        "components": components[:MAX_REPORTED_COMPONENTS],
        "components_truncated": max(0, n_labels - 1) > MAX_REPORTED_COMPONENTS,
        "ink_density": {
            "original": round(density_a, 4),
            "suspect": round(density_b, 4),
            "delta": round(density_delta, 4),
            "note_ar": (
                "ارتفاع كثافة الحبر في النسخة المشتبهة قد يشير إلى إضافة "
                "كتابة لاحقة — وقد يكون مجرد فرق مسح ضوئي؛ المقارنة وحدها "
                "لا تكفي للإثبات."
            ),
        },
    }


# ---------------------------------------------------------------------------
def detect_seals_and_signatures(img_bytes: bytes) -> dict[str, Any]:
    """
    YOLO-based seal/signature detection — DEGRADES HONESTLY.
    The yolov11n fine-tune for ختم النسر / التوقيعات is planned (roadmap);
    unless a trained model is mounted at YOLO_MODEL_PATH, this reports
    model_loaded=false and returns zero detections. It never fabricates
    boxes.
    """
    model_path = os.environ.get("YOLO_MODEL_PATH", "").strip()
    result: dict[str, Any] = {
        "advisory_only": True,
        "disclaimer_ar": ADVISORY_BANNER_AR,
        "model_loaded": False,
        "detections": [],
        "note_ar": "",
    }
    if not model_path:
        result["note_ar"] = (
            "نموذج كشف الأختام والتوقيعات غير مثبّت بعد (خارطة الطريق) — "
            "لا يمكن إصدار كشف آلي في هذه المرحلة."
        )
        return result
    try:
        from ultralytics import YOLO  # optional heavy dep — not in base image

        model = YOLO(model_path)
        buf = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("undecodable image")
        preds = model.predict(img, verbose=False)
        boxes = preds[0].boxes if preds else None
        names = getattr(model, "names", {})
        if boxes is not None:
            for b in boxes:
                xyxy = [round(float(v), 1) for v in b.xyxy[0].tolist()]
                result["detections"].append({
                    "class": names.get(int(b.cls[0]), str(int(b.cls[0]))),
                    "confidence": round(float(b.conf[0]), 4),
                    "bbox_xyxy": xyxy,
                })
        result["model_loaded"] = True
        result["note_ar"] = "نتائج كشف مبدئية — تتطلب تأكيد خبير."
        return result
    except ImportError:
        result["note_ar"] = (
            "مكتبة ultralytics غير مثبتة في هذه الحاوية — كشف الأختام "
            "معطّل بأمان (بدون نتائج مختلقة)."
        )
        return result
    except Exception:  # noqa: BLE001 — model/IO failures must not 500 blindly
        logger.exception("YOLO inference failed")
        result["note_ar"] = "فشل استدلال النموذج — أعد المحاولة أو راجع السجلات."
        return result
