import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithGoogle, loginWithEmail, registerWithEmail } from '../../services/firebase/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google sign in failed');
    }
  };

  const handleEmailSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Masthead */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', position: 'absolute', width: '100%', top: 0 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '18px 36px 14px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', color: 'var(--primary)', letterSpacing: '-0.06em', lineHeight: 1 }}>D.</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.015em' }}>DealForge</span>
          <span style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>an industrial operating system for sales</span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '440px', width: '100%' }}>
          
          <div className="ds-panel">
            <div className="ds-panel-head">
              <span className="ds-panel-title">{isRegister ? 'Initialize Account' : 'Authenticate'}</span>
              <span className="ds-panel-hint">{isRegister ? 'secure access' : 'credentials'}</span>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '15px' }}>
              {isRegister ? 'Create your operator account to begin logging.' : 'Sign in to access your ledger.'}
            </p>

            {error && (
              <div style={{ backgroundColor: 'rgba(138, 35, 23, 0.08)', borderLeft: '2px solid var(--primary)', padding: '12px 16px', marginBottom: '24px', color: 'var(--primary)', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                className="ds-input"
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="ds-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="ds-btn-primary" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}>
                {isRegister ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', gap: '16px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
              <span className="label-text" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="ds-btn-ghost"
              style={{ width: '100%', textAlign: 'center', border: '1px solid var(--border)' }}
            >
              Sign in with Google
            </button>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                onClick={() => setIsRegister(!isRegister)}
                className="ds-btn-ghost"
                style={{ fontSize: '13px', borderBottom: 'none' }}
              >
                {isRegister ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </button>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
