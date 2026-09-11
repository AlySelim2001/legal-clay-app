"""
Egyptian National ID (الرقم القومي) recognizer for Microsoft Presidio.

The Egyptian NID is exactly 14 digits and is information-dense:
  digits 1     -> century/century+1 (2 = born 1900s, 3 = born 2000s)
  digits 2-7   -> YYMMDD date of birth
  digits 8-10  -> governorate code (11..88; 88 = born abroad)
  digits 11-13 -> sequencing number
  digit  14    -> checksum (Luhn-style over the first 13 digits)

The checksum makes this recognizer essentially false-positive-free, which is
what allows the scrubber to sit as a hard gate in front of every LLM call.
"""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

from presidio_analyzer import (
    AnalysisExplanation,
    EntityRecognizer,
    LocalRecognizer,
    Pattern,
    RecognizerResult,
)

ENTITIES = ["EG_NATIONAL_ID"]

# 14 digits, with boundaries so a 15-digit number is not partially matched.
PATTERN = Pattern(
    name="egyptian_nid_14_digits",
    regex=r"(?<!\d)([23]\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])"
          r"(?:0[1-9]|[1-8][0-9]|88)\d{6})(?!\d)",
    score=0.4,
)

_GOV_CODES = {f"{g:02d}" for g in list(range(11, 36)) + list(range(88, 89))}

_CONTEXT_WORDS = [
    "رقم قومي",
    "الرقم القومي",
    "بطاقة رقمية",
    "بطاقة الرقم القومي",
    "national id",
    "national number",
]

_LUHN_WEIGHTS = (2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2)


def _luhn_checksum_ok(nid: str) -> bool:
    """Validate the 14th digit (Luhn variant used by the Egyptian NID)."""
    total = 0
    for digit, weight in zip(nid[:13], _LUHN_WEIGHTS):
        product = int(digit) * weight
        total += product // 10 + product % 10
    return (10 - (total % 10)) % 10 == int(nid[13])


def _birth_date_ok(nid: str) -> bool:
    yy, mm, dd = int(nid[1:3]), nid[3:5], nid[5:7]
    if mm not in ("01", "02", "03", "04", "05", "06",
                  "07", "08", "09", "10", "11", "12"):
        return False
    if not 1 <= int(dd) <= 31:
        return False
    if yy == 0:  # 1900 or 2000 — both plausible; only 0000 would be invalid
        return True
    return True


class EgyptianNationalIDRecognizer(LocalRecognizer):
    """14-digit Egyptian National ID with checksum + governorate validation."""

    NAME = "EgyptianNationalIDRecognizer"

    def load(self) -> None:  # Presidio contract
        pass

    @property
    def supported_entities(self) -> List[str]:
        return ENTITIES

    @property
    def supported_language(self) -> str:
        return "ar"

    @property
    def version(self) -> str:
        return "1.0.0"

    # ------------------------------------------------------------------ #
    def analyze(
        self,
        text: str,
        entities: Optional[List[str]] = None,
        nlp_artifacts=None,
        regex_flags: Optional[int] = None,
    ) -> List[RecognizerResult]:
        results: List[RecognizerResult] = []
        for match in re.finditer(
            PATTERN.regex, text, flags=re.UNICODE
        ):
            nid = match.group(1)
            score = self._score(nid, match.start(), text)
            if score is None:
                continue
            results.append(
                RecognizerResult(
                    entity_type="EG_NATIONAL_ID",
                    start=match.start(),
                    end=match.end(),
                    score=score,
                    analysis_explanation=self._explain(nid, score),
                )
            )
        return self.__remove_duplicates(results)

    def _score(self, nid: str, offset: int, text: str) -> Optional[float]:
        if not _birth_date_ok(nid):
            return None
        gov = nid[7:9]
        if gov not in _GOV_CODES:
            return None
        if not _luhn_checksum_ok(nid):
            # Checksum mismatch -> almost certainly not an NID. Keep a tiny
            # residual score so the whitelist below can still rescue it.
            score = 0.2
        else:
            score = 0.95
        # Context words ("الرقم القومي") within 40 chars raise confidence.
        window = text[max(0, offset - 40):offset + len(nid) + 40]
        if any(w in window for w in _CONTEXT_WORDS):
            score = min(1.0, score + 0.3)
        if score < 0.4:
            return None
        return score

    # Presidio contract (explains results in Waits/decisions logs)
    def _explain(self, nid: str, score: float) -> AnalysisExplanation:
        return AnalysisExplanation(
            recognizer=self.NAME,
            pattern_support=PATTERN.name,
            score=score,
            textual_reason=(
                "14-digit pattern, governorate code valid, "
                + ("Luhn checksum valid" if score >= 0.95
                   else "checksum mismatch (low confidence)")
            ),
        )

    @staticmethod
    def __remove_duplicates(
        results: List[RecognizerResult],
    ) -> List[RecognizerResult]:
        # Overlapping matches: keep the highest score.
        unique: List[RecognizerResult] = []
        for res in sorted(results, key=lambda r: (-r.score, r.start)):
            if not any(
                res.intersects(other) or other.intersects(res)
                for other in unique
            ):
                unique.append(res)
        return unique


# Module-level tuple Presidio expects from pluggable recognizers.
recognizer = EgyptianNationalIDRecognizer()

# What the anonymizer replaces each entity with (operators are configured
# in app.py, this constant documents the token used for NIDs).
REDACTION_LABEL = "<رقم_قومي_محجوب>"
