import re
from typing import Any


class EgyptianLegalSanitizerSkill:
    """Sanitizes legal text, strips injection vectors, and normalizes Arabic legal text."""

    @staticmethod
    def apply(text: str) -> str:
        if not text:
            return ""

        sanitized = str(text)

        sanitized = re.sub(r"<script\b[^>]*>.*?</script>", "", sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(r"<style\b[^>]*>.*?</style>", "", sanitized, flags=re.IGNORECASE | re.DOTALL)
        sanitized = re.sub(r"javascript\s*:", "", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"on\w+\s*=\s*['\"`][^'\"`]*['\"`]", "", sanitized, flags=re.IGNORECASE)
        sanitized = re.sub(r"\b(?:data|vbscript|file)\s*:\s*[^\s\)\]>]+", "", sanitized, flags=re.IGNORECASE)

        sanitized = re.sub(r"[\u0622\u0623\u0625]", "\u0627", sanitized)
        sanitized = re.sub(r"[\u064A\u0625]", "\u064A", sanitized)
        sanitized = re.sub(r"\s+", " ", sanitized)
        sanitized = sanitized.replace("\r\n", "\n").replace("\r", "\n")

        sanitized = sanitized.strip()
        return sanitized


__all__ = ["EgyptianLegalSanitizerSkill"]
