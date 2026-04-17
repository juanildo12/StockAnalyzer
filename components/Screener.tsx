'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface StockFundamental {
  symbol: string;
  shortName: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  peRatio?: number;
  pegRatio?: number;
  priceToBook?: number;
  priceToSales?: number;
  priceToFreeCashFlow?: number;
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
  operatingCashFlow?: number;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
}

interface ScreenerStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  sector: string;
  marketCap: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  iv: number;
  ivRank: number;
  ivPercentile: number;
  dividendYield: number;
  nearEarnings: boolean;
  daysUntilEarnings: number | null;
  earningsDate: string | null;
  earningsEstimate: any;
  stockTrend: string;
  suitabilityScore: number;
  recommendation: 'excellent' | 'buena' | 'regular' | 'poor';
  reasons: string[];
  topStrategy: string;
  recommendedStrategies: {
    name: string;
    score: number;
    rationale: string;
  }[];
}

interface Filters {
  minScore: number;
  minIV: number;
  maxIV: number;
  minVolumeRatio: number;
  minMarketCap: number;
  sectors: string[];
  excludeNearEarnings: boolean;
}

interface SortConfig {
  key: keyof StockFundamental | 'valueScore';
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
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({});
  const [priceChanges, setPriceChanges] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState<Filters>({
    minScore: 0,
    minIV: 0,
    maxIV: 100,
    minVolumeRatio: 0,
    minMarketCap: 0,
    sectors: [],
    excludeNearEarnings: false,
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'valueScore', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(true);
  const [addingToWatchlist, setAddingToWatchlist] = useState<string | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasNavigated = useRef(false);
  const [screenerSummary, setScreenerSummary] = useState<{
    excellent: number;
    buena: number;
    regular: number;
    notRecommended: number;
    totalScanned: number;
  } | null>(null);
  const isVisible = useRef(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleAnalyzeStock = (symbol: string) => {
    router.push(`/?symbol=${symbol}&tab=options`);
  };

  useEffect(() => {
    setMounted(true);
    loadStocks();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlSymbol = searchParams.get('symbol');
    if (urlSymbol && !hasNavigated.current) {
      hasNavigated.current = true;
      handleAnalyzeStock(urlSymbol.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isVisible.current) {
        isVisible.current = true;
        if (!isRefreshing) {
          setIsRefreshing(true);
          loadStocks(true);
        }
      } else if (document.visibilityState === 'hidden') {
        isVisible.current = false;
      }
    };

    const handleFocus = () => {
      if (!isVisible.current) {
        isVisible.current = true;
        if (!isRefreshing) {
          setIsRefreshing(true);
          loadStocks(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isRefreshing]);

  const handleManualRefresh = useCallback(() => {
    if (!isRefreshing) {
      setIsRefreshing(true);
      loadStocks(true);
    }
  }, [isRefreshing]);

  const loadStocks = async (silent = false, retryCount = 0) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError('');
      const response = await fetch(`/api/options?screen=screener&t=${Date.now()}`, {
        signal: AbortSignal.timeout(120000),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.all && data.all.length > 0) {
        setStocks(data.all);
        setScreenerSummary({
          excellent: data.summary?.excellent || 0,
          buena: data.summary?.buena || 0,
          regular: data.summary?.regular || 0,
          notRecommended: data.summary?.notRecommended || 0,
          totalScanned: data.totalScanned || data.all.length,
        });
        if (data.lastUpdated) {
          setLastUpdated(new Date(data.lastUpdated));
        } else {
          setLastUpdated(new Date());
        }
      } else if (retryCount < 2) {
        setTimeout(() => loadStocks(silent, retryCount + 1), 2000);
      } else {
        setError('No se pudieron cargar las acciones. Intenta recargar la página.');
      }
    } catch (err) {
      console.error('Load stocks error:', err);
      if (retryCount < 2) {
        setTimeout(() => loadStocks(silent, retryCount + 1), 2000);
      } else if (!silent) {
        setError('Error al cargar. Verifica tu conexión e intenta de nuevo.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setIsRefreshing(false);
    }
  };

  const handleRetry = () => loadStocks(0);

  const filteredAndSortedStocks = useMemo(() => {
    let filtered = stocks.filter(stock => {
      if (filters.sectors.length > 0 && stock.sector && !filters.sectors.includes(stock.sector)) return false;
      if (stock.suitabilityScore < filters.minScore) return false;
      if ((stock.iv * 100) < filters.minIV) return false;
      if ((stock.iv * 100) > filters.maxIV) return false;
      if (stock.volumeRatio < filters.minVolumeRatio) return false;
      if (filters.excludeNearEarnings && stock.nearEarnings) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortConfig.key) {
        case 'valueScore':
          aVal = a.suitabilityScore;
          bVal = b.suitabilityScore;
          break;
        case 'price':
          aVal = a.price;
          bVal = b.price;
          break;
        case 'changePercent':
          aVal = a.changePercent;
          bVal = b.changePercent;
          break;
        case 'iv':
          aVal = a.iv;
          bVal = b.iv;
          break;
        case 'volumeRatio':
          aVal = a.volumeRatio;
          bVal = b.volumeRatio;
          break;
        case 'marketCap':
          aVal = a.marketCap;
          bVal = b.marketCap;
          break;
        default:
          aVal = a.suitabilityScore;
          bVal = b.suitabilityScore;
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [stocks, filters, sortConfig]);

  const handleSort = (key: keyof StockFundamental | 'valueScore') => {
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

  const { data: session } = useSession();
  const LOCAL_WATCHLIST_KEY = 'local-watchlist';

  const handleAddToWatchlist = async (symbol: string) => {
    setAddingToWatchlist(symbol);
    try {
      if (session?.user?.email) {
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
      } else {
        const local = localStorage.getItem(LOCAL_WATCHLIST_KEY);
        const items = local ? JSON.parse(local) : [];
        if (!items.some((w: any) => w.symbol === symbol.toUpperCase())) {
          items.push({
            symbol: symbol.toUpperCase(),
            addedAt: new Date().toISOString(),
            alertEnabled: false,
            alertPrice: 0,
            alertType: 'above',
          });
          localStorage.setItem(LOCAL_WATCHLIST_KEY, JSON.stringify(items));
          alert(`${symbol} agregado a Watchlist`);
        } else {
          alert(`${symbol} ya está en tu Watchlist`);
        }
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

  if (!mounted || loading) {
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
            onClick={handleRetry}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                {lastUpdated && (
                  <p style={{ color: '#58a6ff', fontSize: '12px', margin: '8px 0 0', fontWeight: '500' }}>
                    🕐 Actualizado: {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                style={{
                  padding: '10px 20px',
                  background: isRefreshing ? '#21262d' : 'linear-gradient(135deg, #238636 0%, #2ea043 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isRefreshing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                }} />
                {isRefreshing ? 'Actualizando...' : 'Actualizar'}
              </button>
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
              { label: 'Total analizadas', value: screenerSummary?.totalScanned || stocks.length, color: '#58a6ff' },
              { label: 'Excelentes', value: screenerSummary?.excellent || 0, color: '#3fb950' },
              { label: 'Buenas', value: screenerSummary?.buena || 0, color: '#f0883e' },
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
            
            {/* Preset Buttons */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#c9d1d9', fontSize: '13px', marginBottom: '12px', fontWeight: '500' }}>
                Presets:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  onClick={() => setFilters({ minScore: 0, minIV: 40, maxIV: 100, minVolumeRatio: 0, minMarketCap: 0, sectors: [], excludeNearEarnings: false })}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '20px',
                    border: '2px solid #3fb950',
                    background: '#3fb95020',
                    color: '#3fb950',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  💰 High IV
                </button>
                <button
                  onClick={() => setFilters({ minScore: 0, minIV: 0, maxIV: 100, minVolumeRatio: 1.5, minMarketCap: 0, sectors: [], excludeNearEarnings: false })}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '20px',
                    border: '2px solid #f0883e',
                    background: '#f0883e20',
                    color: '#f0883e',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🔥 High Volume
                </button>
                <button
                  onClick={() => setFilters({ minScore: 55, minIV: 0, maxIV: 100, minVolumeRatio: 0, minMarketCap: 0, sectors: [], excludeNearEarnings: false })}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '20px',
                    border: '2px solid #a371f7',
                    background: '#a371f720',
                    color: '#a371f7',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  ⭐ Top Picks
                </button>
                <button
                  onClick={() => setFilters({ minScore: 0, minIV: 0, maxIV: 100, minVolumeRatio: 0, minMarketCap: 0, sectors: [], excludeNearEarnings: false })}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '20px',
                    border: '2px solid #6e7681',
                    background: 'transparent',
                    color: '#8b949e',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Reset
                </button>
              </div>
            </div>

            {/* Range Filters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
              {[
                { key: 'minScore', label: 'Score Mínimo', max: 100, value: filters.minScore, color: '#58a6ff', suffix: '' },
                { key: 'minIV', label: 'IV Mínimo', max: 100, value: filters.minIV, color: '#f0883e', suffix: '%', step: 5 },
                { key: 'minVolumeRatio', label: 'Volumen Ratio Mín', max: 3, value: filters.minVolumeRatio, color: '#3fb950', suffix: 'x', step: 0.1 },
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
                background: filters.excludeNearEarnings ? 'rgba(63, 185, 80, 0.1)' : 'rgba(0,0,0,0.2)',
                borderRadius: '10px',
                border: filters.excludeNearEarnings ? '1px solid rgba(63, 185, 80, 0.3)' : '1px solid #21262d',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '6px',
                  border: `2px solid ${filters.excludeNearEarnings ? '#3fb950' : '#484f58'}`,
                  background: filters.excludeNearEarnings ? '#3fb950' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  {filters.excludeNearEarnings && <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>✓</span>}
                </div>
                <input
                  type="checkbox"
                  checked={filters.excludeNearEarnings}
                  onChange={(e) => setFilters(prev => ({ ...prev, excludeNearEarnings: e.target.checked }))}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '14px' }}>Excluir acciones con earnings cercanos (30 días)</span>
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
              Acciones para Opciones ({filteredAndSortedStocks.length})
            </h2>
            <span style={{ color: '#8b949e', fontSize: '12px' }}>
              Ordenadas por score de idoneidad
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: '#21262d' }}>
                  {[
                    { key: 'valueScore', label: 'Score', align: 'center' as const },
                    { key: 'symbol', label: 'Símbolo', align: 'left' as const },
                    { key: 'price', label: 'Precio', align: 'right' as const },
                    { key: 'change', label: '%', align: 'right' as const },
                    { key: 'iv', label: 'IV', align: 'right' as const },
                    { key: 'ivRank', label: 'IV Rank', align: 'right' as const },
                    { key: 'nearEarnings', label: 'Earnings', align: 'center' as const },
                    { key: 'topStrategy', label: 'Estrategia', align: 'left' as const },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable !== false && handleSort(col.key as keyof StockFundamental | 'valueScore')}
                      style={{
                        padding: '14px 12px',
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
                          marginLeft: '4px',
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
                {filteredAndSortedStocks.map((stock, index) => {
                  const scoreColor = stock.suitabilityScore >= 75 ? '#3fb950' : stock.suitabilityScore >= 55 ? '#f0883e' : stock.suitabilityScore >= 35 ? '#a371f7' : '#f85149';
                  const scoreBg = stock.suitabilityScore >= 75 ? '#3fb95020' : stock.suitabilityScore >= 55 ? '#f0883e20' : stock.suitabilityScore >= 35 ? '#a371f720' : '#f8514920';
                  
                  return (
                    <tr 
                      key={stock.symbol}
                      onClick={() => handleAnalyzeStock(stock.symbol)}
                      style={{ 
                        borderTop: index > 0 ? '1px solid #21262d' : 'none',
                        transition: 'background 0.15s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#1c2128'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '48px',
                          height: '48px',
                          borderRadius: '10px',
                          background: scoreBg,
                          border: `2px solid ${scoreColor}`,
                          fontWeight: '700',
                          fontSize: '15px',
                          color: scoreColor,
                        }}>
                          {stock.suitabilityScore}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '700', color: '#58a6ff', fontSize: '15px' }}>{stock.symbol}</div>
                        <div style={{ fontSize: '10px', color: '#6e7681', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {stock.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '2px' }}>
                          {stock.sector}
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#f0f6fc', fontWeight: '600', fontSize: '14px' }}>
                        ${stock.price?.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600', fontSize: '13px', color: stock.changePercent > 0 ? '#3fb950' : stock.changePercent < 0 ? '#f85149' : '#8b949e' }}>
                        {stock.changePercent > 0 ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: stock.iv > 0.5 ? '#f0883e' : stock.iv > 0.3 ? '#a371f7' : '#3fb950', fontWeight: '600', fontSize: '13px' }}>
                        {(stock.iv * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', color: '#8b949e', fontWeight: '600', fontSize: '13px' }}>
                        {stock.ivRank?.toFixed(0) || '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {stock.nearEarnings ? (
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: '#f0883e20',
                            color: '#f0883e',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}>
                            📅 {stock.daysUntilEarnings}d
                          </span>
                        ) : (
                          <span style={{ color: '#484f58', fontSize: '11px' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ color: '#c9d1d9', fontSize: '12px', fontWeight: '500' }}>
                          {stock.topStrategy}
                        </div>
                        {stock.reasons.length > 0 && (
                          <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '2px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {stock.reasons[0]}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddToWatchlist(stock.symbol); }}
                          disabled={addingToWatchlist === stock.symbol}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #30363d',
                            background: addingToWatchlist === stock.symbol ? '#30363d' : '#23863620',
                            color: addingToWatchlist === stock.symbol ? '#8b949e' : '#3fb950',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: addingToWatchlist === stock.symbol ? 'wait' : 'pointer',
                          }}
                        >
                          {addingToWatchlist === stock.symbol ? '...' : '⭐'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
