import { describe, it, expect } from 'vitest';
import type { GraphElement } from '../types';
import { runSimulation } from '../runner';

describe('engine/runner', () => {
  describe('runSimulation — basic multi-tick execution', () => {
    it('should run simulation for default maxTicks', () => {
      const source: GraphElement = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
      } as GraphElement;

      const pool: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        max: Infinity,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const conn: GraphElement = {
        id: 3,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '5',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, pool, conn];
      const result = runSimulation(elements, { maxTicks: 10 });

      expect(result.ticksRun).toBe(10);
      expect(result.finalState).toBeDefined();
      expect(result.finalState.length).toBe(3);
      expect(result.gameEnded).toBe(false);
    });

    it('should stop early when game ends', () => {
      const register: GraphElement = {
        id: 1,
        type: 'Register',
        x: 0,
        y: 0,
        currentValue: 0,
        startingValue: 0,
      } as GraphElement;

      const endCond: GraphElement = {
        id: 2,
        type: 'End Condition',
        x: 100,
        y: 0,
        inhibited: true,
      } as GraphElement;

      const stateConn: GraphElement = {
        id: 3,
        type: 'State Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '> -1',
      } as GraphElement;

      const elements = [register, endCond, stateConn];
      const result = runSimulation(elements, { maxTicks: 100 });

      expect(result.gameEnded).toBe(true);
      expect(result.ticksRun).toBeLessThan(100);
    });

    it('should return correct tick count', () => {
      const pool: GraphElement = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        max: 100,
        currentPoints: 10,
        resourcesByColor: { red: 10 },
        pullMode: 'pull any',
      } as GraphElement;

      const elements = [pool];
      const result = runSimulation(elements, { maxTicks: 5 });

      expect(result.ticksRun).toBe(5);
    });
  });

  describe('runSimulation — tickLog collection', () => {
    it('should collect tick log when collectLog is true', () => {
      const source: GraphElement = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
      } as GraphElement;

      const pool: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        max: 100,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const conn: GraphElement = {
        id: 3,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '5',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, pool, conn];
      const result = runSimulation(elements, { maxTicks: 5, collectLog: true });

      expect(result.tickLog.length).toBeGreaterThan(0);
      expect(result.tickLog[0]).toHaveProperty('nextElements');
      expect(result.tickLog[0]).toHaveProperty('transfers');
      expect(result.tickLog[0]).toHaveProperty('events');
    });

    it('should not collect tick log when collectLog is false', () => {
      const pool: GraphElement = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        max: 100,
        currentPoints: 10,
        resourcesByColor: { red: 10 },
        pullMode: 'pull any',
      } as GraphElement;

      const elements = [pool];
      const result = runSimulation(elements, {
        maxTicks: 5,
        collectLog: false,
      });

      expect(result.tickLog.length).toBe(0);
    });
  });

  describe('runSimulation — final state accuracy', () => {
    it('should return final element state matching last tick', () => {
      const source: GraphElement = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
      } as GraphElement;

      const pool: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        max: 100,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const conn: GraphElement = {
        id: 3,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '10',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, pool, conn];
      const result = runSimulation(elements, { maxTicks: 3, collectLog: true });

      const finalPoolFromResult = result.finalState.find(e => e.id === 2);
      const lastTickPoolFromLog = result.tickLog[
        result.tickLog.length - 1
      ].nextElements.find(e => e.id === 2);

      expect(finalPoolFromResult?.currentPoints).toBe(
        lastTickPoolFromLog?.currentPoints
      );
    });

    it('should handle multiple element types', () => {
      const source: GraphElement = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
      } as GraphElement;

      const pool: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        max: 100,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const register: GraphElement = {
        id: 3,
        type: 'Register',
        x: 200,
        y: 0,
        currentValue: 0,
        startingValue: 0,
      } as GraphElement;

      const conn: GraphElement = {
        id: 4,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '5',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, pool, register, conn];
      const result = runSimulation(elements, { maxTicks: 5 });

      expect(result.finalState.length).toBe(4);
      expect(result.finalState.find(e => e.id === 1)?.type).toBe('Source');
      expect(result.finalState.find(e => e.id === 2)?.type).toBe('Pool');
      expect(result.finalState.find(e => e.id === 3)?.type).toBe('Register');
    });
  });

  describe('runSimulation — resource flow validation', () => {
    it('should accumulate resources correctly over multiple ticks', () => {
      const source: GraphElement = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
      } as GraphElement;

      const pool: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        max: 1000,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const conn: GraphElement = {
        id: 3,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '10',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, pool, conn];
      const result = runSimulation(elements, { maxTicks: 10 });

      const finalPool = result.finalState.find(e => e.id === 2);
      expect(finalPool?.currentPoints).toBeGreaterThan(0);
    });

    it('should respect pool capacity limits', () => {
      const source: GraphElement = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
      } as GraphElement;

      const pool: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        max: 15,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const conn: GraphElement = {
        id: 3,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '10',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, pool, conn];
      const result = runSimulation(elements, { maxTicks: 10 });

      const finalPool = result.finalState.find(e => e.id === 2);
      const finalPoolPoints = finalPool?.currentPoints ?? 0;
      const poolMax = pool.max ?? Infinity;
      expect(finalPoolPoints).toBeLessThanOrEqual(poolMax);
    });
  });

  describe('runSimulation — onstart phase', () => {
    it('should initialize elements during onstart phase', () => {
      const pool: GraphElement = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        max: 100,
        number: 50,
        currentPoints: 0,
        resourcesByColor: {},
        color: '#FF0000',
        pullMode: 'pull any',
      } as GraphElement;

      const elements = [pool];
      const result = runSimulation(elements, { maxTicks: 1 });

      const finalPool = result.finalState.find(e => e.id === 1);
      expect(finalPool?.currentPoints).toBeGreaterThan(0);
    });
  });

  describe('runSimulation — edge cases', () => {
    it('should handle empty element array', () => {
      const result = runSimulation([], { maxTicks: 5 });
      expect(result.ticksRun).toBe(5);
      expect(result.finalState.length).toBe(0);
      expect(result.gameEnded).toBe(false);
    });

    it('should handle single element', () => {
      const pool: GraphElement = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        max: 100,
        currentPoints: 10,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const result = runSimulation([pool], { maxTicks: 5 });
      expect(result.ticksRun).toBe(5);
      expect(result.finalState.length).toBe(1);
    });

    it('should handle default options', () => {
      const pool: GraphElement = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        max: 100,
        currentPoints: 10,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const result = runSimulation([pool]);
      expect(result.ticksRun).toBe(1000);
      expect(result.tickLog.length).toBe(0);
    });
  });

  describe('runSimulation — deterministic seeding', () => {
    // Probabilistic model: Source -> Convertor -> Pool where the converter
    // output is gated by a 50% probability. Without a seed the pool count
    // varies run to run; with a seed it must be identical every time.
    const buildProbabilisticModel = (): GraphElement[] => [
      {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
        color: '#FF0000',
      } as GraphElement,
      {
        id: 2,
        type: 'Convertor',
        x: 100,
        y: 0,
        activation: 'automatic',
        pullMode: 'pull any',
      } as GraphElement,
      {
        id: 3,
        type: 'Pool',
        x: 200,
        y: 0,
        max: 10000,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement,
      {
        id: 4,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '1',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement,
      {
        id: 5,
        type: 'Resource Connection',
        connectedToStart: 2,
        connectedToEnd: 3,
        text: '50%',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement,
    ];

    const poolCount = (els: GraphElement[]): number =>
      els.find(e => e.id === 3)?.currentPoints ?? 0;

    it('produces identical outcomes for the same seed', () => {
      const a = runSimulation(buildProbabilisticModel(), {
        maxTicks: 200,
        seed: 42,
      });
      const b = runSimulation(buildProbabilisticModel(), {
        maxTicks: 200,
        seed: 42,
      });

      expect(b.finalState).toEqual(a.finalState);
      expect(poolCount(b.finalState)).toBe(poolCount(a.finalState));
    });

    it('different seeds can produce different outcomes', () => {
      const counts = [7, 13, 99, 1234, 56789].map(seed =>
        poolCount(
          runSimulation(buildProbabilisticModel(), { maxTicks: 200, seed })
            .finalState
        )
      );
      // With 200 probabilistic draws across distinct seeds, at least two of the
      // resulting pool counts should differ.
      const unique = new Set(counts);
      expect(unique.size).toBeGreaterThan(1);
    });

    it('runs are reproducible after running other seeds in between', () => {
      const first = poolCount(
        runSimulation(buildProbabilisticModel(), { maxTicks: 200, seed: 42 })
          .finalState
      );
      // Run unrelated seeds to advance/replace global RNG state.
      runSimulation(buildProbabilisticModel(), { maxTicks: 50, seed: 1 });
      runSimulation(buildProbabilisticModel(), { maxTicks: 73, seed: 2 });
      const again = poolCount(
        runSimulation(buildProbabilisticModel(), { maxTicks: 200, seed: 42 })
          .finalState
      );
      expect(again).toBe(first);
    });
  });
});
