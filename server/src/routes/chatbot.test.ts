import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../services/firebase-admin.js', () => ({
  getFirebaseAuth: () => ({
    verifyIdToken: vi.fn(async (token: string) =>
      token === 'other-token' ? { uid: 'other-user' } : { uid: 'test-user' },
    ),
  }),
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

vi.mock('../services/email-generator.js', () => ({
  generateFollowUpDraft: vi.fn(async (req: any) => ({
    subject: `Re: Your question ${req.attendeeName}`,
    body: `Hi ${req.attendeeName}, thanks for joining!`,
  })),
}));

import { app } from '../app.js';
import bufferService from '../services/buffer-service.js';
import { getDrafts } from '../services/chat-engine.js';

const KB_CHUNKS = [{ text: 'The starter plan costs $29/month with unlimited seats.', embedding: [1, 0] }];

describe('Chatbot Routes', () => {
  beforeEach(() => {
    (bufferService as any).buffer.clear();
    vi.clearAllMocks();
    openai.embeddingsCreate.mockResolvedValue({ data: [{ embedding: [1, 0] }] });
    openai.chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              shouldRespond: true,
              message: 'Our starter plan is $29/month with unlimited seats.',
              type: 'answer',
              confidence: 0.9,
            }),
          },
        },
      ],
    });
  });

  it('rejects requests without a token', async () => {
    const res = await request(app)
      .post('/api/chatbot/session/start')
      .send({ sessionId: 's1', meetingId: 'm1', companyName: 'Acme', knowledgeChunks: KB_CHUNKS, apiKey: 'k' });
    expect(res.status).toBe(401);
  });

  it('runs the full session happy path: start -> segments -> drafts -> approve -> emails -> followups -> end', async () => {
    const auth = { Authorization: 'Bearer test-token' };

    const start = await request(app)
      .post('/api/chatbot/session/start')
      .set(auth)
      .send({ sessionId: 's1', meetingId: 'm1', companyName: 'Acme Inc', knowledgeChunks: KB_CHUNKS, apiKey: 'k' });
    expect(start.status).toBe(200);
    expect(start.body).toEqual({ status: 'success', sessionId: 's1' });

    const segments = await request(app)
      .post('/api/chatbot/segments')
      .set(auth)
      .send({
        sessionId: 's1',
        segments: [{ speaker: 'Sarah', text: 'How much does the starter plan cost? my email is sarah@techcorp.com', timestamp: 't1' }],
        apiKey: 'k',
      });
    expect(segments.status).toBe(200);
    expect(segments.body.status).toBe('success');
    expect(segments.body.drafts).toHaveLength(1);
    expect(segments.body.drafts[0]).toMatchObject({
      type: 'answer',
      speakerName: 'Sarah',
      triggerSegment: 'How much does the starter plan cost? my email is sarah@techcorp.com',
    });

    const drafts = await request(app).get('/api/chatbot/drafts/s1').set(auth);
    expect(drafts.status).toBe(200);
    expect(drafts.body).toHaveLength(1);
    expect(drafts.body[0].approved).toBe(false);
    const draftId = drafts.body[0].id;

    const approve = await request(app).post(`/api/chatbot/approve/s1/${draftId}`).set(auth);
    expect(approve.status).toBe(200);
    expect(approve.body).toEqual({ status: 'success' });

    const storedAfterApprove = await getDrafts('s1');
    expect(storedAfterApprove[0].approved).toBe(true);

    const emails = await request(app).get('/api/chatbot/emails/s1').set(auth);
    expect(emails.status).toBe(200);
    expect(emails.body).toEqual([
      expect.objectContaining({ email: 'sarah@techcorp.com', name: 'Sarah' }),
    ]);

    const followups = await request(app)
      .post('/api/chatbot/generate-followups')
      .set(auth)
      .send({
        sessionId: 's1',
        attendees: [{ email: 'sarah@techcorp.com', name: 'Sarah', questions: ['How much does it cost?'] }],
        meetingTopic: 'Q3 Demo',
        apiKey: 'k',
      });
    expect(followups.status).toBe(200);
    expect(followups.body).toEqual({
      status: 'success',
      drafts: [
        { attendeeEmail: 'sarah@techcorp.com', attendeeName: 'Sarah', subject: 'Re: Your question Sarah', body: 'Hi Sarah, thanks for joining!' },
      ],
    });

    const end = await request(app).post('/api/chatbot/session/end').set(auth).send({ sessionId: 's1' });
    expect(end.status).toBe(200);
    expect(end.body).toEqual({ status: 'success', drafts: 1, emails: [expect.objectContaining({ email: 'sarah@techcorp.com' })] });
  });

  it('generates follow-ups in manual mode without a session (companyName + knowledgeContext)', async () => {
    const auth = { Authorization: 'Bearer test-token' };

    const res = await request(app)
      .post('/api/chatbot/generate-followups')
      .set(auth)
      .send({
        attendees: [{ email: 'manual@user.io', name: 'Manual', questions: ['What does it cost?'] }],
        meetingTopic: 'Pasted transcript',
        companyName: 'Acme Inc',
        knowledgeContext: ['The starter plan costs $29/month.'],
        apiKey: 'k',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'success',
      drafts: [
        { attendeeEmail: 'manual@user.io', attendeeName: 'Manual', subject: 'Re: Your question Manual', body: 'Hi Manual, thanks for joining!' },
      ],
    });
  });

  it('returns 400 for generate-followups without a session or companyName', async () => {
    const auth = { Authorization: 'Bearer test-token' };

    const res = await request(app)
      .post('/api/chatbot/generate-followups')
      .set(auth)
      .send({ attendees: [{ email: 'x@y.io' }], meetingTopic: 'T', apiKey: 'k' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown session', async () => {
    const auth = { Authorization: 'Bearer test-token' };
    const res = await request(app)
      .post('/api/chatbot/segments')
      .set(auth)
      .send({ sessionId: 'nope', segments: [{ speaker: 'P', text: 'hi', timestamp: 't1' }], apiKey: 'k' });
    expect(res.status).toBe(404);
  });

  it('rejects access to a session owned by a different user', async () => {
    const auth = { Authorization: 'Bearer test-token' };
    const other = { Authorization: 'Bearer other-token' };

    const start = await request(app)
      .post('/api/chatbot/session/start')
      .set(auth)
      .send({ sessionId: 's2', meetingId: 'm2', companyName: 'Acme Inc', knowledgeChunks: KB_CHUNKS, apiKey: 'k' });
    expect(start.status).toBe(200);

    const res = await request(app).get('/api/chatbot/drafts/s2').set(other);
    expect(res.status).toBe(404);
  });
});