import asyncio
from dealforge.plugins.base import MeetingConnector
from dealforge.core.eventbus import EventBus

class ChatMonitor:
    def __init__(self, connector: MeetingConnector, eventbus: EventBus):
        self.connector = connector
        self.eventbus = eventbus
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _poll_loop(self):
        try:
            async for msg in self.connector.stream_chat():
                if not self._running:
                    break
                await self.eventbus.publish(msg)
        except Exception as e:
            print(f"[ChatMonitor] Error in poll loop: {e}")
