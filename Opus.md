# Opus — DealForge Codebase Ground-Truth Reference

> **Last verified**: 2026-08-03 08:15 IST  
> **Verified by**: Claude Opus 4.6 — every claim below was validated by reading actual source files and running actual commands against the working tree.  
> **Git state**: `main` @ `bc7d663` + **89 uncommitted modified/new files**

---

## 1. What Is DealForge

AI-powered SaaS for sales meeting intelligence. Privacy-first, BYOK architecture — sensitive data stored client-side in IndexedDB, server acts as a stateless relay with 24h TTL buffering.

**Business model**: Freemium. Free (3 meetings/mo) → Pro ($29/mo) → Enterprise ($79/mo).  
**Moat**: Competitors (Gong, Chorus, Otter.ai) store your data on their servers. DealForge doesn't.

---

## 2. Verified Tech Stack

### Client (`client/package.json`)
| Package | Actual Version | Previously Misreported As |
|---------|---------------|--------------------------|
| react | `^19.2.7` | 19.1.0 |
| react-dom | `^19.2.7` | — |
| react-router-dom | `^7.18.1` | 7.6.2 |
| zustand | `^5.0.14` | 5.0.5 |
| dexie | `^4.4.4` | 4.0.11 |
| recharts | `^3.9.2` | 2.15.3 |
| firebase | `^12.16.0` | 11.8.0 |
| socket.io-client | `^4.8.3` | 4.8.1 |
| lucide-react | `^1.25.0` | 0.511.0 |
| @sentry/react | `^10.68.0` | — |
| @zoom/appssdk | `^0.16.14` | 0.16.37 |
| dompurify | `^3.4.12` | 3.2.6 |
| react-virtuoso | `^4.7.9` | not mentioned |
| vite | `^5.0.0` | 6.3.5 |
| vitest | `^4.1.10` | 3.2.1 |
| typescript | `^5.0.0` | 5.8.3 |
| oxlint | `^1.71.0` | 1.0.0 |

### Server (`server/package.json`)
| Package | Actual Version |
|---------|---------------|
| express | `^4.21.0` (**NOT 5.x**) |
| @anthropic-ai/sdk | `^0.112.5` |
| @google/genai | `^0.2.0` |
| @sentry/node | `^10.68.0` |
| dodopayments | `^2.43.0` |
| firebase-admin | `^14.2.0` |
| ioredis | `^5.11.1` |
| openai | `^6.48.0` |
| resend | `^6.17.2` |
| socket.io | `^4.8.3` |
| helmet | `^8.3.0` |
| zod | `^3.22.4` |
| vitest | `^4.1.10` |

---

## 3. Verified Health (run 2026-08-03)

| Check | Command | Result |
|-------|---------|--------|
| **Server tests** | `npm run test:server` | ✅ **158 passed**, 0 failed, 28 test files |
| **Client tests** | `npm run test:client` | ✅ **85 passed**, 0 failed, 10 test files |
| **Server typecheck** | `cd server && npx tsc --noEmit` | ✅ Clean (exit 0) |
| **Client typecheck** | `cd client && npx tsc --noEmit` | ✅ Clean (exit 0) |
| **Lint** | `npm run lint` | ⚠️ **24 warnings**, 0 errors (all `react/only-export-components` in `routes.tsx`) |
| **Production build** | `npm run build` | ✅ Succeeds |
| **Total tests** | — | **243 passing** |

### Previous False Claims Corrected
- ~~"47 client + 88 server = 135 tests"~~ → Actually **85 client + 158 server = 243 tests**
- ~~"Express 5.1.0"~~ → Actually **Express 4.21.x**
- ~~"5 separate Zustand stores"~~ → Actually **1 store with 4 slices** + Dexie services
- ~~"Dark glassmorphism design"~~ → Actually **"The Industrial Journal"** editorial print aesthetic

---

## 4. Design System: "The Industrial Journal"

**Source**: `client/DESIGN.md` (152 lines), verified against `client/src/index.css`

