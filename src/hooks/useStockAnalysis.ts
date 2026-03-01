import { useState, useCallback } from 'react';
import type { StockAnalysis, LoadingState } from '../types';
import { getStockData } from '../services/yahooFinance';
import { analyzeStock } from '../services/stockAnalysis';

export function useStockAnalysis() {
  const [analysis, setAnalysis] = useState<StockAnalysis | null>(null);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (symbol: string) => {
    if (!symbol.trim()) {
      setError('Por favor ingresa un ticker válido');
      return;
    }

    setLoading('loading');
    setError(null);
    setAnalysis(null);

    try {
      const data = await getStockData(symbol);
      
      const stockAnalysis = analyzeStock(
        data.quote,
        data.summary,
        data.historical,
        data.priceTarget
      );
      setAnalysis(stockAnalysis);
      setLoading('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al analizar la acción';
      setError(message);
      setLoading('error');
    }
  }, []);

  return {
    analysis,
    loading,
    error,
    analyze,
  };
}
