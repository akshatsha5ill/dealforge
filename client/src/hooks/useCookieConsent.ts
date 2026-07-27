import { useState, useCallback, useEffect } from 'react';
import { readConsent, writeConsent, ConsentStatus } from '../services/cookie-consent';

export function useCookieConsent() {
  const [status, setStatus] = useState<ConsentStatus>(readConsent);

  useEffect(() => {
    setStatus(readConsent());
  }, []);

  const accept = useCallback(() => {
    writeConsent('accepted');
    setStatus('accepted');
  }, []);

  const decline = useCallback(() => {
    writeConsent('declined');
    setStatus('declined');
  }, []);

  const reset = useCallback(() => {
    writeConsent(null);
    setStatus(null);
  }, []);

  return { status, consented: status === 'accepted', accept, decline, reset };
}
