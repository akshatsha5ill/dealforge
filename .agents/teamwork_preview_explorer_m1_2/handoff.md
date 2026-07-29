# Handoff Report: Investigation of Failing Zoom Webhook Secret Test

## 1. Observation

### Test Failure
Running `npx vitest run src/routes/zoom.test.ts` inside `/home/akshat/vigilant-goggles/server` results in 1 test failure out of 5:

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

### Relevant Code Locations & Exact Snippets

1. **`server/src/config.ts` (lines 1-17)**
   ```ts
   import dotenv from 'dotenv';
   
   dotenv.config();
   
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

2. **`server/.env` (line 14)**
   ```env
   ZOOM_WEBHOOK_SECRET_TOKEN=your-zoom-webhook-secret
   ```

3. **`server/src/routes/zoom.ts` (lines 97 & 208)**
   ```ts
   // Line 97 in POST /webhook handler:
   const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || config.zoom.webhookSecretToken;
   if (!secret) {
      return next(new AppError('Server configuration error', 500));
   }
   ```

4. **`server/src/routes/zoom.test.ts` (lines 40-58)**
   ```ts
   it('should return 500 if webhook secret is not configured', async () => {
     delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
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
   ```

---

## 2. Logic Chain

1. When Vitest runs, `dotenv.config()` in `config.ts` loads environment variables from `server/.env`, setting `process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'your-zoom-webhook-secret'`.
2. When the first test in `zoom.test.ts` executes, it imports `./zoom.js`, which in turn imports `../config.js`.
3. `config.js` evaluates at load time and constructs the static `config` object. `config.zoom.webhookSecretToken` is assigned `'your-zoom-webhook-secret'`.
4. In the second test (`should return 500 if webhook secret is not configured`), `delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;` deletes `ZOOM_WEBHOOK_SECRET_TOKEN` from `process.env`.
5. However, `config.zoom.webhookSecretToken` retains the value `'your-zoom-webhook-secret'` in memory because `config` is a static singleton object initialized once when `config.js` was imported.
6. When the POST `/api/zoom/webhook` endpoint executes line 97:
   `const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || config.zoom.webhookSecretToken;`
   - `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` is `undefined`.
   - `config.zoom.webhookSecretToken` is `'your-zoom-webhook-secret'`.
   - `secret` evaluates to `'your-zoom-webhook-secret'`.
7. Because `secret` is truthy, `if (!secret)` evaluates to `false`, bypassing the `500 Server configuration error` guard.
8. The route handler proceeds to validate signature headers (`x-zm-signature` and `x-zm-request-timestamp`). Since these headers are missing from the test request, line 107 executes:
   `return next(new AppError('Unauthorized: Missing signature', 401));`
9. The response status is `401`, causing the test expectation `expect(res.status).toBe(500)` to fail.

---

## 3. Proposed Solutions

### Solution Option A: Synchronize / Clear `config.zoom.webhookSecretToken` in Test Setup (Test-level fix)
In `zoom.test.ts`:
- Import `config`: `import { config } from '../config.js';`
- In `afterEach` or `beforeEach`, reset environment and config state.
- In the test "should return 500 if webhook secret is not configured":
  ```ts
  delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  config.zoom.webhookSecretToken = undefined;
  ```
- In test 3 ("should return 401 if signature headers are missing"):
  ```ts
  process.env.ZOOM_WEBHOOK_SECRET_TOKEN = 'test-secret';
  config.zoom.webhookSecretToken = 'test-secret';
  ```

### Solution Option B: Refactor `config.zoom.webhookSecretToken` to a Dynamic Getter in `config.ts` (Architectural fix)
In `server/src/config.ts`:
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
With a getter, whenever `config.zoom.webhookSecretToken` is accessed, it dynamically returns the current value of `process.env.ZOOM_WEBHOOK_SECRET_TOKEN`. Deleting `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` will immediately cause `config.zoom.webhookSecretToken` to return `undefined`.

### Recommended Combined Fix:
1. Update `config.ts` to use a getter for `webhookSecretToken` (or all `zoom` env properties).
2. Update `zoom.test.ts` to cleanly save and restore `process.env.ZOOM_WEBHOOK_SECRET_TOKEN` in `beforeEach`/`afterEach` so tests do not pollute subsequent tests.

---

## 4. Caveats
- No other test files in `server/src/` currently manipulate `ZOOM_WEBHOOK_SECRET_TOKEN`.
- The rest of `server/src/routes/zoom.ts` references `config.zoom.webhookSecretToken` (e.g. line 208 in `/deauth`). Converting `webhookSecretToken` to a getter in `config.ts` is fully backwards compatible and benefits `/deauth` as well.

---

## 5. Conclusion
The root cause of the test failure is configuration state pollution where `config.zoom.webhookSecretToken` is cached at module load time from `.env` and does not update when `delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN` is called in `zoom.test.ts`. Implementing a dynamic getter in `config.ts` and/or clearing `config.zoom.webhookSecretToken` in `zoom.test.ts` will resolve the failure cleanly.

---

## 6. Verification Method
1. Run target test:
   `cd /home/akshat/vigilant-goggles/server && npx vitest run src/routes/zoom.test.ts`
   Expected result: All 5 tests pass.
2. Run entire server test suite:
   `cd /home/akshat/vigilant-goggles/server && npx vitest run`
   Expected result: All 54 tests across 15 files pass with 0 failures.
