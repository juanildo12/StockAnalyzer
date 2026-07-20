'use client';

import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';

interface FormulaChipProps {
  label: string;
  color?: string;
}

const DEFAULT_COLORS = ['#B64DFF', '#1FD18A', C.warning, '#3B82F6', '#EC4899', C.info];

let chipIndex = 0;

export default function FormulaChip({ label, color }: FormulaChipProps) {
  const c = color || DEFAULT_COLORS[chipIndex++ % DEFAULT_COLORS.length];

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 600,
      fontFamily: 'Inter, system-ui, sans-serif',
      background: `${c}15`,
      color: c,
      border: `1px solid ${c}30`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
