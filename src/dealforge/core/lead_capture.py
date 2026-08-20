from dealforge.plugins.base import LeadStore
from dealforge.models import Lead

class LeadCaptureService:
    def __init__(self, lead_store: LeadStore):
        self.lead_store = lead_store

    async def get_lead_by_token(self, token: str) -> Lead | None:
        try:
            user_id, doc_id, lead_id = token.split("_")
            return await self.lead_store.get(lead_id)
        except ValueError:
            return None

    async def capture_lead(self, token: str, name: str, email: str, consent: bool) -> str | None:
        lead = await self.get_lead_by_token(token)
        if not lead:
            return None

        lead.name = name
        lead.email = email
        lead.consent = consent

        await self.lead_store.save(lead)

        # In a real app, this would generate a signed URL or return actual file path
        return f"/documents/{lead.doc_id}.pdf"
