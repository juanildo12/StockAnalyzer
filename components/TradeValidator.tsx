'use client';
import { colors as C, radius as R, font as F, spacing as S, shadow, transition as T } from '@/src/utils/webTheme';

import { useState, useEffect, useCallback } from 'react';
import { evaluateTrade, TradeInput, TradeResult } from '@/src/services/tradeValidator';

interface TradeValidatorProps {
  initialSymbol?: string;
  onSymbolChange?: (sym: string) => void;
}

interface MarketTimingResult {
  dayOfWeek: string;
  dayStatus: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';
  marketCondition: string;
  validation: 'no-operar' | 'precaucion' | 'ideal';
  validationColor: string;
  validationBg: string;
  strategy: string;
  message: string;
  details: {
    tendencia: string;
    volumen: string;
    estructura: string;
    eventosCercanos: string;
    ubicacionPrecio: string;
  };
}

const DIAS_ES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado'
};

const DIAS_INGLES: Record<string, string> = {
  'Domingo': 'sunday',
  'Lunes': 'lunes',
  'Martes': 'martes',
  'Miércoles': 'miercoles',
  'Jueves': 'jueves',
  'Viernes': 'viernes',
  'Sábado': 'saturday'
};

function analyzeMarketTiming(
  dayOfWeek: number,
  marketTrend: string,
  volume: number,
  avgVolume: number,
  currentPrice: number,
  support: number,
  resistance: number,
  nearEarnings: boolean,
  earningsDate?: string
): MarketTimingResult {
  const dia = DIAS_ES[dayOfWeek];
  const diaStatus = DIAS_INGLES[dia] as 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';
  
  const tendencia = marketTrend || 'lateral';
  const volumenRatio = avgVolume > 0 ? volume / avgVolume : 1;
  const volumen = volumenRatio > 1.2 ? 'Alto' : volumenRatio < 0.8 ? 'Bajo' : 'Normal';
  
  const rangeSize = resistance - support;
  const midRange = (support + resistance) / 2;
  const priceInRange = rangeSize > 0 ? (currentPrice - support) / rangeSize : 0.5;
  
  let ubicacion = 'En el medio del rango';
  if (priceInRange < 0.35) ubicacion = 'Cerca del soporte';
  else if (priceInRange > 0.65) ubicacion = 'Cerca de la resistencia';
  
  let estructura = 'Consolidación';
  if (tendencia === 'alcista') estructura = 'Breakout';
  else if (tendencia === 'bajista') estructura = 'Rechazo';
  
  let eventosCercanos = 'Sin eventos cercanos';
  if (nearEarnings && earningsDate) {
    eventosCercanos = `Earnings el ${new Date(earningsDate).toLocaleDateString('es-ES')}`;
  }
  
  let validation: 'no-operar' | 'precaucion' | 'ideal' = 'precaucion';
  let validationColor = C.warning;
  let validationBg = `${C.warning20}`;
  let strategy = 'Ninguna';
  let message = '';
  
  const enMedioDelRango = priceInRange >= 0.35 && priceInRange <= 0.65;
  const bajoVolumen = volumen === 'Bajo';
  const eventoCercano = nearEarnings;
  
  if (diaStatus === 'lunes') {
    if (estructura === 'Breakout' && volumen === 'Alto' && !eventoCercano) {
      validation = 'precaucion';
      strategy = 'Bull Call Spread (pequeño)';
      message = 'Es lunes, día de cautela. Solo permitiría un trade si hay breakout claro con volumen. Considera esperar al martes para mayor claridad.';
    } else {
      validation = 'no-operar';
      message = 'Lunes es día de cautela. Evita operar agresivamente. Usa este día para planificar tu semana y observar.';
    }
  } else if (diaStatus === 'martes' || diaStatus === 'miercoles') {
    if (enMedioDelRango) {
      validation = 'no-operar';
      message = 'El precio está en el medio del rango. Espera a que se acerque al soporte para comprar o a resistencia para vender.';
    } else if (bajoVolumen) {
      validation = 'no-operar';
      message = 'El volumen está bajo. Sin volumen no hay convicción. Espera a que el volumen aumente.';
    } else if (eventoCercano) {
      validation = 'precaucion';
      if (tendencia === 'alcista') strategy = 'Put Credit Spread (fecha corta)';
      else strategy = 'Call Credit Spread (fecha corta)';
      message = `Hay evento cercano (${eventosCercanos}). Reduce exposición y usa expiraciones cortas.`;
    } else if (estructura === 'Breakout') {
      validation = 'ideal';
      strategy = 'Bull Call Spread';
      message = '¡Martes/Miércoles! Uno de los mejores días para operar. El mercado muestra señales claras de breakout con buen volumen. Perfecto para un Bull Call Spread.';
    } else if (estructura === 'Rechazo') {
      validation = 'ideal';
      strategy = 'Bear Put Spread';
      message = '¡Martes/Miércoles! El mercado muestra rechazo bajista. Día ideal para un Bear Put Spread según tu plan semanal.';
    } else {
      validation = 'precaucion';
      strategy = 'Put Credit Spread';
      message = 'Mercado estable. Un Put Credit Spread es apropiado para generar income en rangos laterales.';
    }
  } else if (diaStatus === 'jueves') {
    validation = 'precaucion';
    strategy = 'Gestionar posiciones existentes';
    message = 'Jueves es día de gestión. Evita nuevas entradas agresivas. Concéntrate en cerrar posiciones perdedoras o tomar ganancias.';
  } else if (diaStatus === 'viernes') {
    validation = 'no-operar';
    strategy = 'Cerrar trades';
    message = 'Viernes es día de cierre. No abras nuevas posiciones. Cierra trades winners o reduce riesgo en perdedores.';
  }
  
  return {
    dayOfWeek: dia,
    dayStatus: diaStatus,
    marketCondition: `${tendencia.charAt(0).toUpperCase() + tendencia.slice(1)} / ${volumen} / ${estructura}`,
    validation,
    validationColor,
    validationBg,
    strategy,
    message,
    details: {
      tendencia,
      volumen,
      estructura,
      eventosCercanos,
      ubicacionPrecio: ubicacion
    }
  };
}

