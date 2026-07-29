# Project: Vigilant Goggles Client TypeScript Error Resolution

## Architecture
- Client application in `/client` (React + Vite + TypeScript + Dexie + Zustand + Vitest).
- Server application in `/server` (Node.js/Express + TypeScript, clean build and tests).
- Focus: Client TypeScript compilation errors (`client/src`) and test suites (`client/src/**/*.test.ts`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | ErrorBoundary Prop & Env Typings | Add proper prop/state types and type `import.meta.env` in `ErrorBoundary.tsx` | M1 | survey |
| 2 | useWebSocket Socket Typings | Fix Socket type, event handler typing, empty catch block error handling in `useWebSocket.ts` | M1 | survey |
| 3 | main.tsx Env & Container Typings | Type `import.meta.env` and handle nullable `HTMLElement` in `main.tsx` | M1 | survey |
| 4 | MeetingDetailPage Data & Analysis Typings | Fix string mismatches, nullable params, Dexie queries, and missing Analysis fields in `MeetingDetailPage.tsx` | M1 | survey |
| 5 | AnalyticsPage DateItem & Undefined Typings | Fix DateItem[] type incompatibility in `analytics.ts` and handle undefined values/chart formatting in `AnalyticsPage.tsx` | M1 | survey |
| 6 | ProtectedRoute Children Typings | Fix proper ReactNode type for `children` in `ProtectedRoute.tsx` | M1 | survey |
| 7 | EmailIntegrationSettings SetStateAction Typings | Add proper SetStateAction / EmailProviderConfig type in `EmailIntegrationSettings.tsx` | M1 | survey |
| 8 | Dashboard, Leads, & Pipeline Page Typings | Fix value types, undefined formatters, and scoreLead/expectedClose typings in `DashboardPage.tsx`, `LeadsPage.tsx`, `PipelinePage.tsx` | M1 | survey |
| 9 | Key Vault Crypto BufferSource Assignment | Fix Uint8Array to BufferSource assignment in `key-vault.ts` using `as BufferSource` | M2 | survey |
| 10 | Drip Worker Transcript, Lead & Draft Typings | Fix `Transcript` property access (`fullText`), `Lead` type cast, `.draft`/`.body` access, and `EmailCampaign.sequence` in `drip-worker.ts` | M2 | survey |
| 11 | Analytics Service Env Typings | Type `import.meta.env` in `analytics.ts` | M2 | survey |
| 12 | Client API Unit Test Typings | Fix mock type mismatches, callback parameter types, and `mockResolvedValueOnce` in `client.test.ts` | M3 | survey |
| 13 | Drip Worker Test Typings | Fix `sendEmail` argument counts in `drip-worker.test.ts` | M3 | survey |
| 14 | Store Unit Test & Project Config | Fix `StoreState` loading property in `store.test.ts`, configure `vite/client` and `typecheck` script in `tsconfig.json` & `package.json` | M3 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Component and Hook Typings (R1) | `ErrorBoundary.tsx`, `useWebSocket.ts`, `main.tsx`, `MeetingDetailPage.tsx`, `AnalyticsPage.tsx`, `ProtectedRoute.tsx`, `EmailIntegrationSettings.tsx`, `DashboardPage.tsx`, `LeadsPage.tsx`, `PipelinePage.tsx` | none | DONE |
| 2 | Service and Worker Typings (R2) | `key-vault.ts`, `drip-worker.ts`, `analytics.ts` | none | DONE |
| 3 | Test Typings & Project Build Validation (R3) | `client.test.ts`, `drip-worker.test.ts`, `store.test.ts`, `tsconfig.json`, `package.json` | M1, M2 | IN_PROGRESS |

## Interface Contracts
### Client Components ↔ Types (`client/src/types/index.ts`)
- `Transcript`: `fullText: string` (replacing direct `.content` or `.text` references).
- `EmailCampaign`: requires `sequence: EmailSequenceStep[]` (provide `sequence: []` if empty).
- `Analysis`: 9 required fields (`summary`, `keyTakeaways`, `actionItems`, `sentiment`, `topics`, `followUpRequired`, `riskLevel`, `nextSteps`, `coachingNotes`).

## Code Layout
- `client/src/components/common/ErrorBoundary.tsx`
- `client/src/components/layout/ProtectedRoute.tsx`
- `client/src/components/settings/EmailIntegrationSettings.tsx`
- `client/src/crypto/key-vault.ts`
- `client/src/hooks/useWebSocket.ts`
- `client/src/main.tsx`
- `client/src/pages/dashboard/AnalyticsPage.tsx`
- `client/src/pages/dashboard/DashboardPage.tsx`
- `client/src/pages/dashboard/LeadsPage.tsx`
- `client/src/pages/dashboard/MeetingDetailPage.tsx`
- `client/src/pages/dashboard/PipelinePage.tsx`
- `client/src/services/analytics.ts`
- `client/src/services/api/client.test.ts`
- `client/src/services/drip-worker.ts`
- `client/src/services/drip-worker.test.ts`
- `client/src/store/store.test.ts`
- `client/src/utils/analytics.ts`
- `client/src/vite-env.d.ts` (or `client/tsconfig.json`)
