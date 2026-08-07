import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import bufferService from './buffer-service.js';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import { extractEmails, collectEmail, getCollectedEmails } from './email-collector.js';
import { generateFollowUpDraft } from './email-generator.js';
import log from '../utils/logger.js';

export interface ChatEngineContext {
  knowledgeChunks: { text: string; embedding: number[] }[];
  companyName: string;
  conversationHistory: { speaker: string; text: string; timestamp: string }[];
}

export interface ChatSegment {
  speaker: string;
  text: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  meetingId: string;
  uid: string;
  companyName: string;
  knowledgeChunks: { text: string; embedding: number[] }[];
  conversationHistory: ChatSegment[];
  ended?: boolean;
  endedAt?: string;
}

export interface DraftResponse {
  id: string;
  type: 'answer' | 'email_request';
  message: string;
  confidence: number;
  triggerSegment: string;
  speakerName: string;
  kbSources: string[];
  createdAt: string;
  approved?: boolean;
}

export interface StoredDraft extends DraftResponse {
  approved: boolean;
}

const sessionKey = (sessionId: string) => `chatbot:session:${sessionId}`;
const draftsKey = (sessionId: string) => `chatbot:drafts:${sessionId}`;
const HISTORY_CAP = 50;
const HISTORY_CONTEXT = 10;
const TOP_K = 3;
const RELEVANCE_THRESHOLD = 0.3;

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const buildSystemPrompt = (companyName: string): string => `You are a sales assistant AI for ${companyName}.

RULES:
1. Only respond when an attendee asks a question about the product/service
2. Give a PARTIAL answer — enough to show expertise but leave them wanting more
3. End with something like "I can share more details after the session — drop your email in the chat!"
4. Be professional, concise (2-3 sentences max)
5. Reference specific features/benefits from the knowledge base
6. Do NOT make up information not in the knowledge base

Respond ONLY with a JSON object:
{
  "shouldRespond": true,
  "message": "the draft message",
  "type": "answer",
  "confidence": 0.0
}`;

interface ChatCompletionJson {
  shouldRespond?: boolean;
  message?: string;
  type?: 'answer' | 'email_request';
  confidence?: number;
}

export async function createSession(params: {
  sessionId: string;
  meetingId: string;
  uid: string;
  knowledgeChunks: { text: string; embedding: number[] }[];
  companyName: string;
  apiKey: string;
}): Promise<ChatSession> {
  const existing = await bufferService.get<ChatSession>(sessionKey(params.sessionId));
  if (existing) {
    throw new AppError('Chat session already exists', 409);
  }
  const session: ChatSession = {
    id: params.sessionId,
    meetingId: params.meetingId,
    uid: params.uid,
    companyName: params.companyName,
    knowledgeChunks: params.knowledgeChunks,
    conversationHistory: [],
  };
  await bufferService.store(sessionKey(params.sessionId), session);
  log.info('Chat session created', { sessionId: params.sessionId, meetingId: params.meetingId, uid: params.uid });
  return session;
}

async function loadSession(sessionId: string): Promise<ChatSession> {
  const session = await bufferService.get<ChatSession>(sessionKey(sessionId));
  if (!session) {
    throw new AppError('Chat session not found', 404);
  }
  return session;
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  return bufferService.get<ChatSession>(sessionKey(sessionId));
}

export async function endSession(sessionId: string): Promise<ChatSession | null> {
  const existing = await bufferService.get<ChatSession>(sessionKey(sessionId));
  if (!existing) return null;
  const ended: ChatSession = { ...existing, ended: true, endedAt: new Date().toISOString() };
  await bufferService.store(sessionKey(sessionId), ended);
  log.info('Chat session ended', { sessionId });
  return ended;
}

