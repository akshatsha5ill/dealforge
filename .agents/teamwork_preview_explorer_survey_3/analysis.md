# R3 Test Typings & Project Build/Typecheck Analysis Report

**Date**: 2026-07-29  
**Agent**: `teamwork_preview_explorer_survey_3`  
**Workspace**: `/home/akshat/vigilant-goggles`  

---

## 1. Executive Summary

A full repository investigation was conducted to analyze R3 test typings, project setup, and baseline compilation errors across `/home/akshat/vigilant-goggles`.

- **Server Workspace (`/server`)**: 
  - `npx tsc --noEmit` completes with **0 errors**.
  - `npm test` executes **54/54 tests passing** across 15 test files.
- **Client Workspace (`/client`)**:
  - `npm test` (`vitest run`) succeeds with **32/32 tests passing** at runtime (because Vitest relies on Vite/esbuild bundling without enforcing strict TypeScript checking).
  - `npx tsc --noEmit` yields **84 TypeScript compilation errors across 21 files**.

The primary causes of client compilation failures are:
1. **Missing Vite Type Declarations**: Missing `vite/client` reference or `"types"` entry in `client/tsconfig.json`, causing `import.meta.env` property errors in 4 files.
2. **R3 Test Typings (`client.test.ts`, `drip-worker.test.ts`, `store.test.ts`)**: Untyped mock functions, `global.fetch` type mismatches, missing required arguments (`sendEmail`), and invalid property references in store mocks.
3. **Component, Hook, & Service Type Discrepancies (R1 & R2)**: Dexie query parameter undefined handling, missing properties on models (`Transcript`, `Lead`, `Analysis`, `EmailCampaign`), and implicit `any` parameter bindings.

---

## 2. Project Layout & Build / Typecheck Setup

### 2.1 Workspace Structure
```
vigilant-goggles/
├── package.json (root npm workspace: client, server)
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── css-modules.d.ts (only .d.ts in client/src)
│       ├── test/setup.ts (imports '@testing-library/jest-dom')
│       ├── services/api/client.test.ts
│       ├── services/drip-worker.test.ts
│       └── store/store.test.ts
└── server/
    ├── package.json
    ├── tsconfig.json
    └── vitest.config.ts
```

### 2.2 Root & Client Scripts Analysis
- **Root `package.json`**:
  ```json
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "build": "npm run build --workspace=client",
    "test": "npm run test --workspace=client && npm run test --workspace=server"
  }
  ```
  *Note*: There is currently no `typecheck` script in root or client `package.json`. `npm run build` runs `vite build`, which compiles assets but does not enforce typechecks unless `tsc` is explicitly run prior to build.

- **`client/tsconfig.json` Configuration**:
  ```json
  {
    "compilerOptions": {
      "target": "ES2020",
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "noEmit": true,
      "jsx": "react-jsx",
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true
    },
    "include": ["src"]
  }
  ```
  *Key Gap*: `client/tsconfig.json` does not include `"types": ["vite/client", "vitest/globals"]` and `client/src` lacks an `env.d.ts` file.

---

## 3. Baseline Project Errors Overview

Full execution of `npx tsc --noEmit` in `/client` returned **84 errors in 21 files**:

