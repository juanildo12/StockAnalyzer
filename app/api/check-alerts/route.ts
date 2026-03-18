import { NextResponse } from 'next/server';
import { getWatchlistFromFirestore, WatchlistItem } from '@/src/services/firebase';
import { getStockQuote } from '@/src/services/yahooFinance';
import { getAllWatchlistUsers, addAlertedSymbol, getUserEmail } from '@/src/services/firebase';

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
        from: 'Stock Analyzer <onboarding@resend.dev>',
        to: to,
        subject: `${emoji} Alerta: ${symbol} ha ${direction} tu precio objetivo`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: ${color};">${emoji} Alerta de precio para ${symbol}!</h1>
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
      console.log('Email sent successfully to', to);
      return true;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

async function checkUserAlerts(userId: string, email: string): Promise<{ symbol: string; currentPrice: number; targetPrice: number; emailSent: boolean }[]> {
  const results: { symbol: string; currentPrice: number; targetPrice: number; emailSent: boolean }[] = [];
  
  try {
    const watchlist = await getWatchlistFromFirestore(userId);
    
    for (const item of watchlist) {
      if (!item.alertEnabled || !item.alertPrice || !item.alertType) continue;
      
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
          const emailSent = await sendEmail(email, item.symbol, currentPrice, item.alertPrice, item.alertType);
          if (emailSent) {
            await addAlertedSymbol(userId, item.symbol);
          }
          results.push({
            symbol: item.symbol,
            currentPrice,
            targetPrice: item.alertPrice,
            emailSent
          });
        }
      } catch (error) {
        console.error(`Error checking price for ${item.symbol}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error processing alerts for user ${userId}:`, error);
  }
  
  return results;
}

export async function GET() {
  console.log('Running price alert check...');
  
  if (!RESEND_API_KEY) {
    return NextResponse.json({ 
      error: 'RESEND_API_KEY not configured',
      message: 'Configure RESEND_API_KEY in Vercel to enable email alerts'
    }, { status: 500 });
  }
  
  try {
    const users = await getAllWatchlistUsers();
    console.log(`Found ${users.length} users to check`);
    
    let totalAlerts = 0;
    
    for (const user of users) {
      const results = await checkUserAlerts(user.userId, user.email);
      totalAlerts += results.filter(r => r.emailSent).length;
    }
    
    return NextResponse.json({ 
      message: 'Alert check completed',
      usersChecked: users.length,
      alertsSent: totalAlerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in alert check:', error);
    return NextResponse.json({ 
      error: 'Failed to check alerts',
      message: String(error)
    }, { status: 500 });
  }
}
