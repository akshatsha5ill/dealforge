import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import admin from '../services/firebase-admin.js';
import Stripe from 'stripe';

vi.mock('../services/firebase-admin.js', () => ({
  default: {
    auth: () => ({ verifyIdToken: vi.fn().mockResolvedValue({ uid: 'test-user', email: 'test@example.com' }) }),
    firestore: () => ({
      collection: () => ({
        doc: () => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ status: 'active', plan: 'pro' }) }) }),
        where: () => ({ get: vi.fn().mockResolvedValue({ forEach: vi.fn() }) })
      })
    })
  }
}));

describe('Billing Routes', () => {
  it('GET /api/billing/status returns billing status', async () => {
    const res = await request(app)
      .get('/api/billing/status')
      .set('Authorization', 'Bearer mock-token');
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.plan).toBe('pro');
    expect(res.body.active).toBe(true);
  });

  it('GET /api/billing/plans returns available plans', async () => {
    const res = await request(app).get('/api/billing/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toBeInstanceOf(Array);
  });
});
