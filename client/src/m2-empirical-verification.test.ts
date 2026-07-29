import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encryptKey, decryptKey } from './crypto/key-vault';
import { dripWorker } from './services/drip-worker';
import { db } from './services/local-db/db';
import { sendEmail, generateEmailDraft } from './services/ai/ai-service';
import { useStore } from './store';
import { initAnalytics, enableAnalytics, disableAnalytics, trackEvent, trackPageView } from './services/analytics';
import * as cookieConsent from './services/cookie-consent';

vi.mock('./services/local-db/db', () => ({
  db: {
    leads: {
      get: vi.fn(),
    },
    drip_campaigns: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      toArray: vi.fn(),
      update: vi.fn(),
    },
    email_campaigns: {
      put: vi.fn(),
    },
    email_tracking: {
      put: vi.fn(),
    },
    transcripts: {
      toArray: vi.fn(),
    },
    meetings: {
      toArray: vi.fn(),
    },
  },
}));

vi.mock('./services/ai/ai-service', () => ({
  sendEmail: vi.fn(),
  generateEmailDraft: vi.fn(),
}));

vi.mock('./services/cookie-consent', () => ({
  readConsent: vi.fn(),
}));

describe('M2 Key Vault Empirical Tests (key-vault.ts)', () => {
  it('should encrypt and decrypt standard API key correctly', async () => {
    const originalKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
    const password = 'StrongPassword123!';

    const encrypted = await encryptKey(originalKey, password);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.salt).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    const decrypted = await decryptKey(encrypted, password);
    expect(decrypted).toBe(originalKey);
  });

  it('should handle empty string key', async () => {
    const encrypted = await encryptKey('', 'pass');
    const decrypted = await decryptKey(encrypted, 'pass');
    expect(decrypted).toBe('');
  });

  it('should handle non-ASCII / Unicode / Emoji characters', async () => {
    const unicodeKey = '🔑 secret_val_€500_日本語';
    const password = 'pässwörd_🔒';

    const encrypted = await encryptKey(unicodeKey, password);
    const decrypted = await decryptKey(encrypted, password);
    expect(decrypted).toBe(unicodeKey);
  });

  it('should handle large payload encryption and decryption', async () => {
    const largeKey = 'A'.repeat(50000);
    const password = 'password123';

    const encrypted = await encryptKey(largeKey, password);
    const decrypted = await decryptKey(encrypted, password);
    expect(decrypted).toBe(largeKey);
  });

  it('should return null when decrypting with wrong password', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const encrypted = await encryptKey('secret', 'correctPassword');
    const decrypted = await decryptKey(encrypted, 'wrongPassword');
    expect(decrypted).toBeNull();
    consoleError.mockRestore();
  });

  it('should return null when decrypting corrupted ciphertext', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const encrypted = await encryptKey('secret', 'password');
    encrypted.ciphertext = 'invalidBase64Data!!!';
    const decrypted = await decryptKey(encrypted, 'password');
    expect(decrypted).toBeNull();
    consoleError.mockRestore();
  });

  it('should produce unique ciphertext, salt, and iv for identical inputs', async () => {
    const key = 'sk-same-key';
    const pass = 'same-pass';
    const enc1 = await encryptKey(key, pass);
    const enc2 = await encryptKey(key, pass);

    expect(enc1.salt).not.toBe(enc2.salt);
    expect(enc1.iv).not.toBe(enc2.iv);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });
});

