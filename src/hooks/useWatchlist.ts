import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WatchlistItem, StockAnalysis } from '../types';
import { getStockQuote } from '../services/yahooFinance';
import { auth } from '../services/firebase';
import {
  getWatchlistFromFirestore,
  addWatchlistItem as fbAddWatchlistItem,
  updateWatchlistItem as fbUpdateWatchlistItem,
  removeWatchlistItem as fbRemoveWatchlistItem,
} from '../services/firebase';

const STORAGE_KEY = 'stock-analyzer-watchlist';

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadWatchlist = async () => {
      try {
        let localWatchlist: WatchlistItem[] = [];
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          localWatchlist = JSON.parse(stored);
        }

        if (userId) {
          try {
            const firebaseWatchlist = await getWatchlistFromFirestore(userId);
            if (firebaseWatchlist.length > 0) {
              const merged = mergeWatchlists(localWatchlist, firebaseWatchlist);
              setWatchlist(merged);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } else {
              setWatchlist(localWatchlist);
            }
          } catch {
            setWatchlist(localWatchlist);
          }
        } else {
          setWatchlist(localWatchlist);
        }
      } catch {
        setWatchlist([]);
      }
      setIsLoaded(true);
    };
    loadWatchlist();
  }, [userId]);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    }
  }, [watchlist, isLoaded]);

  const mergeWatchlists = (local: WatchlistItem[], firebase: WatchlistItem[]): WatchlistItem[] => {
    const merged = [...firebase];
    local.forEach(item => {
      if (!merged.some(m => m.symbol === item.symbol)) {
        merged.push(item);
      }
    });
    return merged;
  };

  const refreshPrices = useCallback(async () => {
    if (watchlist.length === 0) return;

    setIsRefreshing(true);

    try {
      const updatedWatchlist = await Promise.all(
        watchlist.map(async item => {
          try {
            const quote = await getStockQuote(item.symbol);
            return {
              ...item,
              currentPrice: quote.regularMarketPrice,
              changePercent: quote.regularMarketChangePercent,
              lastPriceUpdate: new Date().toISOString(),
            };
          } catch {
            return item;
          }
        }),
      );

      setWatchlist(updatedWatchlist);
    } catch {
    } finally {
      setIsRefreshing(false);
    }
  }, [watchlist]);

  const addToWatchlist = useCallback(async (analysis?: StockAnalysis) => {
    const symbol = analysis?.quote.symbol || '';
    if (!symbol) return;

    const newItem: WatchlistItem = {
      symbol,
      addedAt: new Date().toISOString(),
      alertEnabled: false,
      currentPrice: analysis?.quote.regularMarketPrice,
      changePercent: analysis?.quote.regularMarketChangePercent,
      analysis,
    };

    setWatchlist(prev => {
      if (prev.some(item => item.symbol === symbol)) {
        return prev;
      }
      return [...prev, newItem];
    });

    if (userId) {
      try {
        await fbAddWatchlistItem(userId, {
          symbol,
          addedAt: newItem.addedAt,
          alertEnabled: false,
        });
      } catch {}
    }
  }, [userId]);

  const removeFromWatchlist = useCallback(async (symbol: string) => {
    setWatchlist(prev => prev.filter(item => item.symbol !== symbol));

    if (userId) {
      try {
        await fbRemoveWatchlistItem(userId, symbol);
      } catch {}
    }
  }, [userId]);

  const updateNotes = useCallback(async (symbol: string, notes: string) => {
    setWatchlist(prev =>
      prev.map(item =>
        item.symbol === symbol ? { ...item, notes } : item,
      ),
    );

    if (userId) {
      try {
        await fbUpdateWatchlistItem(userId, symbol, { notes });
      } catch {}
    }
  }, [userId]);

  const setAlert = useCallback(async (
    symbol: string,
    alertPrice?: number,
    alertType?: 'above' | 'below',
    alertEnabled?: boolean,
  ) => {
    setWatchlist(prev =>
      prev.map(item =>
        item.symbol === symbol
          ? { ...item, alertPrice, alertType, alertEnabled: alertEnabled ?? true }
          : item,
      ),
    );

    if (userId) {
      try {
        await fbUpdateWatchlistItem(userId, symbol, { alertPrice, alertType, alertEnabled });
      } catch {}
    }
  }, [userId]);

  const isInWatchlist = useCallback(
    (symbol: string) => {
      return watchlist.some(item => item.symbol === symbol);
    },
    [watchlist],
  );

  const getWatchlistItem = useCallback(
    (symbol: string) => {
      return watchlist.find(item => item.symbol === symbol);
    },
    [watchlist],
  );

  return {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    updateNotes,
    setAlert,
    isInWatchlist,
    getWatchlistItem,
    refreshPrices,
    isRefreshing,
  };
}