| Aspect | Specification |
|--------|--------------|
| **Philosophy** | Editorial print aesthetic — tactile, grounded, like a typeset ledger |
| **Background** | Paper `#f3ebd9`, Soft Paper `#faf3e2` |
| **Text** | Deep Ink `#1c1813`, secondary `#4a4338`, muted `#847a64` |
| **Primary accent** | Oxblood `#8a2317` — links, hover states, interactive elements |
| **Secondary accent** | Antique Gold `#a87714` — warnings, status markers |
| **Tertiary accent** | Sage Green `#5d7440` — success, completion states |
| **Structural lines** | Rule `#c9be9f` — 1px solid borders divide everything |
| **Border radius** | **0px everywhere** — no rounded corners, ever |
| **Display font** | Fraunces (serif, 700 weight) |
| **Body font** | Newsreader (serif, 400 weight, 1.62 line-height) |
| **Label/mono font** | JetBrains Mono |
| **Elevation** | Completely flat. Shadows only for floating modals. |
| **Do not** | Use border-radius, drop shadows on cards, or gradients |

---

## 5. Architecture

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│   Zoom Panel    │────▶│   Express 4.x Server     │────▶│   Firebase      │
│   (iFrame)      │     │   • Stateless relay       │     │   Auth + Firestore
│   @zoom/appssdk │     │   • Redis buffer (24h TTL)│     │   (subscription, │
└─────────────────┘     │   • Socket.io (RTMS)      │     │    usage, tokens)│
                        │   • Rate limited (10 tiers)│     └─────────────────┘
