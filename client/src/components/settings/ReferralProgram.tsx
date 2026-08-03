import { useState, useEffect } from 'react';
import { Gift, Copy, Check, Users, Zap, Crown } from 'lucide-react';
import { useStore } from '../../store';
import {
  getOrCreateReferralCode,
  getReferralShareUrl,
  getActiveMeetingBonusCount,
  getFreeMonthCredits,
  getReferralBenefits,
  fetchReferralStatus,
  trackReferralCreated,
  ReferralStatus,
} from '../../services/referral';
import { toast } from '../common/Toast';

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  marginBottom: '8px',
};

export function ReferralProgram() {
  const user = useStore((state) => state.user);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const c = await getOrCreateReferralCode(user?.uid);
      setCode(c);
      const s = await fetchReferralStatus();
      if (s) setStatus(s);
    };
    load();
  }, [user?.uid]);

  const handleCopy = async () => {
    if (!code) return;
    const url = getReferralShareUrl(code);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    trackReferralCreated();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Referral link copied! Share it with a friend.');
  };

  const meetingBonus = getActiveMeetingBonusCount();
  const freeMonths = getFreeMonthCredits();
  const activeBenefits = getReferralBenefits();
  const referralsMade = status?.referralsMade.length ?? 0;

  return (
    <div className="ds-panel" style={{ padding: '28px', gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gift size={18} /> Referral Program
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
            Invite a colleague. When they sign up with your link, you both get rewarded.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={16} style={{ color: 'var(--secondary)' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Free plan</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Both get +1 meeting analysis/month for 3 months</div>
            </div>
          </div>
        </div>
        <div style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Crown size={16} style={{ color: 'var(--secondary)' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Pro plan</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Both get 1 month free</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div
          className="data-text"
          style={{ padding: '12px 20px', backgroundColor: 'var(--bg-secondary)', border: '1px dashed var(--secondary)', borderRadius: '8px', fontSize: '18px', letterSpacing: '2px', fontWeight: 600, color: 'var(--text-primary)' }}
        >
          {code || '…'}
        </div>
        <button
          onClick={handleCopy}
          disabled={!code}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', backgroundColor: 'var(--accent-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: code ? 'pointer' : 'not-allowed', opacity: code ? 1 : 0.5 }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy Share Link'}
        </button>
      </div>

      {(meetingBonus > 0 || freeMonths > 0) && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Gift size={14} /> Your Rewards
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {meetingBonus > 0 && (
              <div style={{ padding: '10px 16px', backgroundColor: 'rgba(168, 119, 20, 0.12)', border: '1px solid rgba(168, 119, 20, 0.4)', borderRadius: '8px', fontSize: '13px' }}>
                +{meetingBonus} bonus meeting{meetingBonus > 1 ? 's' : ''}/month for 3 months
              </div>
            )}
            {freeMonths > 0 && (
              <div style={{ padding: '10px 16px', backgroundColor: 'rgba(78, 205, 196, 0.12)', border: '1px solid rgba(78, 205, 196, 0.4)', borderRadius: '8px', fontSize: '13px' }}>
                {freeMonths} month{freeMonths > 1 ? 's' : ''} free credit
              </div>
            )}
          </div>
        </div>
      )}

      {activeBenefits.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--text-secondary)' }}>Reward History</h3>
          {activeBenefits.map((b) => (
            <div key={b.id} style={rowStyle}>
              <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>{b.code}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {b.benefit === 'meeting_bonus' ? 'Meeting bonus' : 'Free month'} {b.expiresAt ? `· expires ${new Date(b.expiresAt).toLocaleDateString()}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
          <Users size={14} />
          {referralsMade > 0 ? `${referralsMade} friend${referralsMade > 1 ? 's' : ''} signed up with your link` : 'No one has used your link yet — share it and earn rewards.'}
        </div>
      </div>
    </div>
  );
}
