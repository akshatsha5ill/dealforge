import { NavLink } from 'react-router-dom';
import { Home, Video, Users, Settings, BarChart3, Mail, GitBranch, CreditCard, Activity } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Dashboard', end: true, num: '01' },
  { to: '/dashboard/meetings', icon: Video, label: 'Meetings', num: '02' },
  { to: '/dashboard/leads', icon: Users, label: 'Leads', num: '03' },
  { to: '/dashboard/pipeline', icon: GitBranch, label: 'Pipeline', num: '04' },
  { to: '/dashboard/emails', icon: Mail, label: 'Emails', num: '05' },
  { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', num: '06' },
  { to: '/dashboard/billing', icon: CreditCard, label: 'Billing', num: '07' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings', num: '08' },
];

export default function Sidebar() {
  return (
    <div style={{ 
      width: '280px', 
      height: '100vh', 
      backgroundColor: 'var(--bg-primary)', 
      borderRight: '1px solid var(--border)', 
      display: 'flex', 
      flexDirection: 'column', 
      flexShrink: 0,
      position: 'relative',
      zIndex: 10
    }}>
      <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '24px', color: 'var(--primary)', letterSpacing: '-0.06em', lineHeight: 1 }}>D.</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>DealForge</span>
        </div>
        <span style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--text-muted)' }}>local operating system</span>
      </div>

      <div style={{ padding: '24px 32px 12px' }}>
        <span className="label-text" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>I. Modules</span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
        {navItems.map(({ to, icon: Icon, label, end, num }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            style={({ isActive }) => ({
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
              textDecoration: 'none',
              display: 'grid',
              gridTemplateColumns: '24px 20px 1fr',
              gap: '12px',
              alignItems: 'center',
              padding: '12px 32px',
              fontSize: '14px',
              fontFamily: 'var(--font-body)',
              borderBottom: '1px dotted var(--border)',
              transition: 'background-color 0.2s var(--ease)',
            })}
            onMouseEnter={e => {
              if (e.currentTarget.style.backgroundColor === 'transparent') {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                e.currentTarget.style.paddingLeft = '40px';
                e.currentTarget.style.paddingRight = '24px';
              }
            }}
            onMouseLeave={e => {
              if (e.currentTarget.style.backgroundColor === 'var(--bg-secondary)' && !e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.paddingLeft = '32px';
                e.currentTarget.style.paddingRight = '32px';
              }
            }}
          >
            {({ isActive }) => (
              <>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{num}</span>
                <Icon size={16} color={isActive ? "var(--primary)" : "currentColor"} />
                <span style={{ fontStyle: isActive ? 'italic' : 'normal', color: isActive ? 'var(--primary)' : 'currentColor' }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      
      <div style={{ marginTop: 'auto', padding: '32px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'right' }}>
        v3.0.4
      </div>
    </div>
  );
}
