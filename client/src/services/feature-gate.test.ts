import { describe, it, expect } from 'vitest';
import {
  getPlan,
  canUseFeature,
  getMeetingLimit,
  getAiModelLimit,
  isAtMeetingLimit,
  getTranscriptHistoryDays,
  isTranscriptExpired,
  FEATURE_LABELS,
} from './feature-gate';

describe('feature-gate', () => {
  describe('getPlan', () => {
    it('defaults unknown/empty plans to free', () => {
      expect(getPlan(null)).toBe('free');
      expect(getPlan(undefined)).toBe('free');
      expect(getPlan('')).toBe('free');
      expect(getPlan('bogus' as never)).toBe('free');
    });

    it('recognizes valid plans', () => {
      expect(getPlan('free')).toBe('free');
      expect(getPlan('pro')).toBe('pro');
      expect(getPlan('enterprise')).toBe('enterprise');
    });
  });

  describe('canUseFeature', () => {
    it('free plan: only basic features', () => {
      expect(canUseFeature('free', 'emailOutreach')).toBe(false);
      expect(canUseFeature('free', 'pipeline')).toBe(false);
      expect(canUseFeature('free', 'customStages')).toBe(false);
      expect(canUseFeature('free', 'allAiModels')).toBe(false);
    });

    it('pro plan: email, pipeline, all models, but not enterprise-only', () => {
      expect(canUseFeature('pro', 'emailOutreach')).toBe(true);
      expect(canUseFeature('pro', 'pipeline')).toBe(true);
      expect(canUseFeature('pro', 'allAiModels')).toBe(true);
      expect(canUseFeature('pro', 'customStages')).toBe(false);
    });

    it('enterprise plan: everything', () => {
      for (const feature of Object.keys(FEATURE_LABELS) as Array<keyof typeof FEATURE_LABELS>) {
        expect(canUseFeature('enterprise', feature)).toBe(true);
      }
    });
  });

  describe('meeting limits', () => {
    it('free plan allows 3 meetings per month', () => {
      expect(getMeetingLimit('free')).toBe(3);
      expect(isAtMeetingLimit('free', 2)).toBe(false);
      expect(isAtMeetingLimit('free', 3)).toBe(true);
    });

    it('paid plans are unlimited', () => {
      expect(getMeetingLimit('pro')).toBeNull();
      expect(getMeetingLimit('enterprise')).toBeNull();
      expect(isAtMeetingLimit('pro', 1000)).toBe(false);
    });
  });

  describe('AI model limits', () => {
    it('free plan has 1 model, paid plans have 3', () => {
      expect(getAiModelLimit('free')).toBe(1);
      expect(getAiModelLimit('pro')).toBe(3);
      expect(getAiModelLimit('enterprise')).toBe(3);
    });
  });

  describe('transcript history', () => {
    it('free plan retains transcripts for 30 days', () => {
      expect(getTranscriptHistoryDays('free')).toBe(30);
      expect(getTranscriptHistoryDays('pro')).toBeNull();
      expect(getTranscriptHistoryDays('enterprise')).toBeNull();
    });

    it('marks old free-plan meetings as expired', () => {
      const oldStart = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      const recentStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(isTranscriptExpired('free', oldStart)).toBe(true);
      expect(isTranscriptExpired('free', recentStart)).toBe(false);
      expect(isTranscriptExpired('pro', oldStart)).toBe(false);
      expect(isTranscriptExpired('free', undefined)).toBe(false);
    });
  });
});
