import asyncio
from typing import AsyncIterator
import time

from dealforge.models import ChatMessage
from dealforge.plugins.base import DMResult, registry

class DummyMeetingConnector:
    def __init__(self):
        self.connected = False

    async def connect(self, meeting_ref: str, token: str) -> None:
        self.connected = True
        print(f"[DummyConnector] Connected to meeting {meeting_ref}")

    async def stream_chat(self) -> AsyncIterator[ChatMessage]:
        messages = [
            ChatMessage(user_id="u1", user_name="Alice", text="Hello everyone!", timestamp=time.time()),
            ChatMessage(user_id="u2", user_name="Bob", text="Is there a way to integrate this with Salesforce?", timestamp=time.time()),
            ChatMessage(user_id="u3", user_name="Charlie", text="Can I get the pricing sheet?", timestamp=time.time()),
            ChatMessage(user_id="u1", user_name="Alice", text="What is the weather today?", timestamp=time.time()),
        ]

        for msg in messages:
            if not self.connected:
                break
            await asyncio.sleep(0.5)  # simulate delay
            yield msg

    async def send_dm(self, user_id: str, text: str) -> DMResult:
        print(f"[DummyConnector] Sent DM to {user_id}: {text}")
        return DMResult()

    async def disconnect(self) -> None:
        self.connected = False
        print("[DummyConnector] Disconnected from meeting")

registry.register_connector("dummy", DummyMeetingConnector)
