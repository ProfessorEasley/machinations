import { describe, expect, it } from 'vitest';
import { parseAiScript, selectAiCommand } from '../aiScript';

describe('aiScript', () => {
  it('selects the first matching line', () => {
    const script = [
      'if (Money > Woods) fire (Buy army)',
      'if (Money <= Woods) fire (Buy peon)',
    ].join('\n');
    const lines = parseAiScript(script);
    const getValue = (identifier: string) => {
      if (identifier === 'Money') return 10;
      if (identifier === 'Woods') return 5;
      return 0;
    };
    const command = selectAiCommand(lines, getValue);
    expect(command?.type).toBe('fire');
    expect(command?.targets).toEqual(['Buy army']);
  });

  it('parses fireRandom targets', () => {
    const lines = parseAiScript('fireRandom (buy, buy, sell)');
    const command = selectAiCommand(lines, () => 0);
    expect(command?.type).toBe('fireRandom');
    expect(command?.targets).toEqual(['buy', 'buy', 'sell']);
  });
});
