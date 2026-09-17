from __future__ import annotations

import os
from typing import Any, Dict, Optional

import requests


class LLMProvider:
    """Local Ollama provider with an OpenAI-compatible fallback contract."""

    def __init__(self, provider: Optional[str] = None, model: Optional[str] = None, base_url: Optional[str] = None) -> None:
        self.provider = (provider or os.getenv("LLM_PROVIDER", "ollama")).lower()
        self.model = model or os.getenv("PRIMARY_MODEL", "qwen2.5:7b")
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")

    def generate(self, prompt: str, system: str = "", temperature: float = 0.2, max_tokens: int = 768) -> str:
        if self.provider != "ollama":
            raise ValueError(f"Unsupported local provider: {self.provider}")
        response = requests.post(f"{self.base_url}/api/generate", json={"model": self.model, "prompt": prompt, "system": system, "stream": False, "options": {"temperature": temperature, "num_predict": max_tokens}}, timeout=120)
        response.raise_for_status()
        return str(response.json().get("response", ""))

    def complete(self, prompt: str, system_prompt: str = "", **kwargs: Any) -> Dict[str, Any]:
        return {"response": self.generate(prompt, system=system_prompt, **kwargs)}


__all__ = ["LLMProvider"]
