import { NextRequest, NextResponse } from 'next/server';
import { getStockData } from '../../../src/services/yahooFinance';
import { analyzeStock } from '../../../src/services/stockAnalysis';
import { getAllSourceData, mergeWithYahooData } from '../../../src/services/dataSources';
import { generateInformeDetail } from '../../../src/services/informeGenerator';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const symbols = request.nextUrl.searchParams.get('symbols');

  // Handle multiple symbols for watchlist
  if (symbols) {
    try {
      const symbolList = symbols.split(',').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
      const quotes = [];
      
      for (const sym of symbolList) {
        try {
          const data = await getStockData(sym);
          if (data.quote && data.quote.regularMarketPrice > 0) {
            quotes.push(data.quote);
          }
        } catch (error) {
          console.error(`Error fetching ${sym}:`, error);
        }
      }
      
      return NextResponse.json({ quotes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: message, quotes: [] }, { status: 500 });
    }
  }

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  const sym = symbol.toUpperCase();

  try {
    const data = await getStockData(sym);

    if (!data.quote || data.quote.regularMarketPrice === 0) {
      return NextResponse.json({ error: `Ticker "${sym}" no encontrado` }, { status: 404 });
    }

    const multiSourceData = await getAllSourceData(sym);
    const enhancedData = mergeWithYahooData(data, multiSourceData);

    const analysis = analyzeStock(
      enhancedData.quote,
      enhancedData.summary,
      enhancedData.historical,
      enhancedData.priceTarget,
      enhancedData.technical,
      data.fcfHistory || []
    );

    const summary = enhancedData.summary;
    const quote = enhancedData.quote;

    // Debug: log summary keys if available
    console.log('Summary keys:', summary ? Object.keys(summary) : 'null');
    console.log('Profit margins in summary:', summary?.profitMargins);

    const totalCash = summary?.totalCash || 0;
    const totalDebt = summary?.totalDebt || 0;
    const profitMargins = (summary?.profitMargins && summary.profitMargins > 0) ? summary.profitMargins : (quote?.profitMargins || 0.25);
    const revenueGrowth = (summary?.revenueGrowth && summary.revenueGrowth > 0) ? summary.revenueGrowth : 0.15;
    const peRatio = quote.peRatio || summary?.peRatio || 0;

    // Calculate avgProfitMargin - use Yahoo data directly (already in percentage)
    const avgProfitMargin = summary?.avgProfitMargin || profitMargins * 100 || 25;

    // Calculate revenueGrowth manually if it's 0 - use growth from Yahoo data
    const calculatedRevenueGrowth = revenueGrowth > 0 
      ? revenueGrowth * 100 
      : 15; // Default to 15% if no data
    const debtToCash = totalCash > 0 ? totalDebt / totalCash : 0;
    const avgPe6Months = peRatio > 0 ? peRatio * 0.95 : 20;
    
    const marketCap = quote.marketCap || 0;
    const currentPrice = quote.regularMarketPrice || 0;
    const sharesOutstanding = marketCap > 0 && currentPrice > 0 ? marketCap / currentPrice : 0;
    
    const revenueLastYear = summary?.totalRevenue || marketCap * 0.3;
    const earningsLastYear = revenueLastYear * profitMargins;
    const projectedMarketCap = earningsLastYear * avgPe6Months;
    const projectedPrice = sharesOutstanding > 0 ? projectedMarketCap / sharesOutstanding : currentPrice * 1.15;
    const potentialReturn = currentPrice > 0 ? ((projectedPrice - currentPrice) / currentPrice) * 100 : 0;

    const buyZoneLow = currentPrice * 0.9;
    const buyZoneHigh = currentPrice * 0.97;
    const target1 = enhancedData.priceTarget?.targetMean || projectedPrice * 1.15;
    const target2 = target1 * 1.25;
    const stopLoss = currentPrice * 0.85;

    const technical = enhancedData.technical;

    let informeDetail = null;
    try {
      informeDetail = generateInformeDetail({
        ticker: sym,
        quote: enhancedData.quote,
        summary: enhancedData.summary,
        priceTarget: enhancedData.priceTarget,
        recommendation: analysis.recommendation,
        multiSourceData: multiSourceData,
      });
    } catch (error) {
      console.error('Error generating informeDetail:', error);
      informeDetail = null;
    }

    return NextResponse.json({
      quote,
      historical: enhancedData.historical,
      summary: {
        totalCash,
        totalDebt,
        debtToCash,
        profitMargins,
        profitMarginsPercent: profitMargins * 100 || 25,
        avgProfitMargin,
        revenueGrowth,
        revenueGrowthPercent: calculatedRevenueGrowth,
        revenuePerShare: summary?.revenuePerShare || 0,
        revenueLastYear,
        sharesOutstanding,
        peRatio,
        avgPe6Months,
        projectedPrice,
        potentialReturn,
        targetMeanPrice: quote.targetMeanPrice,
        targetHighPrice: quote.targetHighPrice,
        targetLowPrice: quote.targetLowPrice,
        buyZoneLow,
        buyZoneHigh,
        target1,
        target2,
        stopLoss,
        verdict: analysis.recommendation.action,
        peClassification: analysis.fundamentals.principle1.description,
        cashClassification: analysis.fundamentals.principle2.description,
        debtClassification: analysis.fundamentals.principle2.description,
        totalRevenue: summary?.totalRevenue || 0,
        freeCashflow: summary?.freeCashflow || 0,
        marketCap,
      },
      priceTarget: enhancedData.priceTarget,
      technical,
      fundamentals: analysis.fundamentals,
      recommendation: analysis.recommendation,
      discountScore: analysis.discountScore,
      multiSource: multiSourceData,
      informeDetail,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
