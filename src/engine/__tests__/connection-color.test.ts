import { describe, it, expect } from 'vitest';
import type { GraphElement, TickOptions } from '../types';
import { simulateTick } from '../tick';

/**
 * Machinations treats a connection's colour as cosmetic, so models drawn in the
 * desktop tool routinely colour a connection to match its *target* — a red
 * salary drain pulling from a green wallet. We use colour to select a resource,
 * so a strict reading moves nothing and leaves the model silently inert (no
 * error, the run just looks empty). Imported MGI economy models depend on the
 * mismatched case working.
 */
describe('engine/tick — connection colour vs pool resource colour', () => {
  const options = (): TickOptions => ({
    mode: 'automatic',
    currentTick: 0,
    fractionalDispatch: new Map(),
  });

  /** Pool → Drain, where the connection's colour is set by `connColor`. */
  const graph = (
    resourcesByColor: Record<string, number>,
    connColor: string
  ): GraphElement[] => [
    {
      id: 1,
      type: 'Pool',
      x: 0,
      y: 0,
      activation: 'passive',
      pullMode: 'pull any',
      resourcesByColor: { ...resourcesByColor },
      currentPoints: Object.values(resourcesByColor).reduce((a, b) => a + b, 0),
    } as GraphElement,
    {
      id: 2,
      type: 'Drain',
      x: 100,
      y: 0,
      activation: 'automatic',
      pullMode: 'pull any',
    } as GraphElement,
    {
      id: 3,
      type: 'Resource Connection',
      x: 50,
      y: 0,
      connectedToStart: 1,
      connectedToEnd: 2,
      text: '650',
      color: connColor,
      inhibited: false,
    } as GraphElement,
  ];

  const drainOnce = (
    resourcesByColor: Record<string, number>,
    connColor: string
  ): GraphElement => {
    const result = simulateTick(
      graph(resourcesByColor, connColor),
      'automatic',
      options()
    );
    return result.nextElements.find(el => el.id === 1)!;
  };

  it('pulls from a single-colour pool even when the connection colour differs', () => {
    const pool = drainOnce({ Green: 2000 }, 'Red');
    expect(pool.resourcesByColor?.Green).toBe(1350);
  });

  it('pulls normally when the connection colour matches', () => {
    const pool = drainOnce({ Green: 2000 }, 'Green');
    expect(pool.resourcesByColor?.Green).toBe(1350);
  });

  it('leaves a multi-colour pool untouched when no colour matches', () => {
    // Two candidate colours and no match — guessing one would corrupt genuine
    // multi-colour models, so the strict reading is kept.
    const pool = drainOnce({ Green: 2000, Blue: 500 }, 'Red');
    expect(pool.resourcesByColor?.Green).toBe(2000);
    expect(pool.resourcesByColor?.Blue).toBe(500);
  });

  it('still prefers the exact colour in a multi-colour pool', () => {
    const pool = drainOnce({ Green: 2000, Blue: 900 }, 'Blue');
    expect(pool.resourcesByColor?.Green).toBe(2000);
    expect(pool.resourcesByColor?.Blue).toBe(250);
  });

  it('does not drain a single-colour pool that cannot cover the full amount', () => {
    // Unrelated to colour, but pins the all-or-nothing pull the fallback runs
    // through, so a later partial-pull change has to update this deliberately.
    const pool = drainOnce({ Green: 400 }, 'Red');
    expect(pool.resourcesByColor?.Green).toBe(400);
  });
});
