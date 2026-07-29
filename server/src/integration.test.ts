import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from './app.js';

vi.mock('./services/firebase-admin.js', () => ({
  getFirebaseAuth: () => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user', email: 'test@example.com' }),
  }),
}));

describe('Integration Tests', () => {
  it('GET /api/health returns healthy', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

});
