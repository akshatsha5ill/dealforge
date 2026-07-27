import { describe, it, expect, vi } from 'vitest';
import { errorHandler, AppError } from './errorHandler.js';
import express from 'express';

describe('Error Handler Middleware', () => {
  it('handles AppError properly', () => {
    const err = new AppError('Custom error', 400);
    const req = {} as express.Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as express.Response;
    const next = vi.fn();

    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', error: 'Custom error' });
  });

  it('handles unknown errors gracefully', () => {
    const err = new Error('Unknown crash');
    const req = {} as express.Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as express.Response;
    const next = vi.fn();

    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ status: 'error', error: 'Internal Server Error' });
  });
});
