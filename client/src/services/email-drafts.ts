import { db } from './local-db/db';
import { EmailDraft } from '../types';

export interface DraftMeeting {
  meetingId: string;
  meetingTopic?: string;
  count: number;
  createdAt: string;
}

export const saveDrafts = async (drafts: EmailDraft[]): Promise<void> => {
  if (drafts.length === 0) return;
  const existing = await db.email_drafts.bulkGet(drafts.map((d) => d.id));
  const fresh = drafts.filter((_, i) => !existing[i]);
  if (fresh.length > 0) {
    await db.email_drafts.bulkPut(fresh);
  }
};

export const getDrafts = async (): Promise<EmailDraft[]> => {
  const drafts = await db.email_drafts.toArray();
  return drafts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const getDraftsByMeeting = async (meetingId: string): Promise<EmailDraft[]> => {
  const drafts = await db.email_drafts.where('meetingId').equals(meetingId).toArray();
  return drafts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const getMeetings = async (): Promise<DraftMeeting[]> => {
  const drafts = await db.email_drafts.toArray();
  const map = new Map<string, DraftMeeting>();
  for (const d of drafts) {
    const cur = map.get(d.meetingId);
    if (!cur) {
      map.set(d.meetingId, { meetingId: d.meetingId, meetingTopic: d.meetingTopic, count: 1, createdAt: d.createdAt });
    } else {
      cur.count += 1;
      if (d.createdAt > cur.createdAt) cur.createdAt = d.createdAt;
      if (d.meetingTopic && !cur.meetingTopic) cur.meetingTopic = d.meetingTopic;
    }
  }
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const updateDraft = async (id: string, patch: Partial<EmailDraft>): Promise<void> => {
  await db.email_drafts.update(id, patch);
};

export const markSent = async (id: string, sentAt?: string): Promise<void> => {
  await db.email_drafts.update(id, { status: 'sent', sentAt: sentAt || new Date().toISOString() });
};
