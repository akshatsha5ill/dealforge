from dealforge.plugins.base import SendResult, registry

class DummyDMSender:
    async def send(self, target: str, message: str) -> SendResult:
        print(f"[DummyDMSender] Sending message to {target}:\n{message}")
        return SendResult()

registry.register_dm_sender("dummy", DummyDMSender)
