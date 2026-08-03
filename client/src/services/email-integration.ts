import { apiClient } from './api/client';

export type EmailProvider = 'gmail' | 'outlook';

export interface IntegrationInfo {
  provider: EmailProvider;
  connected: boolean;
  email?: string;
  connectedAt?: string;
}

export interface IntegrationStatusResponse {
  integrations: IntegrationInfo[];
}

export const startEmailOAuth = async (provider: EmailProvider, redirect: string): Promise<{ url: string }> => {
  return apiClient.post<{ url: string }>('/email/oauth/start', { provider, redirect });
};

export const getEmailIntegrationStatus = async (): Promise<IntegrationStatusResponse> => {
  return apiClient.get<IntegrationStatusResponse>('/email/oauth/status');
};

export const disconnectEmailIntegration = async (provider: EmailProvider): Promise<{ status: string }> => {
  return apiClient.post<{ status: string }>('/email/oauth/disconnect', { provider });
};
