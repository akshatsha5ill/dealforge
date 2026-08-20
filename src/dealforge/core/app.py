import asyncio
import logging
import uvicorn
from dealforge.config import DealForgeConfig
from dealforge.plugins.base import registry

# Import to register dummy plugins
import dealforge.plugins.connectors.dummy_connector
import dealforge.plugins.llms.dummy_filter
import dealforge.plugins.vectorstores.dummy_store
import dealforge.plugins.dmsenders.dummy_sender

from dealforge.storage.leads import SQLiteLeadStore
from dealforge.core.eventbus import EventBus
from dealforge.core.monitor import ChatMonitor
from dealforge.core.intent import IntentProcessor
from dealforge.core.rag import RagEngine, DummyAnswerGenerator
from dealforge.core.orchestrator import Orchestrator

class DealForgeApp:
    def __init__(self, config_path: str = "dealforge.toml"):
        self.config = DealForgeConfig.load(config_path)

        logging.basicConfig(level=getattr(logging, self.config.app.log_level.upper(), logging.INFO))
        self.logger = logging.getLogger("DealForgeApp")

        # Initialize plugins based on config (hardcoded to dummy for MVP script if not found)
        ConnectorClass = registry.get_connector(self.config.meeting.platform) or registry.get_connector("dummy")
        IntentFilterClass = registry.get_intent_filter(self.config.intent.provider) or registry.get_intent_filter("dummy")
        VectorStoreClass = registry.get_vector_store(self.config.rag.vectorstore) or registry.get_vector_store("dummy")
        DmSenderClass = registry.get_dm_sender(self.config.dm.method) or registry.get_dm_sender("dummy")

        self.connector = ConnectorClass()
        self.intent_filter = IntentFilterClass()
        self.vector_store = VectorStoreClass()
        self.dm_sender = DmSenderClass()
        self.lead_store = SQLiteLeadStore(self.config.storage.path)

        # Initialize core components
        self.eventbus = EventBus()
        self.monitor = ChatMonitor(self.connector, self.eventbus)
        self.intent_processor = IntentProcessor(self.intent_filter)

        # Use a dummy AnswerGenerator since we don't have a real LLM implementation yet
        self.answer_generator = DummyAnswerGenerator()
        self.rag_engine = RagEngine(self.vector_store, self.answer_generator, self.config.rag.top_k)

        self.orchestrator = Orchestrator(
            self.eventbus,
            self.intent_processor,
            self.rag_engine,
            self.dm_sender,
            self.lead_store,
            host_url="http://localhost:8000"
        )

    async def start(self):
        self.logger.info("Starting DealForge App...")

        # Connect to meeting
        await self.connector.connect("dummy_meeting_123", self.config.meeting.api_key)

        # Seed dummy vector store
        from dealforge.models import DocChunk
        await self.vector_store.upsert([
            DocChunk(id="c1", text="Our product costs $99/mo."),
            DocChunk(id="c2", text="Yes, we have a Salesforce integration.")
        ])

        # Start core loops
        await self.orchestrator.start()
        await self.monitor.start()

        self.logger.info("DealForge App started successfully.")

    async def stop(self):
        self.logger.info("Stopping DealForge App...")
        await self.monitor.stop()
        await self.orchestrator.stop()
        await self.connector.disconnect()
        self.logger.info("DealForge App stopped.")

async def main():
    app = DealForgeApp()

    # Start the background tasks
    await app.start()

    # Normally we'd use uvicorn to run the FastAPI app here, but since this is
    # a local async script demonstration, we'll let it run for a bit.
    try:
        # Give it some time to process the dummy stream
        await asyncio.sleep(5)
    except KeyboardInterrupt:
        pass
    finally:
        await app.stop()

if __name__ == "__main__":
    asyncio.run(main())
