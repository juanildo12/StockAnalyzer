import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { theme } from '../constants/theme';
import { CandlestickChart } from '../components/CandlestickChart';
import { MascotBubble } from '../components/MascotBubble';
import { hapticsSelection, hapticsSuccess, hapticsError } from '../utils/haptics';
import type { CandleData } from '../types';

const SYMBOLS = [
  { ticker: 'MOONCO', name: 'MoonCo Industries', volatility: 0.03 },
  { ticker: 'STAR', name: 'Stellar Corp', volatility: 0.05 },
  { ticker: 'NOVA', name: 'NovaTech', volatility: 0.08 },
];

function generateCandle(prevClose: number, vol: number): CandleData {
  const change = (Math.random() - 0.5) * 2 * prevClose * vol;
  const open = prevClose;
  const close = +(open + change).toFixed(2);
  const high = +(Math.max(open, close) + Math.random() * Math.abs(change) * 0.5).toFixed(2);
  const low = +(Math.min(open, close) - Math.random() * Math.abs(change) * 0.5).toFixed(2);
  return { open, high, low, close };
}

export function SimuladorScreen() {
  const { cash, shares, addCandle, buyShare, sellShare, currentSymbol, setSymbol } = useGameStore();
  const [amountStr, setAmountStr] = useState('1');
  const [chartData, setChartData] = useState<CandleData[]>(() => {
    const sym = SYMBOLS.find(s => s.ticker === currentSymbol) ?? SYMBOLS[0];
    const data: CandleData[] = [];
    let price = 50;
    for (let i = 0; i < 30; i++) {
      const c = generateCandle(price, sym.volatility);
      data.push(c);
      price = c.close;
    }
    return data;
  });

  const sym = SYMBOLS.find(s => s.ticker === currentSymbol) ?? SYMBOLS[0];
  const currentPrice = chartData[chartData.length - 1]?.close ?? 50;
  const heldShares = shares.find(s => s.symbol === currentSymbol);
  const quantity = heldShares?.quantity ?? 0;
  const avgPrice = heldShares?.avgPrice ?? 0;

  const generateNextCandle = useCallback(() => {
    const newCandle = generateCandle(currentPrice, sym.volatility);
    setChartData(prev => [...prev.slice(-59), newCandle]);
    addCandle(newCandle);
    useGameStore.getState().updatePrice(newCandle.close);
  }, [currentPrice, sym.volatility]);

  useEffect(() => {
    const interval = setInterval(generateNextCandle, 2000);
    return () => clearInterval(interval);
  }, [generateNextCandle]);

  const handleBuy = () => {
    const qty = parseInt(amountStr);
    if (isNaN(qty) || qty < 1) return;
    const cost = qty * currentPrice;
    if (cost > cash) {
      hapticsError();
      useUIStore.getState().setToast('❌ No tienes suficiente efectivo', 'error');
      return;
    }
    hapticsSuccess();
    buyShare(currentSymbol, qty, currentPrice, new Date().toISOString());
    useUIStore.getState().setToast(`✅ Compraste ${qty} acciones de ${currentSymbol}`, 'success');
  };

  const handleSell = () => {
    const qty = parseInt(amountStr);
    if (isNaN(qty) || qty < 1) return;
    if (qty > quantity) {
      hapticsError();
      useUIStore.getState().setToast('❌ No tienes tantas acciones', 'error');
      return;
    }
    hapticsSuccess();
    sellShare(currentSymbol, qty, currentPrice, new Date().toISOString());
    useUIStore.getState().setToast(`✅ Vendiste ${qty} acciones de ${currentSymbol}`, 'success');
  };

  const switchSymbol = (ticker: string) => {
    hapticsSelection();
    const newSym = SYMBOLS.find(s => s.ticker === ticker)!;
    setSymbol(ticker);
    const data: CandleData[] = [];
    let price = 50;
    for (let i = 0; i < 30; i++) {
      const c = generateCandle(price, newSym.volatility);
      data.push(c);
      price = c.close;
    }
    setChartData(data);
    useGameStore.getState().updatePrice(data[data.length - 1].close);
  };

  const pnl = quantity > 0 ? quantity * (currentPrice - avgPrice) : 0;
  const portfolioValue = cash + quantity * currentPrice;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <MascotBubble size="small" />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {SYMBOLS.map(s => (
          <TouchableOpacity
            key={s.ticker}
            onPress={() => switchSymbol(s.ticker)}
            style={{
              flex: 1, padding: 12, borderRadius: 12,
              backgroundColor: currentSymbol === s.ticker ? theme.primary : theme.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: currentSymbol === s.ticker ? '#fff' : theme.primary, fontWeight: '700', fontSize: 16 }}>{s.ticker}</Text>
            <Text style={{ color: currentSymbol === s.ticker ? '#fff' : theme.textSecondary, fontSize: 11, marginTop: 2 }}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{sym.name} ({currentSymbol})</Text>
        <Text style={{ color: currentPrice >= chartData[chartData.length - 2]?.close ? theme.gain : theme.loss, fontSize: 34, fontWeight: '800' }}>
          ${currentPrice.toFixed(2)}
        </Text>
        <CandlestickChart data={chartData.slice(-20)} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Efectivo</Text>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>${cash.toFixed(2)}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: theme.surface, borderRadius: 12, padding: 12 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Portafolio</Text>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>${portfolioValue.toFixed(2)}</Text>
        </View>
      </View>

      {quantity > 0 && (
        <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{currentSymbol}</Text>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>{quantity} acc.</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Precio promedio</Text>
            <Text style={{ color: theme.text, fontSize: 14 }}>${avgPrice.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>P&L</Text>
            <Text style={{ color: pnl >= 0 ? theme.gain : theme.loss, fontSize: 16, fontWeight: '700' }}>
              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Cantidad:</Text>
          <View style={{ flexDirection: 'row', gap: 6, flex: 1 }}>
            {[1, 5, 10, 25, 50].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => { setAmountStr(String(n)); hapticsSelection(); }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: parseInt(amountStr) === n ? theme.primary : `${theme.primary}20`,
                }}
              >
                <Text style={{ color: parseInt(amountStr) === n ? '#fff' : theme.primary, fontWeight: '600', fontSize: 13 }}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={handleBuy} style={{ flex: 1, backgroundColor: theme.gain, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Comprar</Text>
            <Text style={{ color: '#fff', fontSize: 11, opacity: 0.8 }}>${(currentPrice * parseInt(amountStr || '0')).toFixed(2)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSell} style={{ flex: 1, backgroundColor: theme.loss, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Vender</Text>
            <Text style={{ color: '#fff', fontSize: 11, opacity: 0.8 }}>{quantity} disponibles</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
