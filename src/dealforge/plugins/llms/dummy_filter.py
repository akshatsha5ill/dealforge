from dealforge.models import ChatMessage, IntentVerdict
from dealforge.plugins.base import registry

class DummyIntentFilter:
    def __init__(self, threshold: float = 0.5):
        self.threshold = threshold
        self.buying_keywords = ["pricing", "cost", "buy", "purchase", "integrate", "salesforce"]

    async def is_buying_intent(self, msg: ChatMessage) -> IntentVerdict:
        text_lower = msg.text.lower()
        score = 0.0

        for keyword in self.buying_keywords:
            if keyword in text_lower:
                score += 0.4

        is_intent = score >= self.threshold
        reasoning = f"Found keywords" if is_intent else "No buying keywords found"

        return IntentVerdict(is_intent=is_intent, score=min(score, 1.0), reasoning=reasoning)

registry.register_intent_filter("dummy", DummyIntentFilter)
