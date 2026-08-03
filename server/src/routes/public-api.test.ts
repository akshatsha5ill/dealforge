import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import publicApiRoutes from './public-api.js';
import { errorHandler } from '../middleware/errorHandler.js';

vi.mock('../middleware/apiKeyAuth.js', () => ({
  apiKeyAuth: vi.fn((req: any, _res: any, next: any) => {
    req.user = { uid: 'api-user-1' };
    next();
  }),
}));

vi.mock('../services/api-data-service.js', () => ({
  getMeetingsWithAnalyses: vi.fn(),
  getMeetingDetail: vi.fn(),
  getLeads: vi.fn(),
  getDeals: vi.fn(),
}));

import { getMeetingsWithAnalyses, getMeetingDetail, getLeads, getDeals } from '../services/api-data-service.js';

function createApp() {
  const app = express();
  app.use('/v1', publicApiRoutes);
  app.use(errorHandler);
  return app;
}

async function request(app: express.Express, path: string): Promise<Response> {
  const server = app.listen(0);
  const { port } = server.address() as { port: number };
  try {
    return await fetch(`http://localhost:${port}${path}`);
  } finally {
    server.close();
  }
}

describe('public API routes (v1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns meetings joined with analyses', async () => {
    vi.mocked(getMeetingsWithAnalyses).mockResolvedValue([{ id: 'm1', title: 'Discovery', startTime: 't', endTime: 't', duration: 30, status: 'completed', summary: 'Good', actionItems: ['Send proposal'], leadScore: 72, modelUsed: 'openai', analyzedAt: 't' }]);
    const res = await request(createApp(), '/v1/meetings');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].summary).toBe('Good');
    expect(getMeetingsWithAnalyses).toHaveBeenCalledWith('api-user-1');
  });

  it('returns a single meeting', async () => {
    vi.mocked(getMeetingDetail).mockResolvedValue({ id: 'm1', title: 'Discovery', startTime: 't', endTime: 't', duration: 30, status: 'completed', summary: 'Good', actionItems: [], leadScore: null, modelUsed: null, analyzedAt: null });
    const res = await request(createApp(), '/v1/meetings/m1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('m1');
  });

  it('returns 404 for an unknown meeting', async () => {
    vi.mocked(getMeetingDetail).mockResolvedValue(null);
    const res = await request(createApp(), '/v1/meetings/nope');
    expect(res.status).toBe(404);
  });

  it('returns leads', async () => {
    vi.mocked(getLeads).mockResolvedValue([{ id: 'l1', meetingId: 'm1', name: 'Jane', email: 'jane@acme.com', company: 'Acme', role: 'VP', score: 72, stage: 'qualified', createdAt: 't', updatedAt: 't' }]);
    const res = await request(createApp(), '/v1/leads');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].name).toBe('Jane');
  });

  it('returns deals', async () => {
    vi.mocked(getDeals).mockResolvedValue([{ id: 'd1', leadId: 'l1', title: 'Acme rollout', stage: 'proposal', value: 5000, probability: 50, expectedClose: '2026-09-01', createdAt: 't', updatedAt: 't' }]);
    const res = await request(createApp(), '/v1/deals');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].title).toBe('Acme rollout');
  });
});
