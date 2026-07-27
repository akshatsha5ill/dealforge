import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import http from 'http';
import emailRouter from './email.js';
import { errorHandler } from '../middleware/errorHandler.js';

function createTestServer(router: express.Router) {
  const app = express();
  app.use(express.json());
  // Mock req.user for tests
  app.use((req: express.Request & { user?: Record<string, unknown> }, res, next) => {
    req.user = { uid: 'test-user' };
    next();
  });
  app.use(router);
  app.use(errorHandler);
  return new Promise<http.Server>((resolve) => {
    const server = http.createServer(app).listen(0, () => resolve(server));
  });
}

function makeRequest(server: http.Server, method: string, path: string, options: { headers?: Record<string, string>; body?: string | Record<string, unknown> } = {}) {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return new Promise<{ status: number | undefined; headers: http.IncomingHttpHeaders; body: Buffer; text: string }>((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port, path, method, headers: { 'Content-Type': 'application/json', ...options.headers } },
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

describe('email routes', () => {
  let server: http.Server | null;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it('POST /send with missing subject returns 400', async () => {
    server = await createTestServer(emailRouter);
    const res = await makeRequest(server, 'POST', '/send', {
      body: { to: 'user@example.com', body: 'Hello' },
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toContain('invalid input');
  });

  it('POST /send with missing body returns 400', async () => {
    server = await createTestServer(emailRouter);
    const res = await makeRequest(server, 'POST', '/send', {
      body: { to: 'user@example.com', subject: 'Hello' },
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toContain('invalid input');
  });

  it('POST /send with invalid email returns 400', async () => {
    server = await createTestServer(emailRouter);
    const res = await makeRequest(server, 'POST', '/send', {
      body: { to: 'not-an-email', subject: 'Hello', body: 'World' },
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toContain('invalid input');
  });

  it('POST /send with non-string to returns 400', async () => {
    server = await createTestServer(emailRouter);
    const res = await makeRequest(server, 'POST', '/send', {
      body: { to: 12345, subject: 'Hello', body: 'World' },
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toContain('invalid input');
  });

  it('POST /draft with missing transcript returns 400', async () => {
    server = await createTestServer(emailRouter);
    const res = await makeRequest(server, 'POST', '/draft', {
      body: {},
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toContain('invalid input');
  });

  it('POST /draft without apiKey returns 400', async () => {
    server = await createTestServer(emailRouter);
    const res = await makeRequest(server, 'POST', '/draft', {
      body: { transcript: 'We discussed the project timeline.' },
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.text);
    expect(body.error).toContain('invalid input');
  });
});
