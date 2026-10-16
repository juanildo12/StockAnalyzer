# Project Notes

## Gamma Levels (app/api/gamma-levels/route.ts + components/GammaLevelsPanel.tsx)

Feature nuevo de exposición gamma de dealers (GEX):
- **Math pura**: `src/lib/options/gamma.ts` (+ `bs.ts`) — `bsGamma`, `bsPrice`, `ivFromOptionPrice` (inversión BS), `computeGammaLevels` (GEX por strike, gamma flip = cruce por cero interpolado, gamma walls up/down, max pain, régimen positive/negative/neutral), `contractsFromChain` (normaliza Yahoo). 19 tests en `src/lib/options/gamma.test.ts`.
- **Gotchas de Yahoo (bugs corregidos, no reintroducir)**:
  - `yf.options(sym)` trae **solo 1** expiración en `options` (la más cercana); la lista completa está en `expirationDates`. Para otra expiración: `yf.options(sym, { date })`. La ruta arma la lista de `expirationDates`, elige por DTE y refetchea si no es la que ya viene cargada.
  - Yahoo devuelve **IVs basura** en filas deep-ITM (ej. `1e-5` o >500%) → `computeGammaLevels` filtra `iv < 0.005 || iv > 5` antes de acumular GEX (sino el GEX de esos strikes explota a miles de millones).
  - `bsGamma` usa la **PDF** de la normal (`normalPDF`), no la CDF — gamma = φ(d1)/(S·σ·√T). Test de referencia: `bsGamma(100,100,1,0.2,r=0) ≈ 0.01985`.
- **Datos**: OI + IV de la chain de **Yahoo** (`yf.options()`, gratis) → gamma de BS calculada localmente. **Massive free** complementa: `/v3/reference/options/contracts` (universo oficial de strikes, detecta faltantes de Yahoo) + 1-2 `aggs` ATM (`/v2/aggs/ticker/O:.../prev`) → IV inversa como cross-check. Los snapshots `/v3/snapshot/options` (greeks reales) siguen siendo 403 en free tier → se activan solos al pagar (el helper `getOptionsChainSnapshot` ya existe en `massiveClient.ts`). Throttle: `fetchMassiveSafe` con `maxWaitMs` corto, degrada a null, nunca bloquea.
- **Ruta**: `GET /api/gamma-levels?symbol=X&dte=38` (dte default ~38, elige expiración más cercana). Cache 10 min (`cacheAside`). Devuelve `levels`, `gex[]`, `bars[]` (60 sesiones para el mini chart), `source`, `coverage`.
- **UI**: `components/GammaLevelsPanel.tsx` (montado en `Dashboard.tsx` bajo SqueezeRadar) — banner de régimen, chips (Wall↑/Wall↓/MaxPain/GEX neto), mini candlestick con overlays gamma, y gráfico divergente de GEX neto por strike. `CandlestickChart.tsx` acepta props opcionales `gammaFlip`/`gammaWallUp`/`gammaWallDown` (líneas punteadas).
- **Sin cambios en scoring de trade picks** (decidido: solo visual por ahora).

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

## Trade Picks — win rate del historial (TransactionView + /api/trade-picks/evaluate)

- **Resolución persistente**: cada pick guarda `resolved: {status, price, at}` en localStorage (sobrevive recargas). Una vez resuelto no cambia → win rate estable.
- **Criterio de toque (gana/pierde)**: se evalúan velas diarias desde `createdAt` — gana si el precio TOCA el target, pierde si toca el stop (aunque luego retroceda). Si el mismo día toca ambos, decide el cierre vs entrada. Si nunca toca ninguno y la opción expiró, liquida por intrínseco vs prima.
- **`POST /api/trade-picks/evaluate`**: recibe picks sin resolver y devuelve outcomes con datos históricos reales; el cliente los persiste. Se llama al cargar y tras cada scan.
- **Precios en vivo** (`/api/trade-picks/quotes`) resuelven al instante si el precio actual ya tocó target/stop.
- **Sin precio ≠ excluido**: antes `getStatus` devolvía `null` (símbolo desaparecía silenciosamente de W/L); ahora es `pending`. El chip muestra `Win Rate X% · wW/lL` con el denominador de cerrados.

## Massive.com (ex-Polygon.io) — integración Fase 0 (tier gratis)

