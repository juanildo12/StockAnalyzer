import { describe, it, expect } from 'vitest';
import { parsePositions } from './ai';

describe('parsePositions (tolerante a la salida del LLM)', () => {
  it('lee un JSON limpio', () => {
    const out = parsePositions('{"positions":{"AAPL":{"target":1,"reason":"momentum"},"MSFT":{"target":0,"reason":"RSI"}}}');
    expect(out.AAPL.target).toBe(1);
    expect(out.AAPL.reason).toBe('momentum');
    expect(out.MSFT.target).toBe(0);
  });

  it('ignora preámbulos y texto posterior', () => {
    const out = parsePositions(
      'Claro, aquí tienes el resultado:\n{"positions":{"AAPL":{"target":1,"reason":"ok"}}}\nEspero que te sirva.',
    );
    expect(out.AAPL.target).toBe(1);
  });

  it('acepta JSON dentro de un bloque de markdown', () => {
    const out = parsePositions('```json\n{"positions":{"AAPL":{"target":1,"reason":"ok"}}}\n```');
    expect(out.AAPL.target).toBe(1);
  });

  it('repara un JSON truncado por falta de tokens', () => {
    const out = parsePositions('{"positions":{"AAPL":{"target":1,"reason":"momentum positivo y RSI');
    expect(out.AAPL.target).toBe(1);
  });

  it('extrae por regex cuando el JSON es irrecuperable', () => {
    const out = parsePositions('texto roto "AAPL": { "target": 1, "reason": "muy positive');
    expect(out.AAPL.target).toBe(1);
  });

  it('normaliza la acción buy/increase a target 1', () => {
    const out = parsePositions('{"decisions":{"AAPL":{"action":"buy","reasons":["x"]}}}');
    expect(out.AAPL.target).toBe(1);
  });

  it('acepta targets fraccionarios (el modelo puede ponderar)', () => {
    const out = parsePositions('{"positions":{"AAPL":{"target":0.3,"reason":"parcial"}}}');
    expect(out.AAPL.target).toBe(1);
  });

  it('devuelve vacío si no hay nada parseable', () => {
    expect(parsePositions('sin json aqui')).toEqual({});
    expect(parsePositions('')).toEqual({});
  });
});
