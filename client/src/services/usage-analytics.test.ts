import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackEvent, getEventCount, getAllEvents } from './usage-analytics';

describe('usage-analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('increments counters per event', () => {
    trackEvent('analyze_clicked');
    trackEvent('analyze_clicked');
    trackEvent('analyze_succeeded');
    expect(getEventCount('analyze_clicked')).toBe(2);
    expect(getEventCount('analyze_succeeded')).toBe(1);
  });

  it('returns 0 for events never tracked', () => {
    expect(getEventCount('email_sent')).toBe(0);
  });

  it('persists across reloads via localStorage', () => {
    trackEvent('upgrade_prompt_shown');
    const reloaded = getAllEvents();
    expect(reloaded['upgrade_prompt_shown']).toMatchObject({ count: 1 });
    expect(reloaded['upgrade_prompt_shown'].lastTs).toEqual(expect.any(Number));
  });

  it('prunes events older than the retention window', () => {
    const oldTs = Date.now() - 200 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      'dealforge_usage_events',
      JSON.stringify({ email_sent: { count: 5, lastTs: oldTs } })
    );
    expect(getAllEvents()).toEqual({});
    expect(getEventCount('email_sent')).toBe(0);
  });

  it('handles corrupted storage gracefully', () => {
    localStorage.setItem('dealforge_usage_events', '{not valid json');
    expect(getAllEvents()).toEqual({});
    trackEvent('deal_created');
    expect(getEventCount('deal_created')).toBe(1);
  });
});
