import { useState, useEffect } from 'react';
import { db } from '../../services/local-db/db';
import { Mail, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export interface EmailProviderConfig {
  type: 'gmail' | 'outlook' | 'none';
  connected: boolean;
  email?: string;
  connectedAt?: number;
}

export function EmailIntegrationSettings() {
  const [provider, setProvider] = useState<EmailProviderConfig>({ type: 'none', connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProvider = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isSuccess = urlParams.get('oauth_success');
      
      if (isSuccess === 'true') {
        const providerType = urlParams.get('provider') as 'gmail' | 'outlook';
        const email = urlParams.get('email') || '';
        
        const config: EmailProviderConfig = {
          type: providerType,
          connected: true,
          email,
          connectedAt: Date.now()
        };
        await db.settings.put({ key: 'email_provider', value: config });
        setProvider(config);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        const stored = await db.settings.get('email_provider');
        if (stored && stored.value) {
          setProvider(stored.value);
        }
      }
      setLoading(false);
    };
    loadProvider();
  }, []);

  const connectProvider = async (type: 'gmail' | 'outlook') => {
    setLoading(true);
    // Redirect to real OAuth flow on the server
    window.location.href = `/api/email/oauth/${type}?redirect=${encodeURIComponent(window.location.href)}`;
  };

  const disconnectProvider = async () => {
    if (!confirm('Are you sure you want to disconnect your email provider?')) return;
    setLoading(true);
    const config: EmailProviderConfig = { type: 'none', connected: false };
    await db.settings.put({ key: 'email_provider', value: config });
    setProvider(config);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="ds-panel" style={{ padding: '28px', gridColumn: '1 / -1' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Mail size={18} /> Email Integration (OAuth)
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="ds-panel" style={{ padding: '28px', gridColumn: '1 / -1' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Mail size={18} /> Email Integration (OAuth)
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
        Connect your Gmail or Outlook account to send emails directly from DealForge. This overrides the Resend API key.
      </p>

      {provider.connected ? (
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--success)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={20} color="var(--success)" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px', textTransform: 'capitalize' }}>
                {provider.type} Connected
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Authenticated as <strong style={{ color: 'var(--text-primary)' }}>{provider.email}</strong>
              </p>
            </div>
          </div>
          <button onClick={disconnectProvider} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
            Disconnect
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/c/ca/Google_workspace_icon.svg" alt="Google Workspace" style={{ width: '48px', height: '48px', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Google Workspace</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Connect via Gmail OAuth 2.0</p>
            <button onClick={() => connectProvider('gmail')} style={{ padding: '10px 20px', backgroundColor: '#fff', color: '#000', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" style={{ width: '16px' }} /> Connect Google
            </button>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg" alt="Microsoft 365" style={{ width: '48px', height: '48px', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Microsoft 365</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Connect via Outlook OAuth 2.0</p>
            <button onClick={() => connectProvider('outlook')} style={{ padding: '10px 20px', backgroundColor: '#0078D4', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'center' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="M" style={{ width: '16px' }} /> Connect Outlook
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}
