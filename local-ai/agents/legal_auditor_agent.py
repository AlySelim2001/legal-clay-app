import abc
from typing import Any, Dict


class BaseAgent(abc.ABC):
    """Base contract for all legal-domain agents."""

    def __init__(self, name: str):
        self.name = name

    @abc.abstractmethod
    def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the agent workflow and return a structured JSON-compatible output."""
        raise NotImplementedError

    def format_output(self, status: str, data: Any, message: str = "") -> Dict[str, Any]:
        return {
            "agent": self.name,
            "status": status,
            "message": message,
            "data": data,
        }

    def format_response(self, status: str, data: Any, message: str = "") -> Dict[str, Any]:
        return self.format_output(status=status, data=data, message=message)


__all__ = ["BaseAgent"]
