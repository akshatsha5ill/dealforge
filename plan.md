# DealForge — Implementation Plan

> BYOK, headless, text-only meeting lead-generation bot.
> Scans live meeting chat, filters buying-intent questions via a fast LLM,
> runs RAG over sales collateral, DMs a personalized answer, and gates the
> full document behind a lead-capture form.

---

## 1. Stack & Key Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Language | Python 3.12 (asyncio) | Richest LLM/RAG ecosystem |
| Config | `pydantic-settings` + YAML | BYOK via one config file |
| Plugins | Custom registry (entry-points optional, file-based for MVP) | No heavy deps; explicit, testable |
| Orchestration | `asyncio` event loop + queue | Decouples monitor → filter → RAG → DM |
| LLM/RAG | Provider SDKs behind interfaces (OpenAI/Anthropic/etc.) | Provider-agnostic |
| Vector DB | Plugin (Chroma local default; Pinecone/Qdrant optional) | Self-host friendly |
| API | FastAPI (local control plane only) | Start/stop bots, view leads |
| Storage | SQLite (default) behind a `LeadStore` interface | Zero-config; swap to Postgres later |
| Tests | `pytest` + `pytest-asyncio` + `respx`/`fakeredis` | Mock external calls |

---

## 2. Directory Layout

```
dealforge/
├── pyproject.toml
├── dealforge.toml            # example BYOK config (gitignored secrets)
├── README.md
├── src/dealforge/
│   ├── __init__.py
│   ├── config.py             # pydantic settings, loads dealforge.toml + env
│   ├── core/
│   │   ├── app.py            # DealForgeApp: wires everything, lifecycle
│   │   ├── orchestrator.py   # queue-based pipeline engine
│   │   ├── monitor.py        # chat polling/streaming loop
│   │   ├── intent.py         # intent-filter LLM call + scoring
│   │   ├── rag.py            # retrieve + generate answer
│   │   ├── lead_capture.py   # doc-gating + contact collection
│   │   ├── models.py         # ChatMessage, Lead, DocChunk, Answer
│   │   └── eventbus.py       # simple asyncio queue / pub-sub
│   ├── plugins/
│   │   ├── base.py           # PluginProtocol, registry, loader
│   │   ├── connectors/       # meeting platform plugins
│   │   │   ├── zoom.py
│   │   │   ├── teams.py
│   │   │   └── meet.py
│   │   ├── llms/             # intent + generation providers
│   │   │   ├── openai.py
│   │   │   └── anthropic.py
│   │   ├── vectorstores/     # Chroma, Pinecone, Qdrant
│   │   ├── embedders/        # provider embeddings
│   │   ├── dmsenders/        # meeting DM, email fallback
│   │   │   ├── meeting_dm.py
│   │   │   └── email.py
│   │   └── loaders/          # PDF, DOCX, MD, web collaterals
│   ├── storage/
│   │   └── leads.py          # SQLite-backed LeadStore
│   └── api/
│       └── server.py         # FastAPI control plane
└── tests/
```

---

## 3. Core Interfaces (contracts)

```python
# connectors
class MeetingConnector(Protocol):
    async def connect(self, meeting_ref, token) -> None
    async def stream_chat(self) -> AsyncIterator[ChatMessage]
    async def send_dm(self, user_id, text) -> DMResult
    async def disconnect(self) -> None

# llms
class IntentFilter(Protocol):
    async def is_buying_intent(self, msg: ChatMessage) -> IntentVerdict

class AnswerGenerator(Protocol):
    async def generate(self, question, context: list[DocChunk]) -> str

# vectorstores
class VectorStore(Protocol):
    async def upsert(self, chunks: list[DocChunk]) -> None
    async def query(self, vector, top_k) -> list[DocChunk]

# dmsenders
class DMSender(Protocol):
    async def send(self, target, message) -> SendResult

# leadstore
class LeadStore(Protocol):
    async def save(self, lead: Lead) -> None
    async def get(self, id) -> Lead | None
```

---

## 4. Pipeline (orchestrator flow)

