import bufferService from './buffer-service.js';
import log from '../utils/logger.js';

const STANDARD_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const PHRASE_EMAIL = /(?:\b(?:email|e-mail|mail|contact)\b\s*(?:is|at|:\s*|=\s*)?|\breach\s+me\s+at\s+|my\s+email\s+(?:is\s+)?|email\s+me\s+at\s+)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

const JUNK_DOMAINS = new Set(['example.com', 'example.org', 'example.net', 'test.com', 'localhost', 'user.com', 'yourname.com', 'domain.com']);

export interface CollectedEmail {
  email: string;
  name: string;
  collectedAt: string;
}

const chunkKey = (sessionId: string) => `chatbot:emails:${sessionId}`;

const isValidEmail = (email: string): boolean => {
  if (email.includes(' ')) return false;
  if (email.endsWith('.')) return false;
  const [, domain] = email.split('@');
  if (!domain) return false;
  if (JUNK_DOMAINS.has(domain)) return false;
  if (domain.split('.').length < 2) return false;
  return true;
};

export function extractEmails(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  const standard = text.match(STANDARD_EMAIL);
  if (standard) found.push(...standard);
  let phraseMatch: RegExpExecArray | null;
  while ((phraseMatch = PHRASE_EMAIL.exec(text)) !== null) {
    if (phraseMatch[1]) found.push(phraseMatch[1]);
  }

  const seen = new Set<string>();
  const results: string[] = [];
  for (const raw of found) {
    const email = raw.toLowerCase().trim();
    if (!isValidEmail(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    results.push(email);
  }
  return results;
}

export async function collectEmail(
  email: string,
  speakerName: string,
  sessionId: string,
): Promise<CollectedEmail> {
  const normalized = email.trim().toLowerCase();
  const key = chunkKey(sessionId);
  const existing = (await bufferService.get<CollectedEmail[]>(key)) || [];
  if (existing.some((e) => e.email === normalized)) {
    return existing.find((e) => e.email === normalized) as CollectedEmail;
  }
  const entry: CollectedEmail = {
    email: normalized,
    name: speakerName || '',
    collectedAt: new Date().toISOString(),
  };
  await bufferService.store(key, [...existing, entry]);
  log.info('Email collected', { sessionId, email: normalized, speakerName });
  return entry;
}

export async function getCollectedEmails(sessionId: string): Promise<CollectedEmail[]> {
  const key = chunkKey(sessionId);
  return (await bufferService.get<CollectedEmail[]>(key)) || [];
}