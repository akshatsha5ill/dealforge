
# 🔥 Project Blueprint v2: DealForge — Meeting Intelligence SaaS

> **Zoom Marketplace App** · Real-time meeting intelligence · Lead management · Automated email outreach

> [!IMPORTANT]
> **v2 — Revised after architectural review.** This version fixes 5 critical issues found in v1. Changes are marked with 🔧 throughout.

---

## 📋 Table of Contents

- [Product Vision](#product-vision)
- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Data Strategy](#data-strategy)
- [Feature Breakdown](#feature-breakdown)
- [Project Structure](#project-structure)
- [Design System](#design-system)
- [Build Phases](#build-phases)
- [Risks & Mitigations](#risks--mitigations)

---

## Product Vision

**Product Name:** DealForge 🔥

**One-liner:** An AI-powered Zoom App that turns every sales meeting into actionable leads, follow-ups, and closed deals — automatically.

**Problem:** Sales teams lose deals because of poor post-meeting follow-up. Notes get lost, action items are forgotten, and leads go cold.

**Solution:** A Zoom Marketplace app with two surfaces:

| Surface | Where | Purpose |
|---------|-------|---------|
| **In-Meeting Panel** | Inside Zoom (iframe) | Real-time transcription, live AI suggestions, quick notes |
| **Web Dashboard** | Browser (separate tab) | CRM pipeline, email campaigns, analytics, lead management, settings |

**Target User:** Mid-market B2B SaaS sales teams (10–500 employees)

**Business Model:** Monthly subscription (tiered pricing)

**AI Approach:** BYOK (Bring Your Own Key) — users provide their own OpenAI or Anthropic API keys

---

## Architecture Overview

### 🔧 Critical Fix #1: The Two-Browser Problem

> [!CAUTION]
> **Problem found in v1:** The Zoom in-meeting panel runs inside Zoom's embedded Chromium browser. The web dashboard runs in the user's regular browser (Chrome, Firefox, etc.). These are **completely separate browser contexts** — they **cannot share IndexedDB**. The v1 blueprint assumed they could.

**Solution:** The Zoom panel is a **lightweight, stateless view**. It displays real-time data but stores nothing locally. All data flows through the backend server as a relay, and only the **Web Dashboard** (the user's main browser) stores data in IndexedDB.

```mermaid
graph TB
    subgraph "Zoom Client (Embedded Browser)"
        ZP["🖥️ In-Meeting Panel<br/>(Stateless — display only)"]
    end

    subgraph "User's Browser"
        WD["🌐 Web Dashboard<br/>(React SPA)"]
        IDB["💾 IndexedDB<br/>(via Dexie.js)"]
    end

    subgraph "Backend Server (Stateless Relay)"
        API["⚡ Node.js + Express"]
        WH["📡 Zoom Webhook Handler"]
        AI["🤖 AI Proxy (BYOK)"]
        EM["📧 Email Service"]
        BUF["⏳ Temp Buffer<br/>(Redis + In-memory fallback, 24h TTL)"]
        TRK["📊 Tracking Inbox<br/>(Redis, Opens/Clicks, pull-based)"]
    end

    subgraph "Cloud (Firebase)"
        FA["🔐 Firebase Auth"]
        FS["☁️ Firestore<br/>(Account data only)"]
    end

    subgraph "External APIs"
        ZOOM["Zoom API + RTMS"]
        OAI["OpenAI API"]
        ANT["Anthropic API"]
        RS["Resend API"]
        GM["Gmail / Outlook"]
    end

    ZP <-->|"WebSocket (live view)"| API
    WD <-->|"REST + WebSocket"| API
    WD <--> IDB
    API --> BUF
    API --> TRK
    API <--> WH
    API <--> AI
    API <--> EM
    API <--> FA
    API <--> FS
    WH <--> ZOOM
    AI <--> OAI
    AI <--> ANT
    EM <--> RS
    EM <--> GM

    style ZP fill:#1a1a2e,stroke:#e94560,color:#fff
    style WD fill:#1a1a2e,stroke:#4ecdc4,color:#fff
    style IDB fill:#0d1117,stroke:#f0c929,color:#fff
    style BUF fill:#2d1b36,stroke:#d4a574,color:#fff
    style TRK fill:#2d1b36,stroke:#d4a574,color:#fff
    style API fill:#16213e,stroke:#0f3460,color:#fff
    style FA fill:#ff6b35,stroke:#ff6b35,color:#fff
    style FS fill:#ff6b35,stroke:#ff6b35,color:#fff
```

### How Data Flows (Privacy-First) — Corrected

```mermaid
sequenceDiagram
    participant ZP as Zoom Panel<br/>(in Zoom)
    participant S as Backend Server
    participant WD as Web Dashboard<br/>(in Browser)
    participant L as IndexedDB<br/>(Local)
    participant F as Firebase

    Note over ZP,F: 🎙️ DURING A MEETING

    rect rgb(30, 30, 45)
        Note right of ZP: Scenario A: Dashboard is OPEN
        ZP->>S: Audio stream / transcription events
        S->>S: Process transcription
        S->>ZP: Live transcript (display only)
        S->>WD: Push via WebSocket
        WD->>L: Store transcript locally
        S->>S: Discard from memory ✅
    end

    rect rgb(45, 30, 30)
        Note right of ZP: Scenario B: Dashboard is CLOSED
        ZP->>S: Audio stream / transcription events
        S->>S: Process transcription
        S->>ZP: Live transcript (display only)
        S->>S: Buffer in Redis (24h TTL) ⏳
        Note over S: Data held temporarily until<br/>dashboard connects & pulls it
    end

    Note over ZP,F: 📝 AFTER THE MEETING

    WD->>S: Pull any buffered meeting data
    S-->>WD: Return buffered data
    WD->>L: Store in IndexedDB
    S->>S: Clear buffer ✅

    WD->>S: Request AI analysis (with user's API key)
    S->>S: Call OpenAI / Claude
    S-->>WD: Return summary, action items, sentiment, lead score
    WD->>L: Store analysis locally
    WD->>L: Auto-create lead card

    Note over ZP,F: 📧 EMAIL TRACKING (Pull-Based)

    Note over S: Tracking pixel/link hit arrives at server
    S->>S: Store in Tracking Inbox (minimal metadata)
    WD->>S: Periodic pull — "any new tracking events?"
    S-->>WD: Return events
    WD->>L: Store tracking data locally
    S->>S: Clear from inbox ✅

    Note over ZP,F: ☁️ ACCOUNT DATA ONLY
    WD->>F: Auth tokens, user profile, subscription, settings
```

> [!IMPORTANT]
> **Privacy guarantee (updated):** Sensitive data (transcripts, leads, emails, analytics) is **never permanently stored on the server**. The server uses an in-memory temporary buffer (with optional Redis for production durability, 24h TTL) only when the dashboard is offline. Once the dashboard pulls the data, the server discards it.

> [!WARNING]
> **Trade-offs to understand:**
> - Users **cannot access data from a different device/browser** — this is the intentional privacy trade-off
> - If the user doesn't open the dashboard within **24 hours** of a meeting, buffered data is lost (we'll show warnings)
> - Browser data can be cleared by the user or browser cleanup tools — **regular data export/backup is essential**

---

## 🔧 Critical Fix #2: Real-Time Transcription Approach

The original blueprint was vague about HOW we get real-time transcription. There are 3 possible approaches:

| Approach | How It Works | Complexity | Quality |
|----------|-------------|:----------:|:-------:|
| **A. Zoom's Built-in Captions** | Use Zoom's native transcription, capture via SDK events | 🟢 Low | 🟡 Medium |
| **B. Zoom RTMS (Real-Time Media Streams)** | Receive raw audio from Zoom, transcribe with Whisper/Deepgram | 🟡 Medium | 🟢 High |
| **C. Browser Audio Capture** | Capture system audio via browser API, send to speech-to-text | 🔴 High | 🟡 Medium |

### Implemented: Approach B (Zoom RTMS)

**Current implementation:** The app uses **Zoom RTMS (Real-Time Media Streams)** via WebSocket (`wss://rtms2.zoom.us/rtms/websocket`) for real-time transcription. The server authenticates with Zoom's RTMS API, receives audio/transcription streams, and relays them to connected clients via Socket.IO. This provides higher quality transcription with speaker diarization support.

**Note:** The original plan recommended starting with Approach A (Zoom's built-in captions) for simplicity, but RTMS was implemented directly for its superior accuracy and real-time capabilities.

---

## Tech Stack

Since you're coming from a non-technical background, here's what each piece does and why we chose it:

### Frontend (What the User Sees)

| Technology | What It Does | Why This One |
|-----------|-------------|--------------|
| **React 19.2.7** | Builds the UI (buttons, pages, panels) | Industry standard, huge community, Zoom SDK supports it |
| **TypeScript** | Type safety | Catch errors early, great autocomplete |
| **Vite** | Development tooling (fast builds, hot reload) | Fastest dev experience, modern standard |
| **Vitest** | Unit testing framework | Fast testing, Vite compatible |
| **oxlint** | Linter | Extremely fast linting |
| **React Router** | Navigation between pages | Simple, works great with SPAs |
| **Firebase SDK** | Client-side auth (Google OAuth, email/password) | Pairs with Firebase Auth backend |
| **@zoom/appssdk** | Connects to Zoom's in-meeting panel runtime | Required for the Zoom in-meeting panel |
| **Dexie.js** | Local database in the browser (IndexedDB wrapper) | Makes IndexedDB easy to use, supports queries |
| **Zustand** | State management (sharing data between components) | Tiny, simple, no boilerplate — perfect for vibe coding |
| **Socket.io Client** | Real-time WebSocket connection to server | Live transcription and suggestions |
| **CSS Modules & Vanilla CSS** | Styling | Component-scoped styling and global tokens |
| **Lucide React** | Icons | Beautiful, consistent icon set |
| **Recharts** | Charts and analytics | Easy React-based charting |
| **Sentry (@sentry/react)** | Error monitoring and performance tracking | Catches runtime errors in production |
| **DOMPurify** | Sanitizes HTML content | Prevents XSS from AI-generated or user-supplied HTML |
| **React Virtuoso** | Virtualized scrolling for long lists | Handles large meeting/lead lists without lag |

### Backend (The Engine Behind the Scenes)

| Technology | What It Does | Why This One |
|-----------|-------------|--------------|
| **Node.js + Express** | Server that handles API calls, webhooks, AI requests | Simple, JavaScript everywhere |
| **Firebase Admin SDK** | Server-side Firebase auth verification | Secure token verification |
| **OpenAI SDK** | Calls GPT models for AI features | BYOK — uses user's key |
| **Anthropic SDK** | Calls Claude models for AI features | BYOK — uses user's key |
| **Google GenAI SDK** | Calls Gemini models for AI features | BYOK — uses user's key, additional model option |
| **Resend SDK** | Sends emails programmatically | Modern email API, great DX |
| **Socket.io** | Real-time communication (WebSocket) | Pushes live data to dashboard |
| **ws (WebSocket)** | Low-level WebSocket support | Used alongside Socket.io for Zoom RTMS connections |
| **Redis (ioredis)** | Optional production buffer and tracking event store | Falls back to in-memory if unavailable; 24h TTL meeting buffer |
| **Zod** | Request body/query validation | Type-safe input validation at API boundaries |
| **Helmet** | Sets security HTTP headers | Protects against common web vulnerabilities |
| **express-rate-limit** | Throttles abusive requests | Prevents API abuse and brute-force attacks |
| **compression** | HTTP response compression | Reduces payload size and bandwidth usage |
| **xss** | Sanitizes HTML input | Prevents cross-site scripting via request body sanitization |
| **zod-express-middleware** | Zod validation middleware for Express | Type-safe request body/query/params validation at route boundaries |
| **Sentry (@sentry/node)** | Server-side error monitoring | Tracks production errors and performance |

### Infrastructure

| Technology | What It Does | Why This One |
|-----------|-------------|--------------|
| **Firebase Auth** | User login/signup (Google, email/password) | Easy setup, handles OAuth |
| **Firebase Firestore** | Cloud database (account data only) | Only stores non-sensitive data |
| **Redis** | Optional in-memory data store for buffer and tracking | Production durability for meeting data buffer (in-memory is primary) |
| **ngrok** | HTTPS tunnel for local development | Required by Zoom Apps SDK |
| **Render** | Hosting the backend + frontend | Easy deployment, supports WebSockets well |

---

## Data Strategy

### What Goes WHERE

| Data Type | Storage Location | Reason |
|-----------|-----------------|--------|
| User auth (login credentials) | ☁️ Firebase Auth | Needs to work across devices |
| User profile (name, email, plan) | ☁️ Firestore | Account-level, non-sensitive |
| Subscription & billing info | ☁️ Firestore | Needs server-side access |
| API keys (OpenAI/Claude) | 🔧 ☁️ Firestore (client-side encrypted) | See Fix #3 below |
| App settings & preferences | ☁️ Firestore | Small, non-sensitive |
| Meeting transcripts | 💾 IndexedDB (Local) | **Sensitive** — stays on user's machine |
| AI summaries & action items | 💾 IndexedDB (Local) | **Sensitive** — derived from meetings |
| Lead/contact data | 💾 IndexedDB (Local) | **Sensitive** — customer PII |
| Deal pipeline & stages | 💾 IndexedDB (Local) | **Sensitive** — business data |
| Email drafts & campaigns | 💾 IndexedDB (Local) | **Sensitive** — outreach content |
| Email tracking data | 🔧 ⏳ Server → 💾 Local | See Fix #4 below |
| Sentiment analysis results | 💾 IndexedDB (Local) | **Sensitive** — meeting insights |

### 🔧 Critical Fix #3: BYOK API Key Security

> [!WARNING]
> **Problem in v1:** API keys were stored "encrypted" in Firestore, but if the server holds the encryption key, it's not truly secure — a server breach exposes all keys.

**Solution: Client-side encryption**

```mermaid
sequenceDiagram
    participant U as User's Browser
    participant S as Server
    participant F as Firestore
    participant AI as OpenAI/Claude

    Note over U,AI: STORING AN API KEY
    U->>U: Encrypt API key with password-derived key (PBKDF2)
    U->>F: Store encrypted blob in Firestore
    Note over S: Server NEVER sees plaintext key

    Note over U,AI: USING THE API KEY
    U->>U: Decrypt API key locally
    U->>S: Send API key + prompt in request (over HTTPS)
    S->>AI: Forward to OpenAI/Claude
    AI-->>S: AI response
    S-->>U: Return response
    S->>S: Discard API key from memory ✅
```

The API key travels over HTTPS per-request and is never stored on the server. The encrypted blob in Firestore can only be decrypted by the user's browser.

> [!NOTE]
> **BYOK implementation detail:** The explicit `/api/ai/analyze` and `/api/ai/score` endpoints follow the BYOK pattern (client sends the key per-request). However, the automatic **Transcript Analysis Pipeline** (`server/src/services/transcript-analysis-pipeline.ts`) reads API keys from server-side environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`). This means the real-time in-meeting suggestions use server-configured keys, while post-meeting analysis on the dashboard uses the user's own keys.

### 🔧 Critical Fix #4: Email Tracking Needs Server Persistence

> [!NOTE]
> **Problem in v1:** Email open/click tracking works by embedding a tiny tracking pixel (for opens) and redirect links (for clicks) in emails. When a recipient opens the email or clicks a link, a request hits YOUR server. But your server is supposed to be stateless — contradiction!

**Solution: Tracking Inbox pattern**

The server maintains a minimal **Tracking Inbox** — a lightweight queue that stores only:
- `{ campaignId, event: "open"|"click", timestamp }`

No email content, no personal data — just event metadata. When the user opens their dashboard, it pulls events from the inbox and stores them in local IndexedDB. The server then deletes the pulled events.

This is an honest, small compromise to the "nothing on server" rule, but the data is minimal and ephemeral.

### IndexedDB Schema (Local Database)

```mermaid
erDiagram
    MEETINGS {
        string id PK
        string zoomMeetingId
        string title
        datetime startTime
        datetime endTime
        number duration
        string status
        string participants
    }

    TRANSCRIPTS {
        string id PK
        string meetingId FK
        json segments
        string fullText
        datetime createdAt
    }

    AI_ANALYSIS {
        string id PK
        string meetingId FK
        string summary
        json actionItems
        json sentiment
        number leadScore
        json emailDraft
        string modelUsed
        datetime analyzedAt
    }

    LEADS {
        string id PK
        string meetingId FK
        string name
        string email
        string company
        string role
        number score
        string stage
        json tags
        json customFields
        datetime createdAt
        datetime updatedAt
    }

    DEALS {
        string id PK
        string leadId FK
        string title
        string stage
        number value
        number probability
        datetime expectedClose
        json notes
        datetime createdAt
        datetime updatedAt
    }

    EMAIL_CAMPAIGNS {
        string id PK
        string leadId FK
        string subject
        string body
        string status
        string type
        json sequence
        datetime scheduledAt
        datetime sentAt
    }

    EMAIL_TRACKING {
        string id PK
        string campaignId FK
        number opens
        number clicks
        boolean replied
        datetime lastActivity
    }

    MEETINGS ||--|| TRANSCRIPTS : has
    MEETINGS ||--|| AI_ANALYSIS : has
    MEETINGS ||--o{ LEADS : generates
    LEADS ||--o{ DEALS : has
    LEADS ||--o{ EMAIL_CAMPAIGNS : receives
    EMAIL_CAMPAIGNS ||--|| EMAIL_TRACKING : tracks
```

### 🔧 Critical Fix #5: Data Durability

> [!CAUTION]
> **Problem in v1:** IndexedDB data can be lost if the user clears browser data, reinstalls the browser, or the browser evicts storage under disk pressure. For a business tool managing sales pipeline data, this is a **critical risk**.

**Mitigations (built into MVP):**
1. **Automatic JSON backup exports** — Scheduled weekly auto-export to a local JSON file (user chooses folder)
2. **Manual export** — One-click export of all data (JSON + CSV formats) from Settings
3. **Import/restore** — Ability to import a backup file to restore data
4. **Storage persistence request** — Use `navigator.storage.persist()` to ask the browser not to evict our data
5. **Low storage warnings** — Alert users when IndexedDB usage exceeds 80% of quota

---

## Feature Breakdown

### 🎙️ In-Meeting Panel (Inside Zoom)

> 🔧 **Updated:** Panel is now stateless — it displays data streamed from the server but stores nothing locally (because it can't share IndexedDB with the dashboard).

| Feature | Description | AI Powered | Storage |
|---------|-------------|:----------:|:-------:|
| Live Transcription | Real-time speech-to-text during the call | ✅ | Server relay → Dashboard |
| Speaker Identification | Labels who said what | — | Server relay → Dashboard |
| Live Suggestions | AI suggests talking points, responses | ✅ | Display only (ephemeral) |
| Quick Notes | Manual note-taking alongside transcript | — | Sent to server → Dashboard |
| Meeting Timer | Shows elapsed time and key moments | — | Display only |
| Action Item Detection | Flags action items as they come up | ✅ | Server relay → Dashboard |

### 📊 Web Dashboard

#### Meeting Intelligence
| Feature | Description | AI Powered |
|---------|-------------|:----------:|
| Meeting History | Browse past meetings with search & filter | — |
| AI Summary | Auto-generated executive summary | ✅ |
| Action Items | Extracted action items with assignees & deadlines | ✅ |
| Sentiment Analysis | Meeting mood timeline (positive/negative/neutral) | ✅ |
| Key Moments | Highlighted important parts of the conversation | ✅ |
| Full Transcript | Searchable, timestamped transcript | — |

#### Lead Management
| Feature | Description | AI Powered |
|---------|-------------|:----------:|
| Lead Cards | Contact info, company, role, meeting history | — |
| Lead Scoring | AI scores leads based on meeting engagement | ✅ |
| Auto-Creation | Leads auto-created from meeting participants | ✅ |
| Tags & Filters | Organize leads by custom tags | — |
| Activity Timeline | Full history of interactions per lead | — |

#### Deal Pipeline
| Feature | Description | AI Powered |
|---------|-------------|:----------:|
| Kanban Board | Visual drag-and-drop pipeline | — |
| Deal Stages | Customizable stages (Discovery → Closed Won) | — |
| Deal Value | Track expected revenue | — |
| Win Probability | AI-estimated close probability | ✅ |
| Notes & History | Attach notes and meeting references | — |

#### Email Outreach
| Feature | Description | AI Powered |
|---------|-------------|:----------:|
| AI Draft Generation | Generate follow-up emails from meeting context | ✅ |
| Email Editor | Rich text editor for reviewing/editing drafts | — |
| Send via Resend | Send emails through Resend API | — |
| Gmail/Outlook Integration | Send from user's own email account | — |
| Drip Campaigns | Multi-step automated email sequences (runs client-side via `setInterval`; only active while dashboard is open) | — |
| Open/Click Tracking | Track email engagement (via Tracking Inbox) | — |

#### Settings & Configuration
| Feature | Description |
|---------|-------------|
| API Key Management | Add/update OpenAI and Anthropic keys (client-side encrypted) |
| AI Model Selection | Choose which model to use (GPT-4o, Claude Sonnet, etc.) |
| Email Account Connection | Connect Gmail/Outlook |
| Pipeline Customization | Custom deal stages |
| Subscription Management | Dodo Payments integration (checkout, verify, webhooks, plan management) |
| 🔧 Data Export / Backup | Export all local data as JSON/CSV, import backups |
| 🔧 Storage Health | Monitor IndexedDB usage, storage warnings |
| 🔧 Auto Backup | Automatic weekly JSON backup via `useAutoBackup` hook |
| 🔧 Cookie Consent | GDPR-compliant cookie consent banner |

---

## Project Structure

```
/ (Project Root)
├── client/                          # Frontend (React + Vite)
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── src/
│   │   ├── main.tsx                 # App entry point
│   │   ├── App.tsx                  # Root component + routing
│   │   ├── routes.tsx               # App routing definitions
│   │   ├── index.css                # Global styles + design tokens
│   │   │
│   │   ├── components/              # Reusable UI components
│   │   │   ├── GoogleIcon.tsx       # Google OAuth icon component
│   │   │   ├── common/              # ErrorBoundary, RichTextEditor, Toast, ConfirmDialog, Spinner, CookieConsent
│   │   │   │   └── index.ts         # Barrel exports (ErrorBoundary, RichTextEditor, Toast)
│   │   │   ├── email/               # ComposeEmailCard, EmailCampaignCard, DripCampaignCard
│   │   │   ├── layout/              # Sidebar, Header, DashboardLayout, ZoomPanelLayout, ProtectedRoute
│   │   │   ├── pipeline/            # PipelineCard, PipelineColumn, NewDealModal
│   │   │   └── settings/            # EmailIntegrationSettings, PipelineSettings
│   │   │
│   │   ├── pages/                   # Page-level components
│   │   │   ├── auth/                # LoginPage
│   │   │   ├── dashboard/           # DashboardPage, MeetingsPage, MeetingDetailPage, LeadsPage, LeadDetailPage, PipelinePage, AnalyticsPage, SettingsPage, EmailPage, BillingPage
│   │   │   ├── landing/             # PrivacyPolicy, TermsOfService, Support
│   │   │   ├── LandingPage.tsx      # Marketing / landing page (root)
│   │   │   ├── LandingPage.css      # Landing page styles
│   │   │   └── zoom-panel/          # TranscriptionView, SuggestionsView, NotesView (STATELESS)
│   │   │
│   │   ├── services/                # Business logic & data layer
│   │   │   ├── ai/                  # ai-service.ts (AI proxy layer)
│   │   │   ├── api/                 # client.ts (Backend API client)
│   │   │   ├── firebase/            # auth.ts, config.ts (Firebase config & helpers)
│   │   │   ├── local-db/            # db.ts, meetings.ts, transcripts.ts, leads.ts, deals.ts, emails.ts, tracking.ts, ai-analysis.ts, backup.ts
│   │   │   ├── zoom/                # zoom-sdk.ts (Zoom SDK integration)
│   │   │   ├── lead-automation.ts   # Auto-lead creation from meeting participants
│   │   │   ├── drip-worker.ts       # Drip campaign automation
│   │   │   ├── analytics.ts         # Analytics service
│   │   │   └── cookie-consent.ts    # Cookie consent service
│   │   │
│   │   ├── hooks/                   # useAutoBackup, useCookieConsent, useWebSocket
│   │   ├── store/                   # Zustand stores (authSlice, keySlice, uiSlice)
│   │   ├── types/                   # TypeScript interfaces (index.ts, billing.ts)
│   │   ├── utils/                   # analytics.ts, stages.ts
│   │   ├── crypto/                  # key-vault.ts (Client-side encryption utilities)
│   │   └── test/                    # Test utilities
│   │
│   ├── vite.config.ts
│   └── package.json
│
├── server/                          # Backend (Node.js + Express)
│   ├── src/
│   │   ├── index.ts                 # Server entry point (Socket.io, graceful shutdown)
│   │   ├── app.ts                   # Express app setup (routes, middleware, security)
│   │   ├── config.ts                # Environment configuration
│   │   ├── routes/                  # auth.ts, zoom.ts, ai.ts, email.ts, tracking.ts, billing.ts
│   │   ├── services/                # ai-providers.ts, ai-service.ts, buffer-service.ts, email-service.ts, firebase-admin.ts, transcript-analysis-pipeline.ts, zoom-rtms.ts
│   │   ├── middleware/              # auth.ts, errorHandler.ts, requestId.ts, sanitize.ts, validateRequest.ts
│   │   ├── types/                   # TypeScript interfaces
│   │   ├── utils/                   # logger.ts, prompts.ts, sanitize.ts, crypto.ts
│   │   ├── swagger.json             # OpenAPI 3.0.3 API documentation
│   │   └── *.test.ts                # Co-located tests (config, routes, services, middleware, utils, integration, e2e)
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── .github/                         # CI/CD and GitHub Actions
│   └── workflows/
│       ├── ci.yml                   # CI pipeline (lint, test, build)
│       └── deploy.yml               # Deployment pipeline (Render)
│
├── docker-compose.yml               # Docker Compose configuration
├── render.yaml                      # Render deployment configuration
├── package.json                     # Root package.json (npm workspaces monorepo root)
└── README.md
```

---

## Infrastructure & Documentation

### Environment Variables
- `client/.env` - Frontend environment variables (Vite config, API URL, Firebase config).
- `server/.env` - Backend environment variables (Port, Zoom credentials, Resend API key, Firebase Admin credentials, Dodo Payments credentials).

### API Documentation
- **Swagger/OpenAPI**: The server exposes an OpenAPI 3.0.3 spec at `/api/docs` (`server/src/swagger.json`).
- Covers all endpoints: auth, zoom, AI analysis, email, tracking, and billing.

### Build & Deployment
The app uses an npm workspaces monorepo structure.
- **Local Dev:** Run `npm run dev` from the root to start both `client` and `server` concurrently.
- **Render Deployment:** `render.yaml` defines a web service (`dealforge-server`) running Node.js and a static site (`dealforge-client`) served by the platform.

### Docker Setup
- `docker-compose.yml` configures `server` and `client` services.
- `server/Dockerfile` is a multi-stage Node.js build copying root workspaces and starting via `node server/dist/index.js`.
- `client/Dockerfile` builds the Vite app and serves it via an `nginx:alpine` web server with custom `nginx.conf`.

### CI/CD Pipeline
- **`.github/workflows/ci.yml`**: Runs on pull requests to `main`. It tests code quality by running `npm ci`, linting (`npm run lint`), and unit tests (`npm run test`).
- **`.github/workflows/deploy.yml`**: Runs on pushes to `main`. Contains the deployment pipeline triggering Render deploys.

---

## Design System

### Visual Identity — *"Warm Parchment"*

**Vibe:** Warm, elegant, literary — inspired by vintage paper and classical typography.

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#8a2317` | Primary accent (deep red) |
| `--secondary` | `#a87714` | Secondary accent (warm brown) |
| `--tertiary` | `#5d7440` | Tertiary accent (sage green) |
| `--bg-primary` | `#f3ebd9` | Main background (light parchment) |
| `--bg-secondary` | `#faf3e2` | Cards, panels |
| `--bg-tertiary` | `#e9dec3` | Hover states, elevated surfaces |
| `--text-primary` | `#1c1813` | Primary text (dark brown) |
| `--text-secondary` | `#4a4338` | Secondary text |
| `--text-muted` | `#847a64` | Muted/disabled text |
| `--border` | `#c9be9f` | Warm borders |

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Display | **Fraunces** | 24–32px | 700 |
| Body | **Newsreader** | 17px | 400 |
| Code/Data | **JetBrains Mono** | 13px | 400 |

### Design Principles

- **Paper Texture:** Subtle grain overlay for tactile, printed feel
- **Warm Tones:** Earthy reds, browns, and sage against parchment backgrounds
- **Classical Typography:** Serif fonts (Fraunces, Newsreader) for elegant readability
- **Minimal Shadows:** Flat design with subtle borders instead of heavy shadows
- **Whitespace:** Generous padding and margins for a premium, breathable feel

---

## Build Phases

### Phase 1 — Foundation & Meeting Intelligence (Weeks 1–4)

> **Goal:** A working Zoom App that can transcribe meetings and show AI summaries on the dashboard.

| Week | Tasks |
|------|-------|
| **1** | Project scaffolding (React + Vite + Express monorepo), design system (CSS tokens, base components), Firebase Auth (login/signup/onboarding) |
| **2** | Web Dashboard shell (sidebar, header, routing, empty pages), Zoom Developer App registration, OAuth flow, ngrok HTTPS setup |
| **3** | Zoom in-meeting panel (stateless UI), meeting transcription (Zoom captions API → server relay → WebSocket → IndexedDB), transcript viewer page |
| **4** | BYOK setup (client-side encrypted key storage), AI proxy (server), post-meeting analysis (summary, action items, sentiment), meeting detail page |

**Deliverable:** User installs the Zoom App → joins a meeting → sees live transcription in the panel → opens dashboard → views AI-generated summary, action items, and sentiment analysis.

---

### Phase 2 — Lead Management & Pipeline (Weeks 5–8)

> **Goal:** Auto-create leads from meetings and manage deals in a visual pipeline.

| Week | Tasks |
|------|-------|
| **5** | Lead management UI (list view, lead cards, search & filter), lead CRUD in IndexedDB |
| **6** | Auto lead creation from meeting participants, AI lead scoring, lead detail page |
| **7** | Deal pipeline (Kanban board with drag-and-drop), customizable deal stages, deal CRUD |
| **8** | Activity timelines, lead ↔ meeting linking, deal notes, data export/backup (v1) |

**Deliverable:** After a meeting, leads auto-appear with AI scores. Sales reps manage deals in a drag-and-drop Kanban pipeline. Data can be exported as backup.

---

### Phase 3 — Email Outreach (Weeks 9–12)

> **Goal:** AI-generated follow-up emails with campaign management.

| Week | Tasks |
|------|-------|
| **9** | AI email draft generation (from meeting transcript + lead context), rich text email editor |
| **10** | Resend API integration, send emails from dashboard, email history per lead |
| **11** | Gmail/Outlook OAuth integration, send from user's own email account |
| **12** | Drip campaigns (multi-step automated sequences), email scheduling |

**Deliverable:** After a meeting, AI drafts a follow-up email using the transcript. Users edit, send, and create automated email sequences.

---

### Phase 4 — Analytics, Tracking & Launch (Weeks 13–16)

> **Goal:** Email tracking, analytics dashboard, billing, and Zoom Marketplace submission.

| Week | Tasks |
|------|-------|
| **13** | Email tracking (open/click via Tracking Inbox), tracking pixel + redirect links, engagement dashboard |
| **14** | Analytics page (meeting frequency, pipeline velocity, email performance, lead score trends) |
| **15** | Subscription/billing (Dodo Payments integration — Stripe removed), plan tiers, settings polish |
| **16** | End-to-end testing, bug fixes, Zoom Marketplace submission process, landing page |

**Deliverable:** Full DealForge product with analytics, email tracking, billing, and a polished landing page. Submitted to Zoom Marketplace for review.

---

## 🎯 What We Build FIRST (MVP Scope)

For the very first buildable version, we focus on **Phase 1 only**:

1. ✅ Project scaffolding + design system (CSS tokens, base components)
2. ✅ Firebase Auth (login / signup / Google OAuth)
3. ✅ Web Dashboard shell (sidebar navigation, page routing, responsive layout)
4. ✅ Zoom App registration + OAuth flow
5. ✅ In-meeting panel (stateless live transcription view)
6. ✅ Meeting transcription pipeline (Zoom → Server → Dashboard → IndexedDB)
7. ✅ BYOK API key setup (client-side encrypted)
8. ✅ AI summary generation (post-meeting analysis)
9. ✅ Storage persistence + basic data export

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Zoom Marketplace rejection** | Can't distribute the app | Study Zoom's review requirements early; follow their security & privacy guidelines strictly |
| **Zoom RTMS complexity** | Real-time audio processing is hard | Start with Zoom's built-in captions API (simpler); upgrade to RTMS post-MVP |
| **IndexedDB data loss** | Users lose their sales pipeline | Auto-backup to JSON weekly; manual export; `navigator.storage.persist()`; prominent warnings |
| **BYOK key exposure** | Security breach | Client-side PBKDF2 encryption; keys only transit over HTTPS per-request; never stored on server |
| **24h buffer expiry** | Meeting data lost if dashboard isn't opened | Push notifications (email/browser) reminding users to sync; extend TTL if needed |
| **Browser storage limits** | IndexedDB quota exceeded | Monitor usage; warn at 80%; offer cleanup of old meetings; data export before cleanup |
| **WebSocket reliability** | Dropped connections during meetings | Auto-reconnect logic; fallback to HTTP polling; server-side buffering catches gaps |

---

> [!TIP]
> **For a non-technical founder:** You don't need to understand every piece of the tech stack. Think of it like building a house — I'll handle the plumbing and wiring, you focus on what rooms you want and how they should look. Just tell me when something doesn't feel right!

---

**Review the fixes above. When you're happy with the plan, hit "Proceed" and we'll start scaffolding DealForge! 🔥**



# DealForge - Implementation Status

## Completed

### Phase 1: MVP & Meeting Intelligence
- [x] Project scaffolding (monorepo, workspaces, build config)
- [x] Design system (CSS tokens, Warm Parchment paper aesthetic)
- [x] Firebase Auth (login/signup/Google OAuth)
- [x] Web Dashboard shell (sidebar, header, routing)
- [x] ProtectedRoute with auth loading state
- [x] DashboardPage with stats cards, Recharts charts, recent activity
- [x] MeetingsPage with search, status badges, table view
- [x] MeetingDetailPage with transcript display, AI analysis
- [x] LeadsPage with card grid, stage filters, search
- [x] SettingsPage with BYOK API keys (AES-256-GCM client-side encryption)
- [x] Zoom in-meeting panel (stateless UI with proper CSS)
- [x] TranscriptionView, SuggestionsView, NotesView
- [x] WebSocket hook (shared connection, reconnection)
- [x] IndexedDB schema and wrapper functions (meetings, leads, deals, emails, tracking, backup)
- [x] Data export/import/backup utilities
- [x] AI proxy with summary, action items, sentiment analysis
- [x] Email service (Resend integration, draft generation)
- [x] Buffer service (24h TTL in-memory cache)
- [x] Zoom routes (OAuth, webhooks, transcription relay, notes)
- [x] Tracking routes (open/click pixel, event inbox)
- [x] Server security (helmet, rate limiting, CORS, error handling)
- [x] Graceful shutdown, health check endpoints

### Phase 2: Lead Management & Pipeline
- [x] Lead cards with score visualization
- [x] Stage-based filtering
- [x] Auto lead creation from meeting participants (`client/src/services/lead-automation.ts`)
- [x] AI lead scoring (`client/src/pages/dashboard/LeadsPage.tsx`, `server/src/routes/ai.ts`)
- [x] Kanban drag-and-drop pipeline (`client/src/pages/dashboard/PipelinePage.tsx`)
- [x] Data durability (auto-backup via `backup.ts`, storage persistence in `App.tsx`)

### Phase 3: Email Outreach
- [x] AI email draft generation endpoint
- [x] Email sending via Resend
- [x] Email editor UI (rich text) (`client/src/components/email/RichTextEditor.tsx`)
- [x] Drip campaign management (`client/src/components/email/ComposeEmailCard.tsx`, `client/src/services/drip-worker.ts`)
- [x] Open/click tracking integration in dashboard (`client/src/pages/dashboard/EmailPage.tsx`)

### Phase 4: Analytics & Launch
- [x] Basic dashboard with charts
- [x] Full analytics page with 6 charts (pipeline velocity, meeting frequency, lead stages, conversion funnel, email performance, lead score trends) (`client/src/pages/dashboard/AnalyticsPage.tsx`)
- [x] Billing integration — Dodo Payments (checkout, verify, webhooks, subscription management) (`server/src/routes/billing.ts`, `client/src/pages/dashboard/BillingPage.tsx`)
- [ ] Zoom Marketplace submission (blocked on real Zoom credentials)

## Notes
- Tracking events and buffer service use in-memory storage (lost on server restart). Acceptable for development/small scale; would need Redis for production durability.
- The `save_note` WebSocket handler only logs (intentional — notes persist via HTTP endpoint).
