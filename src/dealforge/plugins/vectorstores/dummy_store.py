from typing import Any
from dealforge.models import DocChunk
from dealforge.plugins.base import registry

class InMemoryVectorStore:
    def __init__(self):
        self.chunks: list[DocChunk] = []

    async def upsert(self, chunks: list[DocChunk]) -> None:
        self.chunks.extend(chunks)
        print(f"[DummyVectorStore] Upserted {len(chunks)} chunks.")

    async def query(self, vector: Any, top_k: int) -> list[DocChunk]:
        # Dummy implementation: just return first top_k chunks
        print(f"[DummyVectorStore] Queried for top {top_k} chunks.")
        return self.chunks[:top_k]

registry.register_vector_store("dummy", InMemoryVectorStore)
