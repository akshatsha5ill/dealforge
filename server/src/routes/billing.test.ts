import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import '../config.js';
import { errorHandler } from '../middleware/errorHandler.js';

const mockVerifyAuth = vi.hoisted(() =>
  vi.fn((_req: any, _res: any, next: any) => {
    _req.user = { uid: 'test-user-123', email: 'test@example.com' };
    next();
  })
);

vi.mock('../middleware/auth.js', () => ({
  verifyAuth: mockVerifyAuth,
}));

const mockFirestoreRefs = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue({ exists: false, data: () => null, ref: { set: mockSet } });
  const mockNestedDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet });
  const mockNestedCollection = vi.fn().mockReturnValue({ doc: mockNestedDoc });
  const mockDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet, collection: mockNestedCollection });
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
  return { mockSet, mockGet, mockCollection };
});

vi.mock('../services/firebase-admin.js', () => ({
  getFirebaseAuth: () => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user-123', email: 'test@example.com' }),
  }),
  getFirebaseFirestore: () => ({
    collection: mockFirestoreRefs.mockCollection,
  }),
}));

import billingRoutes from './billing.js';

describe('Billing Routes', () => {
  let server: http.Server | null = null;
  const originalApiKey = process.env.DODO_PAYMENTS_API_KEY;
  const originalWebhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  const originalProProductId = process.env.DODO_PRO_PRODUCT_ID;
  const originalEnterpriseProductId = process.env.DODO_ENTERPRISE_PRODUCT_ID;

  beforeAll(() => {
    process.env.DODO_PAYMENTS_API_KEY = 'test-api-key';
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = 'test-webhook-key';
    process.env.DODO_PRO_PRODUCT_ID = 'prod_pro_123';
    process.env.DODO_ENTERPRISE_PRODUCT_ID = 'prod_ent_123';
  });

  afterAll(() => {
    const restore = (key: string | undefined, val: string | undefined) => {
      if (val !== undefined) process.env[key!] = val;
      else delete process.env[key!];
    };
    restore('DODO_PAYMENTS_API_KEY', originalApiKey);
    restore('DODO_PAYMENTS_WEBHOOK_KEY', originalWebhookKey);
    restore('DODO_PRO_PRODUCT_ID', originalProProductId);
    restore('DODO_ENTERPRISE_PRODUCT_ID', originalEnterpriseProductId);
  });

  async function startServer() {
    mockFirestoreRefs.mockGet.mockReset();
    mockFirestoreRefs.mockGet.mockResolvedValue({ exists: false, data: () => null, ref: { set: mockFirestoreRefs.mockSet } });

    const app = express();
    app.use(express.json());
    app.use('/api/billing', billingRoutes);
    app.use(errorHandler);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, resolve));
    const address = server.address();
    return typeof address === 'object' && address ? address.port : 0;
  }

  async function stopServer() {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  }

  it('should return subscription data for authenticated user', async () => {
    const port = await startServer();
    const res = await fetch(`http://localhost:${port}/api/billing/subscription`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer fake-token' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('plan');
    expect(body).toHaveProperty('status');
    await stopServer();
  }, 10000);

  it('should require auth for checkout', async () => {
    mockVerifyAuth.mockImplementationOnce((_req: any, res: any, _next: any) => {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    });

    const port = await startServer();
    const res = await fetch(`http://localhost:${port}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' }),
    });

    expect(res.status).toBe(401);
    await stopServer();
  }, 10000);

  it('should reject invalid plan in checkout', async () => {
    const port = await startServer();
    const res = await fetch(`http://localhost:${port}/api/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer fake-token' },
      body: JSON.stringify({ plan: 'invalid' }),
    });

    expect(res.status).toBe(400);
    await stopServer();
  }, 10000);
});
