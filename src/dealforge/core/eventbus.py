import asyncio
from typing import Any

class EventBus:
    def __init__(self):
        self.queue: asyncio.Queue[Any] = asyncio.Queue()

    async def publish(self, event: Any) -> None:
        await self.queue.put(event)

    async def consume(self) -> Any:
        return await self.queue.get()

    def task_done(self) -> None:
        self.queue.task_done()
