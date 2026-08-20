from dealforge.models import ChatMessage, IntentVerdict
from dealforge.plugins.base import IntentFilter

class IntentProcessor:
    def __init__(self, filter_plugin: IntentFilter):
        self.filter_plugin = filter_plugin

    async def process(self, msg: ChatMessage) -> IntentVerdict:
        try:
            return await self.filter_plugin.is_buying_intent(msg)
        except Exception as e:
            print(f"[IntentProcessor] Error evaluating intent for msg {msg.text}: {e}")
            return IntentVerdict(is_intent=False, score=0.0, reasoning=str(e))
