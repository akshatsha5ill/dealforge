import { NavLink } from 'react-router-dom';
import { Home, BookOpen, Mail, CreditCard, Settings } from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Dashboard', end: true, num: '01' },
  { to: '/dashboard/knowledge-base', icon: BookOpen, label: 'Knowledge Base', num: '02' },
  { to: '/dashboard/email-drafts', icon: Mail, label: 'Email Drafts', num: '03' },
  { to: '/dashboard/billing', icon: CreditCard, label: 'Billing', num: '04' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings', num: '05' },
];

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">D.</span>
          <span className="sidebar-brand-name">DealForge</span>
        </div>
        <span className="sidebar-brand-tagline">local operating system</span>
      </div>

      <div className="sidebar-section-label">
        <span className="label-text" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>I. Modules</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label, end, num }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="sidebar-link-num">{num}</span>
                <Icon size={16} color={isActive ? "var(--primary)" : "currentColor"} />
                <span className="sidebar-link-label">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        v3.0.4
      </div>
    </div>
  );
}
