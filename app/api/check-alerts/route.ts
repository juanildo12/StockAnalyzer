import { NextResponse } from 'next/server';
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
    const alertedSymbols = await getAlertedSymbols(userId);
    console.log(`[${userId}] Alerted symbols:`, alertedSymbols);
    
    const watchlist = await getWatchlistFromFirestore(userId);
    console.log(`[${userId}] Watchlist items:`, JSON.stringify(watchlist, null, 2));
    
    if (watchlist.length === 0) {
      console.log(`[${userId}] No items in watchlist`);
      return results;
    }
    
    for (const item of watchlist) {
      console.log(`[${userId}] Checking ${item.symbol}: alertEnabled=${item.alertEnabled}, alertPrice=${item.alertPrice}, alertType=${item.alertType}`);
      
      // Skip if alert is not enabled
      if (!item.alertEnabled) {
        console.log(`  -> Skipping ${item.symbol}: alert not enabled`);
        continue;
      }
      
      // Skip if no target price set
      if (!item.alertPrice || item.alertPrice <= 0) {
        console.log(`  -> Skipping ${item.symbol}: no valid alert price`);
        continue;
      }
      
      // Skip if this symbol was already alerted
      if (alertedSymbols.includes(item.symbol)) {
        console.log(`  -> Skipping ${item.symbol}: already alerted`);
        continue;
      }
      
      try {
        const quote = await getStockQuote(item.symbol);
        const currentPrice = quote.regularMarketPrice;
        console.log(`  -> ${item.symbol}: current=${currentPrice}, target=${item.alertPrice}, type=${item.alertType}`);
        
        let shouldAlert = false;
        
        if (item.alertType === 'below' && currentPrice <= item.alertPrice) {
          shouldAlert = true;
          console.log(`  -> Condition met: below`);
        } else if (item.alertType === 'above' && currentPrice >= item.alertPrice) {
          shouldAlert = true;
          console.log(`  -> Condition met: above`);
        }
        
        if (shouldAlert) {
          console.log(`  -> ALERT TRIGGERED for ${item.symbol}! Sending email...`);
          const emailSent = await sendEmail(email, item.symbol, currentPrice, item.alertPrice, item.alertType || 'above');
          if (emailSent) {
            await addAlertedSymbol(userId, item.symbol);
            console.log(`  -> Email sent and marked as alerted`);
          } else {
            console.log(`  -> Email FAILED to send`);
          }
          results.push({
            symbol: item.symbol,
            currentPrice,
            targetPrice: item.alertPrice,
            emailSent
          });
        } else {
          console.log(`  -> No alert: price not in range`);
        }
      } catch (error) {
        console.error(`  -> Error checking price for ${item.symbol}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error processing alerts for user ${userId}:`, error);
  }
  
  return results;
}

export async function GET() {
  console.log('=== Running price alert check ===');
  
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not configured!');
    return NextResponse.json({ 
      error: 'RESEND_API_KEY not configured',
      message: 'Configure RESEND_API_KEY in Vercel to enable email alerts'
    }, { status: 500 });
  }
  
  try {
    const users = await getAllWatchlistUsers();
    console.log(`Found ${users.length} users:`, users);
    
    let totalAlerts = 0;
    
    for (const user of users) {
      console.log(`\nChecking alerts for user: ${user.email} (${user.userId})`);
      const results = await checkUserAlerts(user.userId, user.email);
      totalAlerts += results.filter(r => r.emailSent).length;
      console.log(`Results for ${user.email}:`, results);
    }
    
    console.log(`\n=== Alert check completed: ${totalAlerts} emails sent ===`);
    
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
