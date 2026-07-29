# Investigation Handoff Report: Fix Zoom Route Test State Pollution

## 1. Observation

### Code Base Inspection & File Locations
- **`.env` file (`/home/akshat/vigilant-goggles/server/.env`)**:
  Line 14 defines: `ZOOM_WEBHOOK_SECRET_TOKEN=your-zoom-webhook-secret`. Vitest loads environment variables from `.env` upon startup.
- **Config module (`/home/akshat/vigilant-goggles/server/src/config.ts`)**:
  Lines 5–17 define the exported static `config` object:
  ```ts
  export const config = {
    ...
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
  `config.zoom.webhookSecretToken` is initialized once when `config.ts` is imported and holds `'your-zoom-webhook-secret'`.
- **Zoom route handler (`/home/akshat/vigilant-goggles/server/src/routes/zoom.ts`)**:
  Lines 97–108:
  ```ts
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
- **Zoom test suite (`/home/akshat/vigilant-goggles/server/src/routes/zoom.test.ts`)**:
  Lines 40–58:
  ```ts
  it('should return 500 if webhook secret is not configured', async () => {
    delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    const app = express();
    ...
    const res = await fetch(`http://localhost:${port}/api/zoom/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'meeting.started', payload: {} }),
    });
    expect(res.status).toBe(500);
  });
  ```
  Lines 60–78 (subsequent test):
  ```ts
  it('should return 401 if signature headers are missing', async () => {
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'test-secret';
    ...
  ```

### Verbatim Test Execution Failure
Command executed in `/home/akshat/vigilant-goggles/server`:
`npx vitest run src/routes/zoom.test.ts`
Result:
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

---

## 2. Logic Chain

1. When vitest runs `src/routes/zoom.test.ts`, vitest imports environment variables from `server/.env`, setting `process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'your-zoom-webhook-secret'`.
2. When `server/src/config.ts` is imported, the static object `config` is instantiated. `config.zoom.webhookSecretToken` evaluates to `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` (`'your-zoom-webhook-secret'`) and is cached in Node's module system.
3. In `zoom.test.ts`, the test `should return 500 if webhook secret is not configured` executes `delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN`.
4. During route execution in `zoom.ts`:
   `const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || config.zoom.webhookSecretToken;`
   Since `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` is `undefined`, JavaScript falls back to `config.zoom.webhookSecretToken`.
5. Because `config.zoom.webhookSecretToken` is still `'your-zoom-webhook-secret'` (due to static module caching), `secret` resolves to `'your-zoom-webhook-secret'` (truthy).
6. Thus, `if (!secret)` does NOT trigger, preventing the expected 500 error (`AppError('Server configuration error', 500)`).
7. Execution proceeds to signature header validation (`if (!zoomSignature || !zoomTimestamp)`), which fails because no signature headers were sent in the test request, resulting in status `401` instead of `500`.

---

## 3. Caveats

- Tests run sequentially or in parallel depending on vitest configuration, but module-level singletons like `config` retain mutated or initial state across test cases within the same process unless explicitly reset or dynamically evaluated.
- No other tests in `zoom.test.ts` currently fail; only `should return 500 if webhook secret is not configured` fails.

---

## 4. Conclusion & Recommended Fix Options

The root cause is configuration state pollution: `config.zoom.webhookSecretToken` retains the value initialized at module import time, bypassing `delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN`.

### Recommended Fix Options

#### Option 1: Dynamic Property Getter in `server/src/config.ts` (Recommended Refactoring Fix)
Change `webhookSecretToken` in `server/src/config.ts` from a static value to a getter:
```ts
zoom: {
  clientId: process.env.ZOOM_CLIENT_ID,
  clientSecret: process.env.ZOOM_CLIENT_SECRET,
  redirectUri: process.env.ZOOM_REDIRECT_URI || `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/zoom/oauth/callback`,
  get webhookSecretToken() {
    return process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  },
  sdkKey: process.env.ZOOM_SDK_KEY,
  sdkSecret: process.env.ZOOM_SDK_SECRET,
},
```
- **Why this works**: Accessing `config.zoom.webhookSecretToken` will dynamically read `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` at runtime, so deleting `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` in tests will immediately reflect as `undefined` on `config.zoom.webhookSecretToken`.

#### Option 2: Test Setup & Teardown State Reset in `server/src/routes/zoom.test.ts` (Test-Level Fix)
In `zoom.test.ts`, explicitly clear `config.zoom.webhookSecretToken` when setting up the test or in a `beforeEach`/`afterEach` hook:
```ts
it('should return 500 if webhook secret is not configured', async () => {
  const origEnvSecret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  const origConfigSecret = config.zoom.webhookSecretToken;
  delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  (config.zoom as any).webhookSecretToken = undefined;

  try {
    // ... test request ...
    expect(res.status).toBe(500);
  } finally {
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = origEnvSecret;
    (config.zoom as any).webhookSecretToken = origConfigSecret;
  }
});
```
Alternatively, manage state restoration in `beforeEach` / `afterEach` hooks across all tests in `zoom.test.ts`.

Option 1 is cleaner as it makes `config.zoom.webhookSecretToken` dynamically track `process.env` throughout the application, while Option 2 keeps the change isolated to the test file. A combination of both ensures maximum robustness.

---

## 5. Verification Method

### Execution Command
Run the test runner from `/home/akshat/vigilant-goggles/server`:
```bash
npx vitest run src/routes/zoom.test.ts
```

### Verification Criteria
1. Output indicates all 5 tests pass: `5 passed (5)`.
2. `should return 500 if webhook secret is not configured` returns status code `500`.
3. Subsequent tests (`should return 401 if signature headers are missing`, etc.) continue to pass without side effects.
