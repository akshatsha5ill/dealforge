from dataclasses import dataclass, field
from typing import Optional, Any
from enum import Enum


@dataclass
class ChatMessage:
    user_id: str
    user_name: str
    text: str
    timestamp: float


@dataclass
class Lead:
    id: str
    user_id: str
    doc_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    consent: bool = False


@dataclass
class DocChunk:
    id: str
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class IntentVerdict:
    is_intent: bool
    score: float
    reasoning: str = ""
