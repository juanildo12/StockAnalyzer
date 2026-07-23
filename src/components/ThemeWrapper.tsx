'use client';

import { ReactNode } from 'react';
import { useTheme } from './ThemeProvider';

export default function ThemeWrapper({ children }: { children: ReactNode }) {
  const { version } = useTheme();
  return <div key={version}>{children}</div>;
}