describe('M2 Drip Worker Empirical Tests (drip-worker.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      openAiKey: 'test-openai-key',
      resendKey: 'test-resend-key',
      error: null,
    });
  });

  it('should ignore campaign if nextRunAt is in the future', async () => {
    const now = Date.now();
    const campaign = { id: 'c1', leadId: 'l1', nextRunAt: now + 10000, currentStep: 0 };
    await dripWorker.processCampaignStep(campaign, now);
    expect(db.leads.get).not.toHaveBeenCalled();
  });

  it('should set error status on campaign if lead is not found or has no email', async () => {
    vi.mocked(db.leads.get).mockResolvedValueOnce(null);
    const now = Date.now();
    const campaign = { id: 'c1', leadId: 'l1', nextRunAt: now - 1000, currentStep: 0 };
    await dripWorker.processCampaignStep(campaign, now);

    expect(db.drip_campaigns.update).toHaveBeenCalledWith('c1', {
      status: 'error',
      error: 'Lead not found or no email',
    });
  });

  it('should handle missing API keys gracefully and set store error', async () => {
    useStore.setState({ openAiKey: '', anthropicKey: '', geminiKey: '', resendKey: '' });
    vi.mocked(db.leads.get).mockResolvedValueOnce({ id: 'l1', name: 'Alice', email: 'alice@test.com' } as any);

    const now = Date.now();
    const campaign = { id: 'c1', leadId: 'l1', nextRunAt: now - 1000, currentStep: 0 };
    await dripWorker.processCampaignStep(campaign, now);

    expect(useStore.getState().error).toBe('Drip Campaign Failed: Missing API Keys.');
    expect(db.drip_campaigns.update).toHaveBeenCalledWith('c1', { nextRunAt: now + 3600000 });
  });

  it('should process predefined campaign sequence step with placeholder replacement', async () => {
    vi.mocked(db.leads.get).mockResolvedValueOnce({
      id: 'l1',
      name: 'Bob Builder',
      email: 'bob@builder.com',
      company: 'Acme Construction',
    } as any);
    vi.mocked(db.transcripts.toArray).mockResolvedValueOnce([]);
    vi.mocked(db.meetings.toArray).mockResolvedValueOnce([]);
    vi.mocked(sendEmail).mockResolvedValueOnce({} as any);

    const now = Date.now();
    const campaign = {
      id: 'c1',
      leadId: 'l1',
      name: 'Sequence Campaign',
      nextRunAt: now - 1000,
      currentStep: 0,
      sequence: [
        { subject: 'Hello {lead_name}', body: 'Welcome to {company}!', delayDays: 2 },
        { subject: 'Follow up 1', body: 'Checking in', delayDays: 3 },
      ],
    };

    await dripWorker.processCampaignStep(campaign, now);

    expect(sendEmail).toHaveBeenCalledWith(
      'bob@builder.com',
      'Hello {lead_name}',
      'Welcome to Acme Construction!',
      'test-resend-key',
      expect.any(String)
    );

    expect(db.email_campaigns.put).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: 'l1',
        subject: 'Hello {lead_name}',
        body: 'Welcome to Acme Construction!',
        status: 'sent',
        sequence: [],
      })
    );

    expect(db.drip_campaigns.update).toHaveBeenCalledWith('c1', {
      status: 'active',
      currentStep: 1,
      nextRunAt: now + 3 * 86400000,
    });
  });

  it('should fallback to AI generation when sequence step subject/body are missing', async () => {
    vi.mocked(db.leads.get).mockResolvedValueOnce({
      id: 'l1',
      name: 'Carol',
      email: 'carol@test.com',
    } as any);
    vi.mocked(db.transcripts.toArray).mockResolvedValueOnce([
      { id: 't1', meetingId: 'm1', fullText: 'Discussed pricing and Q3 timelines', createdAt: '2026-01-01' },
    ]);
    vi.mocked(db.meetings.toArray).mockResolvedValueOnce([{ id: 'm1' } as any]);
    vi.mocked(generateEmailDraft).mockResolvedValueOnce({
      subject: 'AI Generated Subject',
      body: 'AI Generated Body',
    } as any);
    vi.mocked(sendEmail).mockResolvedValueOnce({} as any);

    const now = Date.now();
    const campaign = {
      id: 'c1',
      leadId: 'l1',
      name: 'AI Campaign',
      nextRunAt: now - 1000,
      currentStep: 0,
      sequence: [],
    };

    await dripWorker.processCampaignStep(campaign, now);

    expect(generateEmailDraft).toHaveBeenCalledWith(
      'Discussed pricing and Q3 timelines',
      expect.objectContaining({ name: 'Carol', email: 'carol@test.com' }),
      'test-openai-key',
      'openai'
    );

    expect(sendEmail).toHaveBeenCalledWith(
      'carol@test.com',
      'AI Generated Subject',
      'AI Generated Body',
      'test-resend-key',
      expect.any(String)
    );
  });

  it('should set campaign status to completed when reaching final step', async () => {
    vi.mocked(db.leads.get).mockResolvedValueOnce({
      id: 'l1',
      name: 'Dave',
      email: 'dave@test.com',
    } as any);
    vi.mocked(db.transcripts.toArray).mockResolvedValueOnce([]);
    vi.mocked(db.meetings.toArray).mockResolvedValueOnce([]);
    vi.mocked(sendEmail).mockResolvedValueOnce({} as any);

    const now = Date.now();
    const campaign = {
      id: 'c1',
      leadId: 'l1',
      name: 'Single Step Campaign',
      nextRunAt: now - 1000,
      currentStep: 0,
      sequence: [{ subject: 'Final Step', body: 'Bye', delayDays: 1 }],
    };

    await dripWorker.processCampaignStep(campaign, now);

    expect(db.drip_campaigns.update).toHaveBeenCalledWith('c1', {
      status: 'completed',
      currentStep: 1,
      nextRunAt: null,
    });
  });

  it('should handle errors in sendEmail gracefully by scheduling retry', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(db.leads.get).mockResolvedValueOnce({
      id: 'l1',
      name: 'Eve',
      email: 'eve@test.com',
    } as any);
    vi.mocked(db.transcripts.toArray).mockResolvedValueOnce([]);
    vi.mocked(db.meetings.toArray).mockResolvedValueOnce([]);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Network error'));

    const now = Date.now();
    const campaign = {
      id: 'c1',
      leadId: 'l1',
      name: 'Failing Campaign',
      nextRunAt: now - 1000,
      currentStep: 0,
      sequence: [{ subject: 'Step 1', body: 'Body 1', delayDays: 1 }],
    };

    await dripWorker.processCampaignStep(campaign, now);

    expect(db.drip_campaigns.update).toHaveBeenCalledWith('c1', { nextRunAt: now + 3600000 });
    consoleSpy.mockRestore();
  });
});

