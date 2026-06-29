import type { NNWCInput, NNWCResult, NNWCClassification } from '../types';

export function calculateNNWC(input: NNWCInput): NNWCResult {
  const { cash, receivables, inventory, totalLiabilities, marketCap } = input;

  const missingData =
    cash === undefined ||
    receivables === undefined ||
    inventory === undefined ||
    totalLiabilities === undefined ||
    marketCap === undefined;

  if (missingData) {
    return {
      nnwc: 0,
      discountPercent: 0,
      ratio: 0,
      classification: 'sin-datos',
      displayMessage: 'No es posible evaluar el criterio Net-Net.',
    };
  }

  const hasData =
    cash !== 0 ||
    receivables !== 0 ||
    inventory !== 0 ||
    totalLiabilities !== 0;

  if (!hasData) {
    return {
      nnwc: 0,
      discountPercent: 0,
      ratio: 0,
      classification: 'sin-datos',
      displayMessage: 'No es posible evaluar el criterio Net-Net.',
    };
  }

  const nnwc = cash + receivables + inventory * 0.5 - totalLiabilities;

  if (nnwc <= 0) {
    return {
      nnwc,
      discountPercent: 0,
      ratio: 0,
      classification: 'negativo',
      displayMessage:
        'La empresa posee un NNWC negativo. No califica como candidata Net-Net.',
    };
  }

  const ratio = marketCap / nnwc;
  const discountPercent = ((nnwc - marketCap) / nnwc) * 100;

  let classification: NNWCClassification;
  if (marketCap < nnwc * 0.67) {
    classification = 'excelente';
  } else if (marketCap < nnwc) {
    classification = 'cumple';
  } else {
    classification = 'no-cumple';
  }

  return {
    nnwc: Math.round(nnwc),
    discountPercent: Math.round(discountPercent * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    classification,
    displayMessage: '',
  };
}
