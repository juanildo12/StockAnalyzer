import { NextRequest, NextResponse } from 'next/server';

const CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000;

function getCached(key: string): any | null {
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCache(key: string, data: any): void {
  CACHE.set(key, { data, timestamp: Date.now() });
}

async function fetchWithTimeout(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function scrapeYahooFinance(ticker: string): Promise<any> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,defaultKeyStatistics,financialData,profile`;
    const response = await fetchWithTimeout(url);
    const data = await response.json();
    
    if (data?.quoteSummary?.result?.[0]) {
      const result = data.quoteSummary.result[0];
      const summary = result.summaryDetail || {};
      const stats = result.defaultKeyStatistics || {};
      const financial = result.financialData || {};
      const profile = result.profile || {};
      
      return {
        companyName: profile.shortName || profile.longName || ticker,
        shortDescription: profile.industry || '',
        sector: profile.sector || '',
        industry: profile.industry || '',
        website: profile.website || '',
        employees: profile.fullTimeEmployees || 0,
        businessSummary: profile.longBusinessSummary || '',
        executiveName: profile.chiefExecutiveOfficer?.name || '',
        executiveTitle: profile.chiefExecutiveOfficer?.title || '',
        marketCap: summary.marketCap?.raw || 0,
        peRatio: summary.peRatio?.raw || 0,
        pegRatio: stats.pegRatio?.raw || 0,
        dividendYield: summary.dividendYield?.raw || 0,
        beta: stats.beta?.raw || 0,
        totalCash: financial.totalCash?.raw || 0,
        totalDebt: financial.totalDebt?.raw || 0,
        profitMargins: financial.profitMargins?.raw || 0,
        operatingMargins: financial.operatingMargins?.raw || 0,
        returnOnEquity: financial.returnOnEquity?.raw || 0,
        returnOnAssets: financial.returnOnAssets?.raw || 0,
        revenueGrowth: financial.revenueGrowth?.raw || 0,
        grossMargins: financial.grossMargins?.raw || 0,
        ebitdaMargins: financial.ebitdaMargins?.raw || 0,
        priceToBook: stats.priceToBook?.raw || 0,
        priceToSales: stats.priceToSales?.raw || 0,
        enterpriseToRevenue: financial.enterpriseToRevenue?.raw || 0,
        enterpriseToEbitda: financial.enterpriseToEbitda?.raw || 0,
        targetMeanPrice: financial.targetMeanPrice?.raw || 0,
        targetHighPrice: financial.targetHighPrice?.raw || 0,
        targetLowPrice: financial.targetLowPrice?.raw || 0,
        recommendation: financial.recommendationKey || '',
        numberOfAnalystOpinions: stats.numberOfAnalystOpinions?.raw || 0,
        earningsTimestamp: stats.earningsTimestamp?.raw || 0,
        epsTrailingTwelveMonths: stats.epsTrailingTwelveMonths?.raw || 0,
        epsForward: stats.epsForward?.raw || 0,
        sharesOutstanding: stats.sharesOutstanding?.raw || 0,
        bookValue: stats.bookValue?.raw || 0,
        netIncomeToCommon: stats.netIncomeToCommon?.raw || 0,
        totalRevenue: summary.totalRevenue?.raw || 0,
        revenuePerShare: stats.revenuePerShare?.raw || 0,
        yield: summary.dividendYield?.raw || 0,
        exDividendDate: summary.exDividendDate?.raw || 0,
      };
    }
  } catch (error) {
    console.error('Yahoo scrape error:', error);
  }
  return null;
}

async function scrapeTipRanks(ticker: string): Promise<any> {
  try {
    const url = `https://www.tipranks.com/api/stocks/get hedge-fund-ratings?ticker=${ticker}`;
    const response = await fetchWithTimeout(url);
    const data = await response.json();
    
    if (data) {
      return {
        priceTarget: data.priceTarget || 0,
        consensus: data.consensus || 'N/A',
        numberOfAnalysts: data.numberOfAnalysts || 0,
        buyCount: data.buyCount || 0,
        holdCount: data.holdCount || 0,
        sellCount: data.sellCount || 0,
        upside: data.upside || 0,
        highTarget: data.highTarget || 0,
        lowTarget: data.lowTarget || 0,
        smartScore: data.smartScore || 0,
        sectorRank: data.sectorRank || 0,
        sectorName: data.sectorName || '',
      };
    }
  } catch (error) {
    console.error('TipRanks scrape error:', error);
  }
  
  try {
    const url2 = `https://www.tipranks.com/stocks/${ticker.toLowerCase()}/forecast`;
    const response = await fetchWithTimeout(url2);
    const html = await response.text();
    
    const priceTargetMatch = html.match(/target price.*?\$([\d,]+)/i);
    const consensusMatch = html.match(/consensus.*?(\w+)/i);
    const analystsMatch = html.match(/(\d+)\s*analysts?/i);
    const upsideMatch = html.match(/upside.*?([+-]?[\d.]+)%/i);
    
    return {
      priceTarget: priceTargetMatch ? parseFloat(priceTargetMatch[1].replace(',', '')) : 0,
      consensus: consensusMatch ? consensusMatch[1] : 'N/A',
      numberOfAnalysts: analystsMatch ? parseInt(analystsMatch[1]) : 0,
      upside: upsideMatch ? parseFloat(upsideMatch[1]) : 0,
    };
  } catch (error) {
    console.error('TipRanks fallback error:', error);
  }
  
  return null;
}

