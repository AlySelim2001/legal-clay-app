from __future__ import annotations

from typing import Any, Dict

from agents.base_agent import BaseAgent
from skills.egyptian_legal_sanitizer import EgyptianLegalSanitizerSkill
from skills.markitdown_skill import MarkItDownSkill
from skills.security_audit_skill import SecurityAuditSkill


class LegalAuditorAgent(BaseAgent):
    """Audits legal text and legal documents, sanitizes the input, and checks code risk."""

    def __init__(self) -> None:
        super().__init__(name="LegalAuditorAgent")
        self.sanitizer = EgyptianLegalSanitizerSkill()
        self.security_checker = SecurityAuditSkill()
        self.doc_converter = MarkItDownSkill()

    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        raw_text = payload.get("document_text", "") or ""
        code_snippet = payload.get("code_snippet", "") or ""
        file_bytes = payload.get("file_bytes")
        filename = payload.get("filename", "") or ""

        processed_text = raw_text

        if file_bytes and filename:
            conversion_result = self.doc_converter.apply(file_bytes, filename)
            if conversion_result.get("status") == "success":
                processed_text = conversion_result.get("markdown_content", "")
            else:
                processed_text = ""

        clean_text = self.sanitizer.apply(processed_text)
        security_report = self.security_checker.apply(code_snippet) if code_snippet else {"vulnerabilities_found": 0, "details": []}

        audit_results = {
            "sanitized_text": clean_text,
            "text_length": len(clean_text),
            "security_audit": security_report,
            "compliance_status": "Passed" if security_report.get("vulnerabilities_found", 0) == 0 else "Review Required",
        }

        return self.format_response(
            status="success",
            data=audit_results,
            message="Legal document and compliance audit completed successfully.",
        )


__all__ = ["LegalAuditorAgent"]