┌─────────────────┐     │   • Sentry (prod)         │
│  Web Dashboard  │────▶│   • Zod validation        │     ┌─────────────────┐
│  React 19 SPA   │     │   • XSS sanitization      │────▶│  AI Providers   │
│  • Dexie/IDB    │     │   • Helmet CSP            │     │  OpenAI / Claude│
│  • Zustand      │     └──────────────────────────┘     │  / Gemini (BYOK)│
│  • Web Crypto   │                                       └─────────────────┘
└─────────────────┘
```

### State Management (Verified)
- **1 Zustand store** with 4 composed slices: `authSlice`, `keySlice`, `uiSlice`, `subscriptionSlice`
- **Dexie.js IndexedDB** handles all persistent data (9 tables, version 4 schema with optimized indexes)
- There are **NO** separate `useMeetingStore`, `useLeadStore`, `usePipelineStore`, `useEmailStore` — data lives in Dexie services under `services/local-db/`

### Buffer Service (Server)
- **Primary**: Redis via `ioredis` (connects to `REDIS_URL`)
- **Fallback**: In-memory `Map` (max 10,000 entries) if Redis unavailable
- **TTL**: 24 hours

---

## 6. Routes (Verified from `client/src/routes.tsx`)

| Path | Component | Auth | Layout |
|------|-----------|------|--------|
| `/` | `LandingPage` | No | — |
| `/login` | `LoginPage` | No | — |
| `/privacy` | `PrivacyPolicy` | No | — |
| `/terms` | `TermsOfService` | No | — |
| `/support` | `Support` | No | — |
| `/onboarding` | `OnboardingPage` | Yes | ProtectedRoute |
| `/dashboard` | `DashboardPage` | Yes | DashboardLayout |
| `/dashboard/meetings` | `MeetingsPage` | Yes | DashboardLayout |
| `/dashboard/meetings/:id` | `MeetingDetailPage` | Yes | DashboardLayout |
| `/dashboard/leads` | `LeadsPage` | Yes | DashboardLayout |
| `/dashboard/leads/:id` | `LeadDetailPage` | Yes | DashboardLayout |
| `/dashboard/analytics` | `AnalyticsPage` | Yes | DashboardLayout |
| `/dashboard/pipeline` | `PipelinePage` | Yes | DashboardLayout |
| `/dashboard/emails` | `EmailPage` | Yes | DashboardLayout |
| `/dashboard/settings` | `SettingsPage` | Yes | DashboardLayout |
| `/dashboard/billing` | `BillingPage` | Yes | DashboardLayout |
| `/zoom-panel` | `TranscriptionView` | No | ZoomPanelLayout |
| `/zoom-panel/transcription` | `TranscriptionView` | No | ZoomPanelLayout |
| `/zoom-panel/suggestions` | `SuggestionsView` | No | ZoomPanelLayout |
| `/zoom-panel/notes` | `NotesView` | No | ZoomPanelLayout |

**Note**: There is **NO** `/oauth/callback` client route — OAuth callbacks are handled server-side.

---

## 7. Server API Endpoints (Verified from `server/src/app.ts`)

| Route Group | Mount Point | Middleware | Rate Limit |
|-------------|-------------|-----------|------------|
| Auth | `/api/auth` | authLimiter | 20/15min |
| Zoom | `/api/zoom` | — | global only |
| Billing | `/api/billing` | verifyAuth, billingLimiter | 30/15min |
| Referrals | `/api/referrals` | verifyAuth, referralLimiter | 30/15min |
| Tracking | `/api/tracking` | trackingLimiter | 300/1min |
| AI | `/api/ai` | verifyAuth, aiLimiter | 10/1min |
| Email OAuth | `/api/email/oauth` | billingLimiter | 30/15min |
| Email | `/api/email` | verifyAuth, requirePlan('pro'), emailLimiter | 5/1min |
| API Keys | `/api/api-keys` | verifyAuth, apiKeyLimiter | 30/15min |
| Sync | `/api/sync` | verifyAuth, requirePlan('pro'), syncLimiter | 10/1min |
| Public API | `/api/v1` | publicApiLimiter (keyed by x-api-key) | 60/1min |
| Health | `/api/health` | — | — |
| Docs | `/api/docs` | — | — |
| Zoom verify | `/zoomverify/verifyzoom.html` | — | — |

---

## 8. Dexie/IndexedDB Schema (Version 4)

**Source**: `client/src/services/local-db/db.ts`

| Table | Indexes |
|-------|---------|
| `meetings` | `id, zoomMeetingId, startTime, status, [status+startTime]` |
| `transcripts` | `id, meetingId` |
| `ai_analysis` | `id, meetingId` |
| `leads` | `id, meetingId, stage, createdAt, [stage+createdAt]` |
| `deals` | `id, leadId, stage` |
| `email_campaigns` | `id, leadId, status` |
| `email_tracking` | `id, campaignId` |
| `settings` | `key` |
| `drip_campaigns` | `id, leadId, status` |

V4 upgrade specifically **dropped bloated/unused indexes** to improve write performance.

---

## 9. Plan Configuration (Verified from `client/src/types/billing.ts`)

| Feature | Free | Pro ($29) | Enterprise ($79) |
|---------|------|-----------|-------------------|
| Meetings/month | 3 | Unlimited | Unlimited |
| AI models | 1 | 3 (all) | 3 (all) |
| Email outreach | ❌ | ✅ | ✅ |
| Pipeline | ❌ | ✅ | ✅ |
| Custom stages | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ✅ |
| Team features | ❌ | ❌ | ✅ |
| API access | ❌ | ✅ | ✅ |
| Transcript history | 30 days | Unlimited | Unlimited |

---

## 10. Free Tier Enforcement (Server-Side — Verified)

**Source**: `server/src/services/usage-service.ts` + `server/src/middleware/plan.ts`

- `FREE_ANALYSIS_LIMIT = 3` (usage-service.ts line 4)
- Tracked in Firestore: `users/{uid}/usage/{YYYY-MM}/analyses/{meetingId}`
- `enforceAnalysisLimit` middleware in plan.ts calls `getMonthlyAnalysisCount()` and returns 403 if exceeded
- `enforceAiModelAccess` restricts free users to OpenAI only
- **Graceful degradation**: If Firestore is unavailable, fails open (allows request) with logged warning
- Referral bonuses can dynamically increase the limit via `referral-service.ts`

---

## 11. Web Crypto Vault (Verified from `client/src/crypto/key-vault.ts`)

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-GCM |
| Key length | 256 bits |
| Key derivation | PBKDF2 |
| Iterations | **600,000** |
| Hash | SHA-256 |
| Salt | 16 bytes random |
| IV | 12 bytes random |
| API | Web Crypto (`crypto.subtle`) — no external library |

---

## 12. Feature Map — What's Built vs. What's Not

### ✅ Fully Built & Verified
- Firebase Auth (email/password + Google)
- Onboarding wizard (Zoom connect → API keys → Email provider)
- Meeting management with IndexedDB persistence
- Manual transcript mode (paste/upload .txt/.srt/.vtt)
- AI analysis: summarization, action items, sentiment, lead scoring (OpenAI, Anthropic, Gemini)
- Lead management + auto-creation from meeting participants
- Lead detail page with transcript history, deal status, email log
- Pipeline management with Kanban board
- Email drafting with AI + drip campaign engine (60s polling)
- Email tracking (open pixels + click wrapping, 24h TTL)
- Gmail & Outlook OAuth integration (encrypted tokens in Firestore)
- Dodo Payments billing (checkout, webhook signature validation, subscription lifecycle)
- Zoom in-meeting panel (TranscriptionView, SuggestionsView, NotesView)
- Zoom RTMS live transcription (real WebSocket to `wss://rtms2.zoom.us`, not a stub)
- Feature gating (client-side `feature-gate.ts` + server-side `plan.ts` middleware)
- Server-side free tier enforcement (Firestore usage tracking)
- Usage analytics (localStorage, 180-day retention, no external service)
- Client-side encryption (PBKDF2 + AES-GCM key vault)
- Data backup/restore (JSON export + File System Access API auto-backup)
- Cookie consent
- Rate limiting (10 separate limiters, see §7)
- Sentry integration (client + server, needs DSN env var)
- Redis buffer service with in-memory fallback
- XSS sanitization middleware
- Helmet CSP headers
- Request ID middleware
- Swagger/OpenAPI docs at `/api/docs`
- Referral program (generate code, claim rewards, meeting bonuses + free months)
- API key management (SHA-256 hashed keys, `df_live_`/`df_test_` prefix)
- Public API (`/api/v1` with API key auth for external integrations)
- Data sync service (push local IndexedDB data to server, Firestore batch commits)
- Comprehensive test suite (243 tests)

