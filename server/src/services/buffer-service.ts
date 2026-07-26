import admin from './firebase-admin.js';
import log from '../utils/logger.js';

interface BufferEntry<T> {
  data: T;
  timestamp: number;
}

class BufferService {
  private buffer: Map<string, BufferEntry<any>>;
  private ttl: number;
  private cleanupInterval: NodeJS.Timeout;
  private saveInterval: NodeJS.Timeout;
  private dirty: boolean = false;
  private static readonly COLLECTION = 'buffer_backups';

  constructor(ttlMs: number = 24 * 60 * 60 * 1000) {
    this.buffer = new Map();
    this.ttl = ttlMs;
    this._load();
    this.cleanupInterval = setInterval(() => this._cleanup(), 15 * 60 * 1000);
    this.cleanupInterval.unref();
    this.saveInterval = setInterval(() => this._save(), 10000);
    this.saveInterval.unref();
  }

  private _encodeKey(key: string): string {
    return Buffer.from(key).toString('base64url');
  }

  private _decodeKey(docId: string): string {
    return Buffer.from(docId, 'base64url').toString();
  }

  private async _load(): Promise<void> {
    try {
      const snapshot = await admin.firestore().collection(BufferService.COLLECTION).get();
      for (const doc of snapshot.docs) {
        const key = this._decodeKey(doc.id);
        this.buffer.set(key, doc.data() as BufferEntry<any>);
      }
    } catch (e: any) {
      log.error('Failed to load buffer backup:', e);
    }
  }

  private async _save(): Promise<void> {
    if (!this.dirty) return;
    try {
      const collection = admin.firestore().collection(BufferService.COLLECTION);
      const existingSnapshot = await collection.get();
      const existingIds = new Set<string>(existingSnapshot.docs.map((d: any) => d.id));

      const currentIds = new Set<string>();
      for (const [key, value] of this.buffer.entries()) {
        const docId = this._encodeKey(key);
        currentIds.add(docId);
        await collection.doc(docId).set(value as any);
      }

      for (const id of existingIds) {
        if (!currentIds.has(id)) {
          await collection.doc(id).delete();
        }
      }

      this.dirty = false;
    } catch (e: any) {
      log.error('Failed to save buffer backup:', e);
    }
  }

  store<T>(key: string, data: T): void {
    this.buffer.set(key, {
      data,
      timestamp: Date.now()
    });
    this.dirty = true;
  }

  get<T>(key: string): T | null {
    const entry = this.buffer.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.buffer.delete(key);
      return null;
    }
    return entry.data as T;
  }

  delete(key: string): void {
    if (this.buffer.has(key)) {
      this.buffer.delete(key);
      this.dirty = true;
    }
  }

  shutdown(): void {
    clearInterval(this.cleanupInterval);
    clearInterval(this.saveInterval);
    this._save();
    this.buffer.clear();
  }

  private _cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.buffer.entries()) {
      if (now - value.timestamp > this.ttl) {
        this.buffer.delete(key);
        this.dirty = true;
      }
    }
  }
}

export default new BufferService();