describe('M2 Analytics Empirical Tests (analytics.ts)', () => {
  let existingScript: HTMLElement | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    window.dataLayer = [];
    window.gtag = undefined as any;
    existingScript = document.getElementById('ga-script');
    if (existingScript) existingScript.remove();
  });

  it('should not track events if user consent is not accepted', () => {
    vi.mocked(cookieConsent.readConsent).mockReturnValue('declined');
    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;

    trackEvent('button_click', { id: 123 });
    expect(gtagSpy).not.toHaveBeenCalled();

    trackPageView('/dashboard');
    expect(gtagSpy).not.toHaveBeenCalled();
  });

  it('should track events and page views if consent is accepted', () => {
    vi.mocked(cookieConsent.readConsent).mockReturnValue('accepted');
    const gtagSpy = vi.fn();
    window.gtag = gtagSpy;

    trackEvent('button_click', { id: 123 });
    expect(gtagSpy).toHaveBeenCalledWith('event', 'button_click', { id: 123 });

    trackPageView('/dashboard');
    expect(gtagSpy).toHaveBeenCalledWith('event', 'page_view', { page_path: '/dashboard' });
  });

  it('should disable analytics by replacing gtag with no-op function', () => {
    window.gtag = vi.fn();
    disableAnalytics();
    expect(typeof window.gtag).toBe('function');
    expect(() => window.gtag('event', 'test')).not.toThrow();
  });
});