### 🟡 Built But Needs Credentials to Function
- Firebase (project ID, service account) — **required for everything**
- Dodo Payments (API key, webhook key, product IDs)
- Zoom (client ID/secret, SDK key/secret, webhook secret)
- Gmail OAuth (client ID/secret)
- Outlook OAuth (client ID/secret)
- Resend (API key for fallback email)
- Sentry (DSN)
- Redis (URL — optional, has in-memory fallback)

### 🔴 Not Yet Built
- Team features (shared pipeline, team analytics, admin controls) — gated but not implemented
- Google Meet / MS Teams direct integrations (manual transcript covers the gap)
- Deployment — NOT deployed anywhere
- SEO landing page optimization

---

## 13. Documentation & Content Assets

### `docs/` directory (NEW — untracked)
```
docs/
├── blog/
│   ├── how-ai-meeting-intelligence-saves-sales-teams-5-hours.md
│   ├── why-your-meeting-data-should-stay-on-your-device.md
│   ├── the-complete-guide-to-sales-follow-up-automation.md
│   ├── bant-lead-scoring-ai.md
│   └── dealforge-vs-gong-privacy-first-meeting-intelligence.md
├── upsell/
│   └── enterprise-upsell-playbook.md
└── zoom-marketplace/
    ├── README.md
    ├── listing-copy.md
    ├── technical-design.md
    ├── reviewer-test-guide.md
    └── demo-video-script.md
```

### Other docs
- `DESIGN.md` — design system spec in `client/`
- `PRODUCT.md` — product vision in `client/`
- `SAAS-PROFITABILITY-PLAN.md` — 4-phase business plan (root, untracked)
- `launch-plan.html` — visual launch checklist/dashboard (root)
- `zoom-manifest.json` — Zoom Marketplace app definition (root, untracked)
- `server/src/swagger.json` — OpenAPI spec

---

## 14. CI/CD Pipeline (`.github/workflows/ci.yml`)

**4 parallel jobs** (not a simple 3-stage sequence):

```
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│ lint-client  │  │ test-client   │  │ test-server   │
│ (oxlint)     │  │ (vitest)      │  │ (vitest)      │
└──────┬───────┘  └──────┬────────┘  └──────┬────────┘
       │                 │                   │
       └────────────┬────┴───────────────────┘
                    ▼
            ┌──────────────┐
            │    build     │
            │ (both ws)    │
            └──────────────┘
```

- Trigger: push/PR to `main`
- Node 20, Ubuntu latest
- **No typecheck step** in CI (only lint + test)
- **No deployment step** — deployment is manual

---

## 15. Git State

- **Branch**: `main` @ `bc7d663`
- **Working tree**: 89 modified/untracked files (significant uncommitted work)
- **Stale branches**: `subagent-Client-CSS-Refactorer-*`, `subagent-Server-Refactorer-*` (from previous AI work)
- **Remotes**: `origin` (vigilant-goggles), `dealforge` (separate repo)

---

## 16. Known Issues & Warnings

