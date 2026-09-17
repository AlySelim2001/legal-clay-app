from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

import requests


class LLMProvider:
    """Simple provider abstraction for local model backends."""

    def __init__(
        self,
        provider: str = "ollama",
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ) -> None:
        self.provider = (provider or "ollama").lower()
        self.model = model or os.getenv("PRIMARY_MODEL", "qwen2.5:7b")
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")

    def complete(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.2,
        max_tokens: int = 512,
    ) -> Dict[str, Any]:
        """Send a prompt to the configured local LLM backend."""
        if self.provider == "ollama":
            payload = {
                "model": self.model,
                "prompt": prompt,
                "system": system_prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            }
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=60,
            )
            response.raise_for_status()
            return response.json()

        if self.provider in {"openai", "openrouter"}:
            if not self.api_key:
                raise ValueError("API key is required for OpenAI-compatible providers.")
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions")
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()

        raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def list_models(self) -> list[str]:
        """Return model names from the configured local provider."""
        if self.provider == "ollama":
            response = requests.get(f"{self.base_url}/api/tags", timeout=30)
            response.raise_for_status()
            payload = response.json()
            models = payload.get("models", [])
            return [model.get("name", "") for model in models if model.get("name")]
        return [self.model]

    def health_check(self) -> Dict[str, Any]:
        """Return a lightweight health payload indicating provider availability."""
        try:
            if self.provider == "ollama":
                response = requests.get(f"{self.base_url}/api/tags", timeout=15)
                response.raise_for_status()
                return {"status": "healthy", "provider": self.provider, "models": self.list_models()}
            return {"status": "healthy", "provider": self.provider, "model": self.model}
        except Exception as exc:  # pragma: no cover - runtime safeguard
            return {"status": "unhealthy", "provider": self.provider, "error": str(exc)}


__all__ = ["LLMProvider"]
