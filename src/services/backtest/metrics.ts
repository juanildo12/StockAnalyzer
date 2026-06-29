import { PortfolioSnapshot } from './types';

export function calcReturns(nav: { date: string; value: number }[]): number {
  if (nav.length < 2) return 0;
  const initial = nav[0].value;
  const final = nav[nav.length - 1].value;
  return (final - initial) / initial;
}

export function calcMaxDrawdown(nav: { date: string; value: number }[]): number {
  let peak = nav[0]?.value || 0;
  let maxDd = 0;
  for (const entry of nav) {
    if (entry.value > peak) peak = entry.value;
    const dd = (peak - entry.value) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

export function calcSortino(nav: { date: string; value: number }[]): number {
  if (nav.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < nav.length; i++) {
    returns.push((nav[i].value - nav[i - 1].value) / nav[i - 1].value);
  }
  const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downside = returns.filter(r => r < 0);
  const downsideVar = downside.reduce((a, b) => a + b * b, 0) / returns.length;
  const downsideStd = Math.sqrt(downsideVar);
  return downsideStd === 0 ? 0 : avg / downsideStd;
}

export function calcMetrics(nav: { date: string; value: number }[]) {
  return {
    finalReturn: calcReturns(nav),
    maxDrawdown: calcMaxDrawdown(nav),
    sortino: calcSortino(nav),
  };
}
