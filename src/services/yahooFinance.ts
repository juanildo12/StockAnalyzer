import YahooFinance from 'yahoo-finance2';
import type {
  StockQuote,
  StockSummary,
  HistoricalData,
  AnalystPriceTarget,
  TechnicalAnalysis,
} from '../types';

const yf = new YahooFinance();

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd6q9ts1r01qhcrmjerigd6q9ts1r01qhcrmjerj0';
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || 'H50P2K0ZWGXW6XW6';

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
  symbol: string;
  finance?: {
    totalCash?: number;
    totalDebt?: number;
    totalAssets?: number;
    totalLiabilities?: number;
  }[];
}

async function getFinnhubBalanceSheet(symbol: string): Promise<{ totalCash: number; totalDebt: number }> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/stock/financials?symbol=${symbol.toUpperCase()}&statement=bs&freq=annual&token=${FINNHUB_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Finnhub API error');
    }
    
    const data: FinnhubBalanceSheet = await response.json();
    
    if (data?.finance && data.finance.length > 0) {
      const latest = data.finance[0];
      return {
        totalCash: latest.totalCash || 0,
        totalDebt: latest.totalDebt || 0,
      };
    }
    
    return { totalCash: 0, totalDebt: 0 };
  } catch (e) {
    console.error('Finnhub error:', e);
    return { totalCash: 0, totalDebt: 0 };
  }
}

async function getAlphaVantageBalanceSheet(symbol: string): Promise<{ totalCash: number; totalDebt: number; failed?: boolean }> {
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Alpha Vantage API error');
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data?.['Error Message'] || data?.Note || data?.information) {
      console.error('Alpha Vantage rate limit or error:', data);
      return { totalCash: 0, totalDebt: 0, failed: true };
    }
    
    if (data?.annualReports && data.annualReports.length > 0) {
      const latest = data.annualReports[0];
      const cash = parseInt(latest.cashAndCashEquivalentsAtCarryingValue || '0');
      const shortTermDebt = parseInt(latest.shortTermDebt || '0');
      const longTermDebt = parseInt(latest.longTermDebt || '0');
      const totalDebt = parseInt(latest.shortLongTermDebtTotal || '0') || (shortTermDebt + longTermDebt);
      
      return {
        totalCash: cash,
        totalDebt: totalDebt,
      };
    }
    
    return { totalCash: 0, totalDebt: 0 };
  } catch (e) {
    console.error('Alpha Vantage error:', e);
    return { totalCash: 0, totalDebt: 0 };
  }
}

// SEC EDGAR API - Free, no API key required
const CIK_MAP: Record<string, string> = {
  AAPL: '0000320193',
  MSFT: '0000789019',
  GOOGL: '0001652044',
  GOOG: '0001652044',
  AMZN: '0001018724',
  NVDA: '0001045810',
  META: '0001326801',
  TSLA: '0001318605',
  JPM: '0000019617',
  V: '0001403161',
  JNJ: '0000200406',
  WMT: '0000104169',
  PG: '0000080424',
  DIS: '0001744489',
  NFLX: '0001065280',
  AMD: '0000002488',
  INTC: '0000050863',
  CSCO: '0000858877',
  ORCL: '0001341439',
  IBM: '0000051143',
  BA: '0000012927',
  GE: '0000040545',
  CAT: '0000018230',
  KO: '0000021344',
  PEP: '0000077476',
  MCD: '0000063908',
  NKE: '0000320187',
  SBUX: '0000829224',
};

async function getCIK(symbol: string): Promise<string | null> {
  // First check our static map
  if (CIK_MAP[symbol.toUpperCase()]) {
    return CIK_MAP[symbol.toUpperCase()];
  }
  
  // Try to fetch from SEC
  try {
    const response = await fetch('https://www.sec.gov/files/company_tickers.json', {
      headers: { 'User-Agent': 'StockAnalyzer contact@email.com' }
    });
    const data = await response.json();
    const searchSymbol = symbol.toUpperCase();
    
    for (const [cik, info] of Object.entries(data)) {
      if ((info as any).ticker === searchSymbol) {
        return cik.toString().padStart(10, '0');
      }
    }
    return null;
  } catch (e) {
    console.error('Error getting CIK:', e);
    return null;
  }
}

