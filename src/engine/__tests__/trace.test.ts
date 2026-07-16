import { describe, it, expect } from 'vitest';
import type { GraphElement } from '../types';
import { runSimulation } from '../runner';
import { renderTrace } from '../trace';

/**
 * Source(5)/tick -> Pool. Gives a predictable +5 coloured-resource change every
 * automatic tick, which is the simplest thing tracing should capture.
 */
function sourceToPool(rate: string): GraphElement[] {
  return [
    {
      id: 1,
      type: 'Source',
      x: 0,
      y: 0,
      activation: 'automatic',
    } as GraphElement,
    {
      id: 2,
      type: 'Pool',
      x: 100,
      y: 0,
      text: 'coins',
      max: Infinity,
      currentPoints: 0,
      resourcesByColor: {},
      pullMode: 'pull any',
    } as GraphElement,
    {
      id: 3,
      type: 'Resource Connection',
      connectedToStart: 1,
      connectedToEnd: 2,
      text: rate,
      color: '#FF0000',
      inhibited: false,
    } as GraphElement,
  ];
}

describe('engine/trace', () => {
  describe('runSimulation — trace collection', () => {
    it('does not collect a trace by default', () => {
      const result = runSimulation(sourceToPool('5'), { maxTicks: 5 });
      expect(result.traceLog).toEqual([]);
    });

    it('records a diary entry per tick when armed', () => {
      const result = runSimulation(sourceToPool('5'), {
        maxTicks: 5,
        trace: true,
      });

      // onstart tick + 5 automatic ticks.
      expect(result.traceLog.length).toBe(6);
      // Ticks are 1-based; the onstart tick is tick 1.
      expect(result.traceLog[0].tick).toBe(1);
      expect(result.traceLog[0].activation).toBe('onstart');
      expect(result.traceLog[1].activation).toBe('automatic');
    });

    it('captures before/after/delta for resource changes', () => {
      const result = runSimulation(sourceToPool('5'), {
        maxTicks: 3,
        trace: true,
      });

      // Find the first automatic tick that moved coins into the pool.
      const change = result.traceLog
        .flatMap(e => e.changes)
        .find(c => c.elementId === 2 && c.color === '#FF0000');

      expect(change).toBeDefined();
      expect(change!.label).toBe('coins');
      expect(change!.field).toBe('resource');
      expect(change!.delta).toBe(5);
      expect(change!.after - change!.before).toBe(5);
    });

    it('attributes flows to the source and target nodes', () => {
      const els = sourceToPool('5');
      els[0].text = 'Bronze Pack'; // name the Source node
      const result = runSimulation(els, { maxTicks: 3, trace: true });

      const flow = result.traceLog.flatMap(e => e.flows).find(f => f.units > 0);
      expect(flow).toBeDefined();
      expect(flow!.from).toBe('Bronze Pack');
      expect(flow!.to).toBe('coins');
      expect(flow!.units).toBe(5);
    });

    it('honors the maxTraceTicks safety cap', () => {
      const result = runSimulation(sourceToPool('5'), {
        maxTicks: 50,
        trace: true,
        maxTraceTicks: 4,
      });

      expect(result.traceLog.length).toBe(4);
      // The simulation itself still runs to completion.
      expect(result.ticksRun).toBe(50);
    });

    it('traces Register value changes', () => {
      const elements: GraphElement[] = [
        {
          id: 1,
          type: 'Source',
          x: 0,
          y: 0,
          activation: 'automatic',
        } as GraphElement,
        {
          id: 2,
          type: 'Pool',
          x: 100,
          y: 0,
          text: 'coins',
          max: Infinity,
          currentPoints: 0,
          resourcesByColor: {},
          pullMode: 'pull any',
        } as GraphElement,
        {
          id: 3,
          type: 'Resource Connection',
          connectedToStart: 1,
          connectedToEnd: 2,
          text: '1',
          color: '#FF0000',
          inhibited: false,
        } as GraphElement,
        // Register mirrors the pool's value via a state connection.
        {
          id: 4,
          type: 'Register',
          x: 200,
          y: 0,
          text: 'mirror',
          currentValue: 0,
          startingValue: 0,
          formula: 'a',
        } as GraphElement,
        {
          id: 5,
          type: 'State Connection',
          connectedToStart: 2,
          connectedToEnd: 4,
          text: 'a',
        } as GraphElement,
      ];

      const result = runSimulation(elements, { maxTicks: 5, trace: true });
      const valueChange = result.traceLog
        .flatMap(e => e.changes)
        .find(c => c.field === 'value' && c.elementId === 4);

      expect(valueChange).toBeDefined();
      expect(valueChange!.label).toBe('mirror');
    });
  });

  describe('renderTrace', () => {
    it('renders human-readable diary lines', () => {
      const result = runSimulation(sourceToPool('5'), {
        maxTicks: 2,
        trace: true,
      });
      const text = renderTrace(result.traceLog);

      expect(text).toContain('Tick');
      expect(text).toContain('coins');
      // Arrow + signed delta formatting, e.g. "0 → 5 (+5)".
      expect(text).toContain('→');
      expect(text).toContain('(+5)');
      // Attribution line naming the nodes the resource moved between.
      expect(text).toContain('↳');
    });
  });
});
