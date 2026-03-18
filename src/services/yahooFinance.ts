import YahooFinance from 'yahoo-finance2';
import type {
  StockQuote,
  StockSummary,
  HistoricalData,
  AnalystPriceTarget,
  TechnicalAnalysis,
  FCFHistoryData,
} from '../types';

const yf = new YahooFinance();

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY;

const SYMBOL_MAP: Record<string, string> = {
  AAPL: 'Apple Inc',
  MSFT: 'Microsoft Corporation',
  GOOGL: 'Alphabet Inc Class A',
  AMZN: 'Amazon.com Inc',
  NVDA: 'NVIDIA Corporation',
  META: 'Meta Platforms Inc',
  TSLA: 'Tesla Inc',
  JPM: 'JPMorgan Chase',
  V: 'Visa Inc',
  JNJ: 'Johnson & Johnson',
  WMT: 'Walmart Inc',
  PG: 'Procter & Gamble',
};

interface FinnhubBalanceSheet {
  totalCash: number;
  totalDebt: number;
}

async function getFinnhubBalanceSheet(symbol: string): Promise<{ totalCash: number; totalDebt: number }> {
  if (!FINNHUB_API_KEY) {
    return { totalCash: 0, totalDebt: 0 };
  }

  try {
    const url = `https://finnhub.io/api/v1/stock/balance-sheet?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return { totalCash: 0, totalDebt: 0 };
    }
    
    const data = await response.json();
    
    if (data && data.balanceSheet && data.balanceSheet.length > 0) {
      const latest = data.balanceSheet[0];
      return {
        totalCash: latest.totalCash || 0,
        totalDebt: latest.totalDebt || 0,
      };
    }
    
    return { totalCash: 0, totalDebt: 0 };
  } catch (error) {
    return { totalCash: 0, totalDebt: 0 };
  }
}

async function getAlphaVantageBalanceSheet(symbol: string): Promise<{ totalCash: number; totalDebt: number; failed?: boolean }> {
  if (!ALPHA_VANTAGE_KEY) {
    return { totalCash: 0, totalDebt: 0 };
  }

  try {
    const url = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return { totalCash: 0, totalDebt: 0, failed: true };
    }
    
    const data = await response.json();
    
    if (data?.quarterlyReports && data.quarterlyReports.length > 0) {
      const latest = data.quarterlyReports[0];
      const cash = parseInt(latest.cashAndCashEquivalentsAtEndOfPeriod || '0') || 0;
      const shortTermDebt = parseInt(latest.shortTermDebt || '0') || 0;
      const longTermDebt = parseInt(latest.longTermDebt || '0') || 0;
      const totalDebt = parseInt(latest.shortLongTermDebtTotal || '0') || (shortTermDebt + longTermDebt);
      
      return {
        totalCash: cash,
        totalDebt: totalDebt,
      };
    }
    
    return { totalCash: 0, totalDebt: 0 };
  } catch (error) {
    return { totalCash: 0, totalDebt: 0 };
  }
}

async function getAlphaVantageIncomeStatement(symbol: string): Promise<{ profitMargin: number; avgProfitMargin: number; revenueGrowth: number }> {
  if (!ALPHA_VANTAGE_KEY) {
    return { profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0 };
  }

  try {
    const url = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return { profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0 };
    }
    
    const data = await response.json();
    
    if (data?.quarterlyReports && data.quarterlyReports.length > 0) {
      const latest = data.quarterlyReports[0];
      const revenue = parseFloat(latest.totalRevenue || '0');
      const netIncome = parseFloat(latest.netIncome || '0');
      
      const profitMargin = revenue > 0 ? netIncome / revenue : 0;
      
      // Calculate average from last 4 quarters
      let totalMargin = 0;
      let count = 0;
      for (let i = 0; i < Math.min(4, data.quarterlyReports.length); i++) {
        const q = data.quarterlyReports[i];
        const qRevenue = parseFloat(q.totalRevenue || '0');
        const qNetIncome = parseFloat(q.netIncome || '0');
        if (qRevenue > 0) {
          totalMargin += qNetIncome / qRevenue;
          count++;
        }
      }
      const avgProfitMargin = count > 0 ? (totalMargin / count) * 100 : profitMargin * 100;
      
      // Calculate YoY growth
      let revenueGrowth = 0;
      if (data.quarterlyReports.length >= 4) {
        const currentQ = data.quarterlyReports[0];
        const lastYearQ = data.quarterlyReports[3];
        const currentRevenue = parseFloat(currentQ.totalRevenue || '0');
        const lastYearRevenue = parseFloat(lastYearQ.totalRevenue || '0');
        if (lastYearRevenue > 0) {
          revenueGrowth = (currentRevenue - lastYearRevenue) / lastYearRevenue;
        }
      }
      
      return {
        profitMargin,
        avgProfitMargin,
        revenueGrowth,
      };
    }
    
    return { profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0 };
  } catch (error) {
    return { profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0 };
  }
}

async function getSECFinancials(symbol: string): Promise<{ revenue?: number; netIncome?: number; cash?: number; debt?: number }> {
  try {
    const cikResponse = await fetch(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}&type=10-Q&count=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    const cikText = await cikResponse.text();
    const match = cikText.match(/CIK=(\d{10})/);
    if (!match) return {};
    
    const filingUrl = `https://data.sec.gov/submissions/CIK${match[1]}.json`;
    const filingResponse = await fetch(filingUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    
    const filingData = await filingResponse.json();
    const recentFilings = filingData?.filings?.recent;
    
    if (!recentFilings) return {};
    
    return {};
  } catch (error) {
    return {};
  }
}

async function scrapeYahooBalanceSheet(symbol: string): Promise<{ totalCash: number; totalDebt: number }> {
  try {
    // Try fundamentalsTimeSeries endpoint - newer Yahoo Finance API
    const result: any = await (yf as any).fundamentalsTimeSeries(symbol, {
      period1: '2023-01-01',
      module: 'balance-sheet',
      type: 'annual',
    });
    
    if (result && result.length > 0) {
      const latest = result[0];
      const cash = latest?.cashAndCashEquivalents || latest?.cash || 0;
      const debt = latest?.totalDebt || 0;
      if (cash > 0 || debt > 0) {
        return { totalCash: cash, totalDebt: debt };
      }
    }
    
    // Try quarterly
    const resultQ: any = await (yf as any).fundamentalsTimeSeries(symbol, {
      period1: '2023-01-01',
      module: 'balance-sheet',
      type: 'quarterly',
    });
    
    if (resultQ && resultQ.length > 0) {
      const latest = resultQ[0];
      const cash = latest?.cashAndCashEquivalents || latest?.cash || 0;
      const debt = latest?.totalDebt || 0;
      return { totalCash: cash, totalDebt: debt };
    }
    
    return { totalCash: 0, totalDebt: 0 };
  } catch (error) {
    console.error('Error scraping Yahoo balance sheet:', error);
    return { totalCash: 0, totalDebt: 0 };
  }
}

function estimateCashAndDebt(marketCap: number) {
  // Rough estimation based on sector averages
  // Tech companies typically have 20-30% of market cap in cash
  // Debt varies widely but typically 50-150% of cash for growth companies
  const cashRatio = 0.15; // 15% of market cap
  const debtRatio = 0.30; // 30% of market cap
  
  return {
    cash: marketCap * cashRatio,
    debt: marketCap * debtRatio,
  };
}

async function getYahooBalanceSheetDirect(symbol: string): Promise<{ totalCash: number; totalDebt: number }> {
  try {
    const url = `https://query1.finance.yahoo.com/ws/balance-sheet/v1/finance/${symbol.toUpperCase()}?scheme=balanceSheetHistory`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      return { totalCash: 0, totalDebt: 0 };
    }
    
    const data = await response.json();
    const balanceSheet = data?.balanceSheetHistory?.balanceSheetStatements;
    
    if (balanceSheet && balanceSheet.length > 0) {
      const latest = balanceSheet[0];
      const cash = latest?.cash || latest?.cashAndCashEquivalents || {};
      const debt = latest?.totalDebt || {};
      
      return {
        totalCash: cash.raw || 0,
        totalDebt: debt.raw || 0,
      };
    }
    
    return { totalCash: 0, totalDebt: 0 };
  } catch (error) {
    console.error('Error getting Yahoo balance sheet directly:', error);
    return { totalCash: 0, totalDebt: 0 };
  }
}