- **Cliente**: `src/services/massiveClient.ts` (transporte + resolución de key + capability probe + endpoints nuevos) y `src/services/polygonClient.ts` (fachada legacy que ahora usa ese transporte, ~20 call sites intactos). `src/lib/massiveThrottle.ts` limita las llamadas SALIENTES (el `src/lib/rateLimit.ts` existente solo limita entrada de usuario).
- **Env**: `MASSIVE_API_KEY` (preferida) con fallback a `POLYGON_API_KEY`; `MASSIVE_BASE_URL` (default `https://api.massive.com`); `MASSIVE_REQUESTS_PER_MINUTE` (default 5 = free tier; subir en planes de pago para desactivar el throttle).
- **Qué da el free tier (verificado en vivo)**: `/v2/aggs` (diario y minuto), `/v3/reference/tickers/{s}` (details + branding + market cap), `/v2/reference/news` (con `insights`/sentiment), `/v1/indicators/{sma,ema,rsi,macd}` (`results.values[]`; MACD trae `signal`/`histogram`), `/v1/marketstatus/{now,upcoming}`, `/stocks/v1/short-interest` (snake_case: `short_interest`/`avg_daily_volume`/`days_to_cover`/`settlement_date`), `/stocks/vX/float` (`free_float`/`free_float_percent`; el `vX` es literal), `/v1/related-companies/{s}`, `/stocks/v1/dividends`, `/stocks/v1/splits`, `/vX/reference/ipos` (`vX` literal). **Todos los snapshots** (stocks, options chain, unified, top movers) devuelven **403 NOT_AUTHORIZED**.
- **Ojo con el orden**: los endpoints de corporate actions/dividends **no respetan** `sort`/`order` de forma fiable → los helpers traen una ventana amplia y ordenan **en cliente** (desc) antes de recortar. El límite real del free tier es **5 req/min server-side** (un probe rápido da 429 si se excede).
- **Helpers free-tier nuevos** en `massiveClient.ts`: `getMassiveIndicator`, `getMassiveShortInterest`, `getMassiveFloat`, `getMassiveRelatedTickers`, `getMassiveDividends`, `getMassiveSplits`, `getMassiveTickerDetails`, `getMassiveIPOs`, `getMassiveMarketStatus`/`getMassiveMarketHolidays` (+ sus `normalize*` puros). `polygonClient` delega en ellos (rutas legacy rotas corregidas: short-interest/dividends/splits/related/holidays; `getIndicator` devuelve `IndicatorPoint[]`).
- **Degradación**: `getMassiveCapabilities()` (cache memoria+Redis, TTL 30 min) detecta si la key tiene snapshots; los helpers de snapshot devuelven `null` y los callers caen a Yahoo. `polygonClient` ya no lanza en 403/401 (devuelve `null` → listas `[]`), así `/api/market` y `polygonFinnhubEnrichment` dejan de romperse en silencio.
- **Cableado gratis activo**: news (con sentiment) prioritaria en `/api/catalysts` (ticker y general, fallback Finnhub); `/api/catalysts` expone `newsSentiment` agregado (positive/negative/neutral/net) y `meta.sentiment` por noticia; barras diarias Massive (`getMassiveDailyBars`) como fallback en `POST /api/trade-picks/evaluate` con budget de 5/request.
- **Squeeze Radar**: `/api/squeeze?symbol=` (caché 30 min) combina short interest + float + ADV (Yahoo) y puntúa con `src/lib/tradePicks/squeeze.ts` (`computeSqueeze`, `daysToCover`, `shortPctFloat`, `avgVolume`) → score 0-100 + `signal` (extreme/high/moderate/low) + razones. UI: `components/SqueezeRadarPanel.tsx`, montado en `Dashboard.tsx` (vista de detalle del símbolo, bajo Prospero Signals).
- **`deep.ts` ampliado**: `peerRelativeStrength(stockReturn, peerReturns[])` (fuerza relativa vs pares de `/v1/related-companies`) y `corpActionAdjustment(dte, daysToExDividend, daysSinceSplit)` (ex-div dentro del DTE y split reciente). Puros + testeados y **cableados en el scan SOLO para el pick titular** (`enrichTopPick()` en `scan/route.ts`): 2 llamadas Massive (related + splits, degradan a vacío si no hay slot por el límite de 5 req/min) + Yahoo para los retornos; los resultados (`relatedTickers`, `peerRs`, `corpAction`) se adjuntan al pick como *advisory* (no re-gatean el score).
- **Pendiente al pagar (ya implementado, inactivo)**: `getOptionsChainSnapshot` (greeks/IV/OI/breakeven reales → futura fuente de `bestContract`), `getQuotesBatch` (≤250 símbolos) y `getTopMovers`. Planes: Options Starter $29 (sin bid/ask), Options Advanced $199 (bid/ask real-time), Stocks Starter $29 (15-min delayed), Stocks Advanced $199 (real-time). Benzinga/TMX/ETF Global $99 c/u.
- **Tests**: `npm test` = `vitest run src/lib src/services` (68 tests). `vitest.config.mts` añade el alias `@` para resolver imports en vitest.