| File Path | Error Count | Main Error Identifiers |
|---|---|---|
| `src/components/common/ErrorBoundary.tsx` | 7 | TS7006 (implicit `any`), TS2339 (`error`/`children` missing on `{}`), TS2339 (`import.meta.env`) |
| `src/components/layout/ProtectedRoute.tsx` | 1 | TS7031 (implicit `any` `children`) |
| `src/components/settings/EmailIntegrationSettings.tsx` | 1 | TS2345 (`{}` not assignable to `SetStateAction<EmailProviderConfig>`) |
| `src/crypto/key-vault.ts` | 2 | TS2769, TS2322 (`Uint8Array` to `BufferSource` assignment) |
| `src/hooks/useWebSocket.ts` | 8 | TS2322 (`Socket` to `null`), TS7006 (implicit `any`), TS2339 (`emit`/`on`/`off` on `never`) |
| `src/main.tsx` | 4 | TS2339 (`import.meta.env`), TS2345 (`HTMLElement \| null` to `Container`) |
| `src/pages/dashboard/AnalyticsPage.tsx` | 5 | TS2345 (`EmailCampaign[]` to `DateItem[]`), TS18048 (`v`/`percent` possibly undefined), TS2362 (arithmetic type mismatch) |
| `src/pages/dashboard/DashboardPage.tsx` | 1 | TS18048 (`v` possibly undefined) |
| `src/pages/dashboard/LeadsPage.tsx` | 2 | TS7006 (implicit `any` `score`), TS2339 (`data` missing on score result) |
| `src/pages/dashboard/MeetingDetailPage.tsx` | 12 | TS2769/TS2345 (undefined Dexie keys), TS2345 (undefined state setters), TS2339/TS2345 (`Analysis` properties missing) |
| `src/pages/dashboard/MeetingsPage.tsx` | 1 | TS7006 (implicit `any` `dateStr`) |
| `src/pages/dashboard/PipelinePage.tsx` | 1 | TS2322 (`null` assigned to `expectedClose: string`) |
| `src/services/analytics.ts` | 1 | TS2339 (`import.meta.env`) |
| **`src/services/api/client.test.ts`** | **6** | **TS7006 (implicit `any`), TS2339 (`mockResolvedValueOnce` missing on `global.fetch`)** |
| **`src/services/drip-worker.test.ts`** | **1** | **TS2554 (`sendEmail` expected 4-5 arguments, got 3)** |
| `src/services/drip-worker.ts` | 8 | TS2339 (`content`/`text` missing on `Transcript`), TS2345 (`Lead` index signature), TS2339 (`draft` missing), TS2345 (missing `sequence` on `EmailCampaign`) |
| `src/services/firebase/auth.ts` | 5 | TS7006 (implicit `any`), TS2345 (partial user to `User`) |
| `src/services/firebase/config.ts` | 6 | TS2339 (`import.meta.env`) |
| `src/services/lead-automation.ts` | 7 | TS2339 (`analysis` property missing), TS2322 (`actionItems` type mismatch), TS2739 (`sentiment` missing properties) |
| `src/services/local-db/backup.ts` | 4 | TS2322, TS18048 (`usage`/`quota` possibly undefined) |
| **`src/store/store.test.ts`** | **1** | **TS2353 (`loading` does not exist on `StoreState`)** |

---

## 4. Deep-Dive & Root Cause Analysis for Test Typings (R3)

### 4.1 `client/src/services/api/client.test.ts` (6 Errors)
- **Observations & Errors**:
  - `Line 25`: `const mockFetchSuccess = (data) =>` → `error TS7006: Parameter 'data' implicitly has an 'any' type.`
  - `Line 26`: `global.fetch.mockResolvedValueOnce(...)` → `error TS2339: Property 'mockResolvedValueOnce' does not exist on type 'typeof fetch'.`
  - `Line 32`: `const mockFetchError = (statusText, errorData) =>` → `error TS7006: Parameter 'statusText' implicitly has an 'any' type.`, `error TS7006: Parameter 'errorData' implicitly has an 'any' type.`
  - `Line 33`: `global.fetch.mockResolvedValueOnce(...)` → `error TS2339: Property 'mockResolvedValueOnce' does not exist on type 'typeof fetch'.`
  - `Line 168`: `global.fetch.mockResolvedValueOnce(...)` → `error TS2339: Property 'mockResolvedValueOnce' does not exist on type 'typeof fetch'.`
- **Root Cause**:
  1. `client/tsconfig.json` has `noImplicitAny: true`. Local helper callbacks `mockFetchSuccess` and `mockFetchError` lack parameter type annotations.
  2. In `beforeEach`, `global.fetch = vi.fn();` assigns a mock function to `global.fetch`. However, TypeScript retains the native DOM `fetch` signature for `global.fetch`, which has no `.mockResolvedValueOnce()` method attached to its standard type definition.
