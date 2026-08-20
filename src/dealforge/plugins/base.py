from typing import Protocol, AsyncIterator, runtime_checkable, Any
from dealforge.models import ChatMessage, IntentVerdict, DocChunk, Lead

class DMResult:
    pass

class SendResult:
    pass

@runtime_checkable
class MeetingConnector(Protocol):
    async def connect(self, meeting_ref: str, token: str) -> None: ...
    async def stream_chat(self) -> AsyncIterator[ChatMessage]: ...
    async def send_dm(self, user_id: str, text: str) -> DMResult: ...
    async def disconnect(self) -> None: ...

@runtime_checkable
class IntentFilter(Protocol):
    async def is_buying_intent(self, msg: ChatMessage) -> IntentVerdict: ...

@runtime_checkable
class AnswerGenerator(Protocol):
    async def generate(self, question: str, context: list[DocChunk]) -> str: ...

@runtime_checkable
class VectorStore(Protocol):
    async def upsert(self, chunks: list[DocChunk]) -> None: ...
    async def query(self, vector: Any, top_k: int) -> list[DocChunk]: ...

@runtime_checkable
class DMSender(Protocol):
    async def send(self, target: str, message: str) -> SendResult: ...

@runtime_checkable
class LeadStore(Protocol):
    async def save(self, lead: Lead) -> None: ...
    async def get(self, id: str) -> Lead | None: ...

# Simple registry for MVP
class PluginRegistry:
    def __init__(self):
        self._connectors: dict[str, Any] = {}
        self._intent_filters: dict[str, Any] = {}
        self._vector_stores: dict[str, Any] = {}
        self._dm_senders: dict[str, Any] = {}

    def register_connector(self, name: str, cls: Any):
        self._connectors[name] = cls

    def register_intent_filter(self, name: str, cls: Any):
        self._intent_filters[name] = cls

    def register_vector_store(self, name: str, cls: Any):
        self._vector_stores[name] = cls

    def register_dm_sender(self, name: str, cls: Any):
        self._dm_senders[name] = cls

    def get_connector(self, name: str) -> Any:
        return self._connectors.get(name)

    def get_intent_filter(self, name: str) -> Any:
        return self._intent_filters.get(name)

    def get_vector_store(self, name: str) -> Any:
        return self._vector_stores.get(name)

    def get_dm_sender(self, name: str) -> Any:
        return self._dm_senders.get(name)

registry = PluginRegistry()
