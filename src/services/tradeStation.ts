const TRADESTATION_API_BASE = process.env.TRADESTATION_API_URL || 'https://api.tradestation.com/v3';
const TRADESTATION_SIM_URL = process.env.TRADESTATION_SIM_URL || 'https://sim-api.tradestation.com/v3';

export interface TradeStationConfig {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  refreshToken?: string;
  useSim: boolean;
}

export interface Account {
  AccountNumber: string;
  AccountAlias: string;
  AccountID: number;
  AccountType: string;
  Currency: string;
}

export interface Balance {
  AccountNumber: string;
  CashBalance: number;
  NetCash: number;
  BuyingPower: number;
  DayTradesRemaining: number;
  Equity: number;
  MarginEquity: number;
  RegTEquity: number;
  RegTMarginEquity: number;
  ShortBalance: number;
  PortfolioValue: number;
}

export interface Position {
  Symbol: string;
  SymbolRoot: string;
  Quantity: number;
  AverageEntryPrice: number;
  DayOpenPrice: number;
  CurrentPrice: number;
  ClosedPL: number;
  ClosedPLPercent: number;
  OpenPL: number;
  OpenPLPercent: number;
  TotalPL: number;
  TotalPLPercent: number;
}

export interface Order {
  OrderID: string;
  AccountNumber: string;
  Symbol: string;
  SymbolRoot: string;
  Quantity: number;
  OrderType: string;
  MarketSession: string;
  Price1?: number;
  Price2?: number;
  StopPrice?: number;
  Route: string;
  Duration: string;
  Status: string;
  FillPrice?: number;
  FilledQuantity?: number;
  RemainingQuantity?: number;
  CanceledQuantity?: number;
  DateIssued: string;
  DateFilled?: string;
  Legs?: OrderLeg[];
}

export interface OrderLeg {
  Symbol: string;
  Quantity: number;
  PositionFill: number;
  Side: string;
}

export interface OrderRequest {
  AccountNumber: string;
  Symbol: string;
  Quantity: number;
  OrderType: 'Market' | 'Limit' | 'Stop' | 'StopLimit';
  Side: 'Buy' | 'Sell';
  TimeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  Route?: string;
  Price?: number;
  StopPrice?: number;
  IsSimulated?: boolean;
}

export interface OrderResponse {
  OrderID: string;
  Symbol: string;
  Status: string;
  Message?: string;
}

export interface OptionOrderRequest extends OrderRequest {
  OptionSymbol?: string;
  StrikePrice?: number;
  ExpirationDate?: string;
  OptionType?: 'Call' | 'Put';
  Action?: 'Open' | 'Close';
}

class TradeStationAPI {
  private config: TradeStationConfig;

  constructor(config: TradeStationConfig) {
    this.config = config;
  }

  private getBaseUrl(): string {
    return this.config.useSim ? TRADESTATION_SIM_URL : TRADESTATION_API_BASE;
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async getAccounts(): Promise<Account[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/brokerage/accounts`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }

      const data = await response.json();
      return data.Accounts || [];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  async getBalances(accountNumber: string): Promise<Balance | null> {
    try {
      const response = await fetch(
        `${this.getBaseUrl()}/brokerage/accounts/${accountNumber}/balances`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch balances: ${response.status}`);
      }

