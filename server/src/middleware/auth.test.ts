import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

let mockVerifyIdToken;

vi.mock('../services/firebase-admin.js', () => {
    mockVerifyIdToken = vi.fn();
    return {
        default: {
            auth: () => ({ verifyIdToken: mockVerifyIdToken })
        }
    };
});

describe('verifyAuth middleware', () => {
  let req;
  let res;
  let next;
  let verifyAuth;

  beforeEach(async () => {
    vi.clearAllMocks();

    req = { headers: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();

    const mod = await import('./auth.js');
    verifyAuth = mod.verifyAuth;
  });

  it('returns 401 when authorization header is missing', async () => {
    await verifyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token format is invalid (no Bearer prefix)', async () => {
    req.headers.authorization = 'InvalidToken123';

    await verifyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails', async () => {
    req.headers.authorization = 'Bearer badtoken';
    mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

    await verifyAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.user for a valid token', async () => {
    const decoded = { uid: 'user123', email: 'test@example.com' };
    req.headers.authorization = 'Bearer validtoken';
    mockVerifyIdToken.mockResolvedValue(decoded);

    await verifyAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(decoded);
    expect(res.status).not.toHaveBeenCalled();
  });
});
