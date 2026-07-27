import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { MEETING_ANALYSIS_PROMPT, EMAIL_DRAFT_PROMPT, LEAD_SCORING_PROMPT } from './prompts';

export interface AIProvider {
  analyzeMeeting(transcript: string): Promise<any>;
  generateEmailDraft?(transcript: string, context: any): Promise<any>;
  scoreLead(transcript: string, leadContext: any): Promise<any>;
}

const parseAIResponse = (text: string) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    return parsed;
  } catch (err) {
    throw new Error('Failed to parse AI response as JSON');
  }
};

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async analyzeMeeting(transcript: string) {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MEETING_ANALYSIS_PROMPT },
        { role: "user", content: transcript }
      ],
    });
    return parseAIResponse(response.choices[0].message.content || '');
  }
  
  async generateEmailDraft(transcript: string, context: any) {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EMAIL_DRAFT_PROMPT },
        { role: "user", content: `Context: ${JSON.stringify(context)}\nTranscript: ${transcript}` }
      ],
    });
    return parseAIResponse(response.choices[0].message.content || '');
  }

  async scoreLead(transcript: string, leadContext: any) {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: LEAD_SCORING_PROMPT },
        { role: "user", content: `Lead Context: ${JSON.stringify(leadContext)}\nTranscript: ${transcript}` }
      ],
    });
    return parseAIResponse(response.choices[0].message.content || '');
  }
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyzeMeeting(transcript: string) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.client.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: MEETING_ANALYSIS_PROMPT,
        messages: [
          { role: "user", content: transcript },
          { role: "assistant", content: "{" }
        ]
      })
    });
    const data = await response.json();
    return parseAIResponse("{" + (data.content?.[0]?.text || ''));
  }

  async generateEmailDraft(transcript: string, context: any) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.client.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: EMAIL_DRAFT_PROMPT,
        messages: [
          { role: "user", content: `Context: ${JSON.stringify(context)}\nTranscript: ${transcript}` },
          { role: "assistant", content: "{" }
        ]
      })
    });
    const data = await response.json();
    return parseAIResponse("{" + (data.content?.[0]?.text || ''));
  }

  async scoreLead(transcript: string, leadContext: any) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.client.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: LEAD_SCORING_PROMPT,
        messages: [
          { role: "user", content: `Lead Context: ${JSON.stringify(leadContext)}\nTranscript: ${transcript}` },
          { role: "assistant", content: "{" }
        ]
      })
    });
    const data = await response.json();
    return parseAIResponse("{" + (data.content?.[0]?.text || ''));
  }
}

export class GeminiProvider implements AIProvider {
  private client: GoogleGenAI;
  
  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async analyzeMeeting(transcript: string) {
    const response = await this.client.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: transcript,
      config: {
        systemInstruction: MEETING_ANALYSIS_PROMPT,
        responseMimeType: "application/json"
      }
    });
    return parseAIResponse(response.text || '');
  }

  async generateEmailDraft(transcript: string, context: any) {
    const response = await this.client.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: `Context: ${JSON.stringify(context)}\nTranscript: ${transcript}`,
      config: {
        systemInstruction: EMAIL_DRAFT_PROMPT,
        responseMimeType: "application/json"
      }
    });
    return parseAIResponse(response.text || '');
  }

  async scoreLead(transcript: string, leadContext: any) {
    const response = await this.client.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: `Lead Context: ${JSON.stringify(leadContext)}\nTranscript: ${transcript}`,
      config: {
        systemInstruction: LEAD_SCORING_PROMPT,
        responseMimeType: "application/json"
      }
    });
    return parseAIResponse(response.text || '');
  }
}

export class AIFactory {
  static getProvider(model: string, apiKey: string): AIProvider {
    switch(model) {
      case 'openai': return new OpenAIProvider(apiKey);
      case 'anthropic': return new AnthropicProvider(apiKey);
      case 'gemini': return new GeminiProvider(apiKey);
      default: return new OpenAIProvider(apiKey);
    }
  }
}
