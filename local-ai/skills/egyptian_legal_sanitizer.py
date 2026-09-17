from __future__ import annotations

import re
from typing import Any, Dict, List


class SecurityAuditSkill:
    """Lightweight security audit for code snippets and prompt-like payloads."""

    @staticmethod
    def apply(code_snippet: str) -> Dict[str, Any]:
        if not code_snippet or not code_snippet.strip():
            return {"vulnerabilities_found": 0, "details": []}

        snippet = code_snippet.strip()
        findings: List[Dict[str, Any]] = []
        checks = [
            (r"\beval\s*\(", "Critical: use of eval() can execute arbitrary code."),
            (r"\bexec\s*\(", "Critical: use of exec() can execute arbitrary code."),
            (r"\bsubprocess\.(?:call|check_call|check_output|run)\s*\(", "High: subprocess execution may spawn unintended OS commands."),
            (r"\bos\.system\s*\(", "High: os.system() uses shell execution."),
            (r"\bpickle\.(?:loads|load)\s*\(", "High: unsafe deserialization via pickle."),
            (r"\brequests\.(?:get|post|put|delete)\s*\(", "Medium: outbound requests should be validated and scoped."),
            (r"\byaml\.load\s*\(", "Medium: unsafe YAML deserialization may be exploitable."),
            (r"\bopen\s*\(\s*[\"'][/\\]etc[/\\]passwd[\"']", "Medium: direct reads of sensitive system files are suspicious."),
        ]

        for pattern, description in checks:
            if re.search(pattern, snippet, flags=re.IGNORECASE):
                findings.append({"severity": "high" if "Critical" in description or "High" in description else "medium", "description": description})

        suspicious_shell = bool(re.search(r"\b(shell|bash|sh|cmd|powershell)\b", snippet, flags=re.IGNORECASE))
        if suspicious_shell and ("curl" in snippet or "wget" in snippet):
            findings.append({"severity": "medium", "description": "Network shell command execution detected in the provided snippet."})

        return {
            "vulnerabilities_found": len(findings),
            "details": findings,
        }


__all__ = ["SecurityAuditSkill"]
