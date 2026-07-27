const STORAGE_KEY = 'df_cookie_consent';

export type ConsentStatus = 'accepted' | 'declined' | null;

export function readConsent(): ConsentStatus {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'accepted' || v === 'declined') return v;
  } catch {}
  return null;
}

export function writeConsent(status: ConsentStatus) {
  try {
    if (status) localStorage.setItem(STORAGE_KEY, status);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
