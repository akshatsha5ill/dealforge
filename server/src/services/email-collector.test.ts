import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();
vi.mock('./buffer-service.js', () => ({
  default: {
    store: vi.fn(async (key: string, data: unknown) => {
      store.set(key, data);
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

import { extractEmails, collectEmail, getCollectedEmails } from './email-collector.js';

describe('email-collector', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  describe('extractEmails', () => {
    it('extracts standard emails from plain text', () => {
      expect(extractEmails('Reach the team at sarah@techcorp.com thanks')).toEqual([
        'sarah@techcorp.com',
      ]);
    });

    it('handles "email is x@y.com" phrase patterns', () => {
      expect(extractEmails('Hi, welcome! My email is john.doe@startup.io')).toEqual([
        'john.doe@startup.io',
      ]);
      expect(extractEmails('You can reach me at bob@acme.co')).toEqual(['bob@acme.co']);
      expect(extractEmails('contact: alice@corp.com for details')).toEqual(['alice@corp.com']);
      expect(extractEmails('email is test@prospects.dev please')).toEqual(['test@prospects.dev']);
    });

    it('lowercases emails', () => {
      expect(extractEmails('Email: SARAH@TechCorp.com')).toEqual(['sarah@techcorp.com']);
    });

    it('dedupes repeated emails', () => {
      expect(extractEmails('a@b.com hello a@b.com again email is a@b.com')).toEqual(['a@b.com']);
    });

    it('rejects invalid / junk emails', () => {
      expect(extractEmails('no email here')).toEqual([]);
      expect(extractEmails('my address is a@b')).toEqual([]);
      expect(extractEmails('try foo@example.com')).toEqual([]);
      expect(extractEmails('weird @ with space foo bar@baz.com')).toEqual(['bar@baz.com']);
    });

    it('returns empty for empty input', () => {
      expect(extractEmails('')).toEqual([]);
    });

    it('extracts multiple distinct emails', () => {
      const result = extractEmails('reach me at one@test.dev and email is two@test.dev');
      expect(result).toEqual(expect.arrayContaining(['one@test.dev', 'two@test.dev']));
      expect(result.length).toBe(2);
    });

    it('is stateless across sequential calls', () => {
      expect(extractEmails('email is alice@first.dev and bob@first.dev')).toEqual([
        'alice@first.dev',
        'bob@first.dev',
      ]);
      expect(extractEmails('contact: carol@second.dev')).toEqual(['carol@second.dev']);
      expect(extractEmails('email is dan@third.dev for details')).toEqual(['dan@third.dev']);
    });
  });

  describe('collectEmail / getCollectedEmails', () => {
    it('stores a collected email associated with speaker', async () => {
      await collectEmail('sarah@techcorp.com', 'Sarah', 's1');
      const emails = await getCollectedEmails('s1');
      expect(emails).toHaveLength(1);
      expect(emails[0].email).toBe('sarah@techcorp.com');
      expect(emails[0].name).toBe('Sarah');
      expect(emails[0].collectedAt).toBeDefined();
    });

    it('normalizes email to lowercase', async () => {
      await collectEmail('JOHN@Acme.com', 'John', 's1');
      expect(await getCollectedEmails('s1')).toMatchObject([{ email: 'john@acme.com' }]);
    });

    it('dedupes by email', async () => {
      await collectEmail('a@b.com', 'A', 's1');
      await collectEmail('A@B.com', 'A again', 's1');
      expect(await getCollectedEmails('s1')).toHaveLength(1);
    });

    it('keeps sessions isolated', async () => {
      await collectEmail('a@b.com', 'A', 's1');
      expect(await getCollectedEmails('s2')).toEqual([]);
    });
  });
});