'use client';

import { ThinkingOrb, OrbState, OrbSize, OrbTheme } from 'thinking-orbs';
import { useTheme } from '@/src/components/ThemeProvider';

interface ThinkingOrbLoaderProps {
  state?: OrbState;
  size?: OrbSize;
  label?: string;
  style?: React.CSSProperties;
}

export default function ThinkingOrbLoader({
  state = 'working',
  size = 64,
  label,
  style,
}: ThinkingOrbLoaderProps) {
  const { theme } = useTheme();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 24,
      ...style,
    }}>
      <ThinkingOrb
        state={state}
        size={size}
        theme={theme as OrbTheme}
      />
      {label && (
        <span style={{
          fontSize: size === 64 ? 14 : 12,
          opacity: 0.6,
          fontFamily: 'var(--font-inter)',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

export function InlineOrbLoader({
  state = 'working',
  size = 20,
  style,
}: {
  state?: OrbState;
  size?: OrbSize;
  style?: React.CSSProperties;
}) {
  const { theme } = useTheme();

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', ...style }}>
      <ThinkingOrb state={state} size={size} theme={theme as OrbTheme} />
    </span>
  );
}
