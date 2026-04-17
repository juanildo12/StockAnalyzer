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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountNumber = searchParams.get('account');
  const type = searchParams.get('type') || 'accounts';

  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Not authenticated with TradeStation' },
      { status: 401 }
    );
  }

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  try {
    if (type === 'accounts') {
      const response = await fetch(`${TRADESTATION_API_BASE}/brokerage/accounts`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    if (type === 'balances' && accountNumber) {
      const response = await fetch(
        `${TRADESTATION_API_BASE}/brokerage/accounts/${accountNumber}/balances`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch balances: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    if (type === 'positions' && accountNumber) {
      const response = await fetch(
        `${TRADESTATION_API_BASE}/brokerage/accounts/${accountNumber}/positions`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    if (type === 'orders' && accountNumber) {
      const status = searchParams.get('status');
      let url = `${TRADESTATION_API_BASE}/brokerage/accounts/${accountNumber}/orders`;
      if (status) {
        url += `?status=${status}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
  } catch (error) {
    console.error('TradeStation API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data from TradeStation' },
      { status: 500 }
    );
  }
}
