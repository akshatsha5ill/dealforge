import { AIFactory } from './ai-providers.js';

export const analyzeMeeting = async (transcript: string, model: string, apiKey: string) => {
  const provider = AIFactory.getProvider(model, apiKey);
  return provider.analyzeMeeting(transcript);
};
