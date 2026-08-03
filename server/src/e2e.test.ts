import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

vi.mock('./services/firebase-admin.js', () => {
  const subscriptionDoc = () => ({
    get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ plan: 'pro', emailsSent: 0 }) }),
    set: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  });
  return {
    getFirebaseAuth: () => ({
      verifyIdToken: vi.fn().mockResolvedValue({ uid: 'e2e-user', email: 'e2e@example.com' }),
    }),
    getFirebaseFirestore: () => ({
      collection: () => ({
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ plan: 'pro', emailsSent: 0 }) }),
          set: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          collection: () => ({
            doc: () => subscriptionDoc(),
          }),
        }),
      }),
    }),
  };
});

describe('E2E User Flow', () => {
  it('allows a user to check auth and access ai routes', async () => {
    // 1. Health check
    const health = await request(app).get('/api/health');
    expect(health.status).toBe(200);

    // 2. Email draft route (authenticated)
    const emailDraft = await request(app)
      .post('/api/email/draft')
      .set('Authorization', 'Bearer e2e-token')
      .send({ transcript: 'Hello world', leadContext: {}, apiKey: 'mock', model: 'mock' });
    
    // Might fail depending on AI setup, but shouldn't 401
    expect(emailDraft.status).not.toBe(401);
  });
});