async function scrapeMacrotrends(ticker: string): Promise<any> {
  try {
    const url = `https://www.macrotrends.net/stocks/chart/${ticker.toLowerCase()}/financials`;
    const response = await fetchWithTimeout(url);
    const html = await response.text();
    
    const profitMarginMatches = html.match(/Profit Margin.*?(\d+\.?\d*)%/g);
    const revenueGrowthMatches = html.match(/Revenue Growth.*?(\d+\.?\d*)%/g);
    const peMatches = html.match(/P\/E Ratio.*?(\d+\.?\d*)/g);
    
    return {
      profitMargins: profitMarginMatches ? profitMarginMatches.slice(0, 4).map(m => parseFloat(m.replace('%', ''))) : [],
      revenueGrowth: revenueGrowthMatches ? revenueGrowthMatches.slice(0, 4).map(m => parseFloat(m.replace('%', ''))) : [],
      peRatios: peMatches ? peMatches.slice(0, 4).map(m => parseFloat(m)) : [],
    };
  } catch (error) {
    console.error('Macrotrends scrape error:', error);
  }
  
  return null;
}

async function scrapeGuruFocus(ticker: string): Promise<any> {
  try {
    const url = `https://www.gurufocus.com/stock/${ticker.toUpperCase()}`;
    const response = await fetchWithTimeout(url);
    const html = await response.text();
    
    const peMatch = html.match(/P\/E.*?([\d.]+)/);
    const pegMatch = html.match(/PEG.*?([\d.]+)/);
    const profitMarginMatch = html.match(/Profit Margin.*?([-\d.]+)%/);
    const operatingMarginMatch = html.match(/Operating Margin.*?([-\d.]+)%/);
    const roeMatch = html.match(/ROE.*?([\d.]+)%/);
    const debtToEquityMatch = html.match(/Debt-to-Equity.*?([\d.]+)/);
    const pbMatch = html.match(/P\/B.*?([\d.]+)/);
    const psMatch = html.match(/P\/S.*?([\d.]+)/);
    
    return {
      peRatio: peMatch ? parseFloat(peMatch[1]) : 0,
      pegRatio: pegMatch ? parseFloat(pegMatch[1]) : 0,
      profitMargin: profitMarginMatch ? parseFloat(profitMarginMatch[1]) : 0,
      operatingMargin: operatingMarginMatch ? parseFloat(operatingMarginMatch[1]) : 0,
      returnOnEquity: roeMatch ? parseFloat(roeMatch[1]) : 0,
      debtToEquity: debtToEquityMatch ? parseFloat(debtToEquityMatch[1]) : 0,
      priceToBook: pbMatch ? parseFloat(pbMatch[1]) : 0,
      priceToSales: psMatch ? parseFloat(psMatch[1]) : 0,
    };
  } catch (error) {
    console.error('GuruFocus scrape error:', error);
  }
  
  return null;
}

