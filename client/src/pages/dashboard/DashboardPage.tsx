import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Send, PenLine, Users, ArrowRight, Zap, BookOpen, Mail } from 'lucide-react';
import { db } from '../../services/local-db/db';
import { useStore } from '../../store';
import { getMonthlyAnalyzedCount } from '../../services/usage';
import { getPlan } from '../../services/feature-gate';
import { getEffectiveMeetingLimit, initReferrals } from '../../services/referral';
import { getMeetings, DraftMeeting } from '../../services/email-drafts';

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const plan = useStore((state) => state.subscription?.plan);
  const [stats, setStats] = useState({ documents: 0, emailsSent: 0, emailsDrafted: 0, meetingSessions: 0 });
  const [recentSessions, setRecentSessions] = useState<DraftMeeting[]>([]);
  const [monthlyUsed, setMonthlyUsed] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const [documents, drafts, used] = await Promise.all([
        db.kb_documents.count(),
        db.email_drafts.toArray(),
        getMonthlyAnalyzedCount(),
      ]);
      setStats({
        documents,
        emailsSent: drafts.filter((d) => d.status === 'sent').length,
        emailsDrafted: drafts.length,
        meetingSessions: new Set(drafts.map((d) => d.meetingId)).size,
      });
      setRecentSessions(await getMeetings());
      setMonthlyUsed(used);
      await initReferrals();
    };
    fetchData();
  }, []);

  const currentPlan = getPlan(plan);
  const meetingLimit = getEffectiveMeetingLimit(currentPlan);
  const isFree = currentPlan === 'free';
  const statCards = [
    { label: 'Documents Uploaded', value: stats.documents, icon: FileText, color: 'var(--accent-primary)' },
    { label: 'Emails Sent', value: stats.emailsSent, icon: Send, color: 'var(--success)' },
    { label: 'Emails Drafted', value: stats.emailsDrafted, icon: PenLine, color: 'var(--warning)' },
    { label: 'Meetings with Chatbot', value: stats.meetingSessions, icon: Users, color: 'var(--danger)' },
  ];

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Welcome back. Here's your sales overview.</p>
      </div>

      {/* Free plan usage banner */}
      {isFree && meetingLimit !== null && (
        <div className="ds-panel" style={{ padding: '20px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', border: '1px solid rgba(168, 119, 20, 0.35)' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Free plan — {monthlyUsed}/{meetingLimit} meetings analyzed this month
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {monthlyUsed >= meetingLimit ? 'Limit reached' : `${meetingLimit - monthlyUsed} remaining`}
              </span>
            </div>
            <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (monthlyUsed / meetingLimit) * 100)}%`,
                  backgroundColor: monthlyUsed >= meetingLimit ? 'var(--danger)' : 'var(--secondary)',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/billing')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 18px', backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            <Zap size={14} /> Upgrade for Unlimited
          </button>
        </div>
      )}

      {/* Empty knowledge base CTA */}
      {stats.documents === 0 && (
        <div className="ds-panel" style={{ padding: '28px 32px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookOpen size={22} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Upload your first document</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Add product docs, FAQs, and pricing so the AI chatbot can answer attendee questions during live meetings.
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/knowledge-base')}
            className="ds-btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Go to Knowledge Base <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '30px' }}>
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="ds-panel stat-card" style={{ padding: '20px', cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>{label}</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div className="data-text" style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Recent meeting sessions */}
      <div className="ds-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Recent meeting sessions</h3>
          {recentSessions.length > 0 && (
            <button onClick={() => navigate('/dashboard/email-drafts')} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View all <ArrowRight size={14} />
            </button>
          )}
        </div>
        {recentSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <Mail size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No meeting sessions yet. Run a live meeting with the AI chatbot to start generating follow-up emails.</p>
          </div>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meeting</th>
                <th style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                <th style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Emails</th>
                <th style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((m) => (
                <tr key={m.meetingId} style={{ cursor: 'pointer', transition: 'background-color 0.2s' }} onClick={() => navigate('/dashboard/email-drafts')} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>{m.meetingTopic || 'Untitled meeting'}</td>
                  <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{formatDate(m.createdAt)}</td>
                  <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, backgroundColor: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent-primary)' }}>
                      {m.count} {m.count === 1 ? 'email' : 'emails'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <button onClick={(e) => { e.stopPropagation(); navigate('/dashboard/email-drafts'); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '13px' }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
