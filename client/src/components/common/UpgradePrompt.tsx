import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Lock, Zap } from 'lucide-react';
import { FEATURE_LABELS, FeatureKey, FEATURE_MIN_PLAN } from '../../services/feature-gate';
import { SubscriptionPlan } from '../../types/billing';
import { trackEvent } from '../../services/usage-analytics';

interface UpgradePromptProps {
  feature?: FeatureKey | string;
  description?: string;
  minPlan?: SubscriptionPlan;
  compact?: boolean;
}

export default function UpgradePrompt({ feature, description, minPlan, compact }: UpgradePromptProps) {
  const navigate = useNavigate();
  const requiredPlan = minPlan || (feature && feature in FEATURE_MIN_PLAN ? FEATURE_MIN_PLAN[feature as FeatureKey] : 'pro');
  const featureLabel = feature && feature in FEATURE_LABELS ? FEATURE_LABELS[feature as FeatureKey] : feature;
  const planLabel = requiredPlan === 'enterprise' ? 'Enterprise' : 'Pro';

  useEffect(() => {
    trackEvent('upgrade_prompt_shown');
  }, []);

  const handleUpgrade = () => {
    trackEvent('upgrade_prompt_clicked');
    navigate('/dashboard/billing');
  };

  return (
    <div
      className="ds-panel"
      style={{
        padding: compact ? '20px' : '32px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        border: '1px dashed var(--border)',
      }}
    >
      <div
        style={{
          width: compact ? '36px' : '44px',
          height: compact ? '36px' : '44px',
          borderRadius: '10px',
          backgroundColor: 'rgba(168, 119, 20, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lock size={compact ? 16 : 20} style={{ color: 'var(--secondary)' }} />
      </div>
      <div>
        <p style={{ fontSize: compact ? '15px' : '17px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
          {featureLabel || 'This feature'} is a {planLabel} feature
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>
          {description || `Upgrade to ${planLabel} to unlock unlimited ${featureLabel ? featureLabel.toLowerCase() : 'access'}.`}
        </p>
      </div>
      <button
        onClick={handleUpgrade}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 20px',
          backgroundColor: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--text-primary)'; }}
      >
        <Zap size={14} /> Upgrade to {planLabel}
      </button>
    </div>
  );
}
