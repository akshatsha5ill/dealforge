import log from '../utils/logger.js';
import { config } from '../config.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClient = any;

interface BufferEntry<T> {
  data: T;
  timestamp: number;
}

class BufferService {
  private buffer: Map<string, BufferEntry<unknown>>;
  private ttl: number;
  private cleanupInterval: NodeJS.Timeout;
  private redis: RedisClient | null = null;
  private useRedis = false;
  private static MAX_ENTRIES = 10000;

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) {
    this.buffer = new Map();
    this.ttl = ttlMs;
    this.cleanupInterval = setInterval(() => this._cleanup(), 15 * 60 * 1000);
    this.cleanupInterval.unref();
    this._initRedis();
  }

  private async _initRedis() {
    if (config.redis.url) {
      try {
        const ioredis = await import('ioredis');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Redis = ioredis.default as any;
        this.redis = new Redis(config.redis.url, {
          maxRetriesPerRequest: 3,
          retryStrategy(times: number) {
            if (times > 3) return null;
            return Math.min(times * 200, 2000);
          },
        });
        this.redis.on('connect', () => {
          this.useRedis = true;
          log.info('Redis connected for buffer service');
        });
        this.redis.on('error', (err: Error) => {
          if (this.useRedis) {
            log.error('Redis error, falling back to in-memory', { error: err.message });
            this.useRedis = false;
          }
        });
      } catch {
        log.warn('Redis not available, using in-memory buffer');
      }
    }
  }

  async store<T>(key: string, data: T): Promise<void> {
    const entry: BufferEntry<T> = { data, timestamp: Date.now() };
    if (this.useRedis && this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(entry), 'PX', this.ttl);
        return;
      } catch {
        // Fall through to in-memory
      }
    }
    if (this.buffer.size >= BufferService.MAX_ENTRIES) {
      this._cleanup();
      if (this.buffer.size >= BufferService.MAX_ENTRIES) {
        log.warn('Buffer at capacity, rejecting write', { key, size: this.buffer.size });
        return;
      }
    }
    this.buffer.set(key, entry);
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis && this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (!raw) return null;
        const entry: BufferEntry<T> = JSON.parse(raw);
        return entry.data as T;
      } catch {
        // Fall through to in-memory
      }
    }
    const entry = this.buffer.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.buffer.delete(key);
      return null;
    }
    return entry.data as T;
  }

  async delete(key: string): Promise<void> {
    if (this.useRedis && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch {
        // Fall through to in-memory
      }
    }
    this.buffer.delete(key);
  }

  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.buffer.clear();
    if (this.redis) {
      this.redis.quit();
    }
  }

  private _cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.buffer.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.buffer.delete(key);
      }
    }
  }
}

export default new BufferService();
