from __future__ import annotations

import tempfile
from typing import Any, Dict

try:
    from markitdown import MarkItDown
except Exception:  # pragma: no cover - graceful fallback when dependency is missing
    MarkItDown = None


class MarkItDownSkill:
    """Converts legal PDFs and office files into clean Markdown content."""

    def __init__(self) -> None:
        self.converter = MarkItDown() if MarkItDown is not None else None

    def apply(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        if self.converter is None:
            return {
                "status": "error",
                "markdown_content": "",
                "message": "markitdown is not installed. Install local-ai/requirements.txt or pip install markitdown.",
            }

        try:
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=True) as temp_file:
                temp_file.write(file_bytes)
                temp_file.flush()
                result = self.converter.convert(temp_file.name)
                content = getattr(result, "text_content", "") or ""
                return {
                    "status": "success",
                    "markdown_content": content,
                    "char_count": len(content),
                }
        except Exception as exc:  # pragma: no cover - defensive runtime path
            return {
                "status": "error",
                "markdown_content": "",
                "message": f"Document conversion failed: {exc}",
            }


__all__ = ["MarkItDownSkill"]
