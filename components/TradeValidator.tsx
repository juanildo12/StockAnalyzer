'use client';

import { useState, useEffect } from 'react';
import { evaluateTrade, TradeInput, TradeResult } from '@/src/services/tradeValidator';

interface TradeValidatorProps {
  initialSymbol?: string;
  onSymbolChange?: (sym: string) => void;
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

  useEffect(() => {
    if (initialSymbol && !formData.ticker) {
      setFormData(prev => ({ ...prev, ticker: initialSymbol }));
    }
  }, [initialSymbol]);

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    background: '#161b22',
    borderRadius: '12px',
    border: '1px solid #30363d',
    padding: '24px',
    marginBottom: '20px'
  };

  const inputGroupStyle: React.CSSProperties = {
    marginBottom: '16px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    color: '#8b949e',
    fontSize: '14px',
    fontWeight: '500'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #30363d',
    background: '#0d1117',
    color: '#c9d1d9',
    fontSize: '16px',
    boxSizing: 'border-box'
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={{ color: '#f0f6fc', fontSize: '24px', marginBottom: '8px' }}>🎯 Trade Validator</h2>
        <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '24px' }}>
          Valida si un trade de opciones está bien estructurado según tiempo, setup y volatilidad
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Ticker</label>
            <input
              type="text"
              value={formData.ticker}
              onChange={(e) => {
                handleInputChange('ticker', e.target.value.toUpperCase());
                if (onSymbolChange) onSymbolChange(e.target.value.toUpperCase());
              }}
              placeholder="AAPL"
              style={inputStyle}
            />
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
            borderRadius: '8px',
            border: 'none',
            background: loading ? '#21262d' : 'linear-gradient(135deg, #238636 0%, #2ea043 100%)',
            color: 'white',
            fontSize: '16px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: '8px'
          }}
        >
          {loading ? 'Evaluando...' : '🎯 Evaluar Trade'}
        </button>
      </div>

      {result && (
        <>
          <div style={{
            ...cardStyle,
            borderLeft: result.tradeValid ? '4px solid #3fb950' : '4px solid #f85149'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: result.tradeValid ? '#3fb95020' : '#f8514920',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px'
              }}>
                {result.tradeValid ? '✅' : '❌'}
              </div>
              <div>
                <h3 style={{ color: '#f0f6fc', fontSize: '20px', margin: 0 }}>
                  {result.tradeValid ? 'Trade Válido' : 'Trade No Recomendado'}
                </h3>
                <p style={{ color: '#8b949e', fontSize: '14px', margin: '4px 0 0' }}>
                  Score: {result.score}/3
                </p>
              </div>
              <div style={{
                marginLeft: 'auto',
                padding: '8px 16px',
                borderRadius: '20px',
                background: result.score === 3 ? '#3fb95020' : result.score === 2 ? '#58a6ff20' : '#f8514920',
                color: result.score === 3 ? '#3fb950' : result.score === 2 ? '#58a6ff' : '#f85149',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                {result.score === 3 ? 'Excelente' : result.score === 2 ? 'Bueno' : 'Débil'}
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '8px',
              background: '#0d1117',
              color: result.tradeValid ? '#3fb950' : '#f85149',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {result.messages.overall}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={cardStyle}>
              <h4 style={{ color: '#f0f6fc', fontSize: '16px', marginBottom: '12px' }}>📊 Análisis de Tiempo</h4>
              <div style={{ fontSize: '14px', color: result.messages.timeOk ? '#3fb950' : '#f85149' }}>
                <p style={{ margin: '0 0 8px' }}>{result.messages.timeValidation}</p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <div>
                    <span style={{ color: '#8b949e' }}>Distancia: </span>
                    <strong>${result.distance.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#8b949e' }}>Días estimados: </span>
                    <strong>{result.estimatedDays.toFixed(1)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h4 style={{ color: '#f0f6fc', fontSize: '16px', marginBottom: '12px' }}>📈 Expiración</h4>
              <div style={{ fontSize: '14px', color: result.messages.expirationOk ? '#3fb950' : '#f85149' }}>
                <p style={{ margin: '0 0 8px' }}>{result.messages.expirationValidation}</p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                  <div>
                    <span style={{ color: '#8b949e' }}>Días disponibles: </span>
                    <strong>{formData.expirationDays}</strong>
                  </div>
                </div>
              </div>
            </div>

            {result.messages.volatilityValidation && (
              <div style={cardStyle}>
                <h4 style={{ color: '#f0f6fc', fontSize: '16px', marginBottom: '12px' }}>🎲 Volatilidad</h4>
                <div style={{ fontSize: '14px', color: result.messages.volatilityOk ? '#3fb950' : '#f85149' }}>
                  <p style={{ margin: '0 0 8px' }}>{result.messages.volatilityValidation}</p>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    <div>
                      <span style={{ color: '#8b949e' }}>IV: </span>
                      <strong>{((formData.impliedVolatility ?? 0) * 100).toFixed(0)}%</strong>
                    </div>
                    {result.expectedMove && (
                      <div>
                        <span style={{ color: '#8b949e' }}>Mov. esperado: </span>
                        <strong>${result.expectedMove.toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h4 style={{ color: '#f0f6fc', fontSize: '18px', marginBottom: '16px' }}>💼 Estrategia Recomendada</h4>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: '8px',
              background: '#0d1117',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '24px' }}>
                {result.structure.type === 'Bull Call Spread' ? '📈' : result.structure.type === 'Bear Put Spread' ? '📉' : '➡️'}
              </span>
              <div>
                <div style={{ color: '#f0f6fc', fontSize: '18px', fontWeight: '600' }}>{result.strategy}</div>
                <div style={{ color: '#8b949e', fontSize: '14px' }}>{result.structure.description}</div>
              </div>
            </div>

            <h5 style={{ color: '#f0f6fc', fontSize: '14px', marginBottom: '12px' }}>Estructura:</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.structure.legs.map((leg, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: leg.type === 'buy' ? '#23863620' : '#f8514920',
                  border: `1px solid ${leg.type === 'buy' ? '#238636' : '#f85149'}40`
                }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '4px',
                    background: leg.type === 'buy' ? '#238636' : '#f85149',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {leg.type === 'buy' ? 'COMPRAR' : 'VENDER'}
                  </span>
                  <span style={{ color: '#c9d1d9' }}>
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
