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
