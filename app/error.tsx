'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#07080A', color: '#94A3B8',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <p style={{ fontSize: 48, margin: '0 0 16px' }}>⚠️</p>
        <h2 style={{ color: '#E2E8F0', margin: '0 0 8px' }}>Algo salió mal</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14 }}>Ocurrió un error inesperado. Por favor intenta de nuevo.</p>
        <button onClick={reset} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none',
          background: '#7C3AED', color: '#fff', cursor: 'pointer',
          fontWeight: 600, fontSize: 14,
        }}>
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