      const data = await response.json();
      return data.Balances || null;
    } catch (error) {
      console.error('Error fetching balances:', error);
      throw error;
    }
  }

  async getPositions(accountNumber: string): Promise<Position[]> {
    try {
      const response = await fetch(
        `${this.getBaseUrl()}/brokerage/accounts/${accountNumber}/positions`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.status}`);
      }

      const data = await response.json();
      return data.Positions || [];
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  }

  async getOrders(accountNumber: string, status?: string): Promise<Order[]> {
    try {
      let url = `${this.getBaseUrl()}/brokerage/accounts/${accountNumber}/orders`;
      if (status) {
        url += `?status=${status}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const data = await response.json();
      return data.Orders || [];
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  async placeOrder(order: OrderRequest): Promise<OrderResponse> {
    try {
      const orderPayload = {
        AccountNumber: order.AccountNumber,
        Instrument: {
          Symbol: order.Symbol,
          AssetType: order.Symbol.includes(' ') ? 'Option' : 'Equity',
        },
        Quantity: order.Quantity,
        OrderType: order.OrderType,
        Side: order.Side,
        TimeInForce: { Duration: order.TimeInForce },
        Route: order.Route || 'Intelligent',
        ...(order.Price && { Price1: order.Price }),
        ...(order.StopPrice && { StopPrice: order.StopPrice }),
        ...(order.IsSimulated !== undefined && { IsSimulated: order.IsSimulated }),
      };

      const response = await fetch(`${this.getBaseUrl()}/orderexecution/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to place order: ${response.status}`
        );
      }

      const data = await response.json();
      return {
        OrderID: data.OrderID || '',
        Symbol: order.Symbol,
        Status: data.Status || 'Pending',
        Message: data.Message,
      };
    } catch (error) {
      console.error('Error placing order:', error);
      throw error;
    }
  }

  async placeOptionOrder(order: OptionOrderRequest): Promise<OrderResponse> {
    try {
      const optionSymbol = `${order.Symbol}${order.ExpirationDate?.replace(/-/g, '')}${
        order.OptionType === 'Put' ? 'P' : 'C'
      }${order.StrikePrice?.toFixed(0).padStart(8, '0')}`;

      const orderPayload = {
        AccountNumber: order.AccountNumber,
        Instrument: {
          AssetType: 'Option',
          Symbol: optionSymbol,
        },
        Quantity: order.Quantity,
        OrderType: order.OrderType,
        Side: order.Side,
        TimeInForce: { Duration: order.TimeInForce },
        Route: order.Route || 'Intelligent',
        ...(order.Price && { Price1: order.Price }),
        ...(order.IsSimulated !== undefined && { IsSimulated: order.IsSimulated }),
      };

      const response = await fetch(`${this.getBaseUrl()}/orderexecution/orders`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to place option order: ${response.status}`
        );
      }

      const data = await response.json();
      return {
        OrderID: data.OrderID || '',
        Symbol: optionSymbol,
        Status: data.Status || 'Pending',
        Message: data.Message,
      };
    } catch (error) {
      console.error('Error placing option order:', error);
      throw error;
    }
  }

  async cancelOrder(orderID: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.getBaseUrl()}/orderexecution/orders/${orderID}`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to cancel order: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error canceling order:', error);
      throw error;
    }
  }

  async replaceOrder(
    orderID: string,
    updates: Partial<OrderRequest>
  ): Promise<OrderResponse> {
    try {
      const updatePayload: Record<string, unknown> = {};
      if (updates.Price !== undefined) updatePayload.Price1 = updates.Price;
      if (updates.Quantity !== undefined) updatePayload.Quantity = updates.Quantity;
      if (updates.OrderType !== undefined)
        updatePayload.OrderType = updates.OrderType;

      const response = await fetch(
        `${this.getBaseUrl()}/orderexecution/orders/${orderID}`,
        {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify(updatePayload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to replace order: ${response.status}`);
      }

      const data = await response.json();
      return {
        OrderID: data.OrderID || orderID,
        Symbol: data.Symbol || '',
        Status: data.Status || 'Pending',
        Message: data.Message,
      };
    } catch (error) {
      console.error('Error replacing order:', error);
      throw error;
    }
  }

  async getOptionChain(symbol: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.getBaseUrl()}/marketdata/options/chains?symbol=${symbol}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch option chain: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching option chain:', error);
      throw error;
    }
  }
}

export default TradeStationAPI;

export function createTradeStationClient(accessToken: string, useSim = false): TradeStationAPI {
  return new TradeStationAPI({
    apiKey: process.env.TRADESTATION_API_KEY || '',
    apiSecret: process.env.TRADESTATION_API_SECRET || '',
    accessToken,
    useSim,
  });
}
