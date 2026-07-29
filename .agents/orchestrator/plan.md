# Project Plan — Fix TypeScript Compilation & Test Errors

## Overview
The goal is to resolve ~30 TypeScript compilation errors across React components, hooks, services, workers, and test files in `/home/akshat/vigilant-goggles`.

## Phases & Strategy

### Phase 0: Survey & Inventory
1. Spawn 3 `teamwork_preview_explorer` subagents in parallel:
   - `explorer_1`: Focus on R1 (Component and Hook Typings: ErrorBoundary.tsx, useWebSocket.ts, main.tsx, MeetingDetailPage.tsx, AnalyticsPage.tsx, ProtectedRoute.tsx, EmailIntegrationSettings.tsx, DashboardPage.tsx, LeadsPage.tsx, PipelinePage.tsx).
   - `explorer_2`: Focus on R2 (Service and Worker Typings: key-vault.ts, drip-worker.ts, analytics.ts).
   - `explorer_3`: Focus on R3 & Project Build Setup (Test Typings: client.test.ts, drip-worker.test.ts, npm/tsc configuration, baseline error counts).
2. Synthesize findings into `PROJECT.md` (Feature Inventory, Milestones, Code Layout, Interface Contracts).

### Phase 1: Milestone 1 — Component and Hook Typings (R1)
1. Dispatch Worker to implement fixes for ErrorBoundary, useWebSocket, main, MeetingDetailPage, AnalyticsPage, ProtectedRoute, EmailIntegrationSettings, DashboardPage, LeadsPage, PipelinePage.
2. Dispatch 2 Reviewers, 2 Challengers, 1 Auditor.
3. Evaluate Gate.

### Phase 2: Milestone 2 — Service and Worker Typings (R2)
1. Dispatch Worker to fix Uint8Array/BufferSource in key-vault.ts, Transcript/Lead/draft in drip-worker.ts, import.meta.env in analytics.ts.
2. Dispatch Reviewers, Challengers, Auditor.
3. Evaluate Gate.

### Phase 3: Milestone 3 — Test Typings & Verification (R3)
1. Dispatch Worker to fix mock typings and argument counts in client.test.ts and drip-worker.test.ts.
2. Verify all compilation errors are 0 and tests pass.
3. Gate check.

### Phase 4: Final Validation & Completion Reporting
1. Final verification audit & review.
2. Report results to parent/Sentinel.
