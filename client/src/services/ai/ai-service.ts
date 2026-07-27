import { apiClient } from '../api/client';

import { AIFactory } from './ai-providers';

export const analyzeMeeting = async (transcript: string, meetingId: string, apiKey: string, model: string) => {
  const provider = AIFactory.getProvider(model || 'openai', apiKey);
  return await provider.analyzeMeeting(transcript);
};

export const generateEmailDraft = async (transcript: string, leadContext: Record<string, any>, apiKey: string, model: string) => {
  const provider = AIFactory.getProvider(model || 'openai', apiKey);
  return await provider.generateEmailDraft!(transcript, leadContext);
};

export const sendEmail = async (to: string, subject: string, body: string, emailApiKey: string, campaignId?: string) => {
  // Directly send email from client to Resend via API instead of proxying through server
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${emailApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Acme <onboarding@resend.dev>',
      to,
      subject,
      html: body
    })
  });
  return res.json();
};

export const scoreLead = async (transcript: string, leadContext: Record<string, any>, apiKey: string, model: string) => {
  const provider = AIFactory.getProvider(model || 'openai', apiKey);
  return await provider.scoreLead(transcript, leadContext);
};
