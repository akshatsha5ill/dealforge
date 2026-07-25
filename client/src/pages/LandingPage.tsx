import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Activity, Calendar, Zap, Mail, Shield } from 'lucide-react';
import { useStore } from '../store';

export default function LandingPage() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const isAuthReady = useStore((state) => state.isAuthReady);
  
  if (isAuthReady && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* Masthead */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '18px 36px 14px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '24px' }}>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', color: 'var(--primary)', letterSpacing: '-0.06em', lineHeight: 1 }}>D.</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.015em' }}>DealForge</span>
            <span style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>an industrial operating system for sales</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <Link to="/login" style={{ fontSize: '14px', color: 'var(--text-secondary)', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
              Sign In
            </Link>
            <Link to="/login" className="ds-filter">
              Create Account <span>→</span>
            </Link>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: '-1px', left: 0, height: '2px', background: 'var(--primary)', width: '0%', transition: 'width 0.1s linear' }} id="progress-line"></div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '72px 0 96px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 36px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '72px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '28px' }}>
                <span className="label-text" style={{ color: 'var(--primary)' }}>Currently Operating</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>v3.0.4 · local-first</span>
              </div>
              
              <h1 className="display-text" style={{ fontSize: 'clamp(46px, 7.4vw, 92px)', lineHeight: 0.94, marginBottom: '32px' }}>
                Turn Your Zoom Meetings<br />
                <em>Into Revenue.</em>
              </h1>
              
              <p style={{ fontSize: '19px', lineHeight: 1.55, maxWidth: '560px', marginBottom: '40px', color: 'var(--text-secondary)' }}>
                The ultimate AI-powered CRM that runs right inside your meetings. Automate lead scoring, pipeline management, and follow-up drip campaigns without ever switching tabs.
              </p>
              
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Link to="/login" className="ds-btn-primary">
                  Start Operating <span className="arrow">→</span>
                </Link>
                <Link to="#features" className="ds-btn-ghost">
                  View the architecture
                </Link>
              </div>
            </div>
            
            <aside style={{ borderLeft: '1px solid var(--border)', paddingLeft: '36px' }}>
              <div style={{ fontSize: '11px', fontVariant: 'small-caps', letterSpacing: '0.12em', color: 'var(--text-muted)', paddingBottom: '14px', borderBottom: '1px solid var(--border)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="label-text">The Architecture</span>
                <em style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '12px', fontVariant: 'normal', letterSpacing: 0, textTransform: 'none' }}>three core pillars</em>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  { id: '01', title: 'AI Lead Scoring', desc: 'Live sentiment analysis', state: 'active' },
                  { id: '02', title: 'Pipeline Velocity', desc: 'Visual board management', state: 'active' },
                  { id: '03', title: 'Automated Drips', desc: 'Hyper-personalized sequences', state: 'active' }
                ].map((item, idx) => (
                  <li key={idx} style={{ display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: '14px', alignItems: 'baseline', padding: '14px 0', borderBottom: '1px dotted var(--border)', fontSize: '14px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.margin = '0 -8px'; e.currentTarget.style.paddingLeft = '8px'; e.currentTarget.style.paddingRight = '8px'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.margin = '0'; e.currentTarget.style.paddingLeft = '0'; e.currentTarget.style.paddingRight = '0'; }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{item.id}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{item.title} <em style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>({item.desc})</em></span>
                    <span style={{ fontSize: '9px', fontVariant: 'small-caps', letterSpacing: '0.08em', padding: '2px 7px', border: '1px solid var(--tertiary)', color: 'var(--tertiary)', whiteSpace: 'nowrap' }}>{item.state}</span>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: '18px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'right' }}>
                Privacy · Local-First
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Details Section */}
      <section id="features" style={{ padding: '80px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 36px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '48px', alignItems: 'end', paddingBottom: '40px', borderBottom: '1px solid var(--border)', marginBottom: '48px' }}>
            <div>
              <div className="label-text" style={{ color: 'var(--primary)', marginBottom: '14px' }}>II. The Machinery</div>
              <h2 className="display-text" style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.08, maxWidth: '720px', fontWeight: 500 }}>
                Data processing, <em>made rigorous.</em>
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '560px', marginTop: '14px' }}>
                Every meeting is an asset. DealForge extracts commitments, scores intent, and drafts follow-ups automatically.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px' }}>
             {[
              { icon: <Zap size={24} />, num: 'i.', title: 'AI Lead Scoring', desc: 'Automatically score prospects based on live conversation context and sentiment analysis.' },
              { icon: <Calendar size={24} />, num: 'ii.', title: 'Pipeline Velocity', desc: 'Track your meetings and deal stages visually to close deals faster than ever.' },
              { icon: <Mail size={24} />, num: 'iii.', title: 'Automated Drips', desc: 'Set up hyper-personalized email sequences that follow up for you on autopilot.' }
            ].map((feat, idx) => (
              <div key={idx} className="ds-panel">
                <div className="ds-panel-head">
                  <span className="ds-panel-title">{feat.title}</span>
                  <span className="ds-panel-hint" style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontStyle: 'italic' }}>{feat.num}</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--primary)' }}>{feat.icon}</div>
                  <p className="ds-panel-body">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--bg-secondary)', padding: '56px 0 32px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 36px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '48px', marginBottom: '40px' }}>
            <div>
              <h4 className="label-text" style={{ color: 'var(--primary)', marginBottom: '12px' }}>Colophon</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Set in <em>Fraunces</em> for display, <em>Newsreader</em> for body, and <em>JetBrains Mono</em> for code. Built entirely on client-side storage for maximum privacy and performance.
              </p>
            </div>
            <div>
              <h4 className="label-text" style={{ color: 'var(--primary)', marginBottom: '12px' }}>Product</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                <li style={{ padding: '3px 0' }}>Security</li>
                <li style={{ padding: '3px 0' }}>Data Export</li>
              </ul>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span className="label-text">DealForge · v3.0.4</span>
            <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '14px', color: 'var(--primary)' }}>— an industrial tool —</span>
            <span className="label-text">© 2026 DealForge</span>
          </div>
        </div>
      </footer>
      
    </div>
  );
}
