# Project Notes

## Trade Picks (app/api/trade-picks/scan/route.ts)

User preference for contract selection:
- Contracts must NOT have a wide spread (tight spread only).
- Contracts must have HIGH volume and HIGH open interest.
- This is enforced in `bestContract()` and in the final combo scoring.

## Trade Picks (actualizado — Momentum de Sean @SRxTrades)

El sistema de Trade Picks ha sido actualizado al estilo momentum + breakout de Sean:
- **Solo CALL (largo)**: únicamente líderes alcistas. No genera PUTs.
- **Régimen de mercado**: se exige que SPY y/o QQQ estén por encima de sus EMA 8/21/50. Se calcula y devuelve `regime: {level: BULL|MIXED|CHOP, ...}` en el scan (MIXED/CHOP no bloquean el scan, pero se muestra advertencia).
- **Selección por momentum**: precio sobre EMA 8/21/50, ordenado en el stack, ADR ≥ 2%, cambio del día > 0, fuerza relativa vs SPY (20d) positiva.
- **Setup de base ajustada**: detecta consolidación (~15 barras) con volumen secándose. Requiere estar a ≤ 3% del trigger (breakout "near") o haber cerrado sobre él con volumen ≥ 1.5x ("confirmed"). Range de base ≤ 12%.
- **Umbrales de score**: `MIN_PICK_SCORE = 80` para el pick titular (A/A+). `FOCUS_MIN_SCORE = 70` para la `focusList` (top 5 candidatos). Se prefieren mejores scores (A+ ≥90, A ≥80, B+ ≥70).
- **Contratos**: NO se relajan los requisitos de spread. Siempre tight (spread ≤10% y ≤$0.60) o semi-tight (≤15% y ≤$0.90) únicamente si no hay tight. OI ≥500, Vol ≥100 (se relaja a OI ≥100/Vol ≥20 solo en segundo intento manteniendo spread). Se buscan expiraciones 7-60 DTE, priorizando ~38 DTE. Se devuelve contrato solo si cumple los filtros estrictos.
- **Gestión**: en la UI se sugiere trimming (25% target, 25% bajo EMA8, 25% bajo EMA21, salida bajo EMA50).

## Trade Picks — análisis profundo (deep.ts + route.ts)

- **Ponderación del combo (corregido)**: `weightedScore = stockScore * 0.6 + optionScore * 0.4`. Se eliminó el doble conteo de spread/liquidez y el `+50` plano por DTE≥14 (antes el contrato pesaba más que la acción). `optionScore = contractScore*0.55 + expScore*0.55 + tradeScore + ivAdj + earningsAdj + oiAdj` (clamp 0-100).
- **Delta**: si el proveedor no manda delta, se usa `approxDelta()` en `bestContract()` (antes `|| 0` dejaba pasar contratos sin greeks).
- **IV vs RV**: `realizedVol()` (20d anualizada) del subyacente; `ivAdjustment()` penaliza IV > 1.6x RV (−10) o > 2.2x (−18) o IV > 200% (−18); IV ≈ RV → +6.
- **Tradeabilidad**: `tradeability()` calcula breakeven (strike+prima), retorno esperado `(delta×mov − prima)/prima` hacia el target técnico, y si el breakeven cabe en el movimiento esperado (ADR × √DTE). Se expone en el contrato (`breakeven`, `expectedReturn`, `targetReachable`) y la UI muestra advertencias.
- **Earnings**: `earningsInWindow()` con `quote.earningsTimestamp` → −30 en optionScore + advertencia en UI si cae dentro del DTE.
- **Muros de OI**: `oiLevelsFromChain()` → strike con máximo OI call/put. Si el target supera el callWall → −10 y `targetBlockedByOi`.
- **Estructura real**: `swingLevels()` (pivots de 2 barras agrupados al 2%) define soporte/resistencia. Stop = máx(baseLow, estructural≤entry−ATR, entry−1.5ATR). Target = proyección del asta (NO anulado por muros: un muro real en el camino resta −3 pts y acota el target *realista* usado por `tradeability()` para el contrato).
- **Base amplia**: gate de rango relajado de 12% → **18%** (breakouts de bases grandes como SHOP/TLN ya no se descartan); 12-18% suma 0 pts en calidad de base + razón "Base amplia".
- **Sector**: finalists pasan por `quoteSummary(assetProfile)` → ETF del sector (XLK/XLF/... en `SECTOR_ETF`); RS vs sector < −5% → −6 pts, ≥ +5% → +3 pts.
- **Régimen ampliado**: VIX (`^VIX`) — >25 −6, >30 −10, ≤16 +2. Breadth: % del universo sobre MA50 — ≥65% +3, <35% −6. Ambos se exponen en `regime` (`vix`, `breadth`).
- **Tests**: `npm test` (vitest) cubre `src/lib/tradePicks/deep.ts`.
- **Caché**: `SCAN_CACHE_KEY = trade-picks:scan:candidates:v3` (invalida versiones previas), TTL 15 min (intradía fresco). Si faltan contratos, fallback a 10 megacaps líquidas con los mismos gates (los filtros de spread/vol/OI nunca se relajan); se expone `liquidFallbackScored` en la respuesta.
- **Solo USA**: `filterUSOnly()` consulta `quoteSummary(assetProfile).country` (caché por símbolo) y descarta empresas no estadounidenses — el universo de screeners trae ADR/dual-listing (ej. CMBT, Bélgica, cotiza en NYSE en USD). Si la consulta de país falla, se conserva el símbolo. Aplica a candidatos del scan y al pool de fallback líquido. Los picks y strikes siempre son en USD de NYSE/Nasdaq.
