import { db } from './local-db/db';
import { apiClient } from './api/client';
import { trackEvent } from './usage-analytics';

const SYNC_ENABLED_KEY = 'dealforge_api_sync_enabled';
const LAST_SYNCED_KEY = 'dealforge_api_last_synced';
const SYNC_CHUNK_SIZE = 100;

export interface ApiKeySummary {
  keyHash: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface NewApiKey extends ApiKeySummary {
  key: string;
}

export interface SyncResult {
  meetings: number;
  analyses: number;
  leads: number;
  deals: number;
  syncedAt: string;
}

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.settings.get(key);
    return (row?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  try {
    await db.settings.put({ key, value });
  } catch {
    // IndexedDB unavailable — feature still works for the session
  }
}

export async function getApiSyncEnabled(): Promise<boolean> {
  return readSetting<boolean>(SYNC_ENABLED_KEY, false);
}

export async function setApiSyncEnabled(enabled: boolean): Promise<void> {
  await writeSetting(SYNC_ENABLED_KEY, enabled);
  if (enabled) trackEvent('api_sync_enabled');
}

export async function getLastSyncedAt(): Promise<string | null> {
  return readSetting<string | null>(LAST_SYNCED_KEY, null);
}

export async function createApiKey(name: string): Promise<NewApiKey | null> {
  try {
    const res = await apiClient.post<NewApiKey>('/api-keys', { name });
    trackEvent('api_key_created');
    return res;
  } catch {
    return null;
  }
}

export async function listApiKeys(): Promise<ApiKeySummary[]> {
  try {
    const res = await apiClient.get<{ keys: ApiKeySummary[] }>('/api-keys');
    return res.keys ?? [];
  } catch {
    return [];
  }
}

export async function revokeApiKey(keyHash: string): Promise<boolean> {
  try {
    await apiClient.delete(`/api-keys/${keyHash}`);
    return true;
  } catch {
    return false;
  }
}

async function chunkify<T>(items: T[], size: number): Promise<T[][]> {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function syncDerivedData(): Promise<SyncResult | null> {
  try {
    const [meetings, analyses, leads, deals] = await Promise.all([
      db.meetings.toArray(),
      db.ai_analysis.toArray(),
      db.leads.toArray(),
      db.deals.toArray(),
    ]);

    const meetingChunks = await chunkify(
      meetings.map((m) => ({ id: m.id, title: m.title, startTime: m.startTime, endTime: m.endTime, duration: m.duration, status: m.status })),
      SYNC_CHUNK_SIZE
    );
    const analysisChunks = await chunkify(
      analyses.map((a) => ({ id: a.id, meetingId: a.meetingId, summary: a.summary, actionItems: a.actionItems ?? [], leadScore: a.leadScore, modelUsed: a.modelUsed, analyzedAt: a.analyzedAt })),
      SYNC_CHUNK_SIZE
    );
    const leadChunks = await chunkify(
      leads.map((l) => ({ id: l.id, meetingId: l.meetingId, name: l.name, email: l.email, company: l.company, role: l.role, score: l.score, stage: l.stage, createdAt: l.createdAt, updatedAt: l.updatedAt })),
      SYNC_CHUNK_SIZE
    );
    const dealChunks = await chunkify(
      deals.map((d) => ({ id: d.id, leadId: d.leadId, title: d.title, stage: d.stage, value: d.value, probability: d.probability, expectedClose: d.expectedClose, createdAt: d.createdAt, updatedAt: d.updatedAt })),
      SYNC_CHUNK_SIZE
    );

    const chunkCount = Math.max(meetingChunks.length, analysisChunks.length, leadChunks.length, dealChunks.length, 1);
    for (let i = 0; i < chunkCount; i++) {
      await apiClient.post('/sync', {
        meetings: meetingChunks[i] ?? [],
        analyses: analysisChunks[i] ?? [],
        leads: leadChunks[i] ?? [],
        deals: dealChunks[i] ?? [],
      });
    }

    const syncedAt = new Date().toISOString();
    await writeSetting(LAST_SYNCED_KEY, syncedAt);
    trackEvent('api_sync_completed');
    return { meetings: meetings.length, analyses: analyses.length, leads: leads.length, deals: deals.length, syncedAt };
  } catch {
    return null;
  }
}
