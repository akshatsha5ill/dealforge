import { config } from '../../../server/src/config.js';
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { errorHandler } from '../../../server/src/middleware/errorHandler.js';

async function runEmpiricalStressTest() {
  console.log('=== EMPIRICAL STRESS TEST START ===\n');

  // 1. Property Descriptor Check
  const descriptor = Object.getOwnPropertyDescriptor(config.zoom, 'webhookSecretToken');
  console.log('1. Property Descriptor Check:');
  console.log('   - Is Getter:', typeof descriptor?.get === 'function');
  console.log('   - Is Value undefined:', descriptor?.value === undefined);
  if (typeof descriptor?.get !== 'function') {
    throw new Error('FAIL: webhookSecretToken is not a getter!');
  }
  console.log('   ✓ Property descriptor verified as getter.\n');

  // 2. Sequential State Mutation & Dynamic Reflection Check
  console.log('2. Sequential State Mutation & Dynamic Reflection:');
  const originalEnv = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

  const testSequence = [
    { label: 'Set secret to "secret_alpha"', val: 'secret_alpha', expected: 'secret_alpha' },
    { label: 'Set secret to "secret_beta"', val: 'secret_beta', expected: 'secret_beta' },
    { label: 'Delete secret (undefined)', val: undefined, expected: undefined },
    { label: 'Set secret to empty string ""', val: '', expected: '' },
    { label: 'Set secret to whitespace "   "', val: '   ', expected: '   ' },
  ];

  for (const step of testSequence) {
    if (step.val === undefined) {
      delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    } else {
      process.env.ZOOM_WEBHOOK_SECRET_TOKEN = step.val;
    }
    const actual = config.zoom.webhookSecretToken;
    const match = actual === step.expected;
    console.log(`   - ${step.label} => config.zoom.webhookSecretToken = ${JSON.stringify(actual)} | Pass: ${match}`);
    if (!match) throw new Error(`FAIL on step: ${step.label}`);
  }

  // Rapid loop mutation check (100 iterations)
  let loopPass = true;
  for (let i = 0; i < 100; i++) {
    const val = `token_${i}_${Math.random()}`;
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = val;
    if (config.zoom.webhookSecretToken !== val) {
      loopPass = false;
      break;
    }
  }
  console.log('   - 100 Rapid Loop Mutations => Pass:', loopPass, '\n');

  // Restore env
  if (originalEnv !== undefined) process.env.ZOOM_WEBHOOK_SECRET_TOKEN = originalEnv;
  else delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

  // 3. HTTP Route Integration Edge Case Tests
  console.log('3. HTTP Route Integration Edge Case Tests:');
  const app = express();
  app.use(express.json());
  const { default: zoomRoutes } = await import('../../../server/src/routes/zoom.js');
  app.use('/api/zoom', zoomRoutes);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}/api/zoom`;

  try {
    // Edge Case A: Secret is undefined (deleted)
    delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
    let res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'meeting.started', payload: {} }),
    });
    console.log('   - Secret undefined => Status:', res.status, '(Expected 500)');
    if (res.status !== 500) throw new Error(`FAIL: expected 500, got ${res.status}`);

    // Edge Case B: Secret is empty string ""
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = '';
    res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'meeting.started', payload: {} }),
    });
    console.log('   - Secret empty string "" => Status:', res.status, '(Expected 500)');
    if (res.status !== 500) throw new Error(`FAIL: expected 500, got ${res.status}`);

    // Edge Case C: Secret is whitespace "   "
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = '   ';
    res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'meeting.started', payload: {} }),
    });
    console.log('   - Secret whitespace "   " without headers => Status:', res.status, '(Expected 401)');
    if (res.status !== 401) throw new Error(`FAIL: expected 401, got ${res.status}`);

    // Edge Case D: Secret set to "secret_live_1" and signature header calculated dynamically
    const secret1 = 'secret_live_1';
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = secret1;
    const bodyObj1 = { event: 'meeting.started', payload: { object: { id: '99999' } } };
    const bodyStr1 = JSON.stringify(bodyObj1);
    const ts1 = String(Math.floor(Date.now() / 1000));
    const msg1 = `v0:${ts1}:${bodyStr1}`;
    const sig1 = `v0=${crypto.createHmac('sha256', secret1).update(msg1).digest('hex')}`;

    res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zm-signature': sig1,
        'x-zm-request-timestamp': ts1,
      },
      body: bodyStr1,
    });
    console.log('   - Secret "secret_live_1" with valid signature => Status:', res.status, '(Expected 200)');
    if (res.status !== 200) throw new Error(`FAIL: expected 200, got ${res.status}`);

    // Edge Case E: Dynamic update on live running server: secret changed to "secret_live_2"
    const secret2 = 'secret_live_2';
    process.env.ZOOM_WEBHOOK_SECRET_TOKEN = secret2;

    // Verify old signature sig1 now fails with 401
    res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zm-signature': sig1, // old signature for secret1
        'x-zm-request-timestamp': ts1,
      },
      body: bodyStr1,
    });
    console.log('   - Secret updated to "secret_live_2", request with old signature => Status:', res.status, '(Expected 401)');
    if (res.status !== 401) throw new Error(`FAIL: expected 401, got ${res.status}`);

    // Now send request with signature for secret2
    const ts2 = String(Math.floor(Date.now() / 1000));
    const msg2 = `v0:${ts2}:${bodyStr1}`;
    const sig2 = `v0=${crypto.createHmac('sha256', secret2).update(msg2).digest('hex')}`;

    res = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zm-signature': sig2,
        'x-zm-request-timestamp': ts2,
      },
      body: bodyStr1,
    });
    console.log('   - Request with new signature matching "secret_live_2" => Status:', res.status, '(Expected 200)');
    if (res.status !== 200) throw new Error(`FAIL: expected 200, got ${res.status}`);

    console.log('\n✓ ALL EMPIRICAL EDGE CASE & STATE MUTATION TESTS PASSED!');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (originalEnv !== undefined) process.env.ZOOM_WEBHOOK_SECRET_TOKEN = originalEnv;
    else delete process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  }
}

runEmpiricalStressTest().catch((err) => {
  console.error('STRESS TEST FAILED:', err);
  process.exit(1);
});
