import { apiClient } from '../api/client';

export const analyzeMeeting = async (transcript: string, meetingId: string, apiKey: string, model: string) => {
  const response = await apiClient.post<{ status: string; analysis: any }>('/ai/analyze', {
    transcript,
    meetingId,
    apiKey,
    model: model || 'openai',
  });
  return response.analysis;
};

export const generateEmailDraft = async (transcript: string, leadContext: Record<string, any>, apiKey: string, model: string) => {
  const response = await apiClient.post<{ status: string; draft: any }>('/email/draft', {
    transcript,
    leadContext,
    apiKey,
    model: model || 'openai',
  });
  return response.draft;
};

export const sendEmail = async (to: string, subject: string, body: string, emailApiKey: string, campaignId?: string) => {
  const response = await apiClient.post<{ status: string; data: any }>('/email/send', {
    to,
    subject,
    body,
    emailApiKey,
    campaignId,
  });
  return response;
};

export const scoreLead = async (transcript: string, leadContext: Record<string, any>, apiKey: string, model: string) => {
  const response = await apiClient.post<{ status: string; score: any }>('/ai/score', {
    transcript,
    leadContext,
    apiKey,
    model: model || 'openai',
  });
  return response.score;
};
