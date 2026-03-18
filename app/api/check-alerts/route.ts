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
      console.log('Email sent successfully to', to);
      return true;
    }
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

export async function GET() {
  const logs: string[] = [];
  const results: any[] = [];
  
  console.log('=== Running manual alert check ===');
  logs.push('=== Running manual alert check ===');
  
  if (!RESEND_API_KEY) {
    const msg = 'RESEND_API_KEY not configured!';
    console.log(msg);
    logs.push(msg);
    return NextResponse.json({ error: msg, logs }, { status: 500 });
  }
  
  try {
    const users = await getAllWatchlistUsers();
    console.log(`Found ${users.length} users:`, JSON.stringify(users));
    logs.push(`Found ${users.length} users: ${JSON.stringify(users)}`);
    
    for (const user of users) {
      console.log(`\nProcessing user: ${user.email} (${user.userId})`);
      logs.push(`\nProcessing user: ${user.email} (${user.userId})`);
      
      const alertedSymbols = await getAlertedSymbols(user.userId);
      console.log(`Already alerted:`, alertedSymbols);
      logs.push(`Already alerted: ${JSON.stringify(alertedSymbols)}`);
      
      const watchlist = await getWatchlistFromFirestore(user.userId);
      console.log(`Watchlist (${watchlist.length} items):`, JSON.stringify(watchlist));
      logs.push(`Watchlist (${watchlist.length} items): ${JSON.stringify(watchlist)}`);
      
      for (const item of watchlist) {
        console.log(`\nChecking ${item.symbol}:`);
        logs.push(`\nChecking ${item.symbol}:`);
        
        // Check alert settings
        if (!item.alertEnabled) {
          console.log(`  -> SKIP: Alert not enabled`);
          logs.push(`  -> SKIP: Alert not enabled`);
          continue;
        }
        
        if (!item.alertPrice || item.alertPrice <= 0) {
          console.log(`  -> SKIP: No valid alert price`);
          logs.push(`  -> SKIP: No valid alert price`);
          continue;
        }
        
        if (alertedSymbols.includes(item.symbol)) {
          console.log(`  -> SKIP: Already alerted`);
          logs.push(`  -> SKIP: Already alerted`);
          continue;
        }
        
        // Get current price
        try {
          const quote = await getStockQuote(item.symbol);
          const currentPrice = quote.regularMarketPrice;
          console.log(`  -> Current price: $${currentPrice}`);
          logs.push(`  -> Current price: $${currentPrice}`);
          
          let shouldAlert = false;
          
          if (item.alertType === 'below' && currentPrice <= item.alertPrice) {
            shouldAlert = true;
            console.log(`  -> CONDITION MET: below (${currentPrice} <= ${item.alertPrice})`);
            logs.push(`  -> CONDITION MET: below (${currentPrice} <= ${item.alertPrice})`);
          } else if (item.alertType === 'above' && currentPrice >= item.alertPrice) {
            shouldAlert = true;
            console.log(`  -> CONDITION MET: above (${currentPrice} >= ${item.alertPrice})`);
            logs.push(`  -> CONDITION MET: above (${currentPrice} >= ${item.alertPrice})`);
          }
          
          if (shouldAlert) {
            console.log(`  -> SENDING EMAIL...`);
            logs.push(`  -> SENDING EMAIL...`);
            const emailSent = await sendEmail(user.email, item.symbol, currentPrice, item.alertPrice, item.alertType || 'above');
            
            if (emailSent) {
              await addAlertedSymbol(user.userId, item.symbol);
              console.log(`  -> EMAIL SENT!`);
              logs.push(`  -> EMAIL SENT!`);
            } else {
              console.log(`  -> EMAIL FAILED!`);
              logs.push(`  -> EMAIL FAILED!`);
            }
            
            results.push({
              symbol: item.symbol,
              currentPrice,
              targetPrice: item.alertPrice,
              alertType: item.alertType,
              emailSent
            });
          } else {
            console.log(`  -> No alert: price not in range`);
            logs.push(`  -> No alert: price not in range`);
          }
        } catch (error) {
          console.log(`  -> ERROR getting price:`, error);
          logs.push(`  -> ERROR getting price: ${String(error)}`);
        }
      }
    }
    
    console.log(`\n=== DONE: ${results.length} emails sent ===`);
    logs.push(`\n=== DONE: ${results.length} emails sent ===`);
    
    return NextResponse.json({ 
      message: 'Alert check completed',
      results,
      logs
    });
  } catch (error) {
    console.error('Error:', error);
    logs.push(`Error: ${String(error)}`);
    return NextResponse.json({ error: String(error), logs }, { status: 500 });
  }
}
