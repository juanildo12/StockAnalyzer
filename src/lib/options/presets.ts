// Options strategy simulator — preset strategy builders (pure, unit-testable).
//
// Builds common multi-leg strategies from a spot price and a small set of
// chosen strikes/premiums, so the UI can offer one-click templates. Premiums
// are supplied from the real chain (mid); nothing is fabricated here.

import type { StrategyLeg, OptionType } from './strategy';

export interface StrikeQuote {
  strike: number;
  premium: number; // per-share mid
  iv: number; // decimal
}

export interface LegSpec {
  type: OptionType;
  side: 'long' | 'short';
  qty: number;
  strike: number;
}

export interface PresetContext {
  spot: number;
  dte: number;
  /** Look up a quote (premium + iv) for a strike/type; returns null if absent. */
  quote: (type: OptionType, strike: number) => StrikeQuote | null;
}

export interface PresetDef {
  id: string;
  name: string;
  nameEs: string;
  /** 'bullish' | 'bearish' | 'neutral' | 'volatile' */
  bias: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  /** Given spot, propose up to 4 legs (strikes rounded to the chain). */
  legs: (ctx: PresetContext) => LegSpec[];
}

const round5 = (x: number) => Math.round(x / 5) * 5;
const round2_5 = (x: number) => Math.round(x / 2.5) * 2.5;

