"""No-op marker; automatic document analysis is outside the first scope."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DocumentAnalysisPlaceholder:
    enabled: bool = False
    reason: str = "document analysis has no runtime implementation yet"


__all__ = ["DocumentAnalysisPlaceholder"]
