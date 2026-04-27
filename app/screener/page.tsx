'use client';

import { useState, useEffect } from 'react';

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

function formatNumber(num: number, decimals: number = 1): string {
  if (num >= 1e12) return (num / 1e12).toFixed(decimals) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
}

export default function ScreenerPage() {
  const [activeTab, setActiveTab] = useState<'options' | 'fundamental'>('fundamental');
  const [fundamentalData, setFundamentalData] = useState<any>(null);
  const [optionsData, setOptionsData] = useState<any>(null);
  const [fundamentalLoading, setFundamentalLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fundamentalSort, setFundamentalSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'score', dir: 'desc' });
  const [optionsSort, setOptionsSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'suitabilityScore', dir: 'desc' });
  const [lastFetchDate, setLastFetchDate] = useState<string>('');

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
      const res = await fetch('/api/screener/fundamental');
      if (!res.ok) throw new Error('Error loading screener');
      const json = await res.json();
      setFundamentalData(json);
      setLastFetchDate(json.date || new Date().toISOString().split('T')[0]);
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
      const res = await fetch('/api/options?screen=screener');
      if (!res.ok) throw new Error('Error loading screener');
      const json = await res.json();
      setOptionsData(json);
      setLastFetchDate(json.screenerDate || new Date().toISOString().split('T')[0]);
    } catch (e) {
      console.error('Options screener error:', e);
      setError('Error al cargar el screener de opciones');
    } finally {
      setOptionsLoading(false);
    }
  };

  useEffect(() => {
    const checkAndRefresh = () => {
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
    };
    checkAndRefresh();
  }, [activeTab]);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', background: '#0d1117', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: '#f0f6fc', marginBottom: '8px' }}>🔍 Screener de Acciones</h1>
        <p style={{ color: '#8b949e', margin: 0 }}>Encuentra oportunidades de inversión con análisis fundamental</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
        <button
          onClick={() => setActiveTab('fundamental')}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'fundamental' ? '#238636' : '#161b22',
            color: '#f0f6fc',
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
            background: activeTab === 'options' ? '#238636' : '#161b22',
            color: '#f0f6fc',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          🎯 Opciones
        </button>
      </div>

      {error && (
        <div style={{ padding: '16px', borderRadius: '8px', background: '#f8514920', color: '#f85149', textAlign: 'center', marginBottom: '16px' }}>
          {error}
          <button onClick={() => activeTab === 'fundamental' ? loadFundamentalScreener() : loadOptionsScreener()} style={{ marginLeft: '12px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#238636', color: 'white', cursor: 'pointer' }}>
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
              {/* Summary */}
              <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '18px' }}>📊 Resumen - {fundamentalData.date}</h3>
                  <button
                    onClick={loadFundamentalScreener}
                    disabled={fundamentalLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      background: 'transparent',
                      color: '#58a6ff',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    🔄 Actualizar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#3fb950' }}>{fundamentalData.summary?.excelente || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Excelentes</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#58a6ff' }}>{fundamentalData.summary?.buena || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Buenas</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#f0883e' }}>{fundamentalData.summary?.regular || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Regulares</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#f85149' }}>{fundamentalData.summary?.sobrevalorada || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Sobrevaloradas</p>
                  </div>
                </div>
              </div>

              {/* Top Picks */}
              {fundamentalData.topPicks && fundamentalData.topPicks.length > 0 && (
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '16px' }}>⭐ Top 10 Mejores Oportunidades</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                    {fundamentalData.topPicks.slice(0, 10).map((stock: any) => (
                      <a
                        key={stock.symbol}
                        href={`/?symbol=${stock.symbol}`}
                        style={{
                          background: '#0d1117',
                          padding: '16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: '1px solid #30363d',
                          display: 'block',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ color: '#f0f6fc', fontWeight: 'bold', fontSize: '14px' }}>{stock.symbol}</span>
                          <span style={{ 
                            background: stock.recommendation === 'excelente' ? '#3fb95030' : stock.recommendation === 'buena' ? '#58a6ff30' : '#f0883e30',
                            color: stock.recommendation === 'excelente' ? '#3fb950' : stock.recommendation === 'buena' ? '#58a6ff' : '#f0883e',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}>
                            {stock.score}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px', color: '#8b949e', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stock.name}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#c9d1d9', fontWeight: '600' }}>${stock.price?.toFixed(2)}</span>
                          <span style={{ color: stock.changePercent >= 0 ? '#3fb950' : '#f85149', fontSize: '12px' }}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(1)}%
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '16px' }}>📋 Todas las Oportunidades ({fundamentalData.count})</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <th 
                          onClick={() => handleSort('fundamental', 'symbol')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'symbol' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Symbol<SortIcon active={fundamentalSort.key === 'symbol'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'price')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'price' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Precio<SortIcon active={fundamentalSort.key === 'price'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'peRatio')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'peRatio' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >P/E<SortIcon active={fundamentalSort.key === 'peRatio'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'pegRatio')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'pegRatio' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >PEG<SortIcon active={fundamentalSort.key === 'pegRatio'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'dividendYield')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'dividendYield' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Div%<SortIcon active={fundamentalSort.key === 'dividendYield'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'profitMargin')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'profitMargin' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Margen<SortIcon active={fundamentalSort.key === 'profitMargin'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'roe')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'roe' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >ROE<SortIcon active={fundamentalSort.key === 'roe'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'revenueGrowth')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'revenueGrowth' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Crec.<SortIcon active={fundamentalSort.key === 'revenueGrowth'} dir={fundamentalSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('fundamental', 'score')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: fundamentalSort.key === 'score' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Score<SortIcon active={fundamentalSort.key === 'score'} dir={fundamentalSort.dir} /></th>
                        <th style={{ textAlign: 'left', padding: '12px 8px', color: '#8b949e' }}>Recom.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedFundamental().slice(0, 50).map((stock: any) => (
                        <tr 
                          key={stock.symbol}
                          style={{ borderBottom: '1px solid #21262d' }}
                        >
                          <td style={{ padding: '12px 8px' }}>
                            <a href={`/?symbol=${stock.symbol}`} style={{ color: '#58a6ff', fontWeight: '600', textDecoration: 'none' }}>{stock.symbol}</a>
                          </td>
                          <td style={{ padding: '12px 8px', color: '#c9d1d9' }}>${stock.price?.toFixed(2)}</td>
                          <td style={{ padding: '12px 8px', color: stock.peRatio > 0 && stock.peRatio < 20 ? '#3fb950' : stock.peRatio > 40 ? '#f85149' : '#8b949e' }}>
                            {stock.peRatio > 0 ? stock.peRatio.toFixed(1) : 'N/A'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.pegRatio > 0 && stock.pegRatio < 1.5 ? '#3fb950' : stock.pegRatio > 2.5 ? '#f85149' : '#8b949e' }}>
                            {stock.pegRatio > 0 ? stock.pegRatio.toFixed(1) : 'N/A'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.dividendYield > 0.02 ? '#3fb950' : '#8b949e' }}>
                            {stock.dividendYield > 0 ? (stock.dividendYield * 100).toFixed(1) + '%' : '-'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.profitMargin > 0.2 ? '#3fb950' : stock.profitMargin > 0.1 ? '#f0883e' : '#f85149' }}>
                            {stock.profitMargin > 0 ? (stock.profitMargin * 100).toFixed(0) + '%' : '-'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.roe > 0.2 ? '#3fb950' : stock.roe > 0.1 ? '#f0883e' : '#f85149' }}>
                            {stock.roe > 0 ? (stock.roe * 100).toFixed(0) + '%' : '-'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.revenueGrowth > 0.15 ? '#3fb950' : stock.revenueGrowth > 0.05 ? '#f0883e' : '#f85149' }}>
                            {stock.revenueGrowth > 0 ? (stock.revenueGrowth * 100).toFixed(0) + '%' : '-'}
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.score >= 75 ? '#3fb950' : stock.score >= 60 ? '#58a6ff' : stock.score >= 40 ? '#f0883e' : '#f85149', fontWeight: '600' }}>
                            {stock.score}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{
                              background: stock.recommendation === 'excelente' ? '#3fb95020' : stock.recommendation === 'buena' ? '#58a6ff20' : stock.recommendation === 'regular' ? '#f0883e20' : '#f8514920',
                              color: stock.recommendation === 'excelente' ? '#3fb950' : stock.recommendation === 'buena' ? '#58a6ff' : stock.recommendation === 'regular' ? '#f0883e' : '#f85149',
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
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>📈</p>
              <p>No hay datos disponibles</p>
              <button onClick={loadFundamentalScreener} style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#238636', color: 'white', cursor: 'pointer', fontWeight: '600' }}>
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
              <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '18px' }}>📊 Resumen del Screener de Opciones</h3>
                  <button
                    onClick={loadOptionsScreener}
                    disabled={optionsLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #30363d',
                      background: 'transparent',
                      color: '#58a6ff',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    🔄 Actualizar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#3fb950' }}>{optionsData.summary?.excellent || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Excelentes</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#58a6ff' }}>{optionsData.summary?.buena || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Buenas</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#f0883e' }}>{optionsData.summary?.regular || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>Regulares</p>
                  </div>
                  <div style={{ background: '#0d1117', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 'bold', color: '#f85149' }}>{optionsData.summary?.notRecommended || 0}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8b949e' }}>No Recomendadas</p>
                  </div>
                </div>
              </div>

              {/* Top Picks */}
              {optionsData.topPicks && optionsData.topPicks.length > 0 && (
                <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '16px' }}>⭐ Top Picks para Opciones</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                    {optionsData.topPicks.map((stock: any) => (
                      <a
                        key={stock.symbol}
                        href={`/options?symbol=${stock.symbol}`}
                        style={{
                          background: '#0d1117',
                          padding: '16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          border: '1px solid #30363d',
                          display: 'block',
                          textDecoration: 'none',
                          color: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ color: '#f0f6fc', fontWeight: 'bold', fontSize: '14px' }}>{stock.symbol}</span>
                          <span style={{ 
                            background: stock.recommendation === 'excellent' ? '#3fb95030' : stock.recommendation === 'buena' ? '#58a6ff30' : '#f0883e30',
                            color: stock.recommendation === 'excellent' ? '#3fb950' : stock.recommendation === 'buena' ? '#58a6ff' : '#f0883e',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}>
                            {stock.suitabilityScore}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px', color: '#8b949e', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stock.name}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#c9d1d9', fontWeight: '600' }}>${stock.price?.toFixed(2)}</span>
                          <span style={{ color: stock.changePercent >= 0 ? '#3fb950' : '#f85149', fontSize: '12px' }}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent?.toFixed(1)}%
                          </span>
                        </div>
                        <p style={{ margin: '8px 0 0', color: '#58a6ff', fontSize: '11px' }}>{stock.topStrategy}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Table */}
              <div style={{ background: '#161b22', borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ margin: '0 0 16px', color: '#f0f6fc', fontSize: '16px' }}>📋 Acciones Analizadas ({optionsData.filteredCount})</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #30363d' }}>
                        <th 
                          onClick={() => handleSort('options', 'symbol')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'symbol' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Symbol<SortIcon active={optionsSort.key === 'symbol'} dir={optionsSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('options', 'price')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'price' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Precio<SortIcon active={optionsSort.key === 'price'} dir={optionsSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('options', 'iv')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'iv' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >IV<SortIcon active={optionsSort.key === 'iv'} dir={optionsSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('options', 'volumeRatio')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'volumeRatio' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Vol<SortIcon active={optionsSort.key === 'volumeRatio'} dir={optionsSort.dir} /></th>
                        <th 
                          onClick={() => handleSort('options', 'suitabilityScore')}
                          style={{ textAlign: 'left', padding: '12px 8px', color: optionsSort.key === 'suitabilityScore' ? '#58a6ff' : '#8b949e', cursor: 'pointer' }}
                        >Score<SortIcon active={optionsSort.key === 'suitabilityScore'} dir={optionsSort.dir} /></th>
                        <th style={{ textAlign: 'left', padding: '12px 8px', color: '#8b949e' }}>Estrategia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedOptions().slice(0, 30).map((stock: any) => (
                        <tr 
                          key={stock.symbol}
                          style={{ borderBottom: '1px solid #21262d' }}
                        >
                          <td style={{ padding: '12px 8px' }}>
                            <a href={`/options?symbol=${stock.symbol}`} style={{ color: '#58a6ff', fontWeight: '600', textDecoration: 'none' }}>{stock.symbol}</a>
                          </td>
                          <td style={{ padding: '12px 8px', color: '#c9d1d9' }}>${stock.price?.toFixed(2)}</td>
                          <td style={{ padding: '12px 8px', color: stock.iv > 0.4 ? '#3fb950' : stock.iv > 0.25 ? '#f0883e' : '#8b949e' }}>
                            {(stock.iv * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.volumeRatio > 1.2 ? '#3fb950' : stock.volumeRatio > 1 ? '#f0883e' : '#8b949e' }}>
                            {stock.volumeRatio?.toFixed(1)}x
                          </td>
                          <td style={{ padding: '12px 8px', color: stock.suitabilityScore >= 75 ? '#3fb950' : stock.suitabilityScore >= 55 ? '#58a6ff' : stock.suitabilityScore >= 35 ? '#f0883e' : '#f85149', fontWeight: '600' }}>
                            {stock.suitabilityScore}
                          </td>
                          <td style={{ padding: '12px 8px', color: '#58a6ff', fontSize: '12px' }}>
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
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
              <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🎯</p>
              <p>No hay datos disponibles</p>
              <button onClick={loadOptionsScreener} style={{ marginTop: '16px', padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#238636', color: 'white', cursor: 'pointer', fontWeight: '600' }}>
                Cargar Screener
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}