interface SECFinancialData {
  cash?: number;
  debt?: number;
  revenue?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
}

async function getSECFinancials(symbol: string): Promise<SECFinancialData> {
  try {
    const cik = await getCIK(symbol);
    if (!cik) {
      return {};
    }
    
    const response = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      { headers: { 'User-Agent': 'StockAnalyzer contact@email.com' } }
    );
    
    if (!response.ok) {
      return {};
    }
    
    const data = await response.json();
    const facts = data?.facts?.usGaap;
    
    if (!facts) {
      return {};
    }
    
    const result: SECFinancialData = {};
    
    // Get Cash and Cash Equivalents
    if (facts.CashAndCashEquivalentsAtCarryingValue) {
      const values = facts.CashAndCashEquivalentsAtCarryingValue.units.USD;
      if (values && values.length > 0) {
        // Get the most recent annual value
        const annualValues = values.filter((v: any) => v.fp === 'FY');
        if (annualValues.length > 0) {
          result.cash = annualValues[annualValues.length - 1].val;
        } else if (values[0]) {
          result.cash = values[0].val;
        }
      }
    }
    
    // Get Total Debt (using LongTermDebt + ShortTermDebt)
    if (facts.LongTermDebt) {
      const values = facts.LongTermDebt.units.USD;
      if (values && values.length > 0) {
        const annualValues = values.filter((v: any) => v.fp === 'FY');
        if (annualValues.length > 0) {
          result.debt = (result.debt || 0) + annualValues[annualValues.length - 1].val;
        } else if (values[0]) {
          result.debt = (result.debt || 0) + values[0].val;
        }
      }
    }
    
    if (facts.ShortTermDebt) {
      const values = facts.ShortTermDebt.units.USD;
      if (values && values.length > 0) {
        const annualValues = values.filter((v: any) => v.fp === 'FY');
        if (annualValues.length > 0) {
          result.debt = (result.debt || 0) + annualValues[annualValues.length - 1].val;
        } else if (values[0]) {
          result.debt = (result.debt || 0) + values[0].val;
        }
      }
    }
    
    // Get Revenue
    if (facts.RevenueFromContractWithCustomerExcludingAssessedTax) {
      const values = facts.RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
      if (values && values.length > 0) {
        const annualValues = values.filter((v: any) => v.fp === 'FY');
        if (annualValues.length > 0) {
          result.revenue = annualValues[annualValues.length - 1].val;
        } else if (values[0]) {
          result.revenue = values[0].val;
        }
      }
    } else if (facts.Revenue) {
      const values = facts.Revenue.units.USD;
      if (values && values.length > 0) {
        const annualValues = values.filter((v: any) => v.fp === 'FY');
        if (annualValues.length > 0) {
          result.revenue = annualValues[annualValues.length - 1].val;
        } else if (values[0]) {
          result.revenue = values[0].val;
        }
      }
    }
    
    // Get Net Income
    if (facts.NetIncomeLoss) {
      const values = facts.NetIncomeLoss.units.USD;
      if (values && values.length > 0) {
        const annualValues = values.filter((v: any) => v.fp === 'FY');
        if (annualValues.length > 0) {
          result.netIncome = annualValues[annualValues.length - 1].val;
        } else if (values[0]) {
          result.netIncome = values[0].val;
        }
      }
    }
    
    return result;
  } catch (e) {
    console.error('SEC EDGAR error:', e);
    return {};
  }
}