export async function getStockSummary(
  symbol: string,
): Promise<StockSummary | null> {
  const sym = symbol.toUpperCase();

  try {
    const [quote, quoteSummary, finnhubData, alphaVantageBalance, alphaVantageIncome, secData, yahooDirectData, scrapedData]: [any, any, any, any, any, any, any, any] = await Promise.all([
      yf.quote(sym).catch(() => null),
      yf.quoteSummary(sym, { modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics'] }).catch(() => null),
      getFinnhubBalanceSheet(sym).catch(() => ({ totalCash: 0, totalDebt: 0 })),
      getAlphaVantageBalanceSheet(sym).catch(() => ({ totalCash: 0, totalDebt: 0 })),
      getAlphaVantageIncomeStatement(sym).catch(() => ({ profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0 })),
      getSECFinancials(sym).catch(() => ({})),
      getYahooBalanceSheetDirect(sym).catch(() => ({ totalCash: 0, totalDebt: 0 })),
      scrapeYahooBalanceSheet(sym).catch(() => ({ totalCash: 0, totalDebt: 0 })),
    ]);

    let totalCashRaw = 0;
    let totalDebtRaw = 0;

    // Try scraped data first (from Yahoo finance page)
    if (scrapedData?.totalCash > 0 || scrapedData?.totalDebt > 0) {
      totalCashRaw = scrapedData.totalCash;
      totalDebtRaw = scrapedData.totalDebt;
    }

    // Try Yahoo Finance Direct API first (new approach)
    if (totalCashRaw === 0 && (yahooDirectData?.totalCash > 0 || yahooDirectData?.totalDebt > 0)) {
      totalCashRaw = yahooDirectData.totalCash;
      totalDebtRaw = yahooDirectData.totalDebt;
    }

    // Try Yahoo Finance balance sheet
    if (totalCashRaw === 0 || totalDebtRaw === 0) {
      try {
        const balanceSheet: any = await (yf as any).balanceSheet(sym, { period: 'annual' });
        const statements = balanceSheet?.balanceSheetHistory?.balanceSheetStatements;
        if (statements && statements.length > 0) {
          const latest = statements[0];
          if (totalCashRaw === 0) {
            if (latest.cash && latest.cash[0] && latest.cash[0].raw !== undefined) {
              totalCashRaw = latest.cash[0].raw;
            } else if (latest.cashAndCashEquivalents && latest.cashAndCashEquivalents[0]?.raw !== undefined) {
              totalCashRaw = latest.cashAndCashEquivalents[0].raw;
            }
          }
          if (totalDebtRaw === 0 && latest.totalDebt && latest.totalDebt[0]?.raw !== undefined) {
            totalDebtRaw = latest.totalDebt[0].raw;
          }
        }
      } catch (e) {
        // Try quarterly
        try {
          const balanceSheetQ: any = await (yf as any).balanceSheet(sym, { period: 'quarterly' });
          const statements = balanceSheetQ?.balanceSheetHistory?.balanceSheetStatements;
          if (statements && statements.length > 0) {
            const latest = statements[0];
            if (totalCashRaw === 0) {
              if (latest.cash && latest.cash[0]?.raw !== undefined) {
                totalCashRaw = latest.cash[0].raw;
              } else if (latest.cashAndCashEquivalents && latest.cashAndCashEquivalents[0]?.raw !== undefined) {
                totalCashRaw = latest.cashAndCashEquivalents[0].raw;
              }
            }
            if (totalDebtRaw === 0 && latest.totalDebt && latest.totalDebt[0]?.raw !== undefined) {
              totalDebtRaw = latest.totalDebt[0].raw;
            }
          }
        } catch (e2) {
          // Fallback
        }
      }
    }

    const defaultKeyStatistics = quoteSummary?.defaultKeyStatistics || {};
    const financialData = quoteSummary?.financialData || {};

    // Fallback to financialData if still 0
    if (totalCashRaw === 0 && financialData?.totalCash?.raw) {
      totalCashRaw = financialData.totalCash.raw;
    }
    if (totalDebtRaw === 0 && financialData?.totalDebt?.raw) {
      totalDebtRaw = financialData.totalDebt.raw;
    }

    // Fallback to Finnhub if still 0
    if (totalCashRaw === 0 && finnhubData?.totalCash) {
      totalCashRaw = finnhubData.totalCash;
    }
    if (totalDebtRaw === 0 && finnhubData?.totalDebt) {
      totalDebtRaw = finnhubData.totalDebt;
    }

    // Fallback to Alpha Vantage if still 0
    if (totalCashRaw === 0 && alphaVantageBalance?.totalCash) {
      totalCashRaw = alphaVantageBalance.totalCash;
    }
    if (totalDebtRaw === 0 && alphaVantageBalance?.totalDebt) {
      totalDebtRaw = alphaVantageBalance.totalDebt;
    }

    // Fallback to SEC EDGAR if still 0
    if (totalCashRaw === 0 && secData?.cash) {
      totalCashRaw = secData.cash;
    }
    if (totalDebtRaw === 0 && secData?.debt) {
      totalDebtRaw = secData.debt;
    }

    // Fallback: Estimate from market cap if still 0
    const marketCap = quote?.marketCap || defaultKeyStatistics?.marketCap?.raw || 0;
    if (totalCashRaw === 0 && marketCap > 0) {
      const estimated = estimateCashAndDebt(marketCap);
      totalCashRaw = estimated.cash;
      totalDebtRaw = estimated.debt;
    }

    const sectorDefaults: Record<string, number> = {
      'Technology': 28,
      'Consumer Cyclical': 20,
      'Communication Services': 20,
      'Financial Services': 15,
      'Healthcare': 20,
      'Industrials': 18,
      'Consumer Defensive': 15,
      'Basic Materials': 12,
      'Energy': 10,
      'Real Estate': 30,
      'Utilities': 10,
    };
    
    const sector = quoteSummary?.summaryProfile?.sector || 'Technology';
    const defaultMargin = sectorDefaults[sector] || 15;
    
    const yahooMargin = financialData?.profitMargins;
    const alphaMargin = alphaVantageIncome?.profitMargin;
    const secMargin = secData?.revenue && secData?.netIncome ? secData.netIncome / secData.revenue : 0;
    
    const profitMarginsValue = yahooMargin || (alphaMargin && alphaMargin < 1 ? alphaMargin : 0) || secMargin || (defaultMargin / 100);
    const avgProfitMarginValue = (() => {
      if (alphaVantageIncome?.avgProfitMargin) return alphaVantageIncome.avgProfitMargin;
      if (yahooMargin) return yahooMargin * 100;
      if (secMargin) return secMargin * 100;
      return defaultMargin;
    })();

    return {
      marketCap: marketCap,
      peRatio: quote?.trailingPE || defaultKeyStatistics?.trailingPE?.raw || 0,
      pegRatio: defaultKeyStatistics?.pegRatio?.raw || 0,
      epsTrailingTwelveMonths: defaultKeyStatistics?.epsTrailingTwelveMonths?.raw || 0,
      epsForward: defaultKeyStatistics?.epsForward?.raw || 0,
      beta: defaultKeyStatistics?.beta?.raw || 0,
      dividendYield: (defaultKeyStatistics?.dividendYield?.raw || 0) * 100,
      dividendRate: defaultKeyStatistics?.dividendRate?.raw || 0,
      bookValue: defaultKeyStatistics?.bookValue?.raw || 0,
      priceToBook: defaultKeyStatistics?.priceToBook?.raw || 0,
      priceToSalesTrailingTwelveMonths: defaultKeyStatistics?.priceToSales?.raw || 0,
      trailingAnnualDividendYield: (defaultKeyStatistics?.dividendYield?.raw || 0) * 100,
      exDividendDate: defaultKeyStatistics?.exDividendDate?.raw || '',
      profitMargins: profitMarginsValue,
      avgProfitMargin: avgProfitMarginValue,
      operatingMargins: financialData?.operatingMargins || 0,
      returnOnAssets: financialData?.returnOnAssets || 0,
      returnOnEquity: financialData?.returnOnEquity || 0,
      grossProfits: financialData?.grossProfits || 0,
      totalCash: totalCashRaw || 0,
      totalDebt: totalDebtRaw || 0,
      totalRevenue: financialData?.totalRevenue || secData?.revenue || 0,
      revenuePerShare: financialData?.revenuePerShare || 0,
      revenueGrowth: financialData?.revenueGrowth || alphaVantageIncome?.revenueGrowth || 0.15,
      earningsGrowth: financialData?.earningsGrowth || 0,
      grossMargins: financialData?.grossMargins || 0,
      ebitdaMargins: financialData?.ebitdaMargins || 0,
      operatingCashflow: financialData?.operatingCashflow || 0,
      freeCashflow: financialData?.freeCashflow || 0,
    };
  } catch (e) {
    console.error('Error in getStockSummary:', e);
    return null;
  }
}

export async function getHistoricalData(
  symbol: string,
  period1?: Date,
  period2?: Date,
): Promise<HistoricalData[]> {
  const sym = symbol.toUpperCase();

  const startDate = period1 || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const endDate = period2 || new Date();

  try {
    const result: any = await yf.historical(sym, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    return result.map((item: any) => ({
      date: item.date.toISOString().split('T')[0],
      close: item.close,
      high: item.high,
      low: item.low,
      open: item.open,
      volume: item.volume,
    }));
  } catch (e) {
    console.error('Error in getHistoricalData:', e);
    return [];
  }
}

export async function getAnalystPriceTargets(
  symbol: string,
): Promise<AnalystPriceTarget | null> {
  const sym = symbol.toUpperCase();

  try {
    const result: any = await yf.quoteSummary(sym, { modules: ['financialData'] });
    const financialData = result?.financialData;
    
    if (!financialData) return null;

    const targetMean = financialData.targetMeanPrice?.raw || 0;
    const targetHigh = financialData.targetHighPrice?.raw || 0;
    const targetLow = financialData.targetLowPrice?.raw || 0;
    
    if (!targetMean || !targetHigh || !targetLow) return null;

    return {
      symbol: sym,
      targetMean,
      targetHigh,
      targetLow,
      targetMedian: (targetHigh + targetLow) / 2,
      numberOfAnalysts: financialData.numberOfAnalystOpinions?.raw || 0,
      targetCount: financialData.numberOfAnalystOpinions?.raw || 0,
    };
  } catch (e) {
    console.error('Error in getAnalystPriceTargets:', e);
    return null;
  }
}

export async function getTechnicalAnalysis(
  symbol: string,
): Promise<TechnicalAnalysis | null> {
  const sym = symbol.toUpperCase();

  try {
    const result: any = await yf.historical(sym, {
      period1: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: '1d',
    });

    if (!result || result.length === 0) return null;

    const prices = result.map((item: any) => item.close);
    
    // Calculate SMA 50 and SMA 200
    const sma50 = prices.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50;
    const sma200 = prices.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200;
    
    // Calculate RSI (14)
    const rsiPeriod = 14;
    const recentPrices = prices.slice(-rsiPeriod - 1);
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < recentPrices.length; i++) {
      const diff = recentPrices[i] - recentPrices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    
    const avgGain = gains / rsiPeriod;
    const avgLoss = losses / rsiPeriod;
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    // Determine trend
    let trend: 'alcista' | 'bajista' | 'lateral' = 'lateral';
    if (sma50 > sma200 * 1.02) trend = 'alcista';
    else if (sma50 < sma200 * 0.98) trend = 'bajista';
    
    // Support and resistance
    const support = Math.min(...prices.slice(-50));
    const resistance = Math.max(...prices.slice(-50));

    // Signal
    let signal: 'comprar' | 'vender' | 'neutral' = 'neutral';
    if (rsi < 30 && trend === 'alcista') signal = 'comprar';
    else if (rsi > 70 && trend === 'bajista') signal = 'vender';

    const currentPrice = prices[prices.length - 1];
    
    return {
      rsi,
      sma50,
      sma200,
      currentPrice,
      trend,
      support,
      resistance,
      signal,
    };
  } catch (e) {
    console.error('Error in getTechnicalAnalysis:', e);
    return null;
  }
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const sym = symbol.toUpperCase();
  const companyName = SYMBOL_MAP[sym] || sym;

  try {
    const [quoteResult, summaryResult] = await Promise.all([
      yf.quote(sym).catch(() => null),
      yf.quoteSummary(sym, { modules: ['summaryProfile', 'financialData'] }).catch(() => null),
    ]);

    if (!quoteResult) {
      throw new Error('Quote not found');
    }

    const quote = quoteResult;
    const summary = (summaryResult?.summaryProfile || {}) as any;
    const financialData = (summaryResult?.financialData || {}) as any;

    return {
      symbol: quote.symbol,
      shortName: quote.shortName || companyName,
      longName: quote.longName || summary.longName || companyName,
      currency: quote.currency || 'USD',
      regularMarketPrice: quote.regularMarketPrice || 0,
      regularMarketChange: quote.regularMarketChange || 0,
      regularMarketChangePercent: quote.regularMarketChangePercent || 0,
      regularMarketDayHigh: quote.regularMarketDayHigh || 0,
      regularMarketDayLow: quote.regularMarketDayLow || 0,
      regularMarketVolume: quote.regularMarketVolume || 0,
      regularMarketOpen: quote.regularMarketOpen || 0,
      regularMarketPreviousClose: quote.regularMarketPreviousClose || 0,
      postMarketPrice: quote.postMarketPrice || 0,
      postMarketChange: quote.postMarketChange || 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
      marketCap: quote.marketCap || 0,
      peRatio: quote.trailingPE || 0,
      targetMeanPrice: financialData.targetMeanPrice || 0,
      targetHighPrice: financialData.targetHighPrice || 0,
      targetLowPrice: financialData.targetLowPrice || 0,
      recommendationKey: financialData.recommendationKey || 'none',
      numberOfAnalystOpinions: financialData.numberOfAnalystOpinions || 0,
      sector: summary.sector || 'Unknown',
      industry: summary.industry || 'Unknown',
      businessSummary: summary.businessSummary || '',
    };
  } catch (error) {
    throw new Error(`Failed to fetch quote for ${symbol}`);
  }
}

export async function getStockData(symbol: string) {
  const quote = await getStockQuote(symbol);
  const summary = await getStockSummary(symbol);
  const historical = await getHistoricalData(symbol);
  const priceTarget = await getAnalystPriceTargets(symbol);
  const technical = await getTechnicalAnalysis(symbol);
  const fcfHistory = await getFCFHistory(symbol);

  return {
    quote,
    summary,
    historical,
    priceTarget,
    technical,
    fcfHistory,
  };
}

export async function getFCFHistory(symbol: string): Promise<FCFHistoryData[]> {
  try {
    const result: any = await (yf as any).fundamentalsTimeSeries(symbol, {
      period1: '2020-01-01',
      period2: new Date().toISOString().split('T')[0],
      module: 'cash-flow',
      type: 'annual',
    });

    if (!result || result.length === 0) {
      return [];
    }

    const fcfData: FCFHistoryData[] = result
      .slice(0, 5)
      .reverse()
      .map((item: any) => ({
        year: new Date(item.endDate).getFullYear(),
        freeCashFlow: item.quarterlyFreeCashFlow || 0,
      }))
      .filter((item: FCFHistoryData) => item.freeCashFlow > 0);

    return fcfData;
  } catch (error) {
    console.error('Error fetching FCF history:', error);
    return [];
  }
}
