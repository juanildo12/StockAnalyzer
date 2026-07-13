'use client';

import { useState, useEffect, useRef } from 'react';
import { predictML, extractFeatures, type MLResult } from '@/src/services/mlClassifier';

interface SignalData {
  components: Record<string, number>;
  details?: { marketCap?: number; peRatio?: number; rsi?: number; fcf?: number };
}

interface UseMLSignalResult {
  mlResult: MLResult | null;
  loading: boolean;
  error: string | null;
}

export function useMLSignal(signalData: SignalData | null): UseMLSignalResult {
  const [mlResult, setMlResult] = useState<MLResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  useEffect(() => {
    if (!signalData?.components) { setMlResult(null); return; }

    const runId = ++abortRef.current;
    setLoading(true);
    setError(null);

    try {
      const features = extractFeatures(signalData);

      predictML(features)
        .then(result => {
          if (runId === abortRef.current) { setMlResult(result); setLoading(false); }
        })
        .catch(err => {
          if (runId === abortRef.current) {
            setError(err instanceof Error ? err.message : 'ML inference failed');
            setLoading(false);
          }
        });
    } catch (err) {
      if (runId === abortRef.current) {
        setError(err instanceof Error ? err.message : 'Feature extraction failed');
        setLoading(false);
      }
    }
  }, [
    signalData?.components?.peRatio,
    signalData?.components?.fcfYield,
    signalData?.components?.revenueGrowth,
    signalData?.components?.profitMargin,
    signalData?.details?.rsi,
    signalData?.details?.marketCap,
  ]);

  return { mlResult, loading, error };
}
