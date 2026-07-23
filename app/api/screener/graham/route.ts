import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { scrapeYahooBalanceSheet } from '../../../../src/services/yahooFinance';
import { calculateNNWC } from '../../../../src/services/nnwcAnalysis';
import { analyzeGraham } from '../../../../src/services/grahamAnalysis';

const yf = new YahooFinance();

const VALUE_POOL = [
  'FF', 'ATCO', 'BKE', 'BOOT', 'CALM', 'CCBG', 'CHCO', 'CIVI', 'CNX', 'COST',
  'CPK', 'CRBG', 'CSGS', 'CTRN', 'DDS', 'DINO', 'DOOO', 'DXPE', 'EGY', 'EME',
  'EPD', 'ESNT', 'ET', 'ETRN', 'EWBC', 'FDP', 'FFBC', 'FIBK', 'FULT', 'GABC',
  'GBX', 'GEF', 'GES', 'GHC', 'GMS', 'GNE', 'GNTX', 'GOLF', 'GPI', 'GRMN',
  'HAFC', 'HBAN', 'HCSG', 'HFWA', 'HIBB', 'HMN', 'HNI', 'HOMB', 'HRB', 'HSII',
  'HTBK', 'HTH', 'HWKN', 'IBOC', 'IBTX', 'ICUI', 'IDCC', 'IGT', 'INCY', 'INDB',
  'IPAR', 'IPGP', 'ITIC', 'JACK', 'JAZZ', 'JBL', 'JBT', 'JJSF', 'KALU', 'KAR',
  'KBH', 'KFRC', 'KMT', 'KOP', 'KRP', 'KTB', 'LAD', 'LAKE', 'LBAI', 'LCII',
  'LCUT', 'LEG', 'LFUS', 'LGIH', 'LKFN', 'LMAT', 'LPG', 'LQDT', 'LRN', 'LSXMK',
  'MAA', 'MAC', 'MAN', 'MASI', 'MATW', 'MCFT', 'MCRI', 'MCY', 'MD', 'MDU',
  'MED', 'MEI', 'MGEE', 'MGPI', 'MGRC', 'MHK', 'MIDD', 'MLI', 'MLR', 'MMI',
  'MMS', 'MNRO', 'MOD', 'MOFG', 'MOV', 'MPAA', 'MPB', 'MRC', 'MRTN', 'MSBI',
  'MSEX', 'MSM', 'MTG', 'MTSC', 'MTX', 'MUR', 'MWA', 'MYE', 'MYFW',
  'MYGN', 'NAT', 'NAVI', 'NBIX', 'NBN', 'NBTB', 'NC', 'NCA', 'NCLH', 'NCMI',
  'NEE', 'NEM', 'NEWT', 'NFBK', 'NFG', 'NHC', 'NHI', 'NJR', 'NKE', 'NKSH',
  'NMIH', 'NMRK', 'NNI', 'NOA', 'NOC', 'NOV', 'NPK', 'NRDS', 'NRIM', 'NSIT',
  'NSSC', 'NTB', 'NTCT', 'NTGR', 'NUS', 'NWBI', 'NWFL', 'NWL', 'NWN', 'NX',
  'NXGN', 'NXST', 'NYCB', 'NYMT', 'O', 'OCC', 'OCFC', 'ODC', 'OEC', 'OFG',
  'OIS', 'OLED', 'OLLI', 'OLN', 'OLP', 'OMC', 'OMCL', 'OMF', 'OMI', 'ONB',
  'ONTO', 'OPY', 'ORC', 'ORI', 'ORRF', 'OSBC', 'OSIS', 'OSK', 'OTTR', 'OVBC',
  'OWL', 'OXM', 'OZK', 'PAA', 'PACW', 'PAHC', 'PAR', 'PATK', 'PAYS', 'PB',
  'PBF', 'PBH', 'PBI', 'PBT', 'PCAR', 'PCB', 'PCH', 'PCO', 'PCRX', 'PCTY',
  'PCYG', 'PDCO', 'PDFS', 'PDM', 'PEBO', 'PEP', 'PERY', 'PFC', 'PFG', 'PFGC',
  'PFIS', 'PFS', 'PFSI', 'PG', 'PGC', 'PGRE', 'PGR', 'PH', 'PHM', 'PII',
  'PINC', 'PINS', 'PIPR', 'PJT', 'PK', 'PKE', 'PKG', 'PLAB', 'PLAY', 'PLBC',
  'PLMR', 'PLNT', 'PLOW', 'PLPC', 'PLSE', 'PLTK', 'PLXS', 'PLYA', 'PM', 'PMCB',
  'PMT', 'PNC', 'PNFP', 'PNM', 'PNNT', 'PNR', 'PODD', 'POOL', 'POR', 'POST',
  'POWI', 'POWL', 'PPBI', 'PPG', 'PPL', 'PRAA', 'PRAX', 'PRDO', 'PRE', 'PRFT',
  'PRGO', 'PRGS', 'PRI', 'PRIM', 'PRK', 'PRLB', 'PRMW', 'PRO', 'PROV', 'PRSC',
  'PRSP', 'PRU', 'PSA', 'PSB', 'PSEC', 'PSF', 'PSMT', 'PSTG', 'PTEN', 'PTGX',
  'PTHR', 'PTLA', 'PTSI', 'PTVE', 'PUBM', 'PUK', 'PULM', 'PURE', 'PWR', 'PWSC',
  'PXLW', 'PZZA', 'QCRH', 'QDEL', 'QFIN', 'QGEN', 'QNST', 'QRHC', 'QRTEA',
  'QS', 'QTWO', 'QUAD', 'QUIK', 'R', 'RACE', 'RAD', 'RAMP', 'RAPT', 'RBA',
  'RBC', 'RBCAA', 'RBLX', 'RBOT', 'RC', 'RCEL', 'RCKT', 'RCL', 'RCM', 'RCMT',
  'RCUS', 'RDHL', 'RDN', 'RDNT', 'RDUS', 'RDW', 'RE', 'REFI', 'REFR', 'REG',
  'REGN', 'REI', 'RELL', 'RELX', 'RENT', 'REPL', 'RES', 'RESP', 'RETA', 'RETO',
  'REVG', 'REX', 'REXR', 'REYN', 'RF', 'RFIL', 'RGA', 'RGC', 'RGCO', 'RGLD',
  'RGLS', 'RGNX', 'RGP', 'RGR', 'RGS', 'RH', 'RHI', 'RHP', 'RICK', 'RIG',
  'RIGL', 'RILY', 'RIO', 'RIV', 'RJF', 'RKT', 'RL', 'RLAY', 'RLGT', 'RLGY',
  'RLI', 'RLJ', 'RLMD', 'RM', 'RMAX', 'RMBI', 'RMBL', 'RMBS', 'RMCF', 'RMD',
  'RMNI', 'RMR', 'RMT', 'RMTI', 'RNG', 'RNGR', 'RNR', 'RNST', 'RNVA', 'ROAD',
  'ROCC', 'ROCK', 'ROG', 'ROIC', 'ROKU', 'ROL', 'RONI', 'ROOT', 'ROP', 'ROST',
  'RPAY', 'RPD', 'RPM', 'RPT', 'RPTX', 'RRBI', 'RRC', 'RRGB', 'RRR', 'RRX',
  'RS', 'RSG', 'RSSS', 'RST', 'RSTR', 'RTX', 'RUN', 'RUSHA', 'RUTH', 'RVLV',
  'RVMD', 'RVNC', 'RVP', 'RVPH', 'RWT', 'RXN', 'RY', 'RYAM', 'RYAN', 'RYI',
  'RYN', 'RYTM', 'RZB', 'RZC', 'RZG', 'RZV',
];

