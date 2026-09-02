import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { cacheGet, cacheSet } from '../../../../src/lib/cache';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
function getRaw(v: any): number | undefined {
  if (v && typeof v === 'object' && 'raw' in v) return v.raw;
  if (typeof v === 'number') return v;
  return undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<T | null>((r) => setTimeout(() => r(null), ms))]);
}

function calcEMA200(closes: number[]): number | null {
  if (closes.length < 200) return null;
  const k = 2 / 201;
  let ema = closes.slice(0, 200).reduce((a, b) => a + b, 0) / 200;
  for (let i = 200; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  marketCap: number;
  pe: number | null;
  fcfYield: number | null;
  revenueGrowth: number | null;
  profitMargin: number | null;
  sector: string;
  industry: string;
  category: 'joya' | 'growth' | 'valueTrap' | 'bomba' | null;
  reasons: string[];
  ema200: number | null;
  ema200Distance: number | null;
}

const UNIVERSE = [
  // ═══ S&P 500 mega-cap / blue chips ═══
  'AAPL','MSFT','GOOGL','GOOG','AMZN','NVDA','META','TSLA','BRK.B','UNH',
  'XOM','LLY','JPM','V','MA','AVGO','TSLA','COST','NFLX','ABBV',
  'WMT','PG','JNJ','HD','MRK','BAC','CRM','CVX','AMD','KO',
  'PEP','LIN','TMO','COP','ADBE','ACN','MCD','CSCO','WFC','ABT',
  'DHR','ORCL','TXN','PM','UPS','NEE','CAT','LOW','RTX','HON',
  'AMGN','INTC','IBM','GE','SPGI','BA','BLK','ISRG','AXP','SYK',
  // ═══ NASDAQ-100 / high-growth ═══
  'NFLX','PLTR','ARM','SMCI','MU','QCOM','AMAT','NOW','PANW','CRWD',
  'ANET','DDOG','ZS','NET','FTNT','SNOW','WDAY','TEAM','TTD','HUBS',
  'MDB','MNDY','SMAR','FIVN','ESTC','COHR','LITE','OKTA','SPLK','DLTR',
  // ═══ Tech mid/small cap ═══
  'SNPS','CDNS','KLAC','LRCX','MRVL','NXPI','MCHP','ON','STM','TER',
  'AMKR','AEHR','DIODE','WOLF','POWL','KEYS','COHU','FORM','BRKS','ICHR',
  'ALGM','SWKS','QRVO','CRUS','DIOD','CEVA','PLAB','OSIS','TTMI','VIAV',
  'AOSL','SMTC','POWI','LSCC','ALTR','ARM','KBR','NOVT','DAKT','NTCT',
  // ═══ Software / SaaS ═══
  'ADBE','INTU','NOW','PANW','CRWD','DDOG','ZS','NET','FTNT','OKTA',
  'WDAY','TEAM','TTD','HUBS','SMAR','FIVN','ESTC','MNDY','MDB','TWLO',
  'SNOW','VEEV','DOCS','HIMS','GDRX','PATH','GTLB','CART','AI','BROS',
  'BR','ENV','APPF','GDDY','WK','SHLS','NUVB','VTEX','KPIT','SPT',
  // ═══ Fintech / Payments ═══
  'V','MA','AXP','PYPL','SQ','COIN','HOOD','SOFI','AFRM','UPST',
  'LMND','RKT','BR','PAGS','STNE','NU','BMA','GGAL','SUPV','CRESY',
  'PSEC','OFG','BNTG','VIST','LPRO','PFSI','RDN','MTG','ESMT','PRSO',
  // ═══ Consumer discretionary ═══
  'AMZN','TSLA','MCD','NKE','SBUX','TJX','ROST','DG','TGT','HD',
  'LOW','CMG','LULU','BBY','BURL','URBN','ANF','AEO','GPS','HBI',
  'SHAK','CAKE','YUM','DIN','JACK','WING','SKX','CROX','BOOT','CARG',
  'CVNA','RVLV','DBI','PLBY','LE','SCVL','CAL','FL','JWN',
  'KSS','M','DDS','BKE','BIRK','ONTO','SAH','PAG','LAD','ACLS',
  // ═══ Consumer staples ═══
  'KO','PEP','PG','CL','EL','HSY','MNST','KDP','KHC','GIS',
  'STZ','DEO','CHD','CLX','SJM','CAG','KMB','MKC','HRL','CPB',
  'SYY','SJM','FLO','LANC','THS','SMPL','CALM','SENEA','JBSS','FARM',
  // ═══ Healthcare ═══
  'UNH','ABBV','LLY','MRK','PFE','BMY','GILD','AMGN','MDT','ABT',
  'ISRG','VRTX','REGN','MRNA','ZTS','SYK','BSX','EW','RMD','DXCM',
  'HCA','UHS','CYH','SEM','AMED','ENSG','GMED','IRTC','NVCR','NTRA',
  'CRSP','BEAM','EDIT','NTLA','RARE','SRPT','IONS','NBIX','BBIO','ARWR',
  'ALKS','HALO','ITCI','SAGE','ACAD','PTCT','BMRN','EXEL','RGEN','INSM',
  'DOCS','TDOC','AMWL','OSCR','MOH','ILMN','VEEV','HOLX','ALGN','TECH',
  'IDXX','NARI','SUPN','AMPH','PRGO','CTLT','OCUL','RVMD','KRTX','ARCT',
  'PCVX','IRY','ZYNE','CPRX','ANAB','LGND','HZNP','HALO','INSM','RPTX',
  // ═══ Industrials ═══
  'CAT','GE','HON','UPS','FDX','DE','EMR','ETN','WM','ITW',
  'MMM','GD','NOC','LMT','RTX','TDG','LHX','HII','HWM','CW',
  'KTOS','LDOS','SAIC','DAL','UAL','LUV','AAL','JBLU','SKYW','ALK',
  'ROK','PH','CMI','XYL','AME','GWW','ROST','TDG','SWX','CW',
  'TXT','WAB','HXL','UFPI','PATK','DHI','LEN','PHM','TOL','NVR',
  'MHK','SHW','BALL','SEE','BLL','AVY','CCK','SLGN','CENX','SON',
  // ═══ Financials ═══
  'GS','MS','BAC','JPM','SCHW','BLK','SPGI','ICE','CME','CB',
  'PGR','TRV','ALL','MET','PRU','AON','MMC','COF','DFS','SYF',
  'IBKR','TFC','CFG','KEY','RF','WAL','EWBC','WSBC','SBCF','UMBF',
  'HOMB','BANR','WAFD','COLB','OMF','SLM','NYCB','PACW','FHN','WBS',
  'ZION','CMA','EWBC','BPOP','IBOC','CBSH','UBSI','WSFS','FIBK','PPBI',
  // ═══ Energy ═══
  'XOM','CVX','COP','SLB','EOG','MPC','PSX','VLO','DVN','HAL','BKR',
  'PXD','FANG','HES','MRO','OVV','SM','AR','CIVI','MTDR','SWN','EQT','RRC',
  'CHRD','NOG','CEIX','ARCH','AMR','BTU','TALO','MTDR','APLS','REI',
  'PEAK','REPX','SNEX','VTLE','MGY','ESTE','WDRP','ARR','CRXT','CLMT',
  // ═══ Real Estate ═══
  'AMT','PLD','CCI','EQIX','SPG','O','PSA','WELL','DLR','AVB',
  'EQR','VTR','ARE','MAA','UDR','ESS','VICI','EXR','VNO','BXP',
  'KIM','REG','HST','BEE','RLJ','AHT','SHO','DRH','PEB','XHR',
  'IIPR','GOOD','STAG','IPT','PINE','GTY','EPRT','NNN','WPC','NTST',
  // ═══ Utilities ═══
  'NEE','DUK','SO','D','AEP','SRE','EXC','XEL','ED','WEC',
  'ES','AWK','DTE','ETR','FE','AES','PEG','WTRG','AVL','CMS',
  'PNW','NRG','OKE','SUZ','AES','CEPU','TEO','YPF','CIG','ENIA',
  // ═══ Materials ═══
  'LIN','APD','SHW','ECL','DD','NEM','FCX','NUE','STLD','CMC',
  'AA','X','CLF','MT','SCCO','RS','MLM','VMC','CE','PPG',
  'IFF','EMN','ALB','LTHM','SQM','CAN','LAC','ALB','FUL','KWR',
  // ═══ Communication Services ═══
  'T','VZ','CMCSA','DIS','NFLX','TMUS','CHTR','WBD','PARA','FOX',
  'LYV','LUMN','DISH','MGNI','PUBM','DV','MAX','GOOG','META','SNAP',
  'PINS','RBLX','U','DKNG','TTWO','EA','ATVI','MSFT','ROKU','LUMN',
  'ETSY','CHWY','BIRD','COUR','CART','BROS','CHUY','TXRH','WING','DIN',
  // ═══ Crypto / Blockchain ═══
  'MSTR','MARA','RIOT','CLSK','IREN','HUT','BITF','CIFR','BTBT','CORZ',
  'WULF','HIVE','BITN','EQOS','COIN','MELI','OSTK',
  // ═══ Cybersecurity ═══
  'CRWD','PANW','FTNT','ZS','NET','S','OKTA','CYBR','QLYS','VRNS',
  'TENB','RPD','RBRX','SAIL','ESTC','SQ','DSGX','PPHM','KANG','NICE',
  // ═══ Semiconductor equipment ═══
  'ASML','KLAC','LRCX','AMAT','ENTG','IPGP','COHR','LITE','NOVT','ONTO',
  'CAMT','ICHR','AOSL','SMTC','POWI','LSCC','ALTR','RMBS','DIOD','CEVA',
  // ═══ Biotech speculative ═══
  'CRSP','BEAM','EDIT','NTLA','RARE','SRPT','IONS','NBIX','BBIO','ARWR',
  'ALKS','HALO','ITCI','SAGE','ACAD','PTCT','BMRN','EXEL','RGEN','INSM',
  'KRTX','ARCT','PCVX','IRY','ZYNE','CPRX','ANAB','LGND','RPTX','RVMD',
  'NUVB','VTEX','KPIT','SPT','BR','ENV','APPF','GDDY','WK','SHLS',
  // ═══ LatAm ADRs ═══
  'NU','STNE','PAGS','YPF','BMA','GGAL','SUPV','CRESY','TEO','TGS',
  'VIV','BIOX','CEPU','CIG','ENIA','EEO','CAAP','LTM','SONA','BPAT',
  'MELI','DESP','BRFS','BAP','SID','VALE','PBR','ERJ','UGP','ITUB',
  'BBD','ABEV','CPLE','ELP','GGB','CSAN','RADL','FMX','PBRY',
  // ═══ Rest of NASDAQ / S&P 500 (SPY constituents) ═══
  'GOOGL','AMZN','NVDA','TSLA','BRK.B','UNH','LLY','AVGO','COST','NFLX',
  'WMT','JNJ','HD','MRK','CRM','KO','PEP','LIN','TMO','ACN',
  'MCD','CSCO','ABT','DHR','ORCL','TXN','PM','UPS','CAT','RTX',
  'HON','AMGN','INTC','IBM','GE','SPGI','BA','BLK','ISRG','AXP',
  'ADBE','NEE','LOW','SYK','PFE','T','GS','MS','CMCSA','BMY',
  'GILD','MDT','AMAT','PLTR','QCOM','NOW','DLR','HCA','BUD','ELV',
  'CI','CVS','LRCX','MU','MCO','USB','PGR','CB','META','AMD',
  'NKE','TM','ORLY','MMM','TJX','MON','AZN','SNY','NVS','HSBC',
  'RY','TD','BNS','BMO','BAM','SCHW','BLK','C','WFC','COP',
  'GSK','DEO','NVO','NXPI','TGT','WBA','SBUX','FDX','ZTS','DE',
  'MMM','DOW','APD','SHW','LIN','NEM','FCX','NUE','STLD','CMC',
  'AA','X','CLF','MT','SCCO','RS','MLM','VMC','CE','PPG',
  'IFF','EMN','ALB','LTHM','SQM','CAN','LAC','FUL','KWR','AVY',
  'BALL','CCK','SEE','SON','AMCR','PKG','LPX','UFPI','WY','IP',
  'RJA','UNH','WCN','MCHP','ADI','ANSS','CDW','CTSH','EPAM','GIB',
  'JKHY','MKTX','PAYX','RNG','BMRN','BIIB','ALNY','INCY','MRNA','NTLA',
  'NVS','AZN','GSK','EQT','TRGP','OKE','WMB','KMI','ENB','TRP',
  'PPL','AEE','ATO','LNT','NI','CNP','EIX','PEG','AES','EVRG',
  'LDAY','WTRG','CNP','DUK','SO','AEP','SRE','PPL','AEE','OGE',
  // ═══ ETFs (SPY / QQQ / sector proxies included) ═══
  'SPY','QQQ','DIA','IWM','VOO','VTI','IVE','IJK','IJH','IJR',
  'XLK','XLF','XLE','XLV','XLY','XLP','XLI','XLB','XLU','XLC',
  'SMH','SOXX','FDX','LMT','NOC','GD','HWM','TDG','LHX','TXT',
  'AXON','FLIR','ATKR','MTZ','JBL','TDC','CIEN','LITE','SLAB',
  'SWK','RHI','AZEK','TREX','BECN','WSC','CARR','OFLX','TT','DOV',
  'PH','FAST','CTAS','GWW','AOS','MAS','MLI','WSO','VAL','FTV',
  'PNR','ECL','EFX','TRU','VRSK','FTV','GPN','FIS','FISV','DKNG',
  // ═══ Gaming / Entertainment ═══
  'EA','TTWO','RBLX','U','DKNG','CHGG','DUOL','GME','HEAR','PLTK',
  // ═══ E-commerce / Retail ═══
  'EBAY','ETSY','WISH','W','BBY','TGT','COST','WMT','ROST','TJX',
  'JD','BABA','PDD','SE','MELI','SHOP','SPOT','ABNB','BKNG','EXPE',
  'UBER','LYFT','DASH','GRUB','AMZN','RIVN','LCID','NIO','XPEV','LI',
  // ═══ Medical Devices / Diagnostics ═══
  'BSX','MDT','SYK','ABT','EW','STE','RMD','PODD','ZBH','HOLX',
  'DXCM','PEN','MASI','COO','ALGN','ILMN','TECH','IDXX','VEEV','QTNT',
  'ISRG','SRDX','GKOS','ATRC','NVCR','IRTC','LIVN','PULS','ICUI','QSI',
  // ═══ Logistics / Transportation ═══
  'FDX','UPS','JBLU','DAL','UAL','LUV','ALK','SKYW','SAVE','ZIM',
  'MATX','CMRE','SBLK','OSTS','EXPD','CHRW','ODFL','KNX','JBHT','SAIA',
  // ═══ Aerospace ═══
  'BA','LMT','NOC','GD','RTX','TDG','HWM','CW','AXON','SPR',
  'HXL','HEI','RKLB','ASTS','MAXR','IRDM','GSAT','ERJ','MESO',
  // ═══ Internet / Social ═══
  'GOOG','META','SNAP','PINS','TWTR','SPOT','RBLX','BMBL','MTCH','YELP',
  'Z','HOOD','COIN','PYPL','SQ','AFRM','SOFI','UPST','LC','QRTEA',
  // ═══ Aerospace / Defense ═══
  'LMT','NOC','RTX','GD','TDG','AXON','HWM','CW','KTOS','LDOS',
  'SAIC','RKLB','MAXR','SPR','HXL','HEI','MTDR','FANG','EOG','DVN',
  // ═══ Dividend blue chips ═══
  'KO','PEP','PG','JNJ','ABBV','VZ','T','CVX','XOM','MCD',
  'WMT','HD','LOW','UNH','TGT','O','PSA','SPG','DUK','SO',
  'XEL','AEP','SRE','NEE','EXC','ES','WEC','CMS','AEE','ATO',
  'D','PNW','AWK','WTRG','CWEN','BEP','SJR','CNP','LNT','NI',
  // ═══ Growth mid-caps ═══
  'DT','NTLA','IOVA','RXRX','VKTX','ALNY','DNA','EDIT','BEAM','CRSP',
  'NTRA','ARWR','IONS','SRPT','UTHR','EXEL','INCY','PTGX','MRTX','KYMR',
  // ═══ Energy mid/small ═══
  'PXD','FANG','CTRA','MUR','EQT','AR','SWN','RRC','CHRD','NOG',
  'CIVI','MTDR','SM','OVV','HES','FANG','EXE','PR','STR','VTLE',
  // ═══ Banks / Regional ═══
  'JPM','BAC','WFC','C','GS','MS','USB','TFC','PNC','COF',
  'DFS','SYF','AXP','V','MA','SQ','BK','STT','NTRS','TRV',
  'ALL','CB','AIG','AFG','EVR','LPLA','HOOD','IBKR','SCHW','ET',
  // ═══ Insurance ═══
  'MET','PRU','PGR','TRV','ALL','CB','AIG','AFG','MKL','ACGL',
  'RE','EG','AXS','THG','MCY','KMPR','SAFT','HMN','EMBR','LMND',
  // ═══ Real Estate Investment Trusts ═══
  'AMT','PLD','CCI','EQIX','DLR','SPG','O','PSA','WELL','AVB',
  'EQR','VTR','ARE','MAA','UDR','ESS','EXR','VNO','BXP','KIM',
  'REG','FRT','BRX','SKT','KIM','SPR','MAC','PECO','IRT','ELME',
  // ═══ Auto / EV ═══
  'TSLA','RIVN','LCID','NIO','XPEV','LI','F','GM','STLA','TM',
  'BMWYY','VWAGY','HMC','FCA','PSNY','GOEV','NKLA','RMO','HYLN','WKHS',
  // ═══ Airlines ═══
  'DAL','UAL','LUV','AAL','JBLU','ALK','SKYW','SAVE','HA','ULCC',
  'GOL','ASR','CPA','AZUL','VLT',
  // ═══ Food & Beverage ═══
  'KO','PEP','MDLZ','HSY','K','GIS','CPB','KHC','STZ','TAP',
  'SAM','DEO','STZ','CCE','COKE','FIZZ','MNST','BUD','TAP','SJM',
  'HRL','TSN','SAFM','CALM','LANC','OMS','SWM','GIS','CPB','KHC',
  // ═══ Advertising / Media ═══
  'OMC','IPG','WPP','PUB','IZEA','CMCSA','CHTR','DIS','WBD','PARA',
  'FOXA','NWSA','NYT','GCI','MGNI','PUBM','TSQ','QNST','MAX','DV',
  // ═══ Business Services ═══
  'ACN','IBM','IT','FISV','GPN','FIS','BR','EPAM','GLOB','CTSH',
  'CDW','WIT','INFY','TCS','WNS','EXLS','ICTSI','BANX','VIPA','ASGN',
  // ═══ Specialty Retail ═══
  'LULU','NKE','SBUX','CMG','SHAK','TXRH','DIN','CAKE','BLMN','PNST',
  'WSM','RH','ETSY','BURL','TJX','ROST','GPS','HBI','LEVI','CROX',
  // ═══ Biotech (large) ═══
  'AMGN','GILD','BIIB','REGN','VRTX','ALNY','MRNA','ILMN','HZNP','CI',
  'AIZ','BMRN','UTHR','INCY','ARGX','DMAC','INVA','NUVL','RYTM','AXSM',
  // ═══ Tech hardware ═══
  'AAPL','HPQ','DELL','CSCO','JNPR','HPE','NTAP','STX','WDC','SMCI',
  'LITE','COHR','AXT','LESL','IOVA','NOVT','JBL','FLEX','SANM','CLS',
  // ═══ Telecom ═══
  'T','VZ','TMUS','STK','LILAK','VOD','NOK','ERIC','AMX','TU',
  'VIVO','TEF','ORAN','TKC','CHT','KT','SKM','AUD','O2','BT',
  'MBT','TIMB','VZ','PHI','BIP','PEGI','ORAN','TDS','USM','FRTA',
];

const UNIVERSE_DEDUPED = Array.from(new Set(UNIVERSE));

async function fetchStock(symbol: string): Promise<StockData | null> {
  try {
    const [qs, quote] = await Promise.all([
      withTimeout(yf.quoteSummary(symbol, {
        modules: ['summaryDetail', 'financialData', 'assetProfile', 'defaultKeyStatistics'],
      }), 6000),
      withTimeout(yf.quote(symbol), 4000),
    ]);

    if (!quote || !qs) return null;

    const sd = (qs as any)?.summaryDetail || {};
    const fd = (qs as any)?.financialData || {};
    const ap = (qs as any)?.assetProfile || {};

    const price = quote.regularMarketPrice || 0;
    const marketCap = getRaw(sd.marketCap) || quote.marketCap || 0;

    const pe = getRaw(sd.trailingPE) ?? null;
    const totalRevenue = getRaw(fd.totalRevenue) || 0;
    const revenueGrowth = getRaw(fd.revenueGrowth);
    const profitMargin = getRaw(fd.profitMargins);
    const freeCashflow = getRaw(fd.freeCashflow) || 0;
    const fcfYield = marketCap > 0 && freeCashflow > 0
      ? (freeCashflow / marketCap) * 100
      : null;

    return {
      symbol,
      name: quote.shortName || quote.longName || symbol,
      price,
      change: quote.regularMarketChange || 0,
      changePct: quote.regularMarketChangePercent || 0,
      marketCap,
      pe,
      fcfYield,
      revenueGrowth: revenueGrowth != null ? revenueGrowth * 100 : null,
      profitMargin: profitMargin != null ? profitMargin * 100 : null,
      sector: ap.sector || '',
      industry: ap.industry || '',
      category: null,
      reasons: [],
      ema200: null,
      ema200Distance: null,
    };
  } catch {
    return null;
  }
}

function classify(s: StockData): StockData {
  const pe = s.pe;
  const fcf = s.fcfYield;
  const revGrowth = s.revenueGrowth;
  const margin = s.profitMargin;
  const reasons: string[] = [];

  // 💎 Joyas Ocultas: FCF >8% + PE bajo + crece + margen sólido
  if (fcf != null && fcf > 8 && pe != null && pe > 0 && pe < 20 && revGrowth != null && revGrowth > 5 && margin != null && margin > 10) {
    reasons.push(`FCF Yield ${fcf.toFixed(1)}%`);
    reasons.push(`PE ${pe.toFixed(1)}`);
    reasons.push(`Revenue Growth +${revGrowth.toFixed(1)}%`);
    reasons.push(`Margin ${margin.toFixed(1)}%`);
    return { ...s, category: 'joya', reasons };
  }

  // 🚀 Growth Caro: FCF bajo + PE alto + Revenue >20%
  if (fcf != null && fcf < 5 && pe != null && pe > 30 && revGrowth != null && revGrowth > 20) {
    reasons.push(`FCF Yield ${fcf.toFixed(1)}% (bajo)`);
    reasons.push(`PE ${pe.toFixed(1)} (alto)`);
    reasons.push(`Revenue Growth +${revGrowth.toFixed(1)}%`);
    return { ...s, category: 'growth', reasons };
  }

  // 💣 Bomba de Tiempo: FCF negativo + PE alto + no crece
  if (fcf != null && fcf < 0 && pe != null && pe > 25 && revGrowth != null && revGrowth < 5) {
    reasons.push(`FCF Yield ${fcf.toFixed(1)}% (negativo)`);
    reasons.push(`PE ${pe.toFixed(1)} (alto)`);
    reasons.push(`Revenue Growth ${revGrowth.toFixed(1)}% (estancado)`);
    return { ...s, category: 'bomba', reasons };
  }

  // ⚠️ Value Trap: FCF alto + PE bajo + revenue estancado
  if (fcf != null && fcf > 8 && pe != null && pe > 0 && pe < 15 && revGrowth != null && revGrowth < 5) {
    reasons.push(`FCF Yield ${fcf.toFixed(1)}%`);
    reasons.push(`PE ${pe.toFixed(1)}`);
    reasons.push(`Revenue Growth ${revGrowth.toFixed(1)}% (estancado)`);
    return { ...s, category: 'valueTrap', reasons };
  }

  return s;
}

export async function GET() {
  try {
    const cacheKey = 'screener:classification:v5:' + new Date().toISOString().split('T')[0];
    const cached = await cacheGet<{ stocks: StockData[]; joyas: StockData[]; growths: StockData[]; traps: StockData[]; bombas: StockData[] }>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const results: StockData[] = [];
    const seen = new Set<string>();
    const batchSize = 15;

    for (let i = 0; i < UNIVERSE_DEDUPED.length; i += batchSize) {
      const batch = UNIVERSE_DEDUPED.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(fetchStock));
      for (const r of batchResults) {
        if (r && !seen.has(r.symbol)) {
          seen.add(r.symbol);
          results.push(classify(r));
        }
      }
    }

    const joyas = results.filter(s => s.category === 'joya').sort((a, b) => (b.fcfYield || 0) - (a.fcfYield || 0));
    const growths = results.filter(s => s.category === 'growth').sort((a, b) => (b.revenueGrowth || 0) - (a.revenueGrowth || 0));
    const traps = results.filter(s => s.category === 'valueTrap').sort((a, b) => (b.fcfYield || 0) - (a.fcfYield || 0));
    const bombas = results.filter(s => s.category === 'bomba').sort((a, b) => (b.pe || 0) - (a.pe || 0));

    // EMA 200 is now computed via /api/screener/classification/ema (client-side batch)
    const data = { stocks: results, joyas, growths, traps, bombas, total: results.length, classified: joyas.length + growths.length + traps.length + bombas.length, timestamp: Date.now() };
    await cacheSet(cacheKey, data, 3600);

    return NextResponse.json(data);
  } catch (e: any) {
    console.error('[Classification] Error:', e?.message);
    return NextResponse.json({ error: e?.message || 'Failed', stocks: [], joyas: [], growths: [], traps: [], bombas: [] }, { status: 500 });
  }
}
