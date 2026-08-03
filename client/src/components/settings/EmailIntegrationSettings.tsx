import { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, CheckCircle, Link2, Unplug } from 'lucide-react';
import {
  EmailProvider,
  IntegrationInfo,
  startEmailOAuth,
  getEmailIntegrationStatus,
  disconnectEmailIntegration,
} from '../../services/email-integration';

const PROVIDER_META: Record<EmailProvider, { name: string; icon: string }> = {
  gmail: {
    name: 'Google Workspace',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg',
  },
  outlook: {
    name: 'Microsoft 365',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg',
  },
};

export function EmailIntegrationSettings() {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await getEmailIntegrationStatus();
      setIntegrations(res.integrations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('oauth_success') === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
      loadStatus();
    }
    if (urlParams.get('oauth_error')) {
      setError(urlParams.get('oauth_error') || 'Failed to connect email provider');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [loadStatus]);

  const connectProvider = async (type: EmailProvider) => {
    setLoading(true);
    try {
      const { url } = await startEmailOAuth(type, window.location.href);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start email connection');
      setLoading(false);
    }
  };

  const disconnect = async (provider: EmailProvider) => {
    if (!confirm('Are you sure you want to disconnect this email provider?')) return;
    setLoading(true);
    try {
      await disconnectEmailIntegration(provider);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect email provider');
    } finally {
      setLoading(false);
    }
  };

  const connected = (provider: EmailProvider) => integrations.find((i) => i.provider === provider)?.connected || false;

  return (
    <div className="ds-panel" style={{ padding: '28px', gridColumn: '1 / -1' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Mail size={18} /> Email Integration (OAuth)
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
        Connect your Gmail or Outlook account to send emails directly from DealForge. This overrides the Resend API key.
      </p>

      {error && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {loading && !integrations.length ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {(Object.keys(PROVIDER_META) as EmailProvider[]).map((type) => {
            const info = integrations.find((i) => i.provider === type);
            const isConnected = connected(type);
            return (
              <div key={type} style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', border: `1px solid ${isConnected ? 'var(--success)' : 'var(--border)'}`, borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <img src={PROVIDER_META[type].icon} alt={PROVIDER_META[type].name} style={{ width: '48px', height: '48px', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>{PROVIDER_META[type].name}</h3>
                {isConnected && info?.email ? (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    Authenticated as <strong style={{ color: 'var(--text-primary)' }}>{info.email}</strong>
                  </p>
                ) : (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Not connected</p>
                )}
                {isConnected ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>
                    <CheckCircle size={16} /> Connected
                  </div>
                ) : null}
                {isConnected ? (
                  <button onClick={() => disconnect(type)} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Unplug size={14} /> Disconnect
                  </button>
                ) : (
                  <button onClick={() => connectProvider(type)} disabled={loading} style={{ padding: '10px 20px', backgroundColor: type === 'gmail' ? '#fff' : '#0078D4', color: type === 'gmail' ? '#000' : '#fff', border: type === 'gmail' ? '1px solid #ddd' : 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
                    <Link2 size={16} /> Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
