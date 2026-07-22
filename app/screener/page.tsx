'use client';

import { useState, useEffect } from 'react';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

function ScreenerLoading() {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      background: C.bg,
      color: C.textMuted
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
        <p>Cargando Screener...</p>
      </div>
    </div>
  );
}

function formatNumber(num: number, decimals: number = 1): string {
  if (num >= 1e12) return (num / 1e12).toFixed(decimals) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
}

const CACHE_KEY = 'screener_cache';

function readCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
}
function writeCache(patch: Record<string, any>) {
  const prev = readCache();
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...prev, ...patch }));
}

export default function ScreenerPage() {
  const cache = readCache();
  const [activeTab, setActiveTab] = useState<'options' | 'fundamental'>('fundamental');
  const [fundamentalData, setFundamentalData] = useState<any>(cache.fundamental ?? null);
  const [optionsData, setOptionsData] = useState<any>(cache.options ?? null);
  const [fundamentalLoading, setFundamentalLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fundamentalSort, setFundamentalSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'score', dir: 'desc' });
  const [optionsSort, setOptionsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'suitabilityScore', dir: 'desc' });
  const [lastFetchDate, setLastFetchDate] = useState<string>(cache.date ?? '');

  const handleSort = (tab: 'fundamental' | 'options', key: string) => {
    if (tab === 'fundamental') {
      setFundamentalSort(prev => ({
        key,
        dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
      }));
    } else {
      setOptionsSort(prev => ({
        key,
        dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
      }));
    }
  };

  const getSortedFundamental = () => {
    if (!fundamentalData?.stocks) return [];
    return [...fundamentalData.stocks].sort((a: any, b: any) => {
      const valA = a[fundamentalSort.key] ?? (fundamentalSort.key === 'name' ? '' : -999999);
      const valB = b[fundamentalSort.key] ?? (fundamentalSort.key === 'name' ? '' : -999999);
      if (typeof valA === 'string') {
        return fundamentalSort.dir === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return fundamentalSort.dir === 'asc' ? valA - valB : valB - valA;
    });
  };

  const getSortedOptions = () => {
    if (!optionsData?.all) return [];
    return [...optionsData.all].sort((a: any, b: any) => {
      const valA = a[optionsSort.key] ?? -999999;
      const valB = b[optionsSort.key] ?? -999999;
      if (typeof valA === 'string') {
        return optionsSort.dir === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      return optionsSort.dir === 'asc' ? valA - valB : valB - valA;
    });
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => (
    <span style={{ marginLeft: '4px', opacity: active ? 1 : 0.3 }}>
      {dir === 'asc' ? '↑' : '↓'}
    </span>
  );

  const loadFundamentalScreener = async () => {
    setFundamentalLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/screener/fundamental?t=${Date.now()}`);
      if (!res.ok) throw new Error('Error loading screener');
      const json = await res.json();
      setFundamentalData(json);
      const date = json.date || new Date().toISOString().split('T')[0];
      setLastFetchDate(date);
      writeCache({ fundamental: json, date });
    } catch (e) {
      console.error('Fundamental screener error:', e);
      setError('Error al cargar el screener fundamental');
    } finally {
      setFundamentalLoading(false);
    }
  };

  const loadOptionsScreener = async () => {
    setOptionsLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/options?screen=screener&t=${Date.now()}`);
      if (!res.ok) throw new Error('Error loading screener');
      const json = await res.json();
      setOptionsData(json);
      const date = json.screenerDate || new Date().toISOString().split('T')[0];
      setLastFetchDate(date);
      writeCache({ options: json, date });
    } catch (e) {
      console.error('Options screener error:', e);
      setError('Error al cargar el screener de opciones');
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (activeTab === 'fundamental') {
      if (!fundamentalData || lastFetchDate !== today) {
        loadFundamentalScreener();
      }
    } else if (activeTab === 'options') {
      if (!optionsData || lastFetchDate !== today) {
        loadOptionsScreener();
      }
    }
  }, [activeTab]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', background: C.bg, minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: C.textPrimary, marginBottom: '8px' }}>🔍 Screener de Acciones</h1>
        <p style={{ color: C.textMuted, margin: 0 }}>Encuentra oportunidades de inversión con análisis fundamental</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
        <button
          onClick={() => setActiveTab('fundamental')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'fundamental' ? C.accent : C.bgCard,
            color: C.textPrimary,
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          📈 Fundamental
        </button>
        <button
          onClick={() => setActiveTab('options')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'options' ? C.accent : C.bgCard,
            color: C.textPrimary,
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          🎯 Opciones
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '8px', background: C.negativeBg, color: C.negative, textAlign: 'center', marginBottom: '16px' }}>
          {error}
          <button onClick={() => activeTab === 'fundamental' ? loadFundamentalScreener() : loadOptionsScreener()} style={{ marginLeft: '12px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: C.accent, color: 'white', cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      )}

      {activeTab === 'fundamental' ? (
        <>
          {fundamentalLoading ? (
            <ScreenerLoading />
          ) : fundamentalData ? (
            <div>
              {/* Scoring Mode Badge */}
              {fundamentalData.scoringMode && (
                <div style={{ 
                  background: C.bgCard, 
                  borderRadius: '12px', 
                  padding: '16px 20px', 
                  marginBottom: '20px',
                  border: '1px solid ' + C.border,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>{fundamentalData.scoringMode.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px', color: C.textPrimary, fontSize: '16px' }}>
                        Modo de hoy: {fundamentalData.scoringMode.name}
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: C.textMuted }}>
                        {fundamentalData.scoringMode.focus}
                      </p>
                    </div>
                    <span style={{ 
                      background: C.accent + '20',
                      color: C.positive,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                    }}>
                      {fundamentalData.totalUniverse} en universo • {fundamentalData.scanned} escaneadas
                    </span>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div style={{ background: C.bgCard, borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: C.textPrimary, fontSize: '18px' }}>📊 Resumen - {fundamentalData.date}</h3>
                  <button
                    onClick={loadFundamentalScreener}
                    disabled={fundamentalLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid ' + C.border,
                      background: 'transparent',
                      color: C.accent,
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    🔄 Actualizar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: C.positive }}>{fundamentalData.summary?.excelente || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: C.textMuted }}>Excelentes</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: C.accent }}>{fundamentalData.summary?.buena || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: C.textMuted }}>Buenas</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: C.warning }}>{fundamentalData.summary?.regular || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: C.textMuted }}>Regulares</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: C.negative }}>{fundamentalData.summary?.sobrevalorada || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: C.textMuted }}>Sobrevaloradas</p>
                  </div>
                </div>
              </div>

              {/* Top Picks */}
              {fundamentalData.topPicks && fundamentalData.topPicks.length > 0 && (
                <div style={{ background: C.bgCard, borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: '16px' }}>⭐ Top 10 Mejores Oportunidades</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {fundamentalData.topPicks.slice(0, 10).map((stock: any) => (
                      <a
                        key={stock.symbol}
                        href={`/?symbol=${stock.symbol}`}
                        style={{
                          background: C.bg,
                          padding: '16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: '1px solid ' + C.border,
                          display: 'block',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ color: C.textPrimary, fontWeight: 'bold', fontSize: '14px' }}>{stock.symbol}</span>
                          <span style={{ 
                            background: stock.recommendation === 'excelente' ? C.positiveBg : stock.recommendation === 'buena' ? C.accent + '30' : C.warningBg,
                            color: stock.recommendation === 'excelente' ? C.positive : stock.recommendation === 'buena' ? C.accent : C.warning,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}>
                            {stock.score}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px', color: C.textMuted, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stock.name}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: C.textSecondary, fontWeight: '600' }}>${stock.price?.toFixed(2)}</span>
                          <span style={{ color: stock.changePercent >= 0 ? C.positive : C.negative, fontSize: '12px' }}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(1)}%
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              <div style={{ background: C.bgCard, borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: '16px' }}>📋 Todas las Oportunidades ({fundamentalData.stocks?.length || 0})</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid ' + C.border }}>
                        <th 
                          onClick={() => handleSort('fundamental', 'symbol')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'symbol' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Symbol<SortIcon active={fundamentalSort.key === 'symbol'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'price')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'price' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Precio<SortIcon active={fundamentalSort.key === 'price'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'peRatio')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'peRatio' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >P/E<SortIcon active={fundamentalSort.key === 'peRatio'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'pegRatio')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'pegRatio' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >PEG<SortIcon active={fundamentalSort.key === 'pegRatio'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'dividendYield')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'dividendYield' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Div%<SortIcon active={fundamentalSort.key === 'dividendYield'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'profitMargin')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'profitMargin' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Margen<SortIcon active={fundamentalSort.key === 'profitMargin'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'roe')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'roe' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >ROE<SortIcon active={fundamentalSort.key === 'roe'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'revenueGrowth')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'revenueGrowth' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Crec.<SortIcon active={fundamentalSort.key === 'revenueGrowth'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'score')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'score' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Score<SortIcon active={fundamentalSort.key === 'score'} dir={fundamentalSort.dir} /></th>
                        <th style={{ textAlign: 'left', padding: '12px 8px', color: C.textMuted }}>Recom.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedFundamental().slice(0, 50).map((stock: any) => (
                        <tr 
                          key={stock.symbol}
                          style={{ borderBottom: '1px solid ' + C.borderLight }}
                        >
                          <td style={{ padding: '12px 8px' }}>
                            <a href={`/?symbol=${stock.symbol}`} style={{ color: C.accent, fontWeight: '600', textDecoration: 'none' }}>{stock.symbol}</a>
                          </td>
                          <td style={{ padding: '12px 8px', color: C.textSecondary }}>${stock.price?.toFixed(2)}</td>
                          <td style={{ padding: '12px 8px', color: stock.peRatio > 0 && stock.peRatio < 20 ? C.positive : stock.peRatio > 40 ? C.negative : C.textMuted }}>
                            {stock.peRatio > 0 ? stock.peRatio.toFixed(1) : 'N/A'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.pegRatio > 0 && stock.pegRatio < 1.5 ? C.positive : stock.pegRatio > 2.5 ? C.negative : C.textMuted }}>
                            {stock.pegRatio > 0 ? stock.pegRatio.toFixed(1) : 'N/A'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.dividendYield > 0.02 ? C.positive : C.textMuted }}>
                            {stock.dividendYield > 0 ? (stock.dividendYield * 100).toFixed(1) + '%' : '-'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.profitMargin > 0.2 ? C.positive : stock.profitMargin > 0.1 ? C.warning : C.negative }}>
                            {stock.profitMargin > 0 ? (stock.profitMargin * 100).toFixed(0) + '%' : '-'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.roe > 0.2 ? C.positive : stock.roe > 0.1 ? C.warning : C.negative }}>
                            {stock.roe > 0 ? (stock.roe * 100).toFixed(0) + '%' : '-'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.revenueGrowth > 0.15 ? C.positive : stock.revenueGrowth > 0.05 ? C.warning : C.negative }}>
                            {stock.revenueGrowth > 0 ? (stock.revenueGrowth * 100).toFixed(0) + '%' : '-'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.score >= 75 ? C.positive : stock.score >= 60 ? C.accent : stock.score >= 40 ? C.warning : C.negative, fontWeight: '600' }}>
                            {stock.score}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{
                              background: stock.recommendation === 'excelente' ? C.positiveBg : stock.recommendation === 'buena' ? C.accent + '20' : stock.recommendation === 'regular' ? C.warningBg : C.negativeBg,
                              color: stock.recommendation === 'excelente' ? C.positive : stock.recommendation === 'buena' ? C.accent : stock.recommendation === 'regular' ? C.warning : C.negative,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                            }}>
                              {stock.recommendation}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📈</p>
              <p>No hay datos disponibles</p>
              <button onClick={loadFundamentalScreener} style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: C.accent, color: 'white', cursor: 'pointer', fontWeight: '600' }}>
                Cargar Screener
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {optionsLoading ? (
            <ScreenerLoading />
          ) : optionsData ? (
            <div>
              {/* Summary */}
              <div style={{ background: C.bgCard, borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: C.textPrimary, fontSize: '18px' }}>📊 Resumen del Screener de Opciones</h3>
                  <button
                    onClick={loadOptionsScreener}
                    disabled={optionsLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid ' + C.border,
                      background: 'transparent',
                      color: C.accent,
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    🔄 Actualizar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: C.positive }}>{optionsData.summary?.excellent || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: C.textMuted }}>Excelentes</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: C.accent }}>{optionsData.summary?.buena || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: C.textMuted }}>Buenas</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: C.warning }}>{optionsData.summary?.regular || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: C.textMuted }}>Regulares</p>
                  </div>
                  <div style={{ background: C.bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: C.negative }}>{optionsData.summary?.notRecommended || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: C.textMuted }}>No Recomendadas</p>
                  </div>
                </div>
              </div>

              {/* Top Picks */}
              {optionsData.topPicks && optionsData.topPicks.length > 0 && (
                <div style={{ background: C.bgCard, borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: '16px' }}>⭐ Top Picks para Opciones</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {optionsData.topPicks.map((stock: any) => (
                      <a
                        key={stock.symbol}
                        href={`/options?symbol=${stock.symbol}`}
                        style={{
                          background: C.bg,
                          padding: '16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: '1px solid ' + C.border,
                          display: 'block',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ color: C.textPrimary, fontWeight: 'bold', fontSize: '14px' }}>{stock.symbol}</span>
                          <span style={{ 
                            background: stock.recommendation === 'excellent' ? C.positiveBg : stock.recommendation === 'buena' ? C.accent + '30' : C.warningBg,
                            color: stock.recommendation === 'excellent' ? C.positive : stock.recommendation === 'buena' ? C.accent : C.warning,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}>
                            {stock.suitabilityScore}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px', color: C.textMuted, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stock.name}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: C.textSecondary, fontWeight: '600' }}>${stock.price?.toFixed(2)}</span>
                          <span style={{ color: stock.changePercent >= 0 ? C.positive : C.negative, fontSize: '12px' }}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(1)}%
                          </span>
                        </div>
                        <p style={{ margin: '8px 0 0', color: C.accent, fontSize: '11px' }}>{stock.topStrategy}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              <div style={{ background: C.bgCard, borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 16px', color: C.textPrimary, fontSize: '16px' }}>📋 Acciones Analizadas ({optionsData.filteredCount})</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid ' + C.border }}>
                        <th 
                          onClick={() => handleSort('options', 'symbol')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'symbol' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Symbol<SortIcon active={optionsSort.key === 'symbol'} dir={optionsSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('options', 'price')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'price' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Precio<SortIcon active={optionsSort.key === 'price'} dir={optionsSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('options', 'iv')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'iv' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >IV<SortIcon active={optionsSort.key === 'iv'} dir={optionsSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('options', 'volumeRatio')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'volumeRatio' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Vol<SortIcon active={optionsSort.key === 'volumeRatio'} dir={optionsSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('options', 'suitabilityScore')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'suitabilityScore' ? C.accent : C.textMuted, cursor: 'pointer' }}
                        >Score<SortIcon active={optionsSort.key === 'suitabilityScore'} dir={optionsSort.dir} /></th>
                        <th style={{ textAlign: 'left', padding: '12px 8px', color: C.textMuted }}>Estrategia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedOptions().slice(0, 30).map((stock: any) => (
                        <tr 
                          key={stock.symbol}
                          style={{ borderBottom: '1px solid ' + C.borderLight }}
                        >
                          <td style={{ padding: '12px 8px' }}>
                            <a href={`/options?symbol=${stock.symbol}`} style={{ color: C.accent, fontWeight: '600', textDecoration: 'none' }}>{stock.symbol}</a>
                          </td>
                          <td style={{ padding: '12px 8px', color: C.textSecondary }}>${stock.price?.toFixed(2)}</td>
                          <td style={{ padding: '12px 8px', color: stock.iv > 0.4 ? C.positive : stock.iv > 0.25 ? C.warning : C.textMuted }}>
                            {(stock.iv * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.volumeRatio > 1.2 ? C.positive : stock.volumeRatio > 1 ? C.warning : C.textMuted }}>
                            {stock.volumeRatio?.toFixed(1)}x
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.suitabilityScore >= 75 ? C.positive : stock.suitabilityScore >= 55 ? C.accent : stock.suitabilityScore >= 35 ? C.warning : C.negative, fontWeight: '600' }}>
                            {stock.suitabilityScore}
                          </td>
                          <td style={{ padding: '12px 8px', color: C.accent, fontSize: '12px' }}>
                            {stock.topStrategy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🎯</p>
              <p>No hay datos disponibles</p>
              <button onClick={loadOptionsScreener} style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: C.accent, color: 'white', cursor: 'pointer', fontWeight: '600' }}>
                Cargar Screener
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}