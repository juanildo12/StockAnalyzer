'use client';

import { useState, useEffect, useMemo } from 'react';

interface StockFundamental {
  symbol: string;
  shortName: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  peRatio?: number;
  pegRatio?: number;
  priceToBook?: number;
  dividendYield?: number;
  epsTrailingTwelveMonths?: number;
  epsForward?: number;
  price?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekChange?: number;
  debtToEquity?: number;
  returnOnEquity?: number;
  profitMargin?: number;
  operatingMargin?: number;
  grossMargin?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  bookValue?: number;
  totalRevenue?: number;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
}

interface Filters {
  maxPe: number;
  maxPb: number;
  minDividendYield: number;
  minMarketCap: number;
  minRevenue: number;
  sectors: string[];
  excludeNegativeEarnings: boolean;
  minRoe: number;
}

interface SortConfig {
  key: keyof StockFundamental;
  direction: 'asc' | 'desc';
}

const SECTOR_OPTIONS = [
  'Technology',
  'Healthcare',
  'Financial',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Energy',
  'Industrials',
  'Communication Services',
];

const SECTOR_COLORS: { [key: string]: string } = {
  'Technology': '#5865F2',
  'Healthcare': '#00D4AA',
  'Financial': '#FAA61A',
  'Consumer Cyclical': '#EB459E',
  'Consumer Defensive': '#57F287',
  'Energy': '#FEE75C',
  'Industrials': '#9B59B6',
  'Communication Services': '#E91E63',
};

