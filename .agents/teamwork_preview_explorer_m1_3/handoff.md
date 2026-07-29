# Technical Investigation Report: Fixing Zoom Route Test State Pollution

## 1. Observation

### Test Failure Output
Executing `npm test --workspace=server src/routes/zoom.test.ts` produces the following error:
```
 FAIL  src/routes/zoom.test.ts > Zoom Routes > should return 500 if webhook secret is not configured
AssertionError: expected 401 to be 500 // Object.is equality

- Expected
+ Received

- 500
+ 401

 ❯ src/routes/zoom.test.ts:57:24
     55|       body: JSON.stringify({ event: 'meeting.started', payload: {} }),
     56|     });
     57|     expect(res.status).toBe(500);
```

### Exact File Locations and Code Snippets

#### 1. `server/src/config.ts` (lines 5-17)
```ts
export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  
  zoom: {
    clientId: process.env.ZOOM_CLIENT_ID,
    clientSecret: process.env.ZOOM_CLIENT_SECRET,
    redirectUri: process.env.ZOOM_REDIRECT_URI || `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/zoom/oauth/callback`,
    webhookSecretToken: process.env.ZOOM_WEBHOOK_SECRET_TOKEN,
    sdkKey: process.env.ZOOM_SDK_KEY,
    sdkSecret: process.env.ZOOM_SDK_SECRET,
  },
  ...
};
```
When `config.ts` is imported, `dotenv.config()` populates `process.env`, and `config.zoom.webhookSecretToken` is assigned `process.env.ZOOM_WEBHOOK_SECRET_TOKEN`.

#### 2. `server/src/routes/zoom.ts` (lines 97-108)
```ts
router.post('/webhook', async (req: Request, res: Response, next: express.NextFunction): Promise<unknown> => {
  const { event, payload } = req.body;
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || config.zoom.webhookSecretToken;

  if (!secret) {
     return next(new AppError('Server configuration error', 500));
  }

  const zoomSignature = req.headers['x-zm-signature'] as string;
  const zoomTimestamp = req.headers['x-zm-request-timestamp'] as string;

  if (!zoomSignature || !zoomTimestamp) {
    return next(new AppError('Unauthorized: Missing signature', 401));
  }
```

#### 3. `server/src/routes/zoom.test.ts` (lines 9-15, 40-78)
```ts
  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    vi.clearAllMocks();
  });

  it('should return 500 if webhook secret is not configured', async () => {
    delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    ...
```

### Analysis of Other Test Files
- `server/src/routes/auth.test.ts` (lines 41-49): Mutates `process.env.NODE_ENV` in tests, but captures `originalEnv = process.env.NODE_ENV` and restores it in `afterEach`.
- `server/src/routes/zoom.test.ts`: Mutates `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` in tests 2 (`delete process.env...`) and 3 (`process.env... = 'test-secret'`) without clearing `config.zoom.webhookSecretToken` or restoring env/config state in `afterEach`.

---

## 2. Logic Chain

1. **Module Import & Initial Evaluation**:
   When `zoom.test.ts` runs, test 1 (`should return 400 if no code is provided`) imports `./zoom.js` (line 20), which imports `../config.js`.
2. **Config Initialization**:
   `config.ts` calls `dotenv.config()` (line 3) and exports the `config` object. `config.zoom.webhookSecretToken` gets initialized to whatever string was in `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` (or from `.env`).
3. **Environment Mutation in Test 2**:
   Test 2 (`should return 500 if webhook secret is not configured`) executes `delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;` (line 41).
4. **Failure to Clear Config State**:
   `delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;` removes the property from `process.env`, but leaves `config.zoom.webhookSecretToken` untouched on the imported `config` object.
5. **Route Execution & Secret Fallback**:
   When the POST request to `/api/zoom/webhook` arrives, `zoom.ts` (line 97) evaluates:
   `const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || config.zoom.webhookSecretToken;`
   Since `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` is `undefined`, JavaScript falls back to `config.zoom.webhookSecretToken`, which holds the non-empty string loaded during step 2.
