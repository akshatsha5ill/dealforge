export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface AnalysisSentiment {
  overall: string;
  score: number;
  notes: string;
}

export interface AnalysisEmailDraft {
  subject: string;
  body: string;
}

export interface DealNote {
  text: string;
  author: string;
  createdAt: string;
}

export interface EmailSequenceStep {
  subject: string;
  body: string;
  delayDays: number;
}

export interface Transcript {
  id: string;
  meetingId: string;
  segments: TranscriptSegment[];
  fullText: string;
  createdAt: Date;
}

export interface Analysis {
  id: string;
  meetingId: string;
  summary: string;
  actionItems: string[];
  sentiment: AnalysisSentiment;
  leadScore: number;
  emailDraft: AnalysisEmailDraft | null;
  modelUsed: string;
  analyzedAt: Date;
}

export interface Lead {
  id: string;
  meetingId: string;
  name: string;
  email: string;
  company: string;
  role: string;
  score: number;
  stage: string;
  tags?: string[];
  customFields?: Record<string, string | number | boolean>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  leadId: string;
  title: string;
  stage: string;
  value: number;
  probability: number;
  expectedClose: Date;
  notes: DealNote[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailCampaign {
  id: string;
  leadId: string;
  subject: string;
  body: string;
  status: string;
  type: string;
  sequence: EmailSequenceStep[];
  scheduledAt: Date;
  sentAt?: Date;
}

export interface EmailTracking {
  id: string;
  campaignId: string;
  opens: number;
  clicks: number;
  replied: boolean;
  lastActivity: Date;
}