async function getAlphaVantageIncomeStatement(symbol: string): Promise<{ profitMargin: number; avgProfitMargin: number; revenueGrowth: number; failed?: boolean }> {
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Alpha Vantage API error');
    }
    
    const data = await response.json();
    
    // Check for API limit error
    if (data?.['Error Message'] || data?.Note || data?.information) {
      console.error('Alpha Vantage rate limit or error:', data);
      return { profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0, failed: true };
    }
    
    if (data?.annualReports && data.annualReports.length >= 2) {
      const current = data.annualReports[0];
      const previous = data.annualReports[1];
      
      const revenueCurrent = parseInt(current.totalRevenue || '0');
      const revenuePrevious = parseInt(previous.totalRevenue || '0');
      const netIncomeCurrent = parseInt(current.netIncome || '0');
      
      // Profit margin actual
      const profitMargin = revenueCurrent > 0 ? netIncomeCurrent / revenueCurrent : 0;
      
      // Promedio profit margin últimos años
      const profitMargins = data.annualReports.slice(0, 5).map((r: any) => {
        const rev = parseInt(r.totalRevenue || '0');
        const ni = parseInt(r.netIncome || '0');
        return rev > 0 ? ni / rev : 0;
      }).filter((pm: number) => pm > 0);
      
      const avgProfitMargin = profitMargins.length > 0 
        ? profitMargins.reduce((a: number, b: number) => a + b, 0) / profitMargins.length 
        : profitMargin;
      
      // Crecimiento de ventas
      const revenueGrowth = revenuePrevious > 0 ? (revenueCurrent - revenuePrevious) / revenuePrevious : 0;
      
      return { profitMargin, avgProfitMargin, revenueGrowth };
    }
    
    return { profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0 };
  } catch (e) {
    console.error('Alpha Vantage Income Statement error:', e);
    // Return a flag to indicate failure so Yahoo can be used as fallback
    return { profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0, failed: true };
  }
}

function estimateCashAndDebt(marketCap: number, sector?: string): { cash: number; debt: number } {
  const sectorRatios: Record<string, { cashPercent: number; debtPercent: number }> = {
    'technology': { cashPercent: 0.15, debtPercent: 0.10 },
    'technology services': { cashPercent: 0.15, debtPercent: 0.10 },
    'semiconductors': { cashPercent: 0.20, debtPercent: 0.05 },
    'financial': { cashPercent: 0.02, debtPercent: 0.80 },
    'financial services': { cashPercent: 0.02, debtPercent: 0.80 },
    'banks': { cashPercent: 0.10, debtPercent: 0.85 },
    'healthcare': { cashPercent: 0.08, debtPercent: 0.15 },
    'health': { cashPercent: 0.08, debtPercent: 0.15 },
    'consumer': { cashPercent: 0.05, debtPercent: 0.20 },
    'consumer goods': { cashPercent: 0.05, debtPercent: 0.20 },
    'retail': { cashPercent: 0.03, debtPercent: 0.25 },
    'energy': { cashPercent: 0.04, debtPercent: 0.30 },
    'utilities': { cashPercent: 0.02, debtPercent: 0.50 },
    'real estate': { cashPercent: 0.01, debtPercent: 0.60 },
    'industrial': { cashPercent: 0.04, debtPercent: 0.25 },
    'materials': { cashPercent: 0.05, debtPercent: 0.20 },
    'communication': { cashPercent: 0.06, debtPercent: 0.25 },
  };

  const sectorLower = sector?.toLowerCase() || '';
  let ratios = sectorRatios['default'];
  
  for (const key of Object.keys(sectorRatios)) {
    if (sectorLower.includes(key)) {
      ratios = sectorRatios[key];
      break;
    }
  }

  return {
    cash: marketCap * ratios.cashPercent,
    debt: marketCap * ratios.debtPercent
  };
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const sym = symbol.toUpperCase();

  try {
    const [quote, quoteSummary]: [any, any] = await Promise.all([
      yf.quote(sym),
      yf.quoteSummary(sym, { modules: ['summaryProfile'] }).catch(() => null)
    ]);

    const summaryProfile = quoteSummary?.summaryProfile || {};
    const sector = summaryProfile?.sector || 'Unknown';
    const industry = summaryProfile?.industry || 'Unknown';
    const businessSummary = summaryProfile?.longBusinessSummary || '';

    return {
      symbol: quote.symbol,
      shortName: quote.shortName || SYMBOL_MAP[sym] || sym,
      longName: quote.longName || quote.shortName || SYMBOL_MAP[sym] || sym,
      currency: quote.currency || 'USD',
      regularMarketPrice: quote.regularMarketPrice || 0,
      regularMarketChange: quote.regularMarketChange || 0,
      regularMarketChangePercent: quote.regularMarketChangePercent || 0,
      regularMarketDayHigh: quote.regularMarketDayHigh || 0,
      regularMarketDayLow: quote.regularMarketDayLow || 0,
      regularMarketVolume: quote.regularMarketVolume || 0,
      regularMarketOpen: quote.regularMarketOpen || 0,
      regularMarketPreviousClose: quote.previousClose || quote.regularMarketPreviousClose || 0,
      postMarketPrice: quote.postMarketPrice || 0,
      postMarketChange: quote.postMarketChange || 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
      targetMeanPrice: quote.targetMeanPrice || 0,
      targetHighPrice: quote.targetHighPrice || 0,
      targetLowPrice: quote.targetLowPrice || 0,
      recommendationKey: quote.recommendationKey || 'none',
      numberOfAnalystOpinions: quote.numberOfAnalystOpinions || 0,
      marketCap: quote.marketCap || 0,
      peRatio: quote.trailingPE || 0,
      sector,
      industry,
      businessSummary,
    };
  } catch (e: any) {
    throw new Error(`Error: ${e.message}`);
  }
}

