import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useStore } from '../../store';
import { logoutUser } from '../../services/firebase/auth';

export default function Header() {
  const user = useStore((state) => state.user);
  const logout = useStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutUser();
      logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <header style={{ 
      height: '70px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'flex-end', 
      padding: '0 32px', 
      backgroundColor: 'var(--bg-primary)', 
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          {user?.email || 'user@example.com'}
        </span>
        <div style={{ 
          width: '36px', 
          height: '36px', 
          backgroundColor: 'var(--bg-secondary)', 
          border: '1px solid var(--border)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: 'var(--text-primary)', 
          fontWeight: '500', 
          fontSize: '14px',
          fontFamily: 'var(--font-display)'
        }}>
          {initials}
        </div>
        <button
          onClick={handleLogout}
          className="ds-btn-ghost"
          style={{ padding: '8px', display: 'flex', alignItems: 'center', borderBottom: 'none' }}
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