async function scrapeMarketBeat(ticker: string): Promise<any> {
  try {
    const url = `https://www.marketbeat.com/stocks/${ticker.toUpperCase()}/price-target`;
    const response = await fetchWithTimeout(url);
    const html = await response.text();
    
    const avgTargetMatch = html.match(/Average.*?\$([\d,]+)/);
    const highTargetMatch = html.match(/High.*?\$([\d,]+)/);
    const lowTargetMatch = html.match(/Low.*?\$([\d,]+)/);
    const ratingsMatch = html.match(/Buy.*?(\d+).*?Hold.*?(\d+).*?Sell.*?(\d+)/i);
    
    return {
      priceTarget: avgTargetMatch ? parseFloat(avgTargetMatch[1].replace(',', '')) : 0,
      highTarget: highTargetMatch ? parseFloat(highTargetMatch[1].replace(',', '')) : 0,
      lowTarget: lowTargetMatch ? parseFloat(lowTargetMatch[1].replace(',', '')) : 0,
      buyRatings: ratingsMatch ? parseInt(ratingsMatch[1]) : 0,
      holdRatings: ratingsMatch ? parseInt(ratingsMatch[2]) : 0,
      sellRatings: ratingsMatch ? parseInt(ratingsMatch[3]) : 0,
    };
  } catch (error) {
    console.error('MarketBeat scrape error:', error);
  }
  
  return null;
}

async function scrapeCNBC(ticker: string): Promise<any> {
  try {
    const url = `https://www.cnbc.com/id/MSDCH人民共和国102096093/device/pcd/quote/${ticker.toUpperCase()}.html`;
    const response = await fetchWithTimeout(url);
    const html = await response.text();
    
    const priceMatch = html.match(/"price":\s*"?([\d.]+)"?/);
    const changeMatch = html.match(/"change":\s*"?([-\d.]+)"?/);
    const peMatch = html.match(/P\/E.*?(\d+\.?\d*)/);
    const mktCapMatch = html.match(/Market Cap.*?\$?([\d.]+)([BM])/i);
    
    return {
      price: priceMatch ? parseFloat(priceMatch[1]) : 0,
      change: changeMatch ? parseFloat(changeMatch[1]) : 0,
      peRatio: peMatch ? parseFloat(peMatch[1]) : 0,
      marketCap: mktCapMatch ? parseFloat(mktCapMatch[1]) * (mktCapMatch[2] === 'B' ? 1e9 : 1e6) : 0,
    };
  } catch (error) {
    console.error('CNBC scrape error:', error);
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const source = request.nextUrl.searchParams.get('source');
  
  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
  }
  
  const cacheKey = `${ticker}_${source || 'all'}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }
  
  let result = null;
  
  try {
    switch (source) {
      case 'yahoo':
        result = await scrapeYahooFinance(ticker);
        break;
      case 'tipranks':
        result = await scrapeTipRanks(ticker);
        break;
      case 'macrotrends':
        result = await scrapeMacrotrends(ticker);
        break;
      case 'gurufocus':
        result = await scrapeGuruFocus(ticker);
        break;
      case 'marketbeat':
        result = await scrapeMarketBeat(ticker);
        break;
      case 'cnbc':
        result = await scrapeCNBC(ticker);
        break;
      default:
        const [yahoo, tipranks, macrotrends, gurufocus, marketbeat, cnbc] = await Promise.allSettled([
          scrapeYahooFinance(ticker),
          scrapeTipRanks(ticker),
          scrapeMacrotrends(ticker),
          scrapeGuruFocus(ticker),
          scrapeMarketBeat(ticker),
          scrapeCNBC(ticker),
        ]);
        
        result = {
          yahoo: yahoo.status === 'fulfilled' ? yahoo.value : null,
          tipranks: tipranks.status === 'fulfilled' ? tipranks.value : null,
          macrotrends: macrotrends.status === 'fulfilled' ? macrotrends.value : null,
          gurufocus: gurufocus.status === 'fulfilled' ? gurufocus.value : null,
          marketbeat: marketbeat.status === 'fulfilled' ? marketbeat.value : null,
          cnbc: cnbc.status === 'fulfilled' ? cnbc.value : null,
        };
    }
    
    if (result) {
      setCache(cacheKey, result);
    }
    
    return NextResponse.json(result || { error: 'No data found' });
  } catch (error: any) {
    console.error('Scraper error:', error);
    return NextResponse.json({ error: error.message || 'Scraping failed' }, { status: 500 });
  }
}
