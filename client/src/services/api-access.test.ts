import { describe, it, expect, vi, beforeEach } from 'vitest';

const { settingsStore, tables } = vi.hoisted(() => ({
  settingsStore: new Map<string, unknown>(),
  tables: {
    meetings: new Map<string, unknown>(),
    ai_analysis: new Map<string, unknown>(),
    leads: new Map<string, unknown>(),
    deals: new Map<string, unknown>(),
  },
}));

vi.mock('./local-db/db', () => ({
  db: {
    settings: {
      get: vi.fn(async (key: string) => {
        if (!settingsStore.has(key)) return undefined;
        return { key, value: settingsStore.get(key) };
      }),
      put: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
        settingsStore.set(key, value);
      }),
    },
    meetings: {
      toArray: vi.fn(async () => [...tables.meetings.values()]),
    },
    ai_analysis: {
      toArray: vi.fn(async () => [...tables.ai_analysis.values()]),
    },
    leads: {
      toArray: vi.fn(async () => [...tables.leads.values()]),
    },
    deals: {
      toArray: vi.fn(async () => [...tables.deals.values()]),
    },
  },
}));

vi.mock('./api/client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('./usage-analytics', () => ({
  trackEvent: vi.fn(),
}));

async function freshModule() {
  vi.resetModules();
  const mod = await import('./api-access');
  const { apiClient } = await import('./api/client');
  const { trackEvent } = await import('./usage-analytics');
  return { apiAccess: mod, apiClient, trackEvent };
}

beforeEach(() => {
  vi.clearAllMocks();
  settingsStore.clear();
  for (const t of Object.values(tables)) t.clear();
});

describe('API access service', () => {
  describe('sync toggle', () => {
    it('defaults to disabled', async () => {
      const { apiAccess } = await freshModule();
      expect(await apiAccess.getApiSyncEnabled()).toBe(false);
    });

    it('persists the enabled state', async () => {
      const { apiAccess, trackEvent } = await freshModule();
      await apiAccess.setApiSyncEnabled(true);
      expect(await apiAccess.getApiSyncEnabled()).toBe(true);
      expect(trackEvent).toHaveBeenCalledWith('api_sync_enabled');
    });
  });

  describe('API keys', () => {
    it('creates a key via the API', async () => {
      const { apiAccess, apiClient, trackEvent } = await freshModule();
      const key = { key: 'df_live_abc', keyHash: 'h1', name: 'CRM', prefix: 'df_live_ab…', createdAt: 't', lastUsedAt: null, revoked: false };
      vi.mocked(apiClient.post).mockResolvedValueOnce(key);
      const result = await apiAccess.createApiKey('CRM');
      expect(result).toEqual(key);
      expect(apiClient.post).toHaveBeenCalledWith('/api-keys', { name: 'CRM' });
      expect(trackEvent).toHaveBeenCalledWith('api_key_created');
    });

    it('returns null when creation fails', async () => {
      const { apiAccess, apiClient } = await freshModule();
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('nope'));
      expect(await apiAccess.createApiKey('CRM')).toBeNull();
    });

    it('lists keys', async () => {
      const { apiAccess, apiClient } = await freshModule();
      vi.mocked(apiClient.get).mockResolvedValueOnce({ keys: [{ keyHash: 'h1', name: 'CRM', prefix: 'df_live_ab…', createdAt: 't', lastUsedAt: null, revoked: false }] });
      const keys = await apiAccess.listApiKeys();
      expect(keys).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith('/api-keys');
    });

    it('returns an empty list when listing fails', async () => {
      const { apiAccess, apiClient } = await freshModule();
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('nope'));
      expect(await apiAccess.listApiKeys()).toEqual([]);
    });

    it('revokes a key', async () => {
      const { apiAccess, apiClient } = await freshModule();
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ status: 'success' });
      expect(await apiAccess.revokeApiKey('h1')).toBe(true);
      expect(apiClient.delete).toHaveBeenCalledWith('/api-keys/h1');
    });

    it('returns false when revocation fails', async () => {
      const { apiAccess, apiClient } = await freshModule();
      vi.mocked(apiClient.delete).mockRejectedValueOnce(new Error('nope'));
      expect(await apiAccess.revokeApiKey('h1')).toBe(false);
    });
  });

  describe('syncDerivedData', () => {
    it('sends all derived data and records the sync time', async () => {
      const { apiAccess, apiClient, trackEvent } = await freshModule();
      tables.meetings.set('m1', { id: 'm1', title: 'Discovery', startTime: 't', endTime: 't', duration: 30, status: 'completed' });
      tables.ai_analysis.set('a1', { id: 'a1', meetingId: 'm1', summary: 'Good', actionItems: ['Send'], leadScore: 72, modelUsed: 'openai', analyzedAt: 't' });
      tables.leads.set('l1', { id: 'l1', meetingId: 'm1', name: 'Jane', email: 'j@a.com', company: 'A', role: 'VP', score: 72, stage: 'q', createdAt: 't', updatedAt: 't' });
      tables.deals.set('d1', { id: 'd1', leadId: 'l1', title: 'Rollout', stage: 'proposal', value: 5000, probability: 50, expectedClose: '2026-09-01', createdAt: 't', updatedAt: 't' });
      vi.mocked(apiClient.post).mockResolvedValueOnce({ status: 'success' });

      const result = await apiAccess.syncDerivedData();

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      const payload = vi.mocked(apiClient.post).mock.calls[0][1] as {
        meetings: unknown[];
        analyses: Array<{ actionItems: string[] }>;
        leads: unknown[];
        deals: unknown[];
      };
      expect(payload.meetings).toHaveLength(1);
      expect(payload.analyses).toHaveLength(1);
      expect(payload.leads).toHaveLength(1);
      expect(payload.deals).toHaveLength(1);
      expect(payload.analyses[0].actionItems).toEqual(['Send']);
      expect(result).toMatchObject({ meetings: 1, analyses: 1, leads: 1, deals: 1 });
      expect(trackEvent).toHaveBeenCalledWith('api_sync_completed');
      expect(await apiAccess.getLastSyncedAt()).not.toBeNull();
    });

    it('chunks large collections into multiple requests', async () => {
      const { apiAccess, apiClient } = await freshModule();
      for (let i = 0; i < 250; i++) {
        tables.meetings.set(`m${i}`, { id: `m${i}`, title: `M ${i}`, startTime: 't', endTime: 't', duration: 30, status: 'completed' });
      }
      vi.mocked(apiClient.post).mockResolvedValue({ status: 'success' });

      await apiAccess.syncDerivedData();

      const calls = vi.mocked(apiClient.post).mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(3);
      const first = calls[0][1] as { meetings: unknown[] };
      const last = calls[2][1] as { meetings: unknown[] };
      expect(first.meetings).toHaveLength(100);
      expect(last.meetings).toHaveLength(50);
    });

    it('returns null when the server is unreachable', async () => {
      const { apiAccess, apiClient } = await freshModule();
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('offline'));
      expect(await apiAccess.syncDerivedData()).toBeNull();
    });
  });
});
