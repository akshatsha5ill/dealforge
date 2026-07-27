import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmState {
  id: number;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

let confirmId = 0;
let listeners: ((state: ConfirmState | null) => void)[] = [];
let currentState: ConfirmState | null = null;

function notify() {
  listeners.forEach((l) => l(currentState ? { ...currentState } : null));
}

export function confirm(title: string, message: string, options?: { confirmLabel?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const id = ++confirmId;
    currentState = {
      id,
      title,
      message,
      confirmLabel: options?.confirmLabel,
      onConfirm: () => { currentState = null; notify(); resolve(true); },
      onCancel: () => { currentState = null; notify(); resolve(false); },
    };
    notify();
  });
}

export default function ConfirmDialogContainer() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    const handler = (s: ConfirmState | null) => setState(s);
    listeners.push(handler);
    return () => { listeners = listeners.filter((l) => l !== handler); };
  }, []);

  const handleConfirm = useCallback(() => { state?.onConfirm(); }, [state]);
  const handleCancel = useCallback(() => { state?.onCancel?.(); }, [state]);

  if (!state) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div className="ds-panel" style={{ padding: '28px', width: '380px', maxWidth: '90vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{state.title}</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.5 }}>{state.message}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={handleCancel} style={{ padding: '8px 16px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            Cancel
          </button>
          <button onClick={handleConfirm} style={{ padding: '8px 16px', backgroundColor: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
            {state.confirmLabel || 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
