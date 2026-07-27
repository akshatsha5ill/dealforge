import { useCookieConsent } from '../../hooks/useCookieConsent';
import { enableAnalytics } from '../../services/analytics';

export default function CookieConsent() {
  const { consented, accept, decline, status } = useCookieConsent();

  if (status !== null) return null;

  const handleAccept = () => {
    enableAnalytics();
    accept();
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        padding: '20px 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
        We use analytics cookies to understand product usage and improve the experience.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={decline}
          className="ds-btn-ghost"
          style={{ fontSize: '13px', padding: '10px 16px', borderBottom: 'none', border: '1px solid var(--border)' }}
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          className="ds-btn-primary"
          style={{ fontSize: '13px', padding: '10px 18px' }}
        >
          Accept
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