1. **`express-rate-limit` IPv6 warning**: The `publicApiLimiter` custom `keyGenerator` using `req.ip` triggers `ERR_ERL_KEY_GEN_IPV6` — should use `ipKeyGenerator` helper. Shows as a `ValidationError` in test output but doesn't block tests.

2. **24 lint warnings**: All `react/only-export-components` in `routes.tsx` — benign Fast Refresh warnings for lazy-loaded components. Not blocking.

3. **`console.error` in key-vault.ts** (line 92): Logs decryption failures. Acceptable for debugging but consider structured logging.

4. **Sentry error handler order**: In `app.ts`, `errorHandler` is mounted (line 201) before `Sentry.setupExpressErrorHandler` (line 204). Sentry docs recommend Sentry's handler comes first. Current order means Sentry may miss some errors that `errorHandler` catches and formats.

5. **`SAAS-PROFITABILITY-PLAN.md` is stale**: Several items marked "future" (Phase 2C, 2D, 3C, 4C) have already been built. The plan should be updated to reflect current state.

6. **Uncommitted files**: 89 files with significant new features (referrals, API keys, public API, sync, feature gating, usage analytics, onboarding, docs) are sitting uncommitted. Risk of data loss.

7. **`productId: null`** in all `PLAN_CONFIGS` entries (`billing.ts` lines 55, 81, 106) — needs actual Dodo Payments product IDs.

---

## 17. Environment Variables (from `server/.env.example`)

### Required
| Variable | Purpose |
|----------|---------|
| `CLIENT_URL` | CORS origin |
| `FIREBASE_PROJECT_ID` | Firebase project |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account key |

### Required for Features
| Variable | Feature |
|----------|---------|
| `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` / `ZOOM_REDIRECT_URI` | Zoom OAuth |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Zoom webhooks |
| `ZOOM_SDK_KEY` / `ZOOM_SDK_SECRET` | Zoom RTMS |
| `ZOOM_VERIFY_TOKEN` | Zoom domain verification |
| `DODO_PAYMENTS_API_KEY` / `DODO_PAYMENTS_WEBHOOK_KEY` | Billing |
| `DODO_PRO_PRODUCT_ID` / `DODO_ENTERPRISE_PRODUCT_ID` | Plan checkout |
| `RESEND_API_KEY` / `EMAIL_FROM` | Fallback email |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail OAuth |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Outlook OAuth |
| `SESSION_SECRET` | OAuth state encryption |

### Optional
| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `REDIS_URL` | — | Buffer service (falls back to in-memory) |
| `SENTRY_DSN` | — | Error tracking (prod only) |
| `OAUTH_REDIRECT_BASE` | — | OAuth redirect base URL |

---

## 18. SAAS Plan Status Cross-Reference

| Phase | Item | Plan Says | Actual Status |
|-------|------|-----------|---------------|
| 1A | Deploy to Vercel/Render | TODO | ❌ Still TODO |
| 1B | Manual transcript mode | ✅ Done | ✅ Verified |
| 1C | Email OAuth UI | ✅ Done | ✅ Verified |
| 1D | Console.log cleanup | ✅ Done | ⚠️ Some reintroduced in uncommitted `App.tsx` |
| 2B | Smart upgrade prompts | Future | ✅ Actually built (`UpgradePrompt.tsx`, `FeatureGate.tsx`) |
| 2C | Server-side free tier | "next code task" | ✅ Actually built (`usage-service.ts`, `plan.ts`) |
| 2D | Usage analytics | Future | ✅ Actually built (`usage-analytics.ts`) |
| 3C | Referral program | Future | ✅ Actually built (client `referral.ts` + server `referrals.ts`) |
| 3D | Google Meet/Teams | Future | ❌ Not built (manual transcript covers gap) |
| 4A | Team features | Future | ❌ Not built (gated but unimplemented) |
| 4C | API access | Future | ✅ Actually built (`api-keys.ts`, `public-api.ts`) |
| — | Blog content | Phase 3B | ✅ 5 blog posts in `docs/blog/` |
| — | Zoom Marketplace docs | Phase 3A | ✅ Full package in `docs/zoom-marketplace/` |
| — | Data sync | Not mentioned | ✅ Built (`sync.ts`) |
| — | Onboarding flow | Not mentioned | ✅ Built (`OnboardingPage.tsx`) |

---

*This document is the single source of truth for the DealForge codebase. Update it when significant changes are made.*
