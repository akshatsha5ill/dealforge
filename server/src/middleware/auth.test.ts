import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockVerifyIdToken = vi.fn();

vi.mock('../services/firebase-admin.js', () => ({
    getFirebaseAuth: () => ({ verifyIdToken: mockVerifyIdToken }),
    getFirebaseFirestore: () => ({}),
}));

describe('verifyAuth middleware', () => {
  let req: { headers: Record<string, string>; user?: Record<string, unknown> };
  let res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let verifyAuth: any;

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
