import { describe, it, expect } from 'vitest';
import type { GraphElement } from '../types';
import { runSimulation } from '../runner';

/**
 * Traders move resources between pools. They used to do so by assigning
 * `currentPoints` alone, leaving `resourcesByColor` untouched — and since
 * `getElementValue` reads the colour map whenever it has keys, every delivery
 * was invisible. A trade consumed its inputs and produced nothing.
 */

const E = (o: Partial<GraphElement>): GraphElement =>
  ({ x: 0, y: 0, ...o }) as GraphElement;

const pool = (id: number, color: string, number: number) =>
  E({
    id,
    type: 'Pool',
    color,
    activation: 'passive',
    pullMode: 'pull any',
    number,
  });

const flow = (
  id: number,
  from: number,
  to: number,
  color: string,
  text = '1'
) =>
  E({
    id,
    type: 'Resource Connection',
    connectedToStart: from,
    connectedToEnd: to,
    color,
    text,
  });

/** Pool 1 holds Red, pool 2 holds Blue, trader 3 swaps one for one. */
const swapModel = (pullMode: GraphElement['pullMode']) => [
  pool(1, 'Red', 20),
  pool(2, 'Blue', 20),
  E({ id: 3, type: 'Trader', activation: 'automatic', pullMode }),
  flow(4, 1, 3, 'Red'),
  flow(5, 2, 3, 'Blue'),
  flow(6, 3, 1, 'Blue'),
  flow(7, 3, 2, 'Red'),
];

const contents = (els: GraphElement[], id: number) =>
  els.find(e => e.id === id)!.resourcesByColor ?? {};

describe('engine/tick — Trader', () => {
  for (const pullMode of ['pull any', 'pull all'] as const) {
    describe(pullMode, () => {
      it('delivers the traded resources instead of destroying them', () => {
        const after = runSimulation(swapModel(pullMode), {
          maxTicks: 5,
          seed: 1,
        }).finalState;

        expect(contents(after, 1)).toEqual({ Red: 15, Blue: 5 });
        expect(contents(after, 2)).toEqual({ Blue: 15, Red: 5 });
      });

      it('conserves the total number of resources', () => {
        const after = runSimulation(swapModel(pullMode), {
          maxTicks: 5,
          seed: 1,
        }).finalState;

        const total = [1, 2]
          .flatMap(id => Object.values(contents(after, id)))
          .reduce((a, b) => a + b, 0);
        expect(total).toBe(40);
      });

      it('files each delivery under the output connection colour', () => {
        const after = runSimulation(swapModel(pullMode), {
          maxTicks: 1,
          seed: 1,
        }).finalState;

        // One Red left pool 1 and one Blue arrived in its place.
        expect(contents(after, 1)).toEqual({ Red: 19, Blue: 1 });
        expect(contents(after, 2)).toEqual({ Blue: 19, Red: 1 });
      });
    });
  }

  it('respects the receiving pool capacity', () => {
    const model = swapModel('pull any');
    model.find(e => e.id === 1)!.max = 20;
    const after = runSimulation(model, { maxTicks: 5, seed: 1 }).finalState;

    const held = Object.values(contents(after, 1)).reduce((a, b) => a + b, 0);
    expect(held).toBeLessThanOrEqual(20);
  });
});
