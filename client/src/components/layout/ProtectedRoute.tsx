import { ReactNode, useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';
import { db } from '../../services/local-db/db';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const isAuthReady = useStore((state) => state.isAuthReady);
  const location = useLocation();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !isAuthReady) return;

    (async () => {
      try {
        const setting = await db.settings.get('onboarding_complete');
        if (setting?.value) {
          // Already completed onboarding
          setNeedsOnboarding(false);
        } else {
          // Check if this is an existing user with data (old user who predates onboarding)
          const meetingCount = await db.meetings.count();
          if (meetingCount > 0) {
            // Old user — auto-mark onboarding complete, don't bother them
            await db.settings.put({ key: 'onboarding_complete', value: true });
            setNeedsOnboarding(false);
          } else {
            // New user with no data — needs onboarding
            setNeedsOnboarding(true);
          }
        }
      } catch {
        // If IndexedDB fails, don't block the user
        setNeedsOnboarding(false);
      }
      setOnboardingChecked(true);
    })();
  }, [isAuthenticated, isAuthReady]);

  if (!isAuthReady || (isAuthenticated && !onboardingChecked)) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect new users to onboarding, but don't loop if already there
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