export async function getStockSummary(
  symbol: string,
): Promise<StockSummary | null> {
  const sym = symbol.toUpperCase();

  try {
    const [quote, quoteSummary, finnhubData, alphaVantageBalance, alphaVantageIncome, secData]: [any, any, any, any, any, any] = await Promise.all([
      yf.quote(sym).catch(() => null),
      yf.quoteSummary(sym, { modules: ['summaryProfile', 'financialData', 'defaultKeyStatistics'] }).catch(() => null),
      getFinnhubBalanceSheet(sym).catch(() => ({ totalCash: 0, totalDebt: 0 })),
      getAlphaVantageBalanceSheet(sym).catch(() => ({ totalCash: 0, totalDebt: 0 })),
      getAlphaVantageIncomeStatement(sym).catch(() => ({ profitMargin: 0, avgProfitMargin: 0, revenueGrowth: 0 })),
      getSECFinancials(sym).catch(() => ({})),
    ]);

    let totalCashRaw = 0;
    let totalDebtRaw = 0;

    // Try Yahoo Finance first
    try {
      // Method 1: balanceSheet annual
      const balanceSheet: any = await (yf as any).balanceSheet(sym, { period: 'annual' });
      const statements = balanceSheet?.balanceSheetHistory?.balanceSheetStatements;
      if (statements && statements.length > 0) {
        const latest = statements[0];
        // Cash
        if (latest.cash && latest.cash[0] && latest.cash[0].raw !== undefined) {
          totalCashRaw = latest.cash[0].raw;
        } else if (latest.cashAndCashEquivalents && latest.cashAndCashEquivalents[0]?.raw !== undefined) {
          totalCashRaw = latest.cashAndCashEquivalents[0].raw;
        }
        // Total Debt
        if (latest.totalDebt && latest.totalDebt[0]?.raw !== undefined) {
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
          if (latest.cash && latest.cash[0]?.raw !== undefined) {
            totalCashRaw = latest.cash[0].raw;
          } else if (latest.cashAndCashEquivalents && latest.cashAndCashEquivalents[0]?.raw !== undefined) {
            totalCashRaw = latest.cashAndCashEquivalents[0].raw;
          }
          if (latest.totalDebt && latest.totalDebt[0]?.raw !== undefined) {
            totalDebtRaw = latest.totalDebt[0].raw;
          }
        }
      } catch (e2) {
        // Fallback to quoteSummary
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

    // Fallback to SEC EDGAR if still 0 (free, no API key needed)
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

    // Sector-based default profit margins (used as final fallback)
    const sectorDefaults: Record<string, number> = {
      'Technology': 25,
      'Information Technology': 25,
      'Healthcare': 15,
      'Financial Services': 20,
      'Financials': 20,
      'Consumer Cyclical': 10,
      'Communication Services': 15,
      'Industrials': 12,
      'Consumer Defensive': 12,
      'Energy': 8,
      'Basic Materials': 10,
      'Real Estate': 30,
      'Utilities': 10,
    };
    
    const sector = quoteSummary?.summaryProfile?.sector || 'Technology';
    const defaultMargin = sectorDefaults[sector] || 15;
    
    // Calculate profit margins with proper fallback logic
    // Note: Yahoo financialData returns profitMargins directly (not .raw)
    const yahooMargin = financialData?.profitMargins;
    const alphaMargin = alphaVantageIncome?.profitMargin;
    const secMargin = secData?.revenue && secData?.netIncome ? secData.netIncome / secData.revenue : 0;
    
    const profitMarginsValue = yahooMargin || (alphaMargin && alphaMargin < 1 ? alphaMargin : 0) || secMargin || (defaultMargin / 100);
    const avgProfitMarginValue = (() => {
      if (yahooMargin) return yahooMargin * 100;
      if (alphaMargin) return alphaMargin < 1 ? alphaMargin * 100 : alphaMargin;
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
    return [];
  }
}

export async function getAnalystPriceTargets(
  symbol: string,
): Promise<AnalystPriceTarget | null> {
  const sym = symbol.toUpperCase();

  try {
    const quote: any = await yf.quote(sym);
    
    if (!quote.targetMeanPrice) {
      return null;
    }

    return {
      symbol: sym,
      targetMean: quote.targetMeanPrice || 0,
      targetHigh: quote.targetHighPrice || 0,
      targetLow: quote.targetLowPrice || 0,
      targetMedian: quote.targetMedianPrice || 0,
      numberOfAnalysts: quote.numberOfAnalystOpinions || 0,
    };
  } catch (e) {
    return null;
  }
}

export async function getTechnicalAnalysis(
  symbol: string,
): Promise<TechnicalAnalysis | null> {
  const sym = symbol.toUpperCase();
  
  const historical = await getHistoricalData(sym, new Date(Date.now() - 200 * 24 * 60 * 60 * 1000));
  
  if (historical.length < 50) {
    return null;
  }

  const closes = historical.map(h => h.close);
  const currentPrice = closes[closes.length - 1];

  const sma50 = calculateSMA(closes, 50);
  const sma200 = closes.length >= 200 ? calculateSMA(closes, 200) : sma50;
  const rsi = calculateRSI(closes, 14);

  const recentHighs = historical.slice(-30).map(h => h.high);
  const recentLows = historical.slice(-30).map(h => h.low);
  
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);

  let trend: 'alcista' | 'bajista' | 'lateral';
  if (sma50 > sma200 * 1.02) {
    trend = 'alcista';
  } else if (sma50 < sma200 * 0.98) {
    trend = 'bajista';
  } else {
    trend = 'lateral';
  }

  let signal: 'comprar' | 'vender' | 'neutral';
  if (rsi < 30 && trend === 'alcista') {
    signal = 'comprar';
  } else if (rsi > 70 && trend === 'bajista') {
    signal = 'vender';
  } else {
    signal = 'neutral';
  }

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
}

function calculateSMA(data: number[], period: number): number {
  if (data.length < period) {
    return data[data.length - 1] || 0;
  }
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(data: number[], period: number): number {
  if (data.length < period + 1) {
    return 50;
  }

  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }

  const recentChanges = changes.slice(-period);
  let gains = 0;
  let losses = 0;

  for (const change of recentChanges) {
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return Math.round(rsi * 100) / 100;
}

export async function getStockData(symbol: string) {
  const [quote, summary, historical, priceTarget, technical] = await Promise.all([
    getStockQuote(symbol),
    getStockSummary(symbol).catch(() => null),
    getHistoricalData(symbol),
    getAnalystPriceTargets(symbol).catch(() => null),
    getTechnicalAnalysis(symbol).catch(() => null),
  ]);

  return { quote, summary, historical, priceTarget, technical };
}
