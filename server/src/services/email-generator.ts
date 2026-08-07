import OpenAI from 'openai';
import { config } from '../config.js';
import { AppError } from '../middleware/errorHandler.js';
import log from '../utils/logger.js';

export interface FollowUpRequest {
  attendeeEmail: string;
  attendeeName: string;
  questionsAsked: string[];
  meetingTopic: string;
  companyName: string;
  knowledgeContext: string[];
  apiKey: string;
}

export interface FollowUpDraft {
  subject: string;
  body: string;
}

const buildPrompt = (req: FollowUpRequest): string => {
  const questions = req.questionsAsked.length
    ? req.questionsAsked.map((q) => `- ${q}`).join('\n')
    : '- (no specific questions recorded)';
  const context = req.knowledgeContext.length
    ? req.knowledgeContext.join('\n\n')
    : '(no product context available — keep answers general and avoid fabrication)';
  return `Write a personalized follow-up email from a sales rep to ${req.attendeeName}.

Context: They attended a webinar about ${req.meetingTopic} and asked these questions:
${questions}

Use this product information to provide FULL answers (unlike the partial in-meeting responses):
${context}

The email should:
1. Thank them for attending
2. Reference their specific questions
3. Provide complete, helpful answers
4. Include a clear CTA (book a demo, start a trial, etc.)
5. Be warm, professional, 150-250 words

Return ONLY a JSON object with the shape:
{
  "subject": "short subject line, at most 10 words, no emojis",
  "body": "the full email body"
}`;
};

export async function generateFollowUpDraft(req: FollowUpRequest): Promise<FollowUpDraft> {
  const client = new OpenAI({ apiKey: req.apiKey });
  const model = config.ai.openaiModel || 'gpt-4o-mini';
  const response = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a professional sales assistant drafting a follow-up email.' },
      { role: 'user', content: buildPrompt(req) },
    ],
  });
  const content = response.choices[0]?.message?.content || '';
  if (!content) {
    throw new AppError('Empty response from AI email generation', 500);
  }
  try {
    const parsed = JSON.parse(content) as Partial<FollowUpDraft>;
    if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
      throw new Error('Missing subject or body');
    }
    const subject = parsed.subject.trim().replace(/\.+$/, '');
    log.info('Follow-up email generated', { attendeeEmail: req.attendeeEmail });
    return { subject, body: parsed.body.trim() };
  } catch (err) {
    throw new AppError('Failed to parse AI email response as JSON', 500);
  }
}