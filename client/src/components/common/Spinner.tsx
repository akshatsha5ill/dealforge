export default function Spinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <Spinner size={32} />
      <span style={{ fontSize: '14px' }}>{message}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function InlineLoader() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
      <Spinner size={14} />
      Loading...
    </span>
  );
}