export default function Screener() {
  const [stocks, setStocks] = useState<StockFundamental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>({
    maxPe: 30,
    maxPb: 5,
    minDividendYield: 0,
    minMarketCap: 0,
    minRevenue: 0,
    sectors: [],
    excludeNegativeEarnings: true,
    minRoe: 0,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'marketCap', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(true);
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/screener?action=screener');
      const data = await response.json();
      
      if (data.screenerStocks) {
        setStocks(data.screenerStocks);
      } else {
        setError('Error loading stocks');
      }
    } catch (err) {
      setError('Failed to load stocks');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedStocks = useMemo(() => {
    let filtered = stocks.filter(stock => {
      if (filters.excludeNegativeEarnings && (stock.peRatio ?? 0) <= 0) return false;
      if ((stock.peRatio ?? 0) > filters.maxPe && filters.maxPe > 0) return false;
      if ((stock.priceToBook ?? 0) > filters.maxPb && filters.maxPb > 0) return false;
      if ((stock.dividendYield ?? 0) < filters.minDividendYield) return false;
      if ((stock.marketCap ?? 0) < filters.minMarketCap * 1000000000) return false;
      if (filters.minRevenue > 0 && (stock.totalRevenue ?? 0) < filters.minRevenue * 1000000) return false;
      if (filters.sectors.length > 0 && stock.sector && !filters.sectors.includes(stock.sector)) return false;
      if ((stock.returnOnEquity ?? 0) < filters.minRoe) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? 0;
      const bVal = b[sortConfig.key] ?? 0;
      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return filtered;
  }, [stocks, filters, sortConfig]);

  const handleSort = (key: keyof StockFundamental) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const formatNumber = (value: number | undefined, decimals: number = 2): string => {
    if (value === undefined || value === null) return '-';
    return value.toFixed(decimals);
  };

  const formatMarketCap = (value: number | undefined): string => {
    if (!value) return '-';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(0)}`;
  };

  const handleAddToWatchlist = async (symbol: string) => {
    setAddingToWatchlist(symbol);
    try {
      const response = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol,
          alertEnabled: false,
          alertPrice: 0,
          alertType: 'above'
        }),
      });
      if (response.ok) {
        alert(`${symbol} agregado a Watchlist`);
      }
    } catch (err) {
      alert('Error al agregar a Watchlist');
    } finally {
      setAddingToWatchlist(null);
    }
  };

  const toggleSector = (sector: string) => {
    setFilters(prev => ({
      ...prev,
      sectors: prev.sectors.includes(sector)
        ? prev.sectors.filter(s => s !== sector)
        : [...prev.sectors, sector],
    }));
  };

  const getValueColor = (stock: StockFundamental, key: keyof StockFundamental): string => {
    const value = stock[key] as number | undefined;
    if (value === undefined || value === null) return '#6e7681';
    
    switch (key) {
      case 'peRatio':
        if (value <= 0) return '#f85149';
        if (value <= 15) return '#3fb950';
        if (value <= 25) return '#a371f7';
        return '#f85149';
      case 'priceToBook':
        if (value <= 1) return '#3fb950';
        if (value <= 3) return '#a371f7';
        if (value > 10) return '#f85149';
        return '#c9d1d9';
      case 'dividendYield':
        if (value >= 3) return '#3fb950';
        if (value >= 1) return '#a371f7';
        return '#c9d1d9';
      case 'returnOnEquity':
        if (value >= 20) return '#3fb950';
        if (value >= 10) return '#a371f7';
        return '#c9d1d9';
      case 'profitMargin':
        if (value >= 20) return '#3fb950';
        if (value >= 5) return '#a371f7';
        if (value < 0) return '#f85149';
        return '#c9d1d9';
      case 'revenueGrowth':
        if (value >= 20) return '#3fb950';
        if (value >= 5) return '#a371f7';
        if (value < 0) return '#f85149';
        return '#c9d1d9';
      default:
        return '#c9d1d9';
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1117 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '4px solid #21262d',
            borderTopColor: '#58a6ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px',
          }} />
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            input[type="range"] {
              -webkit-appearance: none;
              appearance: none;
              height: 6px;
              border-radius: 3px;
            }
            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: #f0f6fc;
              cursor: pointer;
              border: 2px solid #30363d;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              transition: all 0.15s;
            }
            input[type="range"]::-webkit-slider-thumb:hover {
              transform: scale(1.1);
              border-color: #58a6ff;
            }
            input[type="range"]::-moz-range-thumb {
              width: 18px;
              height: 18px;
              border-radius: 50%;
              background: #f0f6fc;
              cursor: pointer;
              border: 2px solid #30363d;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            }
          `}</style>
          <p style={{ color: '#8b949e', fontSize: '18px', margin: 0 }}>Analizando mercado...</p>
          <p style={{ color: '#484f58', fontSize: '14px', marginTop: '8px' }}> Cargando fundamentales</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#0d1117'
      }}>
        <div style={{ 
          textAlign: 'center',
          padding: '48px',
          background: '#161b22',
          borderRadius: '16px',
          border: '1px solid #30363d',
          maxWidth: '400px'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>⚠️</div>
          <p style={{ color: '#f85149', fontSize: '18px', marginBottom: '24px' }}>{error}</p>
          <button
            onClick={loadStocks}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #238636 0%, #2ea043 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0d1117 0%, #161b22 100%)',
      padding: '32px 24px',
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{
          marginBottom: '32px',
          padding: '32px',
          background: 'linear-gradient(135deg, rgba(88, 166, 255, 0.1) 0%, rgba(163, 113, 247, 0.1) 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(88, 166, 255, 0.2)',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #58a6ff 0%, #a371f7 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}>
              🔍
            </div>
            <div>
              <h1 style={{ 
                fontSize: '32px', 
                fontWeight: '700', 
                color: '#f0f6fc', 
                margin: 0,
                letterSpacing: '-0.5px'
              }}>
                Screener de Acciones
              </h1>
              <p style={{ color: '#8b949e', fontSize: '14px', margin: '4px 0 0' }}>
                Encuentra oportunidades de inversión con análisis fundamental
              </p>
            </div>
          </div>
          
          {/* Stats */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginTop: '24px',
            flexWrap: 'wrap'
          }}>
            {[
              { label: 'Total analizadas', value: stocks.length, color: '#58a6ff' },
              { label: 'Matchean filtros', value: filteredAndSortedStocks.length, color: '#3fb950' },
              { label: 'Sectores activos', value: filters.sectors.length || 'Todos', color: '#a371f7' },
            ].map((stat, i) => (
              <div key={i} style={{
                padding: '16px 20px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px',
                border: '1px solid #30363d',
                flex: '1 1 150px',
              }}>
                <div style={{ color: stat.color, fontSize: '28px', fontWeight: '700' }}>{stat.value}</div>
                <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '4px' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: showFilters ? 'rgba(88, 166, 255, 0.1)' : '#161b22',
            border: showFilters ? '1px solid rgba(88, 166, 255, 0.3)' : '1px solid #30363d',
            borderRadius: '12px',
            color: '#f0f6fc',
            cursor: 'pointer',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚙️</span>
            Filtros de Búsqueda
          </span>
          <span style={{
            padding: '6px 12px',
            background: '#21262d',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#8b949e'
          }}>
            {showFilters ? 'Ocultar' : 'Mostrar'}
          </span>
        </button>

        {showFilters && (
          <div style={{
            background: '#161b22',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            border: '1px solid #30363d',
          }}>
            
            {/* Range Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              {[
                { key: 'maxPe', label: 'P/E Máximo', max: 100, value: filters.maxPe, color: '#58a6ff' },
                { key: 'maxPb', label: 'P/B Máximo', max: 20, step: 0.5, value: filters.maxPb, color: '#a371f7' },
                { key: 'minDividendYield', label: 'Dividend Yield Mín', max: 10, step: 0.5, value: filters.minDividendYield, color: '#3fb950', suffix: '%' },
                { key: 'minRoe', label: 'ROE Mínimo', max: 50, value: filters.minRoe, color: '#f0883e', suffix: '%' },
                { key: 'minMarketCap', label: 'Market Cap Mín', max: 500, value: filters.minMarketCap, color: '#db61a2', prefix: '$', suffix: 'B' },
                { key: 'minRevenue', label: 'Revenue Mín', max: 500, value: filters.minRevenue, color: '#f97316', prefix: '$', suffix: 'B' },
              ].map((filter) => (
                <div key={filter.key} style={{
                  padding: '20px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '12px',
                  border: '1px solid #21262d',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ color: '#c9d1d9', fontSize: '13px', fontWeight: '500' }}>{filter.label}</label>
                    <span style={{ 
                      color: filter.color, 
                      fontSize: '16px', 
                      fontWeight: '700',
                      background: `${filter.color}20`,
                      padding: '4px 10px',
                      borderRadius: '6px',
                    }}>
                      {filter.prefix || ''}{filter.value}{filter.suffix || ''}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={filter.max}
                    step={filter.step || 1}
                    value={filter.value}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      [filter.key]: filter.step ? parseFloat(e.target.value) : parseInt(e.target.value) 
                    }))}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '3px',
                      background: `linear-gradient(to right, ${filter.color} 0%, ${filter.color} ${(filter.value / filter.max) * 100}%, #30363d ${(filter.value / filter.max) * 100}%, #30363d 100%)`,
                      appearance: 'none',
                      cursor: 'pointer',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Checkbox */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                color: '#c9d1d9', 
                cursor: 'pointer',
                padding: '16px',
                background: filters.excludeNegativeEarnings ? 'rgba(63, 185, 80, 0.1)' : 'rgba(0,0,0,0.2)',
                borderRadius: '10px',
                border: filters.excludeNegativeEarnings ? '1px solid rgba(63, 185, 80, 0.3)' : '1px solid #21262d',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  border: `2px solid ${filters.excludeNegativeEarnings ? '#3fb950' : '#484f58'}`,
                  background: filters.excludeNegativeEarnings ? '#3fb950' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  {filters.excludeNegativeEarnings && <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                </div>
                <input
                  type="checkbox"
                  checked={filters.excludeNegativeEarnings}
                  onChange={(e) => setFilters(prev => ({ ...prev, excludeNegativeEarnings: e.target.checked }))}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '14px' }}>Excluir acciones con ganancias negativas (P/E negativo)</span>
              </label>
            </div>

            {/* Sector Pills */}
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '13px', marginBottom: '12px', fontWeight: '500' }}>
                Filtrar por Sector:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {SECTOR_OPTIONS.map(sector => (
                  <button
                    key={sector}
                    onClick={() => toggleSector(sector)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '20px',
                      border: `2px solid ${filters.sectors.includes(sector) ? SECTOR_COLORS[sector] : '#30363d'}`,
                      background: filters.sectors.includes(sector) ? `${SECTOR_COLORS[sector]}20` : '#21262d',
                      color: filters.sectors.includes(sector) ? SECTOR_COLORS[sector] : '#8b949e',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {sector}
                  </button>
                ))}
                {filters.sectors.length > 0 && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, sectors: [] }))}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '20px',
                      border: '2px solid #f85149',
                      background: '#f8514920',
                      color: '#f85149',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Limpiar todo
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Table */}
        <div style={{
          background: '#161b22',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid #30363d',
        }}>
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <h2 style={{ color: '#f0f6fc', fontSize: '16px', fontWeight: '600', margin: 0 }}>
              Resultados ({filteredAndSortedStocks.length})
            </h2>
            <span style={{ color: '#8b949e', fontSize: '12px' }}>
              Clic en encabezado para ordenar
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
              <thead>
                <tr style={{ background: '#21262d' }}>
                  {[
                    { key: 'symbol', label: 'Símbolo', sortable: false },
                    { key: 'regularMarketPrice', label: 'Precio', align: 'right' as const },
                    { key: 'marketCap', label: 'Market Cap', align: 'right' as const },
                    { key: 'peRatio', label: 'P/E', align: 'right' as const },
                    { key: 'priceToBook', label: 'P/B', align: 'right' as const },
                    { key: 'dividendYield', label: 'Div. Yield', align: 'right' as const },
                    { key: 'returnOnEquity', label: 'ROE', align: 'right' as const },
                    { key: 'profitMargin', label: 'Margen', align: 'right' as const },
                    { key: 'revenueGrowth', label: 'Crec.', align: 'right' as const },
                    { key: 'sector', label: 'Sector', align: 'left' as const, sortable: false },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable !== false && handleSort(col.key as keyof StockFundamental)}
                      style={{
                        padding: '14px 16px',
                        textAlign: col.align || 'left',
                        color: '#8b949e',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        cursor: col.sortable !== false ? 'pointer' : 'default',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                      {col.sortable !== false && (
                        <span style={{ 
                          marginLeft: '6px',
                          opacity: sortConfig.key === col.key ? 1 : 0.3,
                          fontSize: '10px',
                        }}>
                          {sortConfig.key === col.key ? (sortConfig.direction === 'desc' ? '↓' : '↑') : '↕'}
                        </span>
                      )}
                    </th>
                  ))}
                  <th style={{ padding: '14px 16px', color: '#8b949e', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedStocks.slice(0, 50).map((stock, index) => (
                  <tr 
                    key={stock.symbol}
                    style={{ 
                      borderTop: index > 0 ? '1px solid #21262d' : 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#1c2128'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: '700', color: '#f0f6fc', fontSize: '15px' }}>{stock.symbol}</div>
                      <div style={{ fontSize: '11px', color: '#6e7681', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stock.shortName}
                      </div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: '#f0f6fc', fontWeight: '600', fontSize: '14px' }}>
                      ${formatNumber(stock.price, 2)}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: '#8b949e', fontSize: '13px' }}>
                      {formatMarketCap(stock.marketCap)}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: getValueColor(stock, 'peRatio'), fontWeight: '600', fontSize: '14px' }}>
                      {formatNumber(stock.peRatio)}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: getValueColor(stock, 'priceToBook'), fontWeight: '600', fontSize: '14px' }}>
                      {formatNumber(stock.priceToBook)}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: getValueColor(stock, 'dividendYield'), fontWeight: '600', fontSize: '14px' }}>
                      {formatNumber(stock.dividendYield)}%
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: getValueColor(stock, 'returnOnEquity'), fontWeight: '600', fontSize: '14px' }}>
                      {formatNumber(stock.returnOnEquity)}%
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: getValueColor(stock, 'profitMargin'), fontWeight: '600', fontSize: '14px' }}>
                      {formatNumber(stock.profitMargin)}%
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', color: getValueColor(stock, 'revenueGrowth'), fontWeight: '600', fontSize: '14px' }}>
                      {formatNumber(stock.revenueGrowth)}%
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        background: stock.sector ? `${SECTOR_COLORS[stock.sector] || '#6e7681'}20` : '#21262d',
                        color: stock.sector ? SECTOR_COLORS[stock.sector] || '#8b949e' : '#8b949e',
                        border: `1px solid ${stock.sector ? SECTOR_COLORS[stock.sector] || '#6e7681' : '#30363d'}40`,
                      }}>
                        {stock.sector || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleAddToWatchlist(stock.symbol)}
                        disabled={addingToWatchlist === stock.symbol}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid #30363d',
                          background: addingToWatchlist === stock.symbol ? '#30363d' : 'linear-gradient(135deg, #238636 0%, #2ea043 100%)',
                          color: addingToWatchlist === stock.symbol ? '#8b949e' : 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: addingToWatchlist === stock.symbol ? 'wait' : 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {addingToWatchlist === stock.symbol ? '...' : '⭐ Watch'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedStocks.length === 0 && (
            <div style={{ 
              padding: '80px 20px', 
              textAlign: 'center', 
            }}>
              <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔍</div>
              <p style={{ color: '#8b949e', fontSize: '18px', marginBottom: '8px' }}>Ninguna acción matchea los filtros</p>
              <p style={{ color: '#484f58', fontSize: '14px' }}>Intenta relajar los criterios de búsqueda</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{
          marginTop: '24px',
          padding: '24px',
          background: '#161b22',
          borderRadius: '12px',
          border: '1px solid #30363d',
        }}>
          <h3 style={{ color: '#f0f6fc', fontSize: '14px', fontWeight: '600', marginTop: 0, marginBottom: '16px' }}>
            📚 Guía de Métricas
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { metric: 'P/E (Price/Earnings)', desc: 'Precio relativo a ganancias. <15 puede indicar valor, >30 puede indicar sobreprecio.', color: '#58a6ff' },
              { metric: 'P/B (Price/Book)', desc: 'Precio relativo a valor en libros. <1 puede indicar subvaloración. Ideal para bancos.', color: '#a371f7' },
              { metric: 'ROE (Return on Equity)', desc: 'Rentabilidad sobre capital propio. >15% indica gestión eficiente.', color: '#3fb950' },
              { metric: 'Dividend Yield', desc: 'Dividendo anual / precio. >4% puede ser atractivo pero investiga el payout ratio.', color: '#f0883e' },
            ].map((item, i) => (
              <div key={i} style={{
                padding: '16px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '10px',
                borderLeft: `3px solid ${item.color}`,
              }}>
                <div style={{ color: item.color, fontWeight: '600', fontSize: '13px', marginBottom: '6px' }}>{item.metric}</div>
                <div style={{ color: '#8b949e', fontSize: '12px', lineHeight: '1.5' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ 
          marginTop: '24px', 
          padding: '20px', 
          background: 'rgba(248, 81, 73, 0.1)', 
          borderRadius: '12px',
          border: '1px solid rgba(248, 81, 73, 0.3)',
          textAlign: 'center'
        }}>
          <p style={{ color: '#f85149', fontSize: '13px', margin: 0 }}>
            ⚠️ Esta herramienta es solo informativa. Los datos son simulados/estimados. No constituye consejo financiero. Investiga siempre antes de invertir.
          </p>
        </div>

      </div>
    </div>
  );
}
