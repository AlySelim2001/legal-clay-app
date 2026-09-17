from agents.legal_auditor_agent import LegalAuditorAgent
from skills.egyptian_legal_sanitizer import EgyptianLegalSanitizerSkill


def test_sanitizer_skill():
    cleaned = EgyptianLegalSanitizerSkill.apply("<script>alert('test')</script>   أحمد و إبراهيم")
    assert "<script>" not in cleaned
    assert "احمد و ابراهيم" in cleaned


def test_legal_auditor_agent():
    result = LegalAuditorAgent().execute({"document_text": "مادة قانونية تجريبية", "code_snippet": "eval('import os')"})
    assert result["status"] == "success"
    assert result["data"]["security_audit"]["vulnerabilities_found"] > 0