```
monitor.stream_chat()
   → ChatMessage
      → intent.is_buying_intent()      # fast, cheap model
         ├─ no  → drop
         └─ yes → rag.retrieve(question)
                   → rag.generate(question, chunks)
                      → dm.send(user, answer + gated-doc link)
                         → lead_capture.await_contact(user, doc_id)
                            → storage.save(Lead)
```

Lead capture: bot DMs a link to a local mini-form (`/capture/{token}`) that
unlocks the full document only after email/name submission. Token scoped to
`(user_id, doc_id)` and short-lived.

---

## 5. Config Model (`dealforge.toml`)

```toml
[app]
log_level = "INFO"

[meeting]
platform = "zoom"            # plugin name
api_key = "env:ZOOM_API_KEY"

[intent]
provider = "openai"
model = "gpt-4o-mini"
threshold = 0.6

[rag]
embedder = "openai"
vectorstore = "chroma"
top_k = 4
collateral_dir = "./collateral"

[answer]
provider = "openai"
model = "gpt-4o"

[dm]
method = "meeting_dm"        # or "email"

[storage]
type = "sqlite"
path = "./dealforge.db"
```
Secrets resolved via `env:<NAME>` → `os.environ`.

---

## 6. Phased Task Breakdown

### Phase 0 — Foundations
- [ ] `pyproject.toml` + venv, ruff/mypy/pytest config
- [ ] `config.py` (pydantic-settings, `env:` resolver, validation)
- [ ] `models.py` (dataclasses / pydantic)
- [ ] `plugins/base.py` (registry + dynamic loader from config)

### Phase 1 — Plugin shells + dummy impls
- [ ] `MeetingConnector` dummy (echoes fake chat)
- [ ] `IntentFilter` dummy (keyword-based) for offline dev
- [ ] `VectorStore` in-memory impl
- [ ] `DMSender` dummy (logs message)
- [ ] `LeadStore` SQLite impl

### Phase 2 — Orchestration core
- [ ] `eventbus.py` (asyncio.Queue)
- [ ] `monitor.py` streaming loop + backpressure
- [ ] `intent.py` real LLM call + caching + retries
- [ ] `rag.py` retrieve → prompt → generate
- [ ] `orchestrator.py` wires stages, handles errors/dead-letters

### Phase 3 — Lead capture
- [ ] Token generation + expiry
- [ ] FastAPI `/capture/{token}` form (name/email)
- [ ] Document unlock + serve (local file or signed URL)
- [ ] Store `Lead` with consent flag

### Phase 4 — Real connectors (incremental)
- [ ] Zoom (chat API + DM) — needs OAuth/app
- [ ] Teams (Graph API)
- [ ] Meet (Chat API via Google)
- [ ] Each behind its own plugin, gated by `intent` config

### Phase 5 — RAG hardening
- [ ] `loaders/` for PDF/DOCX/MD/web
- [ ] Chunking strategy + metadata (source, page)
- [ ] Re-ranking (optional cross-encoder)
- [ ] Citation injection into answers

### Phase 6 — Control plane + DX
- [ ] FastAPI: start/stop bot, list leads, upload collateral
- [ ] `dealforge.toml` example + `.env.example`
- [ ] README with self-host walkthrough
- [ ] Dockerfile + docker-compose

### Phase 7 — Tests & polish
- [ ] Unit: intent, rag prompt, token, storage
- [ ] Integration: full pipeline with dummy plugins
- [ ] E2E stub against mocked Zoom
- [ ] Rate-limit / cost guards on LLM calls

---

## 7. MVP Scope (first deliverable)
Build Phases 0–3 with **dummy/real-LLM-mixed plugins** so the full loop runs
end-to-end locally: a script reads a fake chat stream, filters intent with a
real cheap LLM, retrieves from an in-memory vector store seeded by a sample
PDF, DMs via logged output, and serves a capture form that stores the lead
in SQLite. Real Zoom/Teams/Meet connectors are added in Phase 4.

---

## 8. Open Questions to confirm later
- Meeting platform auth model (OAuth app vs. JWT vs. participant bot).
- DM availability: some platforms lack private DM APIs → email fallback.
- Document hosting: local serve vs. S3/Cloud Storage signed URLs.
- Compliance: recording/PII consent per jurisdiction.
