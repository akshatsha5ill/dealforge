import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginWithGoogle, loginWithEmail, registerWithEmail } from '../../services/firebase/auth';
import GoogleIcon from '../../components/GoogleIcon';

const firebaseErrors: Record<string, string> = {
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/popup-closed-by-user': 'Sign-in popup was closed. Try again.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    emailRef.current?.focus();
  }, [isRegister]);

  const resolveError = (err: any) => {
    const code = err?.code as string | undefined;
    return (code && firebaseErrors[code]) || err?.message || 'Authentication failed.';
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err: any) {
      setError(resolveError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(resolveError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister((v) => !v);
    setError('');
    setPassword('');
  };

  const busy = loading || googleLoading;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', position: 'absolute', width: '100%', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '18px 36px 14px', display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '28px', color: 'var(--primary)', letterSpacing: '-0.06em', lineHeight: 1 }}>D.</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', letterSpacing: '-0.015em' }}>DealForge</span>
          </Link>
          <span style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>an industrial operating system for sales</span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '440px', width: '100%' }}>

          <div className="ds-panel">
            <div className="ds-panel-head">
              <span className="ds-panel-title">{isRegister ? 'Initialize Account' : 'Authenticate'}</span>
              <span className="ds-panel-hint">{isRegister ? 'new operator' : 'credentials'}</span>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '15px' }}>
              {isRegister ? 'Create your operator account to begin logging.' : 'Sign in to access your ledger.'}
            </p>

            {error && (
              <div role="alert" style={{ backgroundColor: 'rgba(138, 35, 23, 0.08)', borderLeft: '2px solid var(--primary)', padding: '12px 16px', marginBottom: '24px', color: 'var(--primary)', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                ref={emailRef}
                className="ds-input"
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={busy}
              />
              <div style={{ position: 'relative' }}>
                <input
                  className="ds-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  disabled={busy}
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', padding: '4px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                >
                  {showPassword ? 'hide' : 'show'}
                </button>
              </div>
              <button type="submit" className="ds-btn-primary" style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }} disabled={busy}>
                {loading ? 'Please wait…' : isRegister ? 'Create Account' : 'Sign In'}
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
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border)' }}
              disabled={busy}
            >
              <GoogleIcon width={16} height={16} />
              {googleLoading ? 'Connecting…' : 'Sign in with Google'}
            </button>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
              <button
                onClick={toggleMode}
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
