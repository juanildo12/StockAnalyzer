import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PortfolioItem, StockAnalysis, StockQuote } from '../types';
import { getStockQuote } from '../services/yahooFinance';

const STORAGE_KEY = 'stock-analyzer-portfolio';

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPortfolio(parsed);
        }
      } catch {
        setPortfolio([]);
      }
      setIsLoaded(true);
    };
    loadPortfolio();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    }
  }, [portfolio, isLoaded]);

  const refreshPrices = useCallback(async () => {
    if (portfolio.length === 0) return;

    setIsRefreshing(true);

    try {
      const updatedPortfolio = await Promise.all(
        portfolio.map(async item => {
          try {
            const newQuote = await getStockQuote(item.symbol);
            return {
              ...item,
              analysis: {
                ...item.analysis,
                quote: newQuote,
              },
              lastPriceUpdate: new Date().toISOString(),
            };
          } catch {
            return item;
          }
        }),
      );

      setPortfolio(updatedPortfolio);
    } catch {
    } finally {
      setIsRefreshing(false);
    }
  }, [portfolio]);

  const addToPortfolio = useCallback((analysis: StockAnalysis, purchasePrice?: number, shares?: number) => {
    const symbol = analysis.quote.symbol;
    setPortfolio(prev => {
      if (prev.some(item => item.symbol === symbol)) {
        return prev.map(item =>
          item.symbol === symbol
            ? { ...item, analysis, addedAt: new Date().toISOString(), purchasePrice, shares }
            : item,
        );
      }
      return [
        ...prev,
        {
          symbol,
          addedAt: new Date().toISOString(),
          analysis,
          purchasePrice,
          shares,
        },
      ];
    });
  }, []);

  const removeFromPortfolio = useCallback((symbol: string) => {
    setPortfolio(prev => prev.filter(item => item.symbol !== symbol));
  }, []);

  const isInPortfolio = useCallback(
    (symbol: string) => {
      return portfolio.some(item => item.symbol === symbol);
    },
    [portfolio],
  );

  return {
    portfolio,
    addToPortfolio,
    removeFromPortfolio,
    isInPortfolio,
    refreshPrices,
    isRefreshing,
  };
}
