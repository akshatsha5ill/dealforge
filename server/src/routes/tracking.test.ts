import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import trackingRouter from './tracking.js';

function createTestServer(router: express.Router) {
  const app = express();
  app.use(router);
  return new Promise<http.Server>((resolve) => {
    const server = http.createServer(app).listen(0, () => resolve(server));
  });
}

function makeRequest(server: http.Server, method: string, path: string, options: { headers?: Record<string, string>; body?: string | Record<string, unknown> } = {}) {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return new Promise<{ status: number | undefined; headers: http.IncomingHttpHeaders; body: Buffer; text: string }>((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port, path, method, headers: options.headers || {} },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: res.headers, body, text: body.toString() });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

describe('tracking routes', () => {
  let server: http.Server | null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it('GET /open/:campaignId without uid returns a GIF', async () => {
    server = await createTestServer(trackingRouter);
    const res = await makeRequest(server, 'GET', '/open/campaign-abc');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/gif');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /click/:campaignId without uid redirects', async () => {
    server = await createTestServer(trackingRouter);
    const res = await makeRequest(server, 'GET', '/click/campaign-abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBeDefined();
  });

  it('GET /events without auth returns 401', async () => {
    server = await createTestServer(trackingRouter);
    const res = await makeRequest(server, 'GET', '/events');
    expect(res.status).toBe(401);
    const body = JSON.parse(res.text);
    expect(body.error).toMatch(/unauthorized/i);
  });
});
