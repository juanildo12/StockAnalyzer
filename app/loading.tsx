'use client';

import { ThinkingOrb } from 'thinking-orbs';
import { useTheme } from '@/src/components/ThemeProvider';

export default function Loading() {
  const { theme } = useTheme();
  
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#07080A', color: '#94A3B8',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <ThinkingOrb state="working" size={64} theme={theme as any} />
        </div>
        <p style={{ fontSize: 14, margin: 0 }}>Cargando...</p>
      </div>
    </div>
  );
}