function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function dateToSeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const extraSymbols = searchParams.get('symbols') || '';

  try {
    let candidates = [...VALUE_POOL];
    const extras: string[] = [];

    if (extraSymbols) {
      const parsed = extraSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      for (const sym of parsed) {
        if (!candidates.includes(sym)) {
          candidates.push(sym);
        }
        extras.push(sym);
      }
    }

    // Shuffle and take daily subset, but always include requested extras
    const today = new Date();
    const dailySeed = dateToSeed(today);
    let dailyStocks = seededShuffle(candidates, dailySeed).slice(0, 40);

    for (const sym of extras) {
      if (!dailyStocks.includes(sym)) {
        dailyStocks.push(sym);
      }
    }

    const results: any[] = [];
    const batchSize = 5;

    for (let i = 0; i < dailyStocks.length; i += batchSize) {
      const batch = dailyStocks.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (sym) => {
        try {
          const [bsData, quoteResult] = await Promise.all([
            scrapeYahooBalanceSheet(sym),
            yf.quote(sym).catch(() => null),
          ]);

          if (!quoteResult) return null;

          const price = quoteResult.regularMarketPrice || 0;
          const marketCap = quoteResult.marketCap || 0;

          if (marketCap === 0) return null;

          const bookValue = bsData.bookValue || 0;
          const priceToBook = bookValue > 0 ? marketCap / bookValue : 0;

          const nnwcResult = calculateNNWC({
            cash: bsData.totalCash,
            receivables: bsData.accountsReceivable || 0,
            inventory: bsData.inventory || 0,
            totalLiabilities: bsData.totalLiabilities || 0,
            marketCap,
          });

          const grahamResult = analyzeGraham({
            cash: bsData.totalCash,
            totalDebt: bsData.totalDebt,
            currentAssets: bsData.currentAssets || 0,
            currentLiabilities: bsData.currentLiabilities || 0,
            totalLiabilities: bsData.totalLiabilities || 0,
            marketCap,
            priceToBook,
            bookValue,
          });

          const grahamMetrics = [grahamResult.ncav, grahamResult.netCash, grahamResult.ev, grahamResult.currentRatio, grahamResult.priceToBook];
          const grahamPassing = grahamMetrics.filter(m => m.passes).length;
          const nnwcPassing = nnwcResult.classification === 'excelente' || nnwcResult.classification === 'cumple' ? 1 : 0;
          const totalPassing = grahamPassing + nnwcPassing;
          const totalMetrics = 6;

          const passesAny = totalPassing > 0;

          return {
            symbol: sym,
            name: quoteResult.shortName || quoteResult.longName || sym,
            price,
            change: quoteResult.regularMarketChange,
            changePercent: quoteResult.regularMarketChangePercent,
            marketCap,
            sector: quoteResult.sector,
            industry: quoteResult.industry,
            nnwc: {
              classification: nnwcResult.classification,
              value: nnwcResult.nwwc,
              discountPercent: nnwcResult.discountPercent,
              displayMessage: nnwcResult.displayMessage,
            },
            graham: {
              ncav: grahamResult.ncav.value,
              ncavPass: grahamResult.ncav.passes,
              netCash: grahamResult.netCash.value,
              netCashPass: grahamResult.netCash.passes,
              ev: grahamResult.ev.value,
              evPass: grahamResult.ev.passes,
              currentRatio: grahamResult.currentRatio.value,
              currentRatioPass: grahamResult.currentRatio.passes,
              priceToBook: grahamResult.priceToBook.value,
              priceToBookPass: grahamResult.priceToBook.passes,
            },
            passes: totalPassing,
            totalMetrics,
            passesAny,
          };
        } catch (e) {
          console.error(`Graham screener error for ${sym}:`, e);
          return null;
        }
      }));

      results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
    }

    const sorted = [...results].filter(r => r.passesAny).sort((a, b) => b.passes - a.passes);

    return NextResponse.json({
      results: sorted,
      passingCount: results.filter(r => r.passesAny).length,
      totalScanned: results.length,
      date: today.toISOString().split('T')[0],
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error in Graham screener:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
