'use client';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

import { useState, useEffect, useCallback } from 'react';

interface Account {
  AccountNumber: string;
  AccountAlias: string;
  AccountType: string;
}

interface Balance {
  AccountNumber: string;
  CashBalance: number;
  NetCash: number;
  BuyingPower: number;
  PortfolioValue: number;
  Equity: number;
}

interface Position {
  Symbol: string;
  Quantity: number;
  AverageEntryPrice: number;
  CurrentPrice: number;
  OpenPL: number;
  OpenPLPercent: number;
}

interface Order {
  OrderID: string;
  Symbol: string;
  Quantity: number;
  OrderType: string;
  Side: string;
  Status: string;
  FillPrice?: number;
  DateIssued: string;
}

interface OrderForm {
  symbol: string;
  quantity: number;
  orderType: 'Market' | 'Limit';
  side: 'Buy' | 'Sell';
  price: number;
  timeInForce: 'DAY' | 'GTC';
  isSimulated: boolean;
}

type TabType = 'dashboard' | 'positions' | 'orders' | 'quick-trade';

export default function TradeStationPanel() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [balance, setBalance] = useState<Balance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [orderForm, setOrderForm] = useState<OrderForm>({
    symbol: '',
    quantity: 1,
    orderType: 'Market',
    side: 'Buy',
    price: 0,
    timeInForce: 'DAY',
    isSimulated: true,
  });
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchData = useCallback(async (endpoint: string, setter: (data: any) => void) => {
    try {
      const response = await fetch(`/api/tradestation/accounts?type=${endpoint}${selectedAccount ? `&account=${selectedAccount}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setter(data);
    } catch (err) {
      console.error(`Error fetching ${endpoint}:`, err);
    }
  }, [selectedAccount]);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tradestation/accounts?type=accounts');
      if (response.status === 401) {
        setError('⚠️ No configurado: necesitas agregar tus credenciales de TradeStation en .env.local');
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      setAccounts(data.Accounts || []);
      if (data.Accounts?.length > 0) {
        setSelectedAccount(data.Accounts[0].AccountNumber);
      }
    } catch (err) {
      setError('Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchData(`balances&account=${selectedAccount}`, (data) => setBalance(data.Balances || null));
      fetchData(`positions&account=${selectedAccount}`, (data) => setPositions(data.Positions || []));
      fetchData(`orders&account=${selectedAccount}`, (data) => setOrders(data.Orders || []));
    }
  }, [selectedAccount, fetchData]);

  const handlePlaceOrder = async () => {
    if (!orderForm.symbol || !orderForm.quantity || (orderForm.orderType === 'Limit' && !orderForm.price)) {
      setOrderResult({ success: false, message: 'Completa todos los campos requeridos' });
      return;
    }

    setLoading(true);
    setOrderResult(null);

    try {
      const response = await fetch('/api/tradestation/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: selectedAccount,
          symbol: orderForm.symbol.toUpperCase(),
          quantity: orderForm.quantity,
          orderType: orderForm.orderType,
          side: orderForm.side,
          timeInForce: orderForm.timeInForce,
          price: orderForm.orderType === 'Limit' ? orderForm.price : undefined,
          isSimulated: orderForm.isSimulated,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setOrderResult({ success: true, message: `Orden ${data.orderID} enviada correctamente` });
        setOrderForm(prev => ({ ...prev, symbol: '', price: 0 }));
        fetchData(`orders&account=${selectedAccount}`, (d) => setOrders(d.Orders || []));
        if (!orderForm.isSimulated) {
          fetchData(`positions&account=${selectedAccount}`, (d) => setPositions(d.Positions || []));
        }
      } else {
        setOrderResult({ success: false, message: data.error || 'Error al enviar orden' });
      }
    } catch (err) {
      setOrderResult({ success: false, message: 'Error de conexión' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderID: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tradestation/orders?orderID=${orderID}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        fetchData(`orders&account=${selectedAccount}`, (d) => setOrders(d.Orders || []));
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Error al cancelar orden');
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    background: C.bgCard,
    borderRadius: '12px',
    border: '1px solid ' + C.border,
    padding: '20px',
    marginBottom: '16px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid ' + C.border,
    background: C.bg,
    color: C.textSecondary,
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  };

  const tabs = [
    { id: 'dashboard' as TabType, label: '📊 Dashboard' },
    { id: 'positions' as TabType, label: '📈 Posiciones' },
    { id: 'orders' as TabType, label: '📋 Órdenes' },
    { id: 'quick-trade' as TabType, label: '⚡ Trade Rápido' },
  ];

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ color: C.textPrimary, fontSize: '28px', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>📊</span> TradeStation
          </h1>
          <p style={{ color: C.textMuted, fontSize: '14px', margin: '8px 0 0' }}>
            Conecta con tu cuenta de TradeStation para gestionar trades
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {accounts.length > 0 && (
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={{
                ...inputStyle,
                width: 'auto',
                minWidth: '180px',
              }}
            >
              {accounts.map((acc) => (
                <option key={acc.AccountNumber} value={acc.AccountNumber}>
                  {acc.AccountAlias || acc.AccountNumber}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={loadAccounts}
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid ' + C.border,
              background: 'transparent',
              color: C.textSecondary,
              cursor: 'pointer',
            }}
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          ...cardStyle,
          borderLeft: '4px solid ' + C.negative,
          background: `${C.negative20}`,
        }}>
          <p style={{ color: C.negative, margin: 0 }}>{error}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid ' + C.border,
              background: activeTab === tab.id ? C.accent : 'transparent',
              color: C.textSecondary,
              cursor: 'pointer',
              fontWeight: '500',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted }}>
          <span style={{
            display: 'inline-block',
            width: '24px',
            height: '24px',
            border: `3px solid ${C.border}`,
            borderTopColor: C.accent,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <p style={{ marginTop: '12px' }}>Cargando...</p>
        </div>
      )}

      {!loading && (
        <>
          {activeTab === 'dashboard' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ ...cardStyle, textAlign: 'center' }}>
                  <div style={{ color: C.textMuted, fontSize: '12px', marginBottom: '8px' }}>Portfolio Value</div>
                  <div style={{ color: C.textPrimary, fontSize: '28px', fontWeight: '700' }}>
                    ${balance?.PortfolioValue?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '—'}
                  </div>
                </div>
                <div style={{ ...cardStyle, textAlign: 'center' }}>
                  <div style={{ color: C.textMuted, fontSize: '12px', marginBottom: '8px' }}>Cash Balance</div>
                  <div style={{ color: C.textPrimary, fontSize: '28px', fontWeight: '700' }}>
                    ${balance?.CashBalance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '—'}
                  </div>
                </div>
                <div style={{ ...cardStyle, textAlign: 'center' }}>
                  <div style={{ color: C.textMuted, fontSize: '12px', marginBottom: '8px' }}>Buying Power</div>
                  <div style={{ color: C.positive, fontSize: '28px', fontWeight: '700' }}>
                    ${balance?.BuyingPower?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '—'}
                  </div>
                </div>
                <div style={{ ...cardStyle, textAlign: 'center' }}>
                  <div style={{ color: C.textMuted, fontSize: '12px', marginBottom: '8px' }}>Equity</div>
                  <div style={{ color: C.textPrimary, fontSize: '28px', fontWeight: '700' }}>
                    ${balance?.Equity?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '—'}
                  </div>
                </div>
              </div>

              <div style={{ ...cardStyle }}>
                <h3 style={{ color: C.textPrimary, marginTop: 0 }}>Posiciones Abiertas ({positions.length})</h3>
                {positions.length === 0 ? (
                  <p style={{ color: C.textMuted, textAlign: 'center', padding: '20px' }}>Sin posiciones abiertas</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid ' + C.border }}>
                          <th style={{ textAlign: 'left', padding: '12px 8px', color: C.textMuted, fontSize: '12px' }}>Símbolo</th>
                          <th style={{ textAlign: 'right', padding: '12px 8px', color: C.textMuted, fontSize: '12px' }}>Cantidad</th>
                          <th style={{ textAlign: 'right', padding: '12px 8px', color: C.textMuted, fontSize: '12px' }}>Precio Entrada</th>
                          <th style={{ textAlign: 'right', padding: '12px 8px', color: C.textMuted, fontSize: '12px' }}>Precio Actual</th>
                          <th style={{ textAlign: 'right', padding: '12px 8px', color: C.textMuted, fontSize: '12px' }}>P/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((pos, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '12px 8px', color: C.accent, fontWeight: '600' }}>{pos.Symbol}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', color: C.textSecondary }}>{pos.Quantity}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', color: C.textSecondary }}>${pos.AverageEntryPrice?.toFixed(2)}</td>
                            <td style={{ padding: '12px 8px', textAlign: 'right', color: C.textSecondary }}>${pos.CurrentPrice?.toFixed(2)}</td>
                            <td style={{ 
                              padding: '12px 8px', 
                              textAlign: 'right', 
                              color: pos.OpenPL >= 0 ? C.positive : C.negative,
                              fontWeight: '600'
                            }}>
                              {pos.OpenPL >= 0 ? '+' : ''}{pos.OpenPL?.toFixed(2)} ({pos.OpenPLPercent?.toFixed(2)}%)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'positions' && (
            <div style={cardStyle}>
              <h3 style={{ color: C.textPrimary, marginTop: 0 }}>Todas las Posiciones ({positions.length})</h3>
              {positions.length === 0 ? (
                <p style={{ color: C.textMuted, textAlign: 'center', padding: '40px' }}>Sin posiciones</p>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {positions.map((pos, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      background: C.bg,
                      borderRadius: '8px',
                      border: '1px solid ' + C.border,
                    }}>
                      <div>
                        <div style={{ color: C.accent, fontSize: '18px', fontWeight: '600' }}>{pos.Symbol}</div>
                        <div style={{ color: C.textMuted, fontSize: '13px' }}>{pos.Quantity} acciones</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: C.textSecondary }}>Entrada: ${pos.AverageEntryPrice?.toFixed(2)}</div>
                        <div style={{ color: C.textSecondary }}>Actual: ${pos.CurrentPrice?.toFixed(2)}</div>
                        <div style={{ 
                          color: pos.OpenPL >= 0 ? C.positive : C.negative,
                          fontSize: '16px',
                          fontWeight: '600'
                        }}>
                          {pos.OpenPL >= 0 ? '+' : ''}${pos.OpenPL?.toFixed(2)} ({pos.OpenPLPercent?.toFixed(2)}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div style={cardStyle}>
              <h3 style={{ color: C.textPrimary, marginTop: 0 }}>Órdenes ({orders.length})</h3>
              {orders.length === 0 ? (
                <p style={{ color: C.textMuted, textAlign: 'center', padding: '40px' }}>Sin órdenes activas</p>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {orders.map((order, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      background: C.bg,
                      borderRadius: '8px',
                      border: `1px solid ${
                        order.Status === 'Filled' ? `${C.positive40}` :
                        order.Status === 'Canceled' ? `${C.negative40}` : C.border
                      }`,
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            background: order.Side === 'Buy' ? `${C.positive30}` : `${C.negative30}`,
                            color: order.Side === 'Buy' ? C.positive : C.negative,
                          }}>
                            {order.Side}
                          </span>
                          <span style={{ color: C.accent, fontSize: '16px', fontWeight: '600' }}>{order.Symbol}</span>
                        </div>
                        <div style={{ color: C.textMuted, fontSize: '12px', marginTop: '4px' }}>
                          {order.Quantity} @ {order.OrderType} {order.FillPrice ? `→ $${order.FillPrice}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: order.Status === 'Filled' ? `${C.positive20}` :
                            order.Status === 'Canceled' ? `${C.negative20}` :
                            order.Status === 'Rejected' ? `${C.negative20}` : `${C.accent20}`,
                          color: order.Status === 'Filled' ? C.positive :
                            order.Status === 'Canceled' ? C.negative :
                            order.Status === 'Rejected' ? C.negative : C.accent,
                        }}>
                          {order.Status}
                        </span>
                        {(order.Status === 'Received' || order.Status === 'Pending') && (
                          <button
                            onClick={() => handleCancelOrder(order.OrderID)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid ' + C.negative,
                              background: 'transparent',
                              color: C.negative,
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'quick-trade' && (
            <div style={cardStyle}>
              <h3 style={{ color: C.textPrimary, marginTop: 0 }}>⚡ Trade Rápido</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: '13px' }}>Símbolo</label>
                  <input
                    type="text"
                    value={orderForm.symbol}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                    placeholder="AAPL"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: '13px' }}>Cantidad</label>
                  <input
                    type="number"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    min="1"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: '13px' }}>Tipo</label>
                  <select
                    value={orderForm.orderType}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, orderType: e.target.value as 'Market' | 'Limit' }))}
                    style={inputStyle}
                  >
                    <option value="Market">Market</option>
                    <option value="Limit">Limit</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: C.textMuted, fontSize: '13px' }}>Precio {orderForm.orderType === 'Limit' ? '(requerido)' : '(opcional)'}</label>
                  <input
                    type="number"
                    value={orderForm.price || ''}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    step="0.01"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setOrderForm(prev => ({ ...prev, side: 'Buy' }))}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: orderForm.side === 'Buy' ? C.positive : C.border,
                      color: 'white',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => setOrderForm(prev => ({ ...prev, side: 'Sell' }))}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: orderForm.side === 'Sell' ? C.negative : C.border,
                      color: 'white',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    SELL
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.textMuted, fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={orderForm.isSimulated}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, isSimulated: e.target.checked }))}
                  />
                  Modo Simulado
                </label>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading || !orderForm.symbol || !selectedAccount}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '8px',
                  border: 'none',
                      background: loading ? C.borderLight : orderForm.side === 'Buy' ? `linear-gradient(135deg, ${C.accent} 0%, ${C.positive} 100%)` : `linear-gradient(135deg, ${C.negative} 0%, ${C.negative} 100%)`,
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading || !orderForm.symbol || !selectedAccount ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Enviando...' : `Enviar Orden ${orderForm.side}`}
              </button>

              {orderResult && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: orderResult.success ? `${C.positive20}` : `${C.negative20}`,
                  border: `1px solid ${orderResult.success ? `${C.positive40}` : `${C.negative40}`}`,
                }}>
                  <p style={{ margin: 0, color: orderResult.success ? C.positive : C.negative, fontSize: '14px' }}>
                    {orderResult.message}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