function findRelevantChunks(
  session: ChatSession,
  embedding: number[],
): Array<{ text: string; score: number }> {
  return session.knowledgeChunks
    .map((chunk) => ({ text: chunk.text, score: cosineSimilarity(embedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .filter((c) => c.score > RELEVANCE_THRESHOLD);
}

async function embedText(client: OpenAI, text: string): Promise<number[]> {
  const res = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

async function processSegment(
  session: ChatSession,
  segment: ChatSegment,
  apiKey: string,
): Promise<DraftResponse | null> {
  const client = new OpenAI({ apiKey });
  const embedding = await embedText(client, segment.text);
  const relevant = findRelevantChunks(session, embedding);
  if (relevant.length === 0) {
    return null;
  }

  const recentHistory = session.conversationHistory.slice(-HISTORY_CONTEXT);
  const historyText = recentHistory.map((h) => `${h.speaker}: ${h.text}`).join('\n') || '(none yet)';
  const kbContext = relevant.map((c) => `- ${c.text}`).join('\n');
  const model = config.ai.openaiModel || 'gpt-4o-mini';

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt(session.companyName) },
      {
        role: 'user',
        content: `KNOWLEDGE BASE CONTEXT:\n${kbContext}\n\nRECENT CONVERSATION:\n${historyText}\n\nATTENDEE QUESTION:\n"${segment.text}"\n\nDraft a partial, curiosity-driving response:`,
      },
    ],
  });
  const content = completion.choices[0]?.message?.content || '';
  let parsed: ChatCompletionJson;
  try {
    parsed = JSON.parse(content) as ChatCompletionJson;
  } catch {
    throw new AppError('Failed to parse AI draft response as JSON', 500);
  }
  if (parsed.shouldRespond === false) {
    return null;
  }
  const type: 'answer' | 'email_request' = parsed.type === 'email_request' ? 'email_request' : 'answer';
  const draft: DraftResponse = {
    id: randomUUID(),
    type,
    message: parsed.message || '',
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
    triggerSegment: segment.text,
    speakerName: segment.speaker || 'Attendee',
    kbSources: relevant.map((r) => r.text),
    createdAt: new Date().toISOString(),
  };

  const list = await getStoredDrafts(session.id);
  await bufferService.store(draftsKey(session.id), [...list, { ...draft, approved: false }]);
  (global as any).__io?.to(`meeting:${session.meetingId}`).emit('draft_response', draft);
  log.info('Draft response generated', { sessionId: session.id, draftId: draft.id, type });
  return draft;
}

export async function processSegments(
  sessionId: string,
  newSegments: ChatSegment[],
  apiKey: string,
): Promise<DraftResponse[]> {
  const session = await loadSession(sessionId);
  if (session.ended) {
    throw new AppError('Chat session has ended', 400);
  }

  const appended = [...session.conversationHistory, ...newSegments].slice(-HISTORY_CAP);
  await bufferService.store(sessionKey(sessionId), { ...session, conversationHistory: appended });

  const drafts: DraftResponse[] = [];
  for (const segment of newSegments) {
    const draft = await processSegment(session, segment, apiKey);
    if (draft) drafts.push(draft);
  }
  return drafts;
}

async function getStoredDrafts(sessionId: string): Promise<StoredDraft[]> {
  return (await bufferService.get<StoredDraft[]>(draftsKey(sessionId))) || [];
}

export async function getDrafts(sessionId: string): Promise<StoredDraft[]> {
  await loadSession(sessionId);
  return getStoredDrafts(sessionId);
}

export async function approveDraft(sessionId: string, draftId: string): Promise<StoredDraft> {
  const list = await getDrafts(sessionId);
  const target = list.find((d) => d.id === draftId);
  if (!target) {
    throw new AppError('Draft not found', 404);
  }
  const updated = list.map((d) => (d.id === draftId ? { ...d, approved: true } : d));
  await bufferService.store(draftsKey(sessionId), updated);
  log.info('Draft approved', { sessionId, draftId });
  return updated.find((d) => d.id === draftId) as StoredDraft;
}

export async function collectEmailsFromSegments(
  sessionId: string,
  segments: ChatSegment[],
): Promise<void> {
  for (const segment of segments) {
    for (const email of extractEmails(segment.text)) {
      await collectEmail(email, segment.speaker, sessionId);
    }
  }
}

export async function generateFollowUps(params: {
  sessionId: string;
  attendees: { email: string; name: string; questions: string[] }[];
  meetingTopic: string;
  apiKey: string;
}): Promise<Array<{ attendeeEmail: string; attendeeName: string; subject: string; body: string }>> {
  const session = await loadSession(params.sessionId);
  const knowledgeContext = session.knowledgeChunks.map((c) => c.text);
  const results: Array<{ attendeeEmail: string; attendeeName: string; subject: string; body: string }> = [];
  for (const attendee of params.attendees) {
    const draft = await generateFollowUpDraft({
      attendeeEmail: attendee.email,
      attendeeName: attendee.name,
      questionsAsked: attendee.questions,
      meetingTopic: params.meetingTopic,
      companyName: session.companyName,
      knowledgeContext,
      apiKey: params.apiKey,
    });
    results.push({
      attendeeEmail: attendee.email,
      attendeeName: attendee.name,
      subject: draft.subject,
      body: draft.body,
    });
  }
  return results;
}

export { getCollectedEmails };
