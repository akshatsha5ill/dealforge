import { describe, it, expect, beforeEach, vi } from 'vitest';

const openai = vi.hoisted(() => ({
  chatCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    embeddings = { create: vi.fn() };
    chat = { completions: { create: openai.chatCreate } };
  },
}));

import { generateFollowUpDraft } from './email-generator.js';

describe('email-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs a prompt with attendee details and parses {subject, body}', async () => {
    openai.chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              subject: 'Re: Your pricing question from our demo',
              body: 'Hi Sarah, thanks for joining our Q3 demo...',
            }),
          },
        },
      ],
    });

    const draft = await generateFollowUpDraft({
      attendeeEmail: 'sarah@techcorp.com',
      attendeeName: 'Sarah',
      questionsAsked: ['How much does the starter plan cost?', 'Do you support SSO?'],
      meetingTopic: 'Q3 Product Demo',
      companyName: 'Acme Inc',
      knowledgeContext: ['The starter plan costs $29/month.', 'SSO is available on enterprise.'],
      apiKey: 'key-1',
    });

    expect(draft).toEqual({
      subject: 'Re: Your pricing question from our demo',
      body: 'Hi Sarah, thanks for joining our Q3 demo...',
    });

    const call = openai.chatCreate.mock.calls[0][0];
    expect(call.model).toBe('gpt-4o-mini');
    expect(call.response_format).toEqual({ type: 'json_object' });
    const userPrompt = call.messages[1].content;
    expect(userPrompt).toContain('Sarah');
    expect(userPrompt).toContain('Q3 Product Demo');
    expect(userPrompt).toContain('How much does the starter plan cost?');
    expect(userPrompt).toContain('The starter plan costs $29/month.');
  });

  it('throws when AI output is not JSON', async () => {
    openai.chatCreate.mockResolvedValue({
      choices: [{ message: { content: 'not json' } }],
    });
    await expect(
      generateFollowUpDraft({
        attendeeEmail: 'a@b.com',
        attendeeName: 'A',
        questionsAsked: [],
        meetingTopic: 'Demo',
        companyName: 'Acme Inc',
        knowledgeContext: [],
        apiKey: 'key-1',
      }),
    ).rejects.toThrow('Failed to parse');
  });

  it('throws when JSON is missing subject or body', async () => {
    openai.chatCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ subject: 'only subject' }) } }],
    });
    await expect(
      generateFollowUpDraft({
        attendeeEmail: 'a@b.com',
        attendeeName: 'A',
        questionsAsked: [],
        meetingTopic: 'Demo',
        companyName: 'Acme Inc',
        knowledgeContext: [],
        apiKey: 'key-1',
      }),
    ).rejects.toThrow('Failed to parse');
  });
});