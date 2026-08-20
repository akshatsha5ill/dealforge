import pytest
import asyncio
import os
from fastapi.testclient import TestClient

from dealforge.core.app import DealForgeApp
from dealforge.config import DealForgeConfig
from dealforge.api.server import app as fastapi_app
from dealforge.storage.leads import SQLiteLeadStore

TEST_DB_PATH = "test_dealforge.db"

@pytest.fixture(autouse=True)
def setup_teardown():
    os.environ["DEALFORGE__STORAGE__PATH"] = TEST_DB_PATH
    import dealforge.config
    dealforge.config.DealForgeConfig._l = None

    yield

    if os.path.exists(TEST_DB_PATH):
        os.remove(TEST_DB_PATH)
    if "DEALFORGE__STORAGE__PATH" in os.environ:
        del os.environ["DEALFORGE__STORAGE__PATH"]

@pytest.mark.asyncio
async def test_full_mvp_loop(capsys):
    app = DealForgeApp()
    app.lead_store = SQLiteLeadStore(TEST_DB_PATH)
    app.orchestrator.lead_store = app.lead_store

    await app.start()

    await asyncio.sleep(2.5)
    await app.stop()

    captured = capsys.readouterr()

    assert "[DummyConnector] Connected to meeting dummy_meeting_123" in captured.out

    assert "[DummyDMSender] Sending message to" in captured.out
    assert "Here is what I found about" in captured.out

    store = SQLiteLeadStore(TEST_DB_PATH)
    with store._init_db.__globals__["sqlite3"].connect(TEST_DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, user_id, doc_id FROM leads")
        rows = cursor.fetchall()

    assert len(rows) > 0, "No leads were saved by the orchestrator"

    lead_id, user_id, doc_id = rows[0]
    token = f"{user_id}_{doc_id}_{lead_id}"

    client = TestClient(fastapi_app)

    response = client.get(f"/capture/{token}")
    assert response.status_code == 200
    assert "Unlock Document" in response.text

    form_data = {
        "name": "Test User",
        "email": "test@example.com",
        "consent": True
    }
    response = client.post(f"/capture/{token}", data=form_data)
    assert response.status_code == 200
    assert "✓ Lead Captured!" in response.text
    assert f"/documents/{doc_id}.pdf" in response.text

    updated_lead = await store.get(lead_id)
    assert updated_lead is not None
    assert updated_lead.name == "Test User"
    assert updated_lead.email == "test@example.com"
    assert updated_lead.consent is True
