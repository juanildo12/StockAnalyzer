import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getWatchlistFromFirestore, getAllWatchlistUsers, addAlertedSymbol, getAlertedSymbols } from '@/src/services/firebase';
import { getStockQuote } from '@/src/services/yahooFinance';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendEmail(to: string, symbol: string, currentPrice: number, targetPrice: number, alertType: string) {
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured, skipping email');
    return false;
  }

  const direction = alertType === 'above' ? 'subido a' : 'bajado a';
  const emoji = alertType === 'above' ? '📈' : '📉';
  const color = alertType === 'above' ? '#238636' : '#E74C3C';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Prospector <alerts@prospector.com>',
        to: to,
        subject: `${emoji} Alerta: ${symbol} ha ${direction} tu precio objetivo`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: ${color};">${emoji} Alerta: ${symbol} ha ${direction} tu precio objetivo!</h1>
            <p>${symbol} ha ${direction} tu precio objetivo.</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Símbolo:</strong> ${symbol}</p>
              <p style="margin: 5px 0;"><strong>Precio actual:</strong> $${currentPrice.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Precio objetivo:</strong> $${targetPrice.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Tipo de alerta:</strong> ${alertType === 'above' ? '📈 Subida' : '📉 Bajada'}</p>
            </div>
            <p>Puedes ver más detalles en <a href="https://stock-analyzer-new.vercel.app">Stock Analyzer</a></p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error sending email:', error);
      return false;
    } else {
      return true;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: any[] = [];
  
  if (!RESEND_API_KEY) {
    const msg = 'RESEND_API_KEY not configured!';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  
  try {
    const users = await getAllWatchlistUsers();
    
    for (const user of users) {
      const alertedSymbols = await getAlertedSymbols(user.userId);
      
      const watchlist = await getWatchlistFromFirestore(user.userId);
      
      for (const item of watchlist) {
        // Check alert settings
        if (!item.alertEnabled) {
          continue;
        }
        
        if (!item.alertPrice || item.alertPrice <= 0) {
          continue;
        }
        
        if (alertedSymbols.includes(item.symbol)) {
          continue;
        }
        
        // Get current price
        try {
          const quote = await getStockQuote(item.symbol);
          const currentPrice = quote.regularMarketPrice;
          
          let shouldAlert = false;
          
          if (item.alertType === 'below' && currentPrice <= item.alertPrice) {
            shouldAlert = true;
          } else if (item.alertType === 'above' && currentPrice >= item.alertPrice) {
            shouldAlert = true;
          }
          
          if (shouldAlert) {
            const emailSent = await sendEmail(user.email, item.symbol, currentPrice, item.alertPrice, item.alertType || 'above');
            
            if (emailSent) {
              await addAlertedSymbol(user.userId, item.symbol);
            }
            
            results.push({
              symbol: item.symbol,
              currentPrice,
              targetPrice: item.alertPrice,
              alertType: item.alertType,
              emailSent
            });
          }
        } catch (error) {
        }
      }
    }
    
    return NextResponse.json({ 
      message: 'Alert check completed'
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