export default function TradeValidator({ initialSymbol, onSymbolChange }: TradeValidatorProps) {
  const [formData, setFormData] = useState<Omit<TradeInput, 'setupType'> & { setupType: string }>({
    ticker: '',
    currentPrice: 0,
    targetPrice: 0,
    adr: 0,
    impliedVolatility: 0,
    expirationDays: 30,
    setupType: 'breakout'
  });
  const [result, setResult] = useState<TradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSymbol, setLoadingSymbol] = useState(false);
  const [marketTiming, setMarketTiming] = useState<MarketTimingResult | null>(null);
  const [loadingTiming, setLoadingTiming] = useState(false);

  useEffect(() => {
    if (initialSymbol && !formData.ticker) {
      setFormData(prev => ({ ...prev, ticker: initialSymbol }));
    }
  }, [initialSymbol]);

  const loadSymbolData = useCallback(async (symbol: string) => {
    if (!symbol || symbol.length < 1) return;
    
    setLoadingSymbol(true);
    setLoadingTiming(true);
    try {
      const [stockResponse, optionsResponse] = await Promise.all([
        fetch(`/api/stock?symbol=${symbol}`),
        fetch(`/api/options?symbol=${symbol}`)
      ]);
      
      const stockData = await stockResponse.json();
      const optionsData = await optionsResponse.json();
      
      if (stockData.error && optionsData.error) {
        setLoadingSymbol(false);
        setLoadingTiming(false);
        return;
      }

      const currentPrice = stockData.quote?.regularMarketPrice || optionsData.optionsAnalysis?.currentPrice || 0;
      
      let adr = 0;
      if (stockData.historical && stockData.historical.length > 0) {
        const last20Days = stockData.historical.slice(-20);
        const dailyRanges = last20Days.map((d: any) => d.high - d.low);
        adr = dailyRanges.reduce((sum: number, r: number) => sum + r, 0) / dailyRanges.length;
      }
      
      let impliedVolatility = optionsData.optionsAnalysis?.impliedVolatility || 0;
      
      setFormData(prev => ({
        ...prev,
        currentPrice,
        adr: adr || prev.adr,
        impliedVolatility: impliedVolatility || prev.impliedVolatility
      }));
      
      const marketTrend = optionsData.technical?.trend || (stockData.technical?.trend) || 'lateral';
      const volume = stockData.quote?.regularMarketVolume || 0;
      const avgVolume = stockData.quote?.averageVolume || volume * 1.5;
      const support = optionsData.optionsAnalysis?.keyLevels?.support || stockData.technical?.support || currentPrice * 0.95;
      const resistance = optionsData.optionsAnalysis?.keyLevels?.resistance || stockData.technical?.resistance || currentPrice * 1.05;
      const nearEarnings = optionsData.optionsAnalysis?.earningsDaysUntil !== null && optionsData.optionsAnalysis?.earningsDaysUntil !== undefined && optionsData.optionsAnalysis?.earningsDaysUntil <= 30;
      const earningsDate = optionsData.optionsAnalysis?.earningsDate;
      
      const timing = analyzeMarketTiming(
        new Date().getDay(),
        marketTrend,
        volume,
        avgVolume,
        currentPrice,
        support,
        resistance,
        nearEarnings,
        earningsDate
      );
      
      setMarketTiming(timing);
      
    } catch (error) {
      console.error('Error loading symbol data:', error);
    } finally {
      setLoadingSymbol(false);
      setLoadingTiming(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.ticker && formData.ticker.length >= 1) {
        loadSymbolData(formData.ticker);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.ticker, loadSymbolData]);

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    if (field === 'ticker') {
      setFormData(prev => ({ ...prev, ticker: String(value), targetPrice: 0 }));
      if (onSymbolChange && typeof value === 'string') onSymbolChange(value.toUpperCase());
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleEvaluate = () => {
    if (!formData.ticker || !formData.currentPrice || !formData.targetPrice || !formData.adr || !formData.expirationDays) {
      return;
    }

    setLoading(true);
    
    setTimeout(() => {
      const tradeResult = evaluateTrade({
        ticker: formData.ticker.toUpperCase(),
        currentPrice: Number(formData.currentPrice),
        targetPrice: Number(formData.targetPrice),
        adr: Number(formData.adr),
        impliedVolatility: formData.impliedVolatility ? Number(formData.impliedVolatility) : undefined,
        expirationDays: Number(formData.expirationDays),
        setupType: formData.setupType as 'breakout' | 'rechazo' | 'lateral'
      });
      
      setResult(tradeResult);
      setLoading(false);
    }, 500);
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px'
  };

  const cardStyle: React.CSSProperties = {
    background: C.bgCard,
    borderRadius: R.lg,
    border: '1px solid ' + C.border,
    padding: '24px',
    marginBottom: '20px'
  };

  const inputGroupStyle: React.CSSProperties = {
    marginBottom: '16px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    color: C.textMuted,
    fontSize: F.sizeBase,
    fontWeight: '500'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: R.md,
    border: '1px solid ' + C.border,
    background: C.bg,
    color: C.textSecondary,
    fontSize: F.sizeLg,
    boxSizing: 'border-box'
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ color: C.textPrimary, fontSize: '24px', marginBottom: '8px' }}>🎯 Trade Validator</h2>
        <p style={{ color: C.textMuted, fontSize: F.sizeBase, marginBottom: '24px' }}>
          Valida si un trade de opciones está bien estructurado según tiempo, setup y volatilidad
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>
              Ticker {loadingSymbol && <span style={{ color: C.accent, fontSize: F.sizeSm }}>(cargando datos...)</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={formData.ticker}
                onChange={(e) => {
                  handleInputChange('ticker', e.target.value.toUpperCase());
                  if (onSymbolChange) onSymbolChange(e.target.value.toUpperCase());
                }}
                placeholder="AAPL"
                style={{
                  ...inputStyle,
                  paddingRight: loadingSymbol ? '40px' : '12px'
                }}
              />
              {loadingSymbol && (
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: `2px solid ${C.textPrimary4d}`,
                  borderTopColor: C.accent,
                  borderRadius: R.full,
                  animation: 'spin 1s linear infinite'
                }} />
              )}
            </div>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Precio Actual ($)</label>
            <input
              type="number"
              value={formData.currentPrice || ''}
              onChange={(e) => handleInputChange('currentPrice', parseFloat(e.target.value) || 0)}
              placeholder="150.00"
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Precio Objetivo ($)</label>
            <input
              type="number"
              value={formData.targetPrice || ''}
              onChange={(e) => handleInputChange('targetPrice', parseFloat(e.target.value) || 0)}
              placeholder="160.00"
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>ADR ($)</label>
            <input
              type="number"
              value={formData.adr || ''}
              onChange={(e) => handleInputChange('adr', parseFloat(e.target.value) || 0)}
              placeholder="3.50"
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Volatilidad Implícita (opcional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={formData.impliedVolatility || ''}
              onChange={(e) => handleInputChange('impliedVolatility', parseFloat(e.target.value) || 0)}
              placeholder="0.30"
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Días hasta Expiración</label>
            <input
              type="number"
              value={formData.expirationDays || ''}
              onChange={(e) => handleInputChange('expirationDays', parseInt(e.target.value) || 0)}
              placeholder="30"
              style={inputStyle}
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Tipo de Setup</label>
            <select
              value={formData.setupType}
              onChange={(e) => handleInputChange('setupType', e.target.value)}
              style={selectStyle}
            >
              <option value="breakout">📈 Breakout</option>
              <option value="rechazo">📉 Rechazo</option>
              <option value="lateral">➡️ Lateral</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={loading || !formData.ticker || !formData.currentPrice}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: R.md,
            border: 'none',
            background: loading ? C.borderLight : `linear-gradient(135deg, ${C.accent} 0%, ${C.positive} 100%)`,
            color: C.textPrimary,
            fontSize: F.sizeLg,
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '8px'
          }}
        >
          {loading ? 'Evaluando...' : '🎯 Evaluar Trade'}
        </button>
      </div>

      {marketTiming && (
        <div style={{
          ...cardStyle,
          borderLeft: `4px solid ${marketTiming.validationColor}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <span style={{ fontSize: '32px' }}>📅</span>
            <div>
              <h3 style={{ color: C.textPrimary, fontSize: '20px', margin: 0 }}>
                Análisis de Mercado
              </h3>
              <p style={{ color: C.textMuted, fontSize: F.sizeBase, margin: '4px 0 0' }}>
                {marketTiming.dayOfWeek} - {marketTiming.marketCondition}
              </p>
            </div>
            <div style={{
              marginLeft: 'auto',
              padding: '8px 16px',
              borderRadius: '20px',
              background: marketTiming.validationBg,
              color: marketTiming.validationColor,
              fontWeight: '600',
              fontSize: F.sizeBase,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {marketTiming.validation === 'ideal' && '🟢 Ideal'}
              {marketTiming.validation === 'precaucion' && '🟡 Precaución'}
              {marketTiming.validation === 'no-operar' && '🔴 No operar'}
            </div>
          </div>
          
          <div style={{
            padding: '16px',
            borderRadius: R.md,
            background: C.bg,
            marginBottom: '16px'
          }}>
            <div style={{ color: marketTiming.validationColor, fontSize: F.sizeBase, fontWeight: '500' }}>
              {marketTiming.message}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', borderRadius: R.md, background: C.bg, textAlign: 'center' }}>
              <div style={{ color: C.textMuted, fontSize: F.sizeXs, marginBottom: '4px' }}>Tendencia</div>
              <div style={{ color: C.textSecondary, fontSize: F.sizeBase, fontWeight: '500', textTransform: 'capitalize' }}>
                {marketTiming.details.tendencia}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: R.md, background: C.bg, textAlign: 'center' }}>
              <div style={{ color: C.textMuted, fontSize: F.sizeXs, marginBottom: '4px' }}>Volumen</div>
              <div style={{ color: C.textSecondary, fontSize: F.sizeBase, fontWeight: '500' }}>
                {marketTiming.details.volumen}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: R.md, background: C.bg, textAlign: 'center' }}>
              <div style={{ color: C.textMuted, fontSize: F.sizeXs, marginBottom: '4px' }}>Estructura</div>
              <div style={{ color: C.textSecondary, fontSize: F.sizeBase, fontWeight: '500' }}>
                {marketTiming.details.estructura}
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: R.md, background: C.bg, textAlign: 'center' }}>
              <div style={{ color: C.textMuted, fontSize: F.sizeXs, marginBottom: '4px' }}>Ubicación</div>
              <div style={{ color: C.textSecondary, fontSize: F.sizeBase, fontWeight: '500' }}>
                {marketTiming.details.ubicacionPrecio}
              </div>
            </div>
          </div>

          {marketTiming.details.eventosCercanos !== 'Sin eventos cercanos' && (
            <div style={{
              padding: '12px',
              borderRadius: R.md,
              background: `${C.warning20}`,
              border: `1px solid ${C.warning40}`,
              marginBottom: '16px'
            }}>
              <span style={{ color: C.warning, fontSize: F.sizeMd }}>
                ⚠️ {marketTiming.details.eventosCercanos}
              </span>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            borderRadius: R.md,
            background: `${C.accent20}`,
            border: `1px solid ${C.accent40}`
          }}>
            <span style={{ fontSize: '24px' }}>🎯</span>
            <div>
              <div style={{ color: C.textMuted, fontSize: F.sizeSm }}>Estrategia recomendada</div>
              <div style={{ color: C.positive, fontSize: F.sizeLg, fontWeight: '600' }}>
                {marketTiming.strategy}
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (!marketTiming || marketTiming.validation !== 'no-operar') && (
        <>
          <div style={{
            ...cardStyle,
            borderLeft: result.tradeValid ? '4px solid ' + C.positive : '4px solid ' + C.negative
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: R.full,
                background: result.tradeValid ? `${C.positive20}` : `${C.negative20}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px'
              }}>
                {result.tradeValid ? '✅' : '❌'}
              </div>
              <div>
                <h3 style={{ color: C.textPrimary, fontSize: '20px', margin: 0 }}>
                  {result.tradeValid ? 'Trade Válido' : 'Trade No Recomendado'}
                </h3>
                <p style={{ color: C.textMuted, fontSize: F.sizeBase, margin: '4px 0 0' }}>
                  Score: {result.score}/3
                </p>
              </div>
              <div style={{
                marginLeft: 'auto',
                padding: '8px 16px',
                borderRadius: '20px',
                background: result.score === 3 ? `${C.positive20}` : result.score === 2 ? `${C.accent20}` : `${C.negative20}`,
                color: result.score === 3 ? C.positive : result.score === 2 ? C.accent : C.negative,
                fontWeight: '600',
                fontSize: F.sizeBase
              }}>
                {result.score === 3 ? 'Excelente' : result.score === 2 ? 'Bueno' : 'Débil'}
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: R.md,
              background: C.bg,
              color: result.tradeValid ? C.positive : C.negative,
              fontSize: F.sizeBase,
              fontWeight: '500'
            }}>
              {result.messages.overall}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={cardStyle}>
              <h4 style={{ color: C.textPrimary, fontSize: F.sizeLg, marginBottom: '12px' }}>📊 Análisis de Tiempo</h4>
              <div style={{ fontSize: F.sizeBase, color: result.messages.timeOk ? C.positive : C.negative }}>
                <p style={{ margin: '0 0 8px' }}>{result.messages.timeValidation}</p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <div>
                    <span style={{ color: C.textMuted }}>Distancia: </span>
                    <strong>${result.distance.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: C.textMuted }}>Días estimados: </span>
                    <strong>{result.estimatedDays.toFixed(1)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h4 style={{ color: C.textPrimary, fontSize: F.sizeLg, marginBottom: '12px' }}>📈 Expiración</h4>
              <div style={{ fontSize: F.sizeBase, color: result.messages.expirationOk ? C.positive : C.negative }}>
                <p style={{ margin: '0 0 8px' }}>{result.messages.expirationValidation}</p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <div>
                    <span style={{ color: C.textMuted }}>Días disponibles: </span>
                    <strong>{formData.expirationDays}</strong>
                  </div>
                </div>
              </div>
            </div>

            {result.messages.volatilityValidation && (
              <div style={cardStyle}>
                <h4 style={{ color: C.textPrimary, fontSize: F.sizeLg, marginBottom: '12px' }}>🎲 Volatilidad</h4>
                <div style={{ fontSize: F.sizeBase, color: result.messages.volatilityOk ? C.positive : C.negative }}>
                  <p style={{ margin: '0 0 8px' }}>{result.messages.volatilityValidation}</p>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    <div>
                      <span style={{ color: C.textMuted }}>IV: </span>
                      <strong>{((formData.impliedVolatility ?? 0) * 100).toFixed(0)}%</strong>
                    </div>
                    {result.expectedMove && (
                      <div>
                        <span style={{ color: C.textMuted }}>Mov. esperado: </span>
                        <strong>${result.expectedMove.toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h4 style={{ color: C.textPrimary, fontSize: '18px', marginBottom: '16px' }}>💼 Estrategia Recomendada</h4>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: R.md,
              background: C.bg,
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '24px' }}>
                {result.structure.type === 'Bull Call Spread' ? '📈' : result.structure.type === 'Bear Put Spread' ? '📉' : '➡️'}
              </span>
              <div>
                <div style={{ color: C.textPrimary, fontSize: '18px', fontWeight: '600' }}>{result.strategy}</div>
                <div style={{ color: C.textMuted, fontSize: F.sizeBase }}>{result.structure.description}</div>
              </div>
            </div>

            <h5 style={{ color: C.textPrimary, fontSize: F.sizeBase, marginBottom: '12px' }}>Estructura:</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.structure.legs.map((leg, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: R.md,
                  background: leg.type === 'buy' ? `${C.accent20}` : `${C.negative20}`,
                  border: `1px solid ${leg.type === 'buy' ? C.accent : C.negative}40`
                }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: R.sm,
                    background: leg.type === 'buy' ? C.accent : C.negative,
                    color: C.textPrimary,
                    fontSize: F.sizeSm,
                    fontWeight: '600'
                  }}>
                    {leg.type === 'buy' ? 'COMPRAR' : 'VENDER'}
                  </span>
                  <span style={{ color: C.textSecondary }}>
                    {leg.optionType === 'call' ? 'Call' : 'Put'} ${leg.strike}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
