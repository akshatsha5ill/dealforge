import asyncio
from dealforge.core.eventbus import EventBus
from dealforge.core.intent import IntentProcessor
from dealforge.core.rag import RagEngine
from dealforge.plugins.base import DMSender, LeadStore
from dealforge.models import Lead
import uuid

class Orchestrator:
    def __init__(
        self,
        eventbus: EventBus,
        intent_processor: IntentProcessor,
        rag_engine: RagEngine,
        dm_sender: DMSender,
        lead_store: LeadStore,
        host_url: str = "http://localhost:8000"
    ):
        self.eventbus = eventbus
        self.intent_processor = intent_processor
        self.rag_engine = rag_engine
        self.dm_sender = dm_sender
        self.lead_store = lead_store
        self.host_url = host_url
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._process_loop())

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _process_loop(self):
        while self._running:
            try:
                msg = await self.eventbus.consume()
                if msg is None:
                    continue

                verdict = await self.intent_processor.process(msg)

                if verdict.is_intent:
                    answer = await self.rag_engine.generate_answer(msg.text)
                    doc_id = "sample_doc_id" # Placeholder for MVP
                    lead_id = str(uuid.uuid4())
                    token = f"{msg.user_id}_{doc_id}_{lead_id}" # Simple token for MVP

                    # Store initial lead state
                    lead = Lead(id=lead_id, user_id=msg.user_id, doc_id=doc_id)
                    await self.lead_store.save(lead)

                    link = f"{self.host_url}/capture/{token}"
                    full_message = f"{answer}\n\nTo view the full document, please visit: {link}"

                    await self.dm_sender.send(msg.user_id, full_message)

                self.eventbus.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[Orchestrator] Error processing message: {e}")
