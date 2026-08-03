import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { apiKeyAuth, API_KEY_HEADER } from './apiKeyAuth.js';
import { errorHandler } from './errorHandler.js';

vi.mock('../services/api-key-service.js', () => ({
  findApiKeyOwner: vi.fn(),
  touchApiKeyLastUsed: vi.fn(),
}));

import { findApiKeyOwner, touchApiKeyLastUsed } from '../services/api-key-service.js';

function createApp() {
  const app = express();
  app.use(apiKeyAuth);
  app.get('/probe', (req: any, res: any) => {
    res.json({ uid: req.user?.uid, hash: req.apiKeyHash });
  });
  app.use(errorHandler);
  return app;
}

async function request(app: express.Express, path: string, headers?: Record<string, string>): Promise<Response> {
  const server = app.listen(0);
  const { port } = server.address() as { port: number };
  try {
    return await fetch(`http://localhost:${port}${path}`, { headers });
  } finally {
    server.close();
  }
}

describe('apiKeyAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects requests without an API key', async () => {
    const res = await request(createApp(), '/probe');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid API key', async () => {
    vi.mocked(findApiKeyOwner).mockResolvedValue(null);
    const res = await request(createApp(), '/probe', { [API_KEY_HEADER]: 'df_live_invalid' });
    expect(res.status).toBe(401);
  });

  it('attaches the user for a valid key', async () => {
    vi.mocked(findApiKeyOwner).mockResolvedValue({ uid: 'user-1', keyHash: 'h1' });
    const res = await request(createApp(), '/probe', { [API_KEY_HEADER]: 'df_live_validkey' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ uid: 'user-1', hash: 'h1' });
    expect(touchApiKeyLastUsed).toHaveBeenCalledWith('h1');
  });

  it('returns 500 when key lookup fails', async () => {
    vi.mocked(findApiKeyOwner).mockRejectedValue(new Error('boom'));
    const res = await request(createApp(), '/probe', { [API_KEY_HEADER]: 'df_live_validkey' });
    expect(res.status).toBe(500);
  });
});