export const PRESETS: PresetDef[] = [
  {
    id: 'long_call',
    name: 'Long Call',
    nameEs: 'Call comprada',
    bias: 'bullish',
    legs: (c) => [{ type: 'call', side: 'long', qty: 1, strike: round5(c.spot) }],
  },
  {
    id: 'long_put',
    name: 'Long Put',
    nameEs: 'Put comprada',
    bias: 'bearish',
    legs: (c) => [{ type: 'put', side: 'long', qty: 1, strike: round5(c.spot) }],
  },
  {
    id: 'bull_call_spread',
    name: 'Bull Call Spread',
    nameEs: 'Spread alcista de calls',
    bias: 'bullish',
    legs: (c) => [
      { type: 'call', side: 'long', qty: 1, strike: round5(c.spot) },
      { type: 'call', side: 'short', qty: 1, strike: round5(c.spot) + 10 },
    ],
  },
  {
    id: 'bear_put_spread',
    name: 'Bear Put Spread',
    nameEs: 'Spread bajista de puts',
    bias: 'bearish',
    legs: (c) => [
      { type: 'put', side: 'long', qty: 1, strike: round5(c.spot) },
      { type: 'put', side: 'short', qty: 1, strike: round5(c.spot) - 10 },
    ],
  },
  {
    id: 'bull_put_spread',
    name: 'Bull Put Spread',
    nameEs: 'Spread de crédito (puts)',
    bias: 'bullish',
    legs: (c) => [
      { type: 'put', side: 'short', qty: 1, strike: round5(c.spot) - 5 },
      { type: 'put', side: 'long', qty: 1, strike: round5(c.spot) - 15 },
    ],
  },
  {
    id: 'bear_call_spread',
    name: 'Bear Call Spread',
    nameEs: 'Spread de crédito (calls)',
    bias: 'bearish',
    legs: (c) => [
      { type: 'call', side: 'short', qty: 1, strike: round5(c.spot) + 5 },
      { type: 'call', side: 'long', qty: 1, strike: round5(c.spot) + 15 },
    ],
  },
  {
    id: 'iron_condor',
    name: 'Iron Condor',
    nameEs: 'Cóndor de hierro',
    bias: 'neutral',
    legs: (c) => {
      const s = round5(c.spot);
      return [
        { type: 'put', side: 'long', qty: 1, strike: s - 20 },
        { type: 'put', side: 'short', qty: 1, strike: s - 10 },
        { type: 'call', side: 'short', qty: 1, strike: s + 10 },
        { type: 'call', side: 'long', qty: 1, strike: s + 20 },
      ];
    },
  },
  {
    id: 'iron_butterfly',
    name: 'Iron Butterfly',
    nameEs: 'Mariposa de hierro',
    bias: 'neutral',
    legs: (c) => {
      const s = round5(c.spot);
      return [
        { type: 'put', side: 'long', qty: 1, strike: s - 10 },
        { type: 'put', side: 'short', qty: 1, strike: s },
        { type: 'call', side: 'short', qty: 1, strike: s },
        { type: 'call', side: 'long', qty: 1, strike: s + 10 },
      ];
    },
  },
  {
    id: 'straddle',
    name: 'Long Straddle',
    nameEs: 'Straddle comprado',
    bias: 'volatile',
    legs: (c) => {
      const s = round5(c.spot);
      return [
        { type: 'call', side: 'long', qty: 1, strike: s },
        { type: 'put', side: 'long', qty: 1, strike: s },
      ];
    },
  },
  {
    id: 'strangle',
    name: 'Long Strangle',
    nameEs: 'Strangle comprado',
    bias: 'volatile',
    legs: (c) => {
      const s = round5(c.spot);
      return [
        { type: 'call', side: 'long', qty: 1, strike: s + 5 },
        { type: 'put', side: 'long', qty: 1, strike: s - 5 },
      ];
    },
  },
  {
    id: 'short_straddle',
    name: 'Short Straddle',
    nameEs: 'Straddle vendido',
    bias: 'neutral',
    legs: (c) => {
      const s = round5(c.spot);
      return [
        { type: 'call', side: 'short', qty: 1, strike: s },
        { type: 'put', side: 'short', qty: 1, strike: s },
      ];
    },
  },
  {
    id: 'covered_call',
    name: 'Covered Call',
    nameEs: 'Call cubierta',
    bias: 'neutral',
    legs: (c) => [{ type: 'call', side: 'short', qty: 1, strike: round5(c.spot) + 10 }],
  },
  {
    id: 'cash_secured_put',
    name: 'Cash-Secured Put',
    nameEs: 'Put con efectivo',
    bias: 'bullish',
    legs: (c) => [{ type: 'put', side: 'short', qty: 1, strike: round5(c.spot) - 5 }],
  },
  {
    id: 'collar',
    name: 'Collar',
    nameEs: 'Collar',
    bias: 'neutral',
    legs: (c) => {
      const s = round5(c.spot);
      return [
        { type: 'put', side: 'long', qty: 1, strike: s - 10 },
        { type: 'call', side: 'short', qty: 1, strike: s + 10 },
      ];
    },
  },
  {
    id: 'calendar',
    name: 'Calendar (diagonal)',
    nameEs: 'Calendario (diagonal)',
    bias: 'neutral',
    legs: (c) => [
      { type: 'call', side: 'short', qty: 1, strike: round2_5(c.spot) },
      { type: 'call', side: 'long', qty: 1, strike: round2_5(c.spot) },
    ],
  },
];

export function getPreset(id: string): PresetDef | null {
  return PRESETS.find((p) => p.id === id) || null;
}

/**
 * Materialize a preset into real StrategyLegs, pulling premiums/IV from the
 * chain through `ctx.quote`. Strikes missing from the chain are dropped (never
 * fabricated). Returns an empty array if no leg resolves.
 */
export function buildPresetLegs(preset: PresetDef, ctx: PresetContext, style: 'european' | 'american' = 'american'): StrategyLeg[] {
  const specs = preset.legs(ctx);
  const out: StrategyLeg[] = [];
  for (const spec of specs) {
    const q = ctx.quote(spec.type, spec.strike);
    if (!q) continue;
    out.push({
      type: spec.type,
      side: spec.side,
      qty: spec.qty,
      strike: spec.strike,
      premium: q.premium,
      iv: q.iv,
      dte: ctx.dte,
      style,
    });
  }
  return out;
}