- **Recommended Strategy**:
  - Add explicit parameter types to helpers:
    ```ts
    const mockFetchSuccess = (data: any) => { ... };
    const mockFetchError = (statusText: string, errorData: any) => { ... };
    ```
  - Cast `global.fetch` as `any` or `ReturnType<typeof vi.fn>` when accessing Vitest mock methods:
    ```ts
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    });
    ```
  - Alternatively, use `vi.mocked(global.fetch).mockResolvedValueOnce(...)`.

### 4.2 `client/src/services/drip-worker.test.ts` (1 Error)
- **Observations & Error**:
  - `Line 77`: `await sendEmail(lead!.email, subject, body);` → `error TS2554: Expected 4-5 arguments, but got 3.`
- **Root Cause**:
  - `sendEmail` in `client/src/services/ai/ai-service.ts` is declared as:
    ```ts
    export const sendEmail = async (to: string, subject: string, body: string, emailApiKey: string, campaignId?: string)
    ```
  - Parameter #4 (`emailApiKey`) is mandatory. The test call passed only 3 arguments.
- **Recommended Strategy**:
  - Update `drip-worker.test.ts` line 77 to provide the 4th argument:
    ```ts
    await sendEmail(lead!.email, subject, body, 'mock-email-key');
    ```

### 4.3 `client/src/store/store.test.ts` (1 Error)
- **Observations & Error**:
  - `Line 14`: `useStore.setState({ ..., loading: false });` → `error TS2353: Object literal may only specify known properties, and 'loading' does not exist in type 'StoreState'.`
- **Root Cause**:
  - `StoreState` composition includes `UiSlice`, which defines `isLoading: boolean` (not `loading`).
- **Recommended Strategy**:
  - Replace `loading: false` with `isLoading: false` (or remove `loading: false`) in `store.test.ts`.

---

## 5. Recommended Overall Fix Plan for R3 & Build Setup

1. **Vite Environment Type Declarations**:
   - Create `client/src/env.d.ts`:
     ```ts
     /// <reference types="vite/client" />

     interface ImportMetaEnv {
       readonly VITE_FIREBASE_API_KEY?: string;
       readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
       readonly VITE_FIREBASE_PROJECT_ID?: string;
       readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
       readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
       readonly VITE_FIREBASE_APP_ID?: string;
       readonly VITE_SENTRY_DSN?: string;
       readonly VITE_GA_ID?: string;
     }

     interface ImportMeta {
       readonly env: ImportMetaEnv;
     }
     ```
   - Update `client/tsconfig.json` `compilerOptions`:
     ```json
     "types": ["vite/client", "vitest/globals"]
     ```

2. **Package Scripts Enhancement**:
   - Add `"typecheck": "tsc --noEmit"` to `client/package.json`.
   - Add `"typecheck": "npm run typecheck --workspace=client && npm run typecheck --workspace=server"` to root `package.json`.

3. **Apply R3 Test Fixes**:
   - In `client.test.ts`: annotate `(data: any)` and `(statusText: string, errorData: any)`, cast `(global.fetch as any).mockResolvedValueOnce(...)`.
   - In `drip-worker.test.ts`: pass `emailApiKey` argument `'mock-email-key'`.
   - In `store.test.ts`: update property name from `loading` to `isLoading`.

---

## 6. Verification Method

- **Typecheck Command**:
  ```bash
  cd /home/akshat/vigilant-goggles/client && npx tsc --noEmit
  ```
  - *Pass criteria*: 0 TypeScript compilation errors in test files and across `client/src`.

- **Test Execution Command**:
  ```bash
  cd /home/akshat/vigilant-goggles/client && npm test
  ```
  - *Pass criteria*: All Vitest test suites (including `client.test.ts`, `drip-worker.test.ts`, `store.test.ts`) pass without runtime or typing errors.
