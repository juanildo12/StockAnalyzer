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

export default function Screener() {
  const [stocks, setStocks] = useState<StockFundamental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>({
    maxPe: 30,
    maxPb: 5,
    minDividendYield: 0,
    minMarketCap: 0,
    sectors: [],
    excludeNegativeEarnings: true,
    minRoe: 0,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'marketCap', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(true);
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(null);

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
      console.error(err);
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
      console.error(err);
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

  const SortIcon = ({ columnKey }: { columnKey: keyof StockFundamental }) => (
    <span style={{ 
      marginLeft: '4px', 
      opacity: sortConfig.key === columnKey ? 1 : 0.3,
      fontSize: '10px'
    }}>
      {sortConfig.key === columnKey ? (sortConfig.direction === 'desc' ? '▼' : '▲') : '⇅'}
    </span>
  );

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        color: '#8b949e'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <p>Cargando acciones...</p>
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
        minHeight: '400px',
        color: '#f85149'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <p>{error}</p>
          <button
            onClick={loadStocks}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              background: '#238636',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '600', 
          color: '#f0f6fc', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '32px' }}>🔍</span>
          Screener de Acciones
        </h1>
        <p style={{ color: '#8b949e', fontSize: '14px' }}>
          Encuentra acciones a descuento usando fundamentales. {filteredAndSortedStocks.length} de {stocks.length} acciones matchean los filtros.
        </p>
      </div>

      <button
        onClick={() => setShowFilters(!showFilters)}
        style={{
          padding: '10px 16px',
          background: '#21262d',
          border: '1px solid #30363d',
          borderRadius: '8px',
          color: '#c9d1d9',
          cursor: 'pointer',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <span>{showFilters ? '▼' : '▶'}</span>
        {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
      </button>

      {showFilters && (
        <div style={{
          background: '#161b22',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          border: '1px solid #30363d'
        }}>
          <h3 style={{ color: '#f0f6fc', marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>
            Filtros de Búsqueda
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '6px' }}>
                P/E Máximo: {filters.maxPe === 0 ? 'Sin límite' : `< ${filters.maxPe}`}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.maxPe}
                onChange={(e) => setFilters(prev => ({ ...prev, maxPe: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '6px' }}>
                P/B Máximo: {filters.maxPb === 0 ? 'Sin límite' : `< ${filters.maxPb}`}
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={filters.maxPb}
                onChange={(e) => setFilters(prev => ({ ...prev, maxPb: parseFloat(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '6px' }}>
                Dividend Yield Mín: {filters.minDividendYield === 0 ? '0%' : `> ${filters.minDividendYield}%`}
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={filters.minDividendYield}
                onChange={(e) => setFilters(prev => ({ ...prev, minDividendYield: parseFloat(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '6px' }}>
                Market Cap Mín: {filters.minMarketCap === 0 ? 'Todos' : `$${filters.minMarketCap}B+`}
              </label>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={filters.minMarketCap}
                onChange={(e) => setFilters(prev => ({ ...prev, minMarketCap: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '6px' }}>
                ROE Mínimo: {filters.minRoe === 0 ? 'Todos' : `> ${filters.minRoe}%`}
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={filters.minRoe}
                onChange={(e) => setFilters(prev => ({ ...prev, minRoe: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c9d1d9', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.excludeNegativeEarnings}
                onChange={(e) => setFilters(prev => ({ ...prev, excludeNegativeEarnings: e.target.checked }))}
              />
              Excluir ganancias negativas (P/E negativo)
            </label>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', color: '#c9d1d9', fontSize: '12px', marginBottom: '8px' }}>
              Sectores:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {SECTOR_OPTIONS.map(sector => (
                <button
                  key={sector}
                  onClick={() => toggleSector(sector)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: filters.sectors.includes(sector) ? '1px solid #238636' : '1px solid #30363d',
                    background: filters.sectors.includes(sector) ? '#23863630' : '#21262d',
                    color: filters.sectors.includes(sector) ? '#3fb950' : '#8b949e',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {sector}
                </button>
              ))}
              {filters.sectors.length > 0 && (
                <button
                  onClick={() => setFilters(prev => ({ ...prev, sectors: [] }))}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: '1px solid #f85149',
                    background: '#f8514930',
                    color: '#f85149',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: '#161b22',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #30363d'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#21262d' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#8b949e', fontSize: '12px', fontWeight: '500' }}>Symbol</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e', fontSize: '12px', fontWeight: '500' }}>Precio</th>
                <th 
                  style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  onClick={() => handleSort('marketCap')}
                >
                  Market Cap <SortIcon columnKey="marketCap" />
                </th>
                <th 
                  style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  onClick={() => handleSort('peRatio')}
                >
                  P/E <SortIcon columnKey="peRatio" />
                </th>
                <th 
                  style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  onClick={() => handleSort('priceToBook')}
                >
                  P/B <SortIcon columnKey="priceToBook" />
                </th>
                <th 
                  style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  onClick={() => handleSort('dividendYield')}
                >
                  Div. Yield <SortIcon columnKey="dividendYield" />
                </th>
                <th 
                  style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  onClick={() => handleSort('returnOnEquity')}
                >
                  ROE <SortIcon columnKey="returnOnEquity" />
                </th>
                <th 
                  style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  onClick={() => handleSort('profitMargin')}
                >
                  Margen <SortIcon columnKey="profitMargin" />
                </th>
                <th 
                  style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
                  onClick={() => handleSort('revenueGrowth')}
                >
                  Crec. Revenue <SortIcon columnKey="revenueGrowth" />
                </th>
                <th style={{ padding: '12px 16px', color: '#8b949e', fontSize: '12px', fontWeight: '500' }}>Sector</th>
                <th style={{ padding: '12px 16px', color: '#8b949e', fontSize: '12px', fontWeight: '500' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedStocks.map((stock, index) => (
                <tr 
                  key={stock.symbol}
                  style={{ 
                    borderTop: index > 0 ? '1px solid #21262d' : 'none',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#1c2128'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: '600', color: '#f0f6fc' }}>{stock.symbol}</div>
                    <div style={{ fontSize: '11px', color: '#8b949e', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stock.shortName}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#f0f6fc' }}>
                    ${formatNumber(stock.price, 2)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#8b949e' }}>
                    {formatMarketCap(stock.marketCap)}
                  </td>
                  <td style={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: (stock.peRatio ?? 0) > 0 && (stock.peRatio ?? 0) <= 25 ? '#3fb950' : 
                            (stock.peRatio ?? 0) > 50 ? '#f85149' : '#c9d1d9'
                  }}>
                    {formatNumber(stock.peRatio)}
                  </td>
                  <td style={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: (stock.priceToBook ?? 0) <= 3 ? '#3fb950' : 
                            (stock.priceToBook ?? 0) > 10 ? '#f85149' : '#c9d1d9'
                  }}>
                    {formatNumber(stock.priceToBook)}
                  </td>
                  <td style={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: (stock.dividendYield ?? 0) >= 2 ? '#3fb950' : '#c9d1d9'
                  }}>
                    {formatNumber(stock.dividendYield)}%
                  </td>
                  <td style={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: (stock.returnOnEquity ?? 0) >= 15 ? '#3fb950' : '#c9d1d9'
                  }}>
                    {formatNumber(stock.returnOnEquity)}%
                  </td>
                  <td style={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: (stock.profitMargin ?? 0) >= 10 ? '#3fb950' : 
                            (stock.profitMargin ?? 0) < 0 ? '#f85149' : '#c9d1d9'
                  }}>
                    {formatNumber(stock.profitMargin)}%
                  </td>
                  <td style={{ 
                    padding: '12px 16px', 
                    textAlign: 'right', 
                    color: (stock.revenueGrowth ?? 0) >= 10 ? '#3fb950' : 
                            (stock.revenueGrowth ?? 0) < 0 ? '#f85149' : '#c9d1d9'
                  }}>
                    {formatNumber(stock.revenueGrowth)}%
                  </td>
                  <td style={{ padding: '12px 16px', color: '#8b949e', fontSize: '12px' }}>
                    {stock.sector}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => handleAddToWatchlist(stock.symbol)}
                      disabled={addingToWatchlist === stock.symbol}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid #30363d',
                        background: addingToWatchlist === stock.symbol ? '#30363d' : '#21262d',
                        color: '#c9d1d9',
                        fontSize: '12px',
                        cursor: addingToWatchlist === stock.symbol ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {addingToWatchlist === stock.symbol ? '⏳' : '⭐'}
                      {addingToWatchlist === stock.symbol ? '...' : 'Watch'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedStocks.length === 0 && (
          <div style={{ 
            padding: '60px 20px', 
            textAlign: 'center', 
            color: '#8b949e' 
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p>Ninguna acción matchea los filtros actuales.</p>
            <p style={{ fontSize: '12px', marginTop: '8px' }}>Intenta relajar los filtros para ver más resultados.</p>
          </div>
        )}
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '16px', 
        background: '#161b22', 
        borderRadius: '8px',
        border: '1px solid #30363d',
        color: '#8b949e',
        fontSize: '12px'
      }}>
        <strong style={{ color: '#c9d1d9' }}>💡 Tips de inversión:</strong>
        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>P/E bajo ({'<'} 25) puede indicar acciones subvaloradas o con problemas</li>
          <li>P/B bajo ({'<'} 3) útil para bancos y companies intensivas en capital</li>
          <li>ROE alto ({'>'} 15%) indica uso eficiente del capital</li>
          <li>Dividend Yield alto ({'>'} 4%) puede indicar value trap - investiga el payout ratio</li>
        </ul>
        <p style={{ marginTop: '12px', color: '#f85149' }}>
          ⚠️ Esta herramienta es solo informativa. No es consejo financiero. Investiga siempre antes de invertir.
        </p>
      </div>
    </div>
  );
}
