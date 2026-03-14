import {
  TipRanksData,
  MacrotrendsData,
  MarketBeatData,
  CircleUSDCData,
  GuruFocusData,
  MultiSourceData
} from '../types';

const TIPRANKS_API = 'https://api.tipranks.com/api/basic';

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function getTipRanksData(symbol: string): Promise<TipRanksData | null> {
  try {
    const url = `https://www.tipranks.com/stocks/${symbol}/forecast`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.log(`TipRanks: Failed to fetch ${symbol}, status: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    const priceTargetMatch = html.match(/priceTarget["\s:]+(\d+\.?\d*)/);
    const consensusMatch = html.match(/consensus["\s:]+"([^"]+)"/);
    const smartScoreMatch = html.match(/smartScore["\s:]+(\d+)/);
    const analystCountMatch = html.match(/(\d+)\s+analysts?/i);
    const upsideMatch = html.match(/upside["\s:]+(-?\d+\.?\d*)%/);
    
    const buyMatch = html.match(/(\d+)\s+Buy/i);
    const holdMatch = html.match(/(\d+)\s+Hold/i);
    const sellMatch = html.match(/(\d+)\s+Sell/i);
    
    const highMatch = html.match(/high["\s:]+(\d+\.?\d*)/);
    const lowMatch = html.match(/low["\s:]+(\d+\.?\d*)/);
    
    return {
      symbol,
      companyName: symbol,
      analystConsensus: consensusMatch ? consensusMatch[1] : 'N/A',
      priceTarget: priceTargetMatch ? parseFloat(priceTargetMatch[1]) : 0,
      highTarget: highMatch ? parseFloat(highMatch[1]) : 0,
      lowTarget: lowMatch ? parseFloat(lowMatch[1]) : 0,
      numberOfAnalysts: analystCountMatch ? parseInt(analystCountMatch[1]) : 0,
      smartScore: smartScoreMatch ? parseInt(smartScoreMatch[1]) : 0,
      buyCount: buyMatch ? parseInt(buyMatch[1]) : 0,
      holdCount: holdMatch ? parseInt(holdMatch[1]) : 0,
      sellCount: sellMatch ? parseInt(sellMatch[1]) : 0,
      upside: upsideMatch ? parseFloat(upsideMatch[1]) : 0,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.log(`TipRanks Error for ${symbol}:`, error);
    return null;
  }
}

export async function getMacrotrendsData(symbol: string): Promise<MacrotrendsData | null> {
  try {
    const url = `https://www.macrotrends.net/stocks/chart/${symbol.toLowerCase()}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.log(`Macrotrends: Failed to fetch ${symbol}, status: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    const profitMargins: { year: number; value: number }[] = [];
    const pmRegex = /profit.*?margin.*?(\d{4}).*?(\d+\.?\d*)%/gi;
    let pmMatch;
    while ((pmMatch = pmRegex.exec(html)) !== null) {
      profitMargins.push({
        year: parseInt(pmMatch[1]),
        value: parseFloat(pmMatch[2])
      });
    }
    
    const peRatioHistory: { date: string; value: number }[] = [];
    const peRegex = /pe.*?ratio.*?(\d{4}-\d{2}).*?(\d+\.?\d*)/gi;
    let peMatch;
    while ((peMatch = peRegex.exec(html)) !== null) {
      peRatioHistory.push({
        date: peMatch[1],
        value: parseFloat(peMatch[2])
      });
    }
    
    return {
      symbol,
      profitMargins: profitMargins.slice(0, 10),
      peRatioHistory: peRatioHistory.slice(0, 12)
    };
  } catch (error) {
    console.log(`Macrotrends Error for ${symbol}:`, error);
    return null;
  }
}

export async function getMarketBeatData(symbol: string): Promise<MarketBeatData | null> {
  try {
    const url = `https://www.marketbeat.com/stocks/nasdaq/${symbol.toLowerCase()}/price-target`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.log(`MarketBeat: Failed to fetch ${symbol}, status: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    const avgTargetMatch = html.match(/\$\s*(\d+\.?\d*)/);
    const highTargetMatch = html.match(/high.*?\$\s*(\d+\.?\d*)/i);
    const lowTargetMatch = html.match(/low.*?\$\s*(\d+\.?\d*)/i);
    const analystCountMatch = html.match(/(\d+)\s+Wall Street/i);
    
    const buyMatch = html.match(/(\d+)\s+buy/gi);
    const holdMatch = html.match(/(\d+)\s+hold/gi);
    const sellMatch = html.match(/(\d+)\s+sell/gi);
    
    const ratingMatch = html.match(/consensus.*?rating.*?([A-Za-z\s]+)/i);
    
    return {
      symbol,
      consensusRating: ratingMatch ? ratingMatch[1].trim() : 'N/A',
      averagePriceTarget: avgTargetMatch ? parseFloat(avgTargetMatch[1]) : 0,
      highPriceTarget: highTargetMatch ? parseFloat(highTargetMatch[1]) : 0,
      lowPriceTarget: lowTargetMatch ? parseFloat(lowTargetMatch[1]) : 0,
      numberOfAnalysts: analystCountMatch ? parseInt(analystCountMatch[1]) : 0,
      buyRatings: buyMatch ? buyMatch.length : 0,
      holdRatings: holdMatch ? holdMatch.length : 0,
      sellRatings: sellMatch ? sellMatch.length : 0,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.log(`MarketBeat Error for ${symbol}:`, error);
    return null;
  }
}

export async function getCircleUSDCData(): Promise<CircleUSDCData | null> {
  try {
    const url = 'https://api.circle.com/v1/mints/cusd';
    const response = await fetchWithTimeout(url, 5000);
    
    if (!response.ok) {
      const backupUrl = 'https://api.circle.com/v1/stablecoins/usdc';
      const backupResponse = await fetchWithTimeout(backupUrl, 5000);
      if (!backupResponse.ok) {
        return null;
      }
      const data = await backupResponse.json();
      return {
        symbol: 'USDC',
        totalCirculation: data?.data?.circulation || 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    const data = await response.json();
    return {
      symbol: 'USDC',
      totalCirculation: data?.data?.amount || 0,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.log('Circle USDC Error:', error);
    return null;
  }
}

export async function getGuruFocusData(symbol: string): Promise<GuruFocusData | null> {
  try {
    const url = `https://www.gurufocus.com/stock/${symbol}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.log(`GuruFocus: Failed to fetch ${symbol}, status: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    const peMatch = html.match(/P\/E.*?(\d+\.?\d*)/i);
    const pegMatch = html.match(/PEG.*?(\d+\.?\d*)/i);
    const profitMarginMatch = html.match(/Profit Margin.*?(-?\d+\.?\d*)%/i);
    const operatingMarginMatch = html.match(/Operating Margin.*?(-?\d+\.?\d*)%/i);
    const roeMatch = html.match(/ROE.*?(\d+\.?\d*)%/i);
    const roaMatch = html.match(/ROA.*?(\d+\.?\d*)%/i);
    const debtToEquityMatch = html.match(/Debt\/Equity.*?(\d+\.?\d*)/i);
    const pbMatch = html.match(/P\/B.*?(\d+\.?\d*)/i);
    const psMatch = html.match(/P\/S.*?(\d+\.?\d*)/i);
    const dividendMatch = html.match(/Dividend Yield.*?(\d+\.?\d*)%/i);
    
    return {
      symbol,
      peRatio: peMatch ? parseFloat(peMatch[1]) : 0,
      pegRatio: pegMatch ? parseFloat(pegMatch[1]) : 0,
      profitMargin: profitMarginMatch ? parseFloat(profitMarginMatch[1]) : 0,
      operatingMargin: operatingMarginMatch ? parseFloat(operatingMarginMatch[1]) : 0,
      returnOnEquity: roeMatch ? parseFloat(roeMatch[1]) : 0,
      returnOnAssets: roaMatch ? parseFloat(roaMatch[1]) : 0,
      debtToEquity: debtToEquityMatch ? parseFloat(debtToEquityMatch[1]) : 0,
      priceToBook: pbMatch ? parseFloat(pbMatch[1]) : 0,
      priceToSales: psMatch ? parseFloat(psMatch[1]) : 0,
      grahamNumber: 0,
      dividendYield: dividendMatch ? parseFloat(dividendMatch[1]) : 0
    };
  } catch (error) {
    console.log(`GuruFocus Error for ${symbol}:`, error);
    return null;
  }
}

export async function getAllSourceData(symbol: string): Promise<MultiSourceData> {
  const sources: string[] = [];
  let tipranks: TipRanksData | undefined;
  let macrotrends: MacrotrendsData | undefined;
  let marketbeat: MarketBeatData | undefined;
  let circle: CircleUSDCData | undefined;
  let gurufocus: GuruFocusData | undefined;
  
  const [tipranksData, macrotrendsData, marketbeatData, circleData, gurufocusData] = await Promise.allSettled([
    getTipRanksData(symbol),
    getMacrotrendsData(symbol),
    getMarketBeatData(symbol),
    getCircleUSDCData(),
    getGuruFocusData(symbol)
  ]);
  
  if (tipranksData.status === 'fulfilled' && tipranksData.value) {
    tipranks = tipranksData.value;
    sources.push('TipRanks');
  }
  
  if (macrotrendsData.status === 'fulfilled' && macrotrendsData.value) {
    macrotrends = macrotrendsData.value;
    sources.push('Macrotrends');
  }
  
  if (marketbeatData.status === 'fulfilled' && marketbeatData.value) {
    marketbeat = marketbeatData.value;
    sources.push('MarketBeat');
  }
  
  if (circleData.status === 'fulfilled' && circleData.value) {
    circle = circleData.value;
    sources.push('Circle');
  }
  
  if (gurufocusData.status === 'fulfilled' && gurufocusData.value) {
    gurufocus = gurufocusData.value;
    sources.push('GuruFocus');
  }
  
  return {
    tipranks,
    macrotrends,
    marketbeat,
    circle,
    gurufocus,
    sources
  };
}

export function mergeWithYahooData(
  yahooData: { quote?: any; summary?: any; priceTarget?: any },
  multiSource: MultiSourceData
): any {
  const merged = { ...yahooData };
  
  if (multiSource.tipranks && !merged.priceTarget) {
    merged.priceTarget = {
      symbol: multiSource.tipranks.symbol,
      targetMean: multiSource.tipranks.priceTarget,
      targetHigh: multiSource.tipranks.highTarget,
      targetLow: multiSource.tipranks.lowTarget,
      targetMedian: (multiSource.tipranks.highTarget + multiSource.tipranks.lowTarget) / 2,
      numberOfAnalysts: multiSource.tipranks.numberOfAnalysts
    };
  }
  
  if (multiSource.macrotrends && multiSource.macrotrends.profitMargins && multiSource.macrotrends.profitMargins.length > 0) {
    const profitMarginsData = multiSource.macrotrends.profitMargins;
    const avgMargin = profitMarginsData.reduce((sum, m) => sum + m.value, 0) / profitMarginsData.length;
    if (merged.summary && !merged.summary.avgProfitMargin) {
      merged.summary.avgProfitMargin = avgMargin;
    }
  }
  
  if (multiSource.gurufocus) {
    if (merged.summary) {
      merged.summary.profitMargins = merged.summary.profitMargins || multiSource.gurufocus.profitMargin;
      merged.summary.operatingMargins = merged.summary.operatingMargins || multiSource.gurufocus.operatingMargin;
      merged.summary.returnOnEquity = merged.summary.returnOnEquity || multiSource.gurufocus.returnOnEquity;
      merged.summary.returnOnAssets = merged.summary.returnOnAssets || multiSource.gurufocus.returnOnAssets;
    }
  }
  
  return merged;
}
