import { Suspense } from 'react';
import Screener from '@/components/Screener';

function ScreenerLoading() {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: '#0d1117',
      color: '#8b949e'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
        <p>Cargando Screener...</p>
      </div>
    </div>
  );
}

export default function ScreenerPage() {
  return (
    <Suspense fallback={<ScreenerLoading />}>
      <Screener />
    </Suspense>
  );
}
