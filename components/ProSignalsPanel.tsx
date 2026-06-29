'use client';

import { useState, useEffect, useCallback } from 'react';
import { colors as C, radius as R } from '@/src/utils/webTheme';

interface SignalItem {
  name: string;
  key: string;
  value: number;
  description: string;
  direction: 'bullish' | 'bearish' | 'neutral';
}

interface ProSignalsData {
  symbol: string;
  overall: number;
  signals: SignalItem[];
  updated: string;
}

interface ProSignalsPanelProps {
  symbol: string;
  onClose?: () => void;
  onAnalyze?: () => void;
}

function signalColor(val: number): string {
  if (val >= 70) return '#22c55e';
  if (val >= 55) return '#84cc16';
  if (val >= 45) return '#eab308';
  if (val >= 30) return '#f97316';
  return '#ef4444';
}

function signalBg(val: number): string {
  if (val >= 70) return '#0a2e1a';
  if (val >= 55) return '#1a2e0a';
  if (val >= 45) return '#2e2a0a';
  if (val >= 30) return '#2e1a0a';
  return '#2e0a0a';
}

const signalIcons: Record<string, string> = {
  optionsSentiment: '📊',
  shortPressure: '🩳',
  instFlow: '🏦',
  socialSentiment: '💬',
  technicalMomentum: '📈',
  valueScore: '💎',
};

const signalLabels: Record<string, string> = {
  optionsSentiment: 'Net Options Sentiment',
  shortPressure: 'Short Pressure Rating',
  instFlow: 'Net Institutional Flow',
  socialSentiment: 'Net Social Sentiment',
  technicalMomentum: 'Technical Momentum',
  valueScore: 'Value Score',
};

export default function ProSignalsPanel({ symbol, onClose, onAnalyze }: ProSignalsPanelProps) {
  const [data, setData] = useState<ProSignalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pro-signals?symbol=${symbol}`);
      const json = await res.json();
      if (json.signals) setData(json);
      else setError('No data');
    } catch {
      setError('Error loading signals');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  if (loading) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, padding: '32px', textAlign: 'center' }}>
        <div style={{ color: C.textMuted, fontSize: '14px' }}>Cargando señales...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, padding: '24px', textAlign: 'center' }}>
        <div style={{ color: C.textMuted, fontSize: '13px' }}>{error || 'Sin datos'}</div>
        <button onClick={fetchSignals} style={{ marginTop: '12px', background: C.accent, color: 'white', border: 'none', borderRadius: R.sm, padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          Reintentar
        </button>
      </div>
    );
  }

  const sigs = data.signals;

  return (
    <div style={{ background: C.bgCard, borderRadius: R.lg, border: '1px solid ' + C.border, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid ' + C.border }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', color: C.textPrimary, fontSize: '16px', fontWeight: '700' }}>🎯 Prospero Signals</h3>
            <p style={{ margin: 0, color: C.textMuted, fontSize: '12px' }}>
              Señales cuantitativas 0-100 para {symbol}
            </p>
          </div>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
          )}
        </div>

        {/* Composite Score */}
        <div style={{
          marginTop: '16px', padding: '16px', borderRadius: R.lg,
          background: `linear-gradient(135deg, ${signalBg(data.overall)}44, ${C.bg})`,
          border: `1px solid ${signalColor(data.overall)}44`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: C.textMuted, fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>COMPOSITE SCORE</div>
              <div style={{ color: signalColor(data.overall), fontSize: '32px', fontWeight: '800', lineHeight: 1 }}>
                {data.overall}
                <span style={{ fontSize: '16px', fontWeight: '500' }}>/100</span>
              </div>
            </div>
            <div style={{
              fontSize: '13px', fontWeight: '600', padding: '6px 16px', borderRadius: '20px',
              background: signalBg(data.overall), color: signalColor(data.overall),
              border: `1px solid ${signalColor(data.overall)}44`,
            }}>
              {data.overall >= 70 ? '🟢 Alcista Fuerte' : data.overall >= 55 ? '🟡 Alcista' : data.overall >= 45 ? '⚪ Neutral' : data.overall >= 30 ? '🟠 Bajista' : '🔴 Bajista Fuerte'}
            </div>
          </div>
          {/* Mini bar */}
          <div style={{ marginTop: '12px', height: '4px', background: C.bg, borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${data.overall}%`, height: '100%', background: signalColor(data.overall), borderRadius: '2px', transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Signal Cards */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sigs.map(sig => (
          <SignalCard key={sig.key} signal={sig} />
        ))}
      </div>

      {/* Updated + Analyze */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid ' + C.borderLight, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: C.textMuted, fontSize: '11px' }}>
          Actualizado: {new Date(data.updated).toLocaleTimeString()}
        </span>
        {onAnalyze && (
          <button
            onClick={onAnalyze}
            style={{
              background: C.accent, color: 'white', border: 'none', borderRadius: R.sm,
              padding: '8px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
            }}
          >
            🤖 Analizar con IA
          </button>
        )}
      </div>
    </div>
  );
}

function SignalCard({ signal: sig }: { signal: SignalItem }) {
  const icon = signalIcons[sig.key] || '📊';
  const label = signalLabels[sig.key] || sig.name;
  const color = signalColor(sig.value);
  const bg = signalBg(sig.value);

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: R.md,
      background: bg + '22',
      border: `1px solid ${color}33`,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{icon}</span>
          <span style={{ color: C.textPrimary, fontSize: '13px', fontWeight: '700' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color, fontSize: '20px', fontWeight: '800', lineHeight: 1 }}>{sig.value}</span>
          <span style={{
            fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px',
            background: bg, color, border: `1px solid ${color}44`,
          }}>
            {sig.direction === 'bullish' ? '🟢 Alcista' : sig.direction === 'bearish' ? '🔴 Bajista' : '⚪ Neutral'}
          </span>
        </div>
      </div>
      {/* Gauge bar */}
      <div style={{ height: '3px', background: C.bg, borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
        <div style={{ width: `${sig.value}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
      </div>
      <p style={{ margin: 0, color: C.textMuted, fontSize: '11px', lineHeight: '1.4' }}>{sig.description}</p>
    </div>
  );
}