6. **Bypassing the 500 Error**:
   Because `secret` evaluates to a truthy string, `if (!secret)` (line 99) evaluates to `false`. The route handler does not return the expected 500 error.
7. **Execution of Next Middleware & 401 Result**:
   The handler proceeds to line 106 (`if (!zoomSignature || !zoomTimestamp)`). Since the test request does not provide signature headers, `zoom.ts` returns `AppError('Unauthorized: Missing signature', 401)`.
8. **Assertion Failure & Lack of Teardown**:
   `expect(res.status).toBe(500)` fails receiving 401. Moreover, `process.env` and `config` state remain corrupted for any subsequent tests because `afterEach` lacks restoration logic.

---

## 3. Caveats

- **Process-wide Singleton State**: Node module caching means `config.ts` is only evaluated once per test process. Any mutation to `config.zoom` properties persists across tests in the same suite unless explicitly reset in `afterEach`.
- **Environment Dependency**: If `.env` is present in the workspace, `config.zoom.webhookSecretToken` is always populated on initial load. If `.env` is absent, the issue only surfaces when another test sets `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` or `config.zoom.webhookSecretToken` prior to running the unconfigured test.

---

## 4. Conclusion & Proposed Fix

### Root Cause
Configuration state pollution in `zoom.test.ts`. `delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN` in the test fails to clear `config.zoom.webhookSecretToken`, causing `zoom.ts` to fall back to `config.zoom.webhookSecretToken` and proceed to signature checks, returning 401 instead of 500.

### Proposed Code Changes (For Implementer / Requirement R1)

#### Modification to `server/src/routes/zoom.test.ts`:
1. Import `config` from `../config.js`.
2. Capture original environment and config secret values before tests run.
3. In `afterEach`, restore `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` and `config.zoom.webhookSecretToken`.
4. In test "should return 500 if webhook secret is not configured", clear both `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` and `config.zoom.webhookSecretToken = undefined`.
5. In test "should return 401 if signature headers are missing", set both `process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'test-secret'` and `config.zoom.webhookSecretToken = 'test-secret'`.

#### Proposed Snippet for `server/src/routes/zoom.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import { errorHandler } from '../middleware/errorHandler.js';
import { config } from '../config.js';

describe('Zoom Routes', () => {
  let server: http.Server | null;
  const originalEnvSecret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  const originalConfigSecret = config.zoom.webhookSecretToken;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    vi.clearAllMocks();
    if (originalEnvSecret !== undefined) {
      process.env.ZOOM_WEBHOOK_SECRET_TOKEN = originalEnvSecret;
    } else {
      delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    }
    config.zoom.webhookSecretToken = originalConfigSecret;
  });

  // ... test 1 unchanged ...

  it('should return 500 if webhook secret is not configured', async () => {
    delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    config.zoom.webhookSecretToken = undefined;
    const app = express();
    app.use(express.json());
    const { default: zoomRoutes } = await import('./zoom.js');
    app.use('/api/zoom', zoomRoutes);
    app.use(errorHandler);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await fetch(`http://localhost:${port}/api/zoom/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'meeting.started', payload: {} }),
    });
    expect(res.status).toBe(500);
  });

  it('should return 401 if signature headers are missing', async () => {
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'test-secret';
    config.zoom.webhookSecretToken = 'test-secret';
    // ... rest of test 3 unchanged ...
  });
```

---

## 5. Verification Method

1. Run the targeted test command from the repository root:
   ```bash
   npm test --workspace=server src/routes/zoom.test.ts
   ```
   **Expected Result**: All 5 tests in `zoom.test.ts` pass cleanly (0 failures).

2. Run the entire server test suite:
   ```bash
   npm test --workspace=server
   ```
   **Expected Result**: All test suites pass without regression or state pollution across test files.
