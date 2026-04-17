import { NextRequest, NextResponse } from 'next/server';

const TRADESTATION_API_BASE = process.env.TRADESTATION_API_URL || 'https://api.tradestation.com/v3';
const TRADESTATION_SIM_URL = process.env.TRADESTATION_SIM_URL || 'https://sim-api.tradestation.com/v3';

async function getAccessToken(): Promise<string | null> {
  const refreshToken = process.env.TRADESTATION_REFRESH_TOKEN;
  
  if (!refreshToken) {
    console.error('No refresh token available');
    return null;
  }

  try {
    const response = await fetch('https://api.tradestation.com/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.TRADESTATION_API_KEY || '',
        client_secret: process.env.TRADESTATION_API_SECRET || '',
      }),
    });

    if (!response.ok) {
      console.error('Failed to refresh token:', response.status);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

interface OrderPayload {
  accountNumber: string;
  symbol: string;
  quantity: number;
  orderType: 'Market' | 'Limit' | 'Stop' | 'StopLimit';
  side: 'Buy' | 'Sell';
  timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  route?: string;
  price?: number;
  stopPrice?: number;
  isSimulated?: boolean;
  isOption?: boolean;
  optionSymbol?: string;
  strikePrice?: number;
  expirationDate?: string;
  optionType?: 'Call' | 'Put';
}

export async function POST(request: NextRequest) {
  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated with TradeStation', success: false },
      { status: 401 }
    );
  }

  try {
    const body: OrderPayload = await request.json();

    if (!body.accountNumber || !body.symbol || !body.quantity || !body.orderType || !body.side) {
      return NextResponse.json(
        { error: 'Missing required fields', success: false },
        { status: 400 }
      );
    }

    let instrument: Record<string, string> = {
      Symbol: body.symbol,
      AssetType: body.isOption ? 'Option' : 'Equity',
    };

    if (body.isOption && body.optionSymbol) {
      instrument.Symbol = body.optionSymbol;
    }

    const orderPayload: Record<string, unknown> = {
      AccountNumber: body.accountNumber,
      Instrument: instrument,
      Quantity: body.quantity,
      OrderType: body.orderType,
      Side: body.side,
      TimeInForce: { Duration: body.timeInForce },
      Route: body.route || 'Intelligent',
    };

    if (body.price) {
      orderPayload.Price1 = body.price;
    }

    if (body.stopPrice) {
      orderPayload.StopPrice = body.stopPrice;
    }

    if (body.isSimulated) {
      orderPayload.IsSimulated = true;
    }

    const baseUrl = body.isSimulated ? TRADESTATION_SIM_URL : TRADESTATION_API_BASE;

    const response = await fetch(`${baseUrl}/orderexecution/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          error: errorData.Message || 'Failed to place order',
          success: false 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      orderID: data.OrderID,
      symbol: body.symbol,
      status: data.Status || 'Pending',
      message: data.Message,
    });
  } catch (error) {
    console.error('Error placing order:', error);
    return NextResponse.json(
      { error: 'Failed to place order', success: false },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const orderID = searchParams.get('orderID');

  if (!orderID) {
    return NextResponse.json(
      { error: 'Order ID is required', success: false },
      { status: 400 }
    );
  }

  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated with TradeStation', success: false },
      { status: 401 }
    );
  }

  try {
    const response = await fetch(
      `${TRADESTATION_API_BASE}/orderexecution/orders/${orderID}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to cancel order', success: false },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, orderID });
  } catch (error) {
    console.error('Error canceling order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order', success: false },
      { status: 500 }
    );
  }
}
