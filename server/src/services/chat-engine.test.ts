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

const openai = vi.hoisted(() => ({
  embeddingsCreate: vi.fn(),
  chatCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    embeddings = { create: openai.embeddingsCreate };
    chat = { completions: { create: openai.chatCreate } };
  },
}));

vi.mock('./email-collector.js', () => ({
  extractEmails: vi.fn((text: string) => (text.includes('@') ? [text.match(/[\w.+-]+@[\w.-]+/)?.[0]] : [])),
  collectEmail: vi.fn(async (email: string, speakerName: string, sessionId: string) => ({
    email,
    name: speakerName,
    collectedAt: new Date().toISOString(),
  })),
  getCollectedEmails: vi.fn(async () => []),
}));

vi.mock('./email-generator.js', () => ({
  generateFollowUpDraft: vi.fn(async () => ({
    subject: 'Re: Your question',
    body: 'Hi there, thanks for attending!',
  })),
}));

import {
  createSession,
  processSegments,
  getDrafts,
  approveDraft,
  endSession,
  getSession,
  collectEmailsFromSegments,
} from './chat-engine.js';
import { collectEmail } from './email-collector.js';

const KB_CHUNKS = [
  { text: 'Pricing: the starter plan costs $29/month.', embedding: [1, 0] },
  { text: 'The enterprise plan includes SSO and API access.', embedding: [0.9, 0.1] },
  { text: 'We support Slack and Teams integrations.', embedding: [0.1, 0.9] },
];

const segment = (speaker: string, text: string, ts: string) => ({ speaker, text, timestamp: ts });

describe('chat-engine', () => {
  let sessionId: string;

  beforeEach(async () => {
    store.clear();
    vi.clearAllMocks();
    sessionId = 'sess-1';
    openai.embeddingsCreate.mockResolvedValue({ data: [{ embedding: [1, 0] }] });
    openai.chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              shouldRespond: true,
              message: 'Great question! Our starter plan includes full reporting.',
              type: 'answer',
              confidence: 0.85,
            }),
          },
        },
      ],
    });
    (global as any).__io = {
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    };
  });

  it('creates a session scoped to uid with empty history', async () => {
    const session = await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    expect(session.uid).toBe('u1');
    expect(session.meetingId).toBe('m1');
    expect(session.conversationHistory).toEqual([]);
    const stored = await getSession(sessionId);
    expect(stored).toMatchObject({ id: sessionId, companyName: 'Acme Inc' });
  });

  it('refuses to create a duplicate session', async () => {
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    await expect(
      createSession({
        sessionId,
        meetingId: 'm1',
        uid: 'u1',
        knowledgeChunks: KB_CHUNKS,
        companyName: 'Acme Inc',
        apiKey: 'key-1',
      }),
    ).rejects.toThrow('already exists');
  });

  it('produces no draft when no knowledge chunk is relevant', async () => {
    openai.embeddingsCreate.mockResolvedValue({ data: [{ embedding: [0, -1] }] });
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    const drafts = await processSegments(sessionId, [segment('Sarah', 'How is the weather today?', 't1')], 'key-1');
    expect(drafts).toEqual([]);
    expect(openai.chatCreate).not.toHaveBeenCalled();
  });

  it('creates, persists and emits a draft for a relevant question', async () => {
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    const drafts = await processSegments(sessionId, [segment('Sarah', 'What does the starter plan cost?', 't1')], 'key-1');
    expect(drafts).toHaveLength(1);
    const draft = drafts[0];
    expect(draft.type).toBe('answer');
    expect(draft.confidence).toBe(0.85);
    expect(draft.triggerSegment).toBe('What does the starter plan cost?');
    expect(draft.speakerName).toBe('Sarah');
    expect(draft.kbSources).toContain('Pricing: the starter plan costs $29/month.');

    const stored = await getDrafts(sessionId);
    expect(stored).toHaveLength(1);
    expect(stored[0].approved).toBe(false);
    expect(stored[0].id).toBe(draft.id);

    expect((global as any).__io.to).toHaveBeenCalledWith('meeting:m1');
    expect((global as any).__io.to('meeting:m1').emit).toHaveBeenCalledWith('draft_response', draft);
  });

  it('skips draft when the model decides not to respond', async () => {
    openai.chatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ shouldRespond: false }) } }],
    });
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    const drafts = await processSegments(sessionId, [segment('Sarah', 'What does it cost?', 't1')], 'key-1');
    expect(drafts).toEqual([]);
  });

  it('caps conversation history at the last 50 segments', async () => {
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    const many = Array.from({ length: 60 }, (_, i) => segment('P', `seg ${i}`, `t${i}`));
    await processSegments(sessionId, many, 'key-1');
    const session = await getSession(sessionId);
    expect(session?.conversationHistory).toHaveLength(50);
    expect(session?.conversationHistory[0].text).toBe('seg 10');
  });

  it('approves a draft and persists the flag', async () => {
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    const [draft] = await processSegments(sessionId, [segment('Sarah', 'What does it cost?', 't1')], 'key-1');
    await approveDraft(sessionId, draft.id);
    const stored = await getDrafts(sessionId);
    expect(stored[0].approved).toBe(true);
  });

  it('throws when approving an unknown draft', async () => {
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    await expect(approveDraft(sessionId, 'nope')).rejects.toThrow('not found');
  });

  it('marks a session ended and rejects further processing', async () => {
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    const ended = await endSession(sessionId);
    expect(ended?.ended).toBe(true);
    expect(ended?.endedAt).toBeDefined();
    await expect(processSegments(sessionId, [segment('P', 'hi', 't1')], 'key-1')).rejects.toThrow(
      'has ended',
    );
  });

  it('collects emails found in segments', async () => {
    await createSession({
      sessionId,
      meetingId: 'm1',
      uid: 'u1',
      knowledgeChunks: KB_CHUNKS,
      companyName: 'Acme Inc',
      apiKey: 'key-1',
    });
    await collectEmailsFromSegments(sessionId, [segment('Sarah', 'email is sarah@co.com', 't1')]);
    expect(collectEmail).toHaveBeenCalledWith('sarah@co.com', 'Sarah', sessionId);
  });
});