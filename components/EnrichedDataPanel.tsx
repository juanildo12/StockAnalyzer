'use client';

import { useState } from 'react';
import { colors as C, radius as R, font as F, transition as T } from '@/src/utils/webTheme';

interface EnrichedDataPanelProps {
  polygon?: {
    details: Record<string, any> | null;
    financials: any[];
    dividends: any[];
    splits: any[];
    news: any[];
  };
  finnhub?: {
    profile: Record<string, any> | null;
    metrics: Record<string, number | null>;
    recommendation: any[];
    earnings: any[];
    priceTarget: Record<string, any> | null;
    insiderTransactions: any[];
    socialSentiment: Record<string, any> | null;
    news: any[];
    yahooNews?: any[];
    peerGroups: string[];
    incomeStatement?: any[];
    balanceSheet?: any[];
    cashFlow?: any[];
  };
  summary?: Record<string, any>;
  loading?: boolean;
}

export default function EnrichedDataPanel({ polygon, finnhub, summary, loading }: EnrichedDataPanelProps) {
  const [activeTab, setActiveTab] = useState<'resumen' | 'balance' | 'insider' | 'social'>('resumen');

  if (loading) {
    return (
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, padding: 24, marginTop: 16,
      }}>
        <div style={{ color: C.textMuted, fontSize: F.sizeSm }}>Cargando datos Polygon + Finnhub...</div>
      </div>
    );
  }

  if (!polygon && !finnhub) return null;

  const m = finnhub?.metrics || {};
  const tabs = [
    { id: 'resumen' as const, label: '📊 Resumen' },
    { id: 'balance' as const, label: '📋 Balance' },
    { id: 'insider' as const, label: '🔍 Insider' },
    { id: 'social' as const, label: '📈 Social' },
  ];

  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: R.xl, marginTop: 16, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: C.gradientHero, padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: F.sizeLg, fontWeight: 600, background: C.gradientPrimary, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Polygon + Finnhub
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 16px 0', borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 14px', borderRadius: `${R.md} ${R.md} 0 0`, border: 'none',
            background: activeTab === tab.id ? C.accent : 'transparent',
            color: activeTab === tab.id ? C.textPrimary : C.textSecondary,
            cursor: 'pointer', fontWeight: 500, fontSize: F.sizeSm, whiteSpace: 'nowrap',
            transition: T.normal,
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 16 }}>
        {activeTab === 'resumen' && <ResumenTab polygon={polygon} finnhub={finnhub} metrics={m} />}
        {activeTab === 'balance' && <BalanceTab polygon={polygon} finnhub={finnhub} summary={summary} />}
        {activeTab === 'insider' && <InsiderTab finnhub={finnhub} />}
        {activeTab === 'social' && <SocialTab finnhub={finnhub} polygon={polygon} />}
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.divider}`, fontSize: F.sizeSm }}>
      <span style={{ color: C.textSecondary }}>{label}</span>
      <span style={{ color: color || C.textPrimary, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function ResumenTab({ polygon, finnhub, metrics }: any) {
  const p = finnhub?.profile;
  const pt = finnhub?.priceTarget;
  const recs = finnhub?.recommendation?.[0];
  const peers = finnhub?.peerGroups;

  return (
    <div>
      {p && (
        <>
          <SectionTitle>Company</SectionTitle>
          <Row label="Name" value={p.name || '—'} />
          <Row label="Industry" value={p.finnhubIndustry || '—'} />
          <Row label="Exchange" value={p.exchange || '—'} />
          <Row label="IPO" value={p.ipo || '—'} />
          <Row label="Country" value={p.country || '—'} />
          <Row label="Market Cap" value={p.marketCapitalization ? fmtCurrency(p.marketCapitalization) : '—'} />
          <Row label="Shares Out" value={p.shareOutstanding ? fmtCompact(p.shareOutstanding) : '—'} />
        </>
      )}

      {pt && (
        <>
          <SectionTitle>Price Targets</SectionTitle>
          <Row label="High" value={pt.targetHigh ? `$${pt.targetHigh}` : '—'} color={C.positive} />
          <Row label="Mean" value={pt.targetMean ? `$${pt.targetMean}` : '—'} />
          <Row label="Low" value={pt.targetLow ? `$${pt.targetLow}` : '—'} color={C.negative} />
          <Row label="Analysts" value={String(pt.numberOfAnalysts || '—')} />
        </>
      )}

      {recs && (
        <>
          <SectionTitle>Analyst Consensus</SectionTitle>
          <Row label="Strong Buy" value={String(recs.strongBuy || 0)} color={C.positive} />
          <Row label="Buy" value={String(recs.buy || 0)} color={C.positive} />
          <Row label="Hold" value={String(recs.hold || 0)} color={C.warning} />
          <Row label="Sell" value={String(recs.sell || 0)} color={C.negative} />
          <Row label="Strong Sell" value={String(recs.strongSell || 0)} color={C.negative} />
        </>
      )}

      {peers && peers.length > 0 && (
        <>
          <SectionTitle>Peer Group</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {peers.map((p: string) => (
              <span key={p} style={{
                background: C.bgElevated, color: C.textSecondary, padding: '4px 10px',
                borderRadius: R.full, fontSize: F.sizeXs, border: `1px solid ${C.border}`,
              }}>{p}</span>
            ))}
          </div>
        </>
      )}

      {polygon?.dividends?.length > 0 && (
        <>
          <SectionTitle>Recent Dividends</SectionTitle>
          {polygon.dividends.slice(0, 4).map((d: any, i: number) => (
            <Row key={i} label={d.exDate || d.payDate || `#${i + 1}`}
              value={d.cashAmount ? `$${d.cashAmount}` : '—'} />
          ))}
        </>
      )}
    </div>
  );
}

// Finnhub BS field name mapping
const FH_BS: Record<string, string> = {
  cashAndCashEquivalents: 'Cash',
  cashAndShortTermInvestments: 'Cash',
  totalAssets: 'Total Assets',
  totalLiabilities: 'Total Liabilities',
  totalShareholdersEquity: "Shareholders' Equity",
  currentAssets: 'Current Assets',
  currentLiabilities: 'Current Liabilities',
  longTermDebtAndCapitalLeases: 'Long Term Debt',
  currentDebtAndCapitalLeases: 'Current Debt',
  accountsReceivable: 'Accounts Receivable',
  inventory: 'Inventory',
  goodwillAndOtherIntangibleAssets: 'Goodwill',
  totalDebt: 'Total Debt',
  netTangibleAssets: 'Net Tangible Assets',
  workingCapital: 'Working Capital',
};

// Finnhub IS field name mapping
const FH_IS: Record<string, string> = {
  revenue: 'Revenue',
  costOfRevenue: 'Cost of Revenue',
  grossProfit: 'Gross Profit',
  operatingIncomeLoss: 'Operating Income',
  netIncomeLoss: 'Net Income',
  ebit: 'EBIT',
  ebitda: 'EBITDA',
  incomeTaxExpenseBenefit: 'Tax Expense',
  interestExpense: 'Interest Expense',
  researchAndDevelopment: 'R&D',
  sellingGeneralAndAdministrativeExpenses: 'SG&A',
  basicAverageShares: 'Weighted Avg Shares',
  dilutedAverageShares: 'Diluted Avg Shares',
};

function getVal(obj: any, polygonKey: string, finnhubKeys: string[]): [number | null, string] {
  // Try Polygon format: obj.polygonKey.value
  const pv = obj?.[polygonKey]?.value;
  if (pv !== undefined && pv !== null) return [parseFloat(pv), 'polygon'];

  // Try Finnhub format: any of the keys directly as numbers
  for (const k of finnhubKeys) {
    const fv = obj?.[k];
    if (fv !== undefined && fv !== null) return [parseFloat(fv), 'finnhub'];
  }
  return [null, ''];
}

function BalanceTab({ polygon, finnhub, summary }: any) {
  const rows: { label: string; val: number | null }[] = [];

  // Helper: robust number extraction
  const tryAdd = (v: any, label: string) => {
    if (v === undefined || v === null) return;
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!isNaN(n) && isFinite(n) && n > 0) rows.push({ label, val: n });
  };

  // Priority 1: summary from stock API (Yahoo Finance)
  if (summary && typeof summary === 'object') {
    tryAdd(summary.totalCash, 'Cash');
    tryAdd(summary.totalDebt, 'Total Debt');
    tryAdd(summary.totalLiabilities, 'Total Liabilities');
    tryAdd(summary.currentAssets, 'Current Assets');
    tryAdd(summary.currentLiabilities, 'Current Liabilities');
    tryAdd(summary.accountsReceivable, 'Accounts Receivable');
    tryAdd(summary.inventory, 'Inventory');
    tryAdd(summary.totalRevenue, 'Total Revenue');
    tryAdd(summary.freeCashflow, 'Free Cash Flow');
    tryAdd(summary.marketCap, 'Market Cap');

    // If still empty, show ALL numeric summary keys as debug fallback
    if (rows.length === 0) {
      for (const [k, v] of Object.entries(summary)) {
        if (typeof v === 'number' && v > 0) {
          const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          rows.push({ label, val: v });
        }
      }
    }
  }

  // Priority 2: Finnhub / Polygon balance sheet
  if (rows.length === 0) {
    const finbs = finnhub?.balanceSheet?.[0];
    const finis = finnhub?.incomeStatement?.[0];
    const dataBS = finbs || polygon?.financials?.[0]?.financials?.balance_sheet;
    const dataIS = finis || polygon?.financials?.[0]?.financials?.income_statement;

    if (dataBS) {
      const add = (pk: string, fks: string[], label: string) => {
        const [v] = getVal(dataBS, pk, fks);
        if (v !== null) rows.push({ label, val: v });
      };
      add('cash', ['cashAndCashEquivalents', 'cashAndShortTermInvestments'], 'Cash');
      add('long_term_debt', ['longTermDebtAndCapitalLeases', 'longTermDebt'], 'Long Term Debt');
      add('total_liabilities', ['totalLiabilities'], 'Total Liabilities');
      add('total_assets', ['totalAssets'], 'Total Assets');
      add('current_assets', ['currentAssets'], 'Current Assets');
      add('current_liabilities', ['currentLiabilities'], 'Current Liabilities');
      add('accounts_receivable', ['accountsReceivable'], 'Accounts Receivable');
      add('inventory', ['inventory'], 'Inventory');
      add('shareholders_equity', ['totalShareholdersEquity', 'shareholdersEquity'], "Shareholders' Equity");
    }

    if (dataIS) {
      const add = (pk: string, fks: string[], label: string) => {
        const [v] = getVal(dataIS, pk, fks);
        if (v !== null) rows.push({ label, val: v });
      };
      add('revenues', ['revenue'], 'Revenue');
      add('gross_profit', ['grossProfit'], 'Gross Profit');
      add('operating_income_loss', ['operatingIncomeLoss'], 'Operating Income');
      add('net_income_loss', ['netIncomeLoss'], 'Net Income');
      add('ebitda', ['ebitda'], 'EBITDA');
    }
  }

  if (rows.length === 0) {
    return (
      <div style={{ color: C.textMuted, fontSize: F.sizeSm, padding: 12 }}>
        No hay datos financieros disponibles para este símbolo desde nuestras fuentes de datos.
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>Balance Sheet & Income Statement</SectionTitle>
      {rows.map((r, i) => (
        <Row key={i} label={r.label} value={fmtCurrency(r.val!)} />
      ))}
    </div>
  );
}

const INSIDER_CODE_MAP: Record<string, string> = {
  P: 'Compra directa de acciones por un insider — señal alcista',
  S: 'Venta directa de acciones por un insider — señal bajista',
  A: 'Concesión o premio de acciones (compensation)',
  C: 'Conversión de instrumento derivado en acciones',
  D: 'Venta de acciones para cubrir impuestos por ejercicio de opciones',
  F: 'Retención de impuestos en acciones (tax withholding)',
  I: 'Transacción discrecional (puede ser compra o venta)',
  M: 'Ejercicio de opciones (compra a strike price)',
  X: 'Ejercicio de opciones con entrega de acciones',
  G: 'Regalo de acciones a terceros',
  L: 'Adquisición pequeña (< $10,000)',
  W: 'Herencia o transmisión por herencia',
  Z: 'Otra transacción no clasificada',
};

const INSIDER_CODE_GROUPS: Record<string, { label: string; color: string }> = {
  P: { label: 'P', color: C.positive },
  S: { label: 'S', color: C.negative },
  A: { label: 'A', color: '#A78BFA' },
  C: { label: 'C', color: C.warning },
  D: { label: 'D', color: '#EC4899' },
  F: { label: 'F', color: '#EC4899' },
  I: { label: 'I', color: C.info },
  M: { label: 'M', color: C.accentLight },
  X: { label: 'X', color: C.accentLight },
  G: { label: 'G', color: '#10B981' },
  L: { label: 'L', color: '#6366F1' },
  W: { label: 'W', color: '#78716C' },
  Z: { label: 'Z', color: '#78716C' },
};

function InsiderTab({ finnhub }: any) {
  const txns = finnhub?.insiderTransactions;
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  if (!txns || txns.length === 0) {
    return <div style={{ color: C.textMuted, fontSize: F.sizeSm, padding: 12 }}>No hay transacciones insider recientes.</div>;
  }

  return (
    <div>
      <SectionTitle>Recent Insider Transactions</SectionTitle>
      {/* Legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px 12px', padding: '8px 12px',
        background: C.bg, borderRadius: R.md, marginBottom: 12, fontSize: F.sizeXs,
      }}>
        {Object.entries(INSIDER_CODE_MAP).map(([code, label]) => {
          const g = INSIDER_CODE_GROUPS[code];
          return (
            <span key={code} style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: 4, cursor: 'default', position: 'relative',
              background: g?.color || C.textMuted, color: C.textPrimary,
              fontWeight: 700, fontSize: 11, lineHeight: '22px', textAlign: 'center',
              transition: 'transform 0.15s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.25)';
                const rect = e.currentTarget.getBoundingClientRect();
                setMousePos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
                setHoverCode(label);
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                setHoverCode(null);
              }}
            >
              {code}
            </span>
          );
        })}
      </div>
      {hoverCode && (
        <div style={{
          position: 'fixed', left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -100%)',
          background: '#1a1a2e', color: '#e2e8f0', padding: '4px 10px', borderRadius: 6,
          fontSize: 12, whiteSpace: 'nowrap', zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)', border: '1px solid #2d2d4a',
        }}>
          {hoverCode}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: F.sizeSm }}>
          <thead>
            <tr style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
              <Th>Date</Th>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Shares</Th>
              <Th>Price</Th>
              <Th>Value</Th>
            </tr>
          </thead>
          <tbody>
            {txns.slice(0, 15).map((t: any, i: number) => {
              const codeInfo = INSIDER_CODE_GROUPS[t.transactionCode] || null;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.divider}` }}>
                  <Td>{t.transactionDate || t.filingDate || '—'}</Td>
                  <Td style={{ fontWeight: 500 }}>{t.name || '—'}</Td>
                  <Td style={{ color: codeInfo?.color || C.textPrimary }}>
                    <span style={{
                      display: 'inline-block', width: 18, height: 18, borderRadius: 3,
                      background: codeInfo?.color || C.textMuted, color: C.textPrimary, textAlign: 'center',
                      lineHeight: '18px', fontWeight: 700, fontSize: 10, marginRight: 4,
                    }}>{t.transactionCode || '?'}</span>
                    {INSIDER_CODE_MAP[t.transactionCode] || t.transactionCode || '—'}
                  </Td>
                  <Td>{fmtCompact(t.share || 0)}</Td>
                  <Td>{t.transactionPrice ? `$${t.transactionPrice.toFixed(2)}` : '—'}</Td>
                  <Td>{(t.share && t.transactionPrice) ? fmtCurrency(t.share * t.transactionPrice) : '—'}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const POSITIVE_WORDS = new Set([
  'surge', 'soar', 'rally', 'bullish', 'upgrade', 'beat', 'outperform', 'growth',
  'profit', 'record', 'positive', 'strong', 'momentum', 'breakthrough', 'innovation',
  'launch', 'expansion', 'partnership', 'acquisition', 'dividend', 'buyback',
  'optimistic', 'confidence', 'opportunity', 'leadership', 'dominant', 'ahead',
  'exceed', 'accelerate', 'boom', 'gain', 'rise', 'climb', 'jump', 'skyrocket',
]);

const NEGATIVE_WORDS = new Set([
  'decline', 'drop', 'fall', 'bearish', 'downgrade', 'miss', 'underperform', 'loss',
  'debt', 'lawsuit', 'investigation', 'negative', 'weak', 'volatile', 'uncertainty',
  'risk', 'crash', 'plunge', 'slump', 'cut', 'reduce', 'sell', 'warning',
  'downturn', 'recession', 'inflation', 'slowdown', 'layoff', 'firing', 'resign',
  'penalty', 'fine', 'sanction', 'probe', 'scrutiny', 'concern', 'struggle',
]);

function analyzeNewsSentiment(news: any[]) {
  if (!news || news.length === 0) return null;
  let positive = 0, negative = 0, neutral = 0;
  const results: { title: string; sentiment: 'positive' | 'negative' | 'neutral' }[] = [];

  for (const article of news) {
    const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
    let score = 0;
    for (const w of POSITIVE_WORDS) {
      if (text.includes(w)) score++;
    }
    for (const w of NEGATIVE_WORDS) {
      if (text.includes(w)) score--;
    }
    let sentiment: 'positive' | 'negative' | 'neutral';
    if (score > 0) { positive++; sentiment = 'positive'; }
    else if (score < 0) { negative++; sentiment = 'negative'; }
    else { neutral++; sentiment = 'neutral'; }
    results.push({ title: article.title || 'Untitled', sentiment });
  }

  return { positive, negative, neutral, total: news.length, results, score: positive - negative };
}

function SocialTab({ finnhub, polygon }: any) {
  const s = finnhub?.socialSentiment;
  const finnhubNews = finnhub?.news || [];
  const polygonNewsSource = polygon?.news || [];
  const yahooNewsSource = finnhub?.yahooNews || [];
  const newsArticles = finnhubNews.length > 0
    ? finnhubNews
    : polygonNewsSource.length > 0
    ? polygonNewsSource
    : yahooNewsSource;
  const newsSource = finnhubNews.length > 0 ? 'Finnhub' : polygonNewsSource.length > 0 ? 'Polygon' : yahooNewsSource.length > 0 ? 'Yahoo Finance' : null;
  const newsAnalysis = newsArticles.length > 0 ? analyzeNewsSentiment(newsArticles) : null;
  const hasFinnhubSocial = s && typeof s === 'object' && (s?.reddit || s?.twitter);
  const hasNewsSentiment = newsAnalysis && newsAnalysis.total > 0;

  return (
    <div>
      {/* --- Finnhub Social Sentiment --- */}
      {hasFinnhubSocial && (
        <>
          {s?.reddit && (
            <>
              <SectionTitle>Reddit Sentiment</SectionTitle>
              <Row label="Mentions" value={String(s.reddit.mention || s.reddit.mentions || 0)} />
              <Row label="Positive Score" value={fmtPct(s.reddit.positiveScore)} color={C.positive} />
              <Row label="Negative Score" value={fmtPct(s.reddit.negativeScore)} color={C.negative} />
              <Row label="Net Score" value={fmtPct((s.reddit.positiveScore || 0) - (s.reddit.negativeScore || 0))}
                color={(s.reddit.positiveScore || 0) > (s.reddit.negativeScore || 0) ? C.positive : C.negative} />
              <Row label="Positive Mentions" value={String(s.reddit.positiveMention || 0)} color={C.positive} />
              <Row label="Negative Mentions" value={String(s.reddit.negativeMention || 0)} color={C.negative} />
            </>
          )}
          {s?.twitter && (
            <>
              <SectionTitle style={{ marginTop: 16 }}>Twitter Sentiment</SectionTitle>
              <Row label="Mentions" value={String(s.twitter.mention || 0)} />
              <Row label="Positive Score" value={fmtPct(s.twitter.positiveScore)} color={C.positive} />
              <Row label="Negative Score" value={fmtPct(s.twitter.negativeScore)} color={C.negative} />
              <Row label="Net Score" value={fmtPct((s.twitter.positiveScore || 0) - (s.twitter.negativeScore || 0))}
                color={(s.twitter.positiveScore || 0) > (s.twitter.negativeScore || 0) ? C.positive : C.negative} />
            </>
          )}
        </>
      )}

      {/* --- News-based Sentiment (fallback/primary) --- */}
      {hasNewsSentiment && (
        <div style={{ marginTop: hasFinnhubSocial ? 20 : 0 }}>
          <SectionTitle>
            {hasFinnhubSocial ? '📰 News Sentiment' : `📰 News Sentiment (${newsSource || 'unknown'} — sin plan pago)`}
          </SectionTitle>
          <Row label="Artículos Positivos" value={String(newsAnalysis.positive)} color={C.positive} />
          <Row label="Artículos Negativos" value={String(newsAnalysis.negative)} color={C.negative} />
          <Row label="Artículos Neutrales" value={String(newsAnalysis.neutral)} color={C.textSecondary} />
          <Row label="Total Artículos" value={String(newsAnalysis.total)} />
          <Row label="Net Sentiment Score" value={`${newsAnalysis.score > 0 ? '+' : ''}${newsAnalysis.score}`}
            color={newsAnalysis.score > 0 ? C.positive : newsAnalysis.score < 0 ? C.negative : C.textSecondary} />
          {newsAnalysis.results.slice(0, 8).map((r, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', padding: '4px 0',
              borderBottom: `1px solid ${C.divider}`, fontSize: F.sizeXs, gap: 8,
            }}>
              <span style={{ color: C.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.title}
              </span>
              <span style={{
                color: r.sentiment === 'positive' ? C.positive : r.sentiment === 'negative' ? C.negative : C.textMuted,
                fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {r.sentiment === 'positive' ? '🟢' : r.sentiment === 'negative' ? '🔴' : '⚪'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* --- No data at all --- */}
      {!hasFinnhubSocial && !hasNewsSentiment && (
        <div style={{ color: C.textMuted, fontSize: F.sizeSm, padding: 12 }}>
          No hay datos de sentimiento social disponibles para este símbolo (Finnhub no provee datos Reddit/Twitter en el plan gratuito, y no hay noticias recientes de Polygon para análisis).
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, style }: any) {
  return (
    <div style={{
      fontSize: F.sizeSm, fontWeight: 600, color: C.accent,
      textTransform: 'uppercase', letterSpacing: '0.5px',
      margin: '16px 0 8px', ...style,
    }}>
      {children}
    </div>
  );
}

function fmtPct(v: any): string {
  const n = parseFloat(v);
  if (isNaN(n)) return '0%';
  if (n > 10 || n < -10) return n.toFixed(1) + '%';
  return (n * 100).toFixed(1) + '%';
}

function Th({ children }: any) {
  return <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, fontSize: F.sizeXs, whiteSpace: 'nowrap' }}>{children}</th>;
}

function Td({ children, style }: any) {
  return <td style={{ padding: '6px 10px', fontSize: F.sizeXs, whiteSpace: 'nowrap', ...style }}>{children}</td>;
}

function fmtCompact(n: number) {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function fmtCurrency(n: number) {
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}
