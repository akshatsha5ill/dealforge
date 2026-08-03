import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { initAuthListener } from './services/firebase/auth';
import { leadAutomationService } from './services/lead-automation';
import { dripWorker } from './services/drip-worker';
import { db } from './services/local-db/db';
import { runAutoBackup } from './services/local-db/backup';
import { initAnalytics } from './services/analytics';
import { initReferrals, retryPendingReferral } from './services/referral';
import { useStore } from './store';
import CookieConsent from './components/common/CookieConsent';
import ToastContainer, { toast } from './components/common/Toast';
import ConfirmDialogContainer from './components/common/ConfirmDialog';
import './index.css';

function App() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [needsBackupPermission, setNeedsBackupPermission] = useState<any>(null);
  useEffect(() => {
    initAuthListener();
    initAnalytics();
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }

    initReferrals().then((benefit) => {
      if (benefit?.benefit === 'meeting_bonus') {
        toast.success('Referral applied! +1 free meeting analysis for 3 months.');
      } else if (benefit?.benefit === 'free_month') {
        toast.success('Referral applied! You have 1 month of Pro credit.');
      }
    });

    const unsubscribeAuth = useStore.subscribe((state, prevState) => {
      if (state.isAuthenticated && !prevState.isAuthenticated) {
        retryPendingReferral();
      }
    });

    const checkBackup = async () => {
      try {
        const handle = await db.settings.get('backup_dir_handle');
        if (!handle || !handle.value) return;

        const lastBackup = await db.settings.get('last_auto_backup');
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        
        if (!lastBackup || Date.now() - (lastBackup.value as number) > SEVEN_DAYS) {
          // Check if we already have permission without prompting
          const opts = { mode: 'readwrite' };
          // @ts-ignore
          if ((await handle.value.queryPermission(opts)) === 'granted') {
            await runAutoBackup(handle.value);
          } else {
            setNeedsBackupPermission(handle.value);
          }
        }
      } catch (err) {
        console.error('Failed to check auto-backup', err);
      }
    };
    checkBackup();

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    leadAutomationService.start();
    dripWorker.start();
    
    return () => {
      leadAutomationService.stop();
      dripWorker.stop();
    };
  }, []);

  const handleAllowBackup = async () => {
    if (needsBackupPermission) {
      const success = await runAutoBackup(needsBackupPermission);
      if (success) {
        toast.success('Weekly backup completed successfully!');
        setNeedsBackupPermission(null);
      } else {
        toast.error('Failed to get permission for backup.');
      }
    }
  };

  return (
    <>
      <RouterProvider router={router} />
      <ToastContainer />
      <ConfirmDialogContainer />
      <CookieConsent />
      {needsBackupPermission && (
        <div className="ds-panel" style={{ position: 'fixed', bottom: '32px', right: '32px', padding: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '300px', boxShadow: '0 8px 32px rgba(168, 119, 20, 0.2)', border: '1px solid var(--secondary)' }}>
          <div className="ds-panel-head" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
            <span className="ds-panel-title">Time for your weekly local backup.</span>
          </div>
          <button onClick={handleAllowBackup} className="ds-btn-primary" style={{ padding: '10px 16px', fontSize: '14px', width: '100%', justifyContent: 'center' }}>Authorize Backup</button>
        </div>
      )}
    </>
  );
}

export default App;
