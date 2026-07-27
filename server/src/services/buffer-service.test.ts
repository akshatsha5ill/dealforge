import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Buffer Service', () => {
  let bufferService: any;

  beforeEach(async () => {
    vi.resetModules();
    bufferService = (await import('../services/buffer-service.js')).default;
    if (bufferService.buffer) {
        bufferService.buffer.clear();
    } else {
        (bufferService as any).buffer.clear();
    }
  });

  it('should store and retrieve data', async () => {
    await bufferService.store('test-key', { value: 'hello' });
    const result = await bufferService.get('test-key');
    expect(result).toEqual({ value: 'hello' });
  });

  it('should return null for non-existent keys', async () => {
    const result = await bufferService.get('non-existent');
    expect(result).toBeNull();
  });

  it('should expire entries after TTL', async () => {
    vi.useFakeTimers();
    await bufferService.store('expire-key', { value: 'temp' });
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    const result = await bufferService.get('expire-key');
    expect(result).toBeNull();
    vi.useRealTimers();
  });

  it('should overwrite existing entries', async () => {
    await bufferService.store('key', { v: 1 });
    await bufferService.store('key', { v: 2 });
    const result = await bufferService.get('key');
    expect(result).toEqual({ v: 2 });
  });
});
