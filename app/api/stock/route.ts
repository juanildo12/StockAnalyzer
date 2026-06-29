import { NextRequest, NextResponse } from 'next/server';
import { getStockData, getStockNews } from '../../../src/services/yahooFinance';
import { analyzeStock } from '../../../src/services/stockAnalysis';
import { getAllSourceData, mergeWithYahooData } from '../../../src/services/dataSources';
import { generateInformeDetail } from '../../../src/services/informeGenerator';
import { calculateNNWC } from '../../../src/services/nnwcAnalysis';
import { analyzeGraham } from '../../../src/services/grahamAnalysis';
import { enrichStockData, extractFinancialMetrics, extractFinnhubMetrics } from '../../../src/services/polygonFinnhubEnrichment';

export const dynamic = 'force-dynamic';

function jsonResponse(data: any, status = 200) {
  const res = NextResponse.json(data, { status });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res;
}

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
      
      return jsonResponse({ quotes });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return jsonResponse({ error: message, quotes: [] }, 500);
    }
  }

  if (!symbol) {
    return jsonResponse({ error: 'Symbol is required' }, 400);
  }

  const sym = symbol.toUpperCase();

  try {
    const [data, enrichment, yahooNews] = await Promise.all([
      getStockData(sym),
      enrichStockData(sym),
      getStockNews(sym).catch(() => []),
    ]);

    if (!data.quote || data.quote.regularMarketPrice === 0) {
      return jsonResponse({ error: `Ticker "${sym}" no encontrado` }, 404);
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

    // ---- Polygon + Finnhub enrichment ----
    const pf = extractFinancialMetrics(enrichment.polygon.financials);
    const fm = extractFinnhubMetrics(enrichment.finnhub.metrics);

    const totalCash = pf.totalCash || summary?.totalCash || 0;
    const totalDebt = pf.totalDebt || summary?.totalDebt || 0;
    const totalLiabilities = pf.totalLiabilities || summary?.totalLiabilities || 0;
    const currentAssets = pf.currentAssets || summary?.currentAssets || 0;
    const currentLiabilities = pf.currentLiabilities || summary?.currentLiabilities || 0;
    const accountsReceivable = pf.accountsReceivable || summary?.accountsReceivable || 0;
    const inventory = pf.inventory || summary?.inventory || 0;
    const totalRevenue = pf.revenue || summary?.totalRevenue || 0;

    const peRatio = fm.peRatio ?? quote.peRatio ?? summary?.peRatio ?? 0;
    // Finnhub returns percentages (25 for 25%), normalize to decimal
    const rawPM = fm.profitMargin;
    const pmDecimal = rawPM != null && rawPM > 0 ? (rawPM > 1 ? rawPM / 100 : rawPM) : 0;
    const profitMargins = pmDecimal || (summary?.profitMargins ?? quote?.profitMargins ?? 0.25);
    const rawRG = fm.revenueGrowth;
    const rgDecimal = rawRG != null && rawRG > 0 ? (rawRG > 1 ? rawRG / 100 : rawRG) : 0;
    const revenueGrowth = rgDecimal || (summary?.revenueGrowth ?? 0.15);
    const marketCap = fm.marketCapitalization ?? quote.marketCap ?? 0;
    const currentPrice = quote.regularMarketPrice || 0;

    const avgProfitMargin = summary?.avgProfitMargin || profitMargins * 100 || 25;
    const calculatedRevenueGrowth = revenueGrowth > 0 ? revenueGrowth * 100 : 15;
    const debtToCash = totalCash > 0 ? totalDebt / totalCash : 0;
    const avgPe6Months = peRatio > 0 ? peRatio * 0.95 : 20;

    const priceToBook = fm.priceToBook ?? quote.priceToBook ?? summary?.priceToBook ?? 0;

    const grahamResult = analyzeGraham({
      cash: totalCash,
      totalDebt,
      currentAssets,
      currentLiabilities,
      totalLiabilities,
      marketCap,
      priceToBook,
      bookValue: summary?.bookValue,
    });

    const nnwcResult = calculateNNWC({
      cash: totalCash,
      receivables: accountsReceivable,
      inventory,
      totalLiabilities,
      marketCap,
    });
    const sharesOutstanding = marketCap > 0 && currentPrice > 0 ? marketCap / currentPrice : 0;
    
    const revenueLastYear = totalRevenue || marketCap * 0.3;
    const earningsLastYear = revenueLastYear * profitMargins;
    const projectedMarketCap = earningsLastYear * avgPe6Months;
    const projectedPrice = sharesOutstanding > 0 ? projectedMarketCap / sharesOutstanding : currentPrice * 1.15;
    const potentialReturn = currentPrice > 0 ? ((projectedPrice - currentPrice) / currentPrice) * 100 : 0;

    const buyZoneLow = currentPrice * 0.9;
    const buyZoneHigh = currentPrice * 0.97;
    const target1 = enrichment.finnhub.priceTarget?.targetMean || enhancedData.priceTarget?.targetMean || projectedPrice * 1.15;
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

    return jsonResponse({
      _cached: false,
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
        totalRevenue,
        freeCashflow: fm.freeCashFlow ?? summary?.freeCashflow ?? 0,
        marketCap,
        accountsReceivable,
        inventory,
        totalLiabilities,
        currentAssets,
        currentLiabilities,
      },
      nnwc: nnwcResult,
      graham: grahamResult,
      priceTarget: enhancedData.priceTarget,
      technical,
      fundamentals: analysis.fundamentals,
      recommendation: analysis.recommendation,
      discountScore: analysis.discountScore,
      multiSource: multiSourceData,
      informeDetail,
      // ---- Polygon + Finnhub enriched data ----
      polygon: enrichment.polygon,
      finnhub: {
        profile: enrichment.finnhub.profile,
        metrics: fm,
        recommendation: enrichment.finnhub.recommendation,
        earnings: enrichment.finnhub.earnings,
        priceTarget: enrichment.finnhub.priceTarget,
        insiderTransactions: enrichment.finnhub.insiderTransactions,
        socialSentiment: enrichment.finnhub.socialSentiment,
        news: enrichment.finnhub.news,
        yahooNews,
        peerGroups: enrichment.finnhub.peerGroups,
        incomeStatement: enrichment.finnhub.incomeStatement,
        balanceSheet: enrichment.finnhub.balanceSheet,
        cashFlow: enrichment.finnhub.cashFlow,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
}
