import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from './index.js';

vi.mock('./services/firebase-admin.js', () => ({
  default: {
    auth: () => ({ verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user', email: 'test@example.com' }) }),
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ plan: 'pro' }) })
        })
      })
    })
  }
}));

describe('Integration Tests', () => {
  it('GET /api/health returns healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /api/billing/status works', async () => {
    const res = await request(app)
      .get('/api/billing/status')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
  });
});
