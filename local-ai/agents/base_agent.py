from __future__ import annotations

import abc
from typing import Any, Dict


class BaseAgent(abc.ABC):
    def __init__(self, name: str) -> None:
        self.name = name

    @abc.abstractmethod
    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError

    def format_output(self, status: str, data: Any, message: str = "") -> Dict[str, Any]:
        return {"agent": self.name, "status": status, "message": message, "data": data}

    format_response = format_output
