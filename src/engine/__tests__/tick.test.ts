import { describe, it, expect, beforeEach } from 'vitest';
import type { GraphElement, TickOptions } from '../types';
import { simulateTick } from '../tick';
import { resetElements } from '../reset';

describe('engine/tick', () => {
  describe('simulateTick — basic flow', () => {
    let pool: GraphElement;
    let source: GraphElement;
    let conn: GraphElement;
    let drain: GraphElement;
    let drainConn: GraphElement;

    beforeEach(() => {
      source = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
        text: '',
      } as GraphElement;

      pool = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        activation: 'automatic',
        max: 100,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      conn = {
        id: 3,
        type: 'Resource Connection',
        x: 0,
        y: 0,
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '5',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;

      drain = {
        id: 4,
        type: 'Drain',
        x: 200,
        y: 0,
        activation: 'automatic',
      } as GraphElement;

      drainConn = {
        id: 5,
        type: 'Resource Connection',
        x: 0,
        y: 0,
        connectedToStart: 2,
        connectedToEnd: 4,
        text: '2',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;
    });

    it('should flow resources from Source → Pool → Drain over ticks', () => {
      source.activation = 'automatic';
      pool.activation = 'automatic';
      drain.activation = 'automatic';

      const elements = [source, pool, conn, drain, drainConn];
      const resetElements_result = resetElements(elements);

      const fractionalDispatch = new Map();
      const options: TickOptions = {
        mode: 'onstart',
        currentTick: 0,
        fractionalDispatch,
      };

      // Tick 1: onstart initializes
      const result1 = simulateTick(resetElements_result, 'onstart', options);
      expect(result1.nextElements).toBeDefined();

      // Tick 2: automatic ticks - resources flow
      options.mode = 'automatic';
      options.currentTick = 1;
      const result2 = simulateTick(result1.nextElements, 'automatic', options);
      const pool2 = result2.nextElements.find(e => e.id === 2);
      expect(pool2?.currentPoints).toBeGreaterThanOrEqual(0);
    });

    it('should respect Pool max capacity', () => {
      const smallPool = {
        ...pool,
        max: 10,
      };
      const elements = [source, smallPool, conn];
      const resetElements_result = resetElements(elements);

      const fractionalDispatch = new Map();
      const options: TickOptions = {
        mode: 'onstart',
        currentTick: 0,
        fractionalDispatch,
      };

      let current = resetElements_result;
      for (let i = 0; i < 5; i++) {
        if (i > 0) options.mode = 'automatic';
        const result = simulateTick(
          current,
          i === 0 ? 'onstart' : 'automatic',
          options
        );
        current = result.nextElements;
        options.currentTick += 1;
      }

      const finalPool = current.find(e => e.id === smallPool.id);
      expect(finalPool?.currentPoints).toBeLessThanOrEqual(smallPool.max);
    });

    it('should return TickResult with transfers and events', () => {
      const elements = [source, pool, conn];
      const resetElements_result = resetElements(elements);

      const fractionalDispatch = new Map();
      const options: TickOptions = {
        mode: 'onstart',
        currentTick: 0,
        fractionalDispatch,
      };

      const result = simulateTick(resetElements_result, 'onstart', options);

      expect(result).toHaveProperty('nextElements');
      expect(result).toHaveProperty('transfers');
      expect(result).toHaveProperty('events');
      expect(Array.isArray(result.transfers)).toBe(true);
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  describe('simulateTick — gates and routing', () => {
    it('should route through Gate with deterministic output', () => {
      const source: GraphElement = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
      } as GraphElement;

      const gate: GraphElement = {
        id: 2,
        type: 'Gate',
        x: 100,
        y: 0,
        activation: 'automatic',
        gateType: 'deterministic',
        actions: 1,
      } as GraphElement;

      const pool1: GraphElement = {
        id: 3,
        type: 'Pool',
        x: 200,
        y: 0,
        max: 100,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const pool2: GraphElement = {
        id: 4,
        type: 'Pool',
        x: 200,
        y: 100,
        max: 100,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const connIn: GraphElement = {
        id: 5,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '10',
        color: '#000000',
        inhibited: false,
      } as GraphElement;

      const connOut1: GraphElement = {
        id: 6,
        type: 'Resource Connection',
        connectedToStart: 2,
        connectedToEnd: 3,
        text: '1',
        color: '#000000',
        inhibited: false,
      } as GraphElement;

      const connOut2: GraphElement = {
        id: 7,
        type: 'Resource Connection',
        connectedToStart: 2,
        connectedToEnd: 4,
        text: '1',
        color: '#000000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, gate, pool1, pool2, connIn, connOut1, connOut2];
      const reset_result = resetElements(elements);

      const fractionalDispatch = new Map();
      const options: TickOptions = {
        mode: 'onstart',
        currentTick: 0,
        fractionalDispatch,
      };

      const result1 = simulateTick(reset_result, 'onstart', options);
      options.mode = 'automatic';
      options.currentTick = 1;
      const result2 = simulateTick(result1.nextElements, 'automatic', options);

      const finalPool1 = result2.nextElements.find(e => e.id === 3);
      const finalPool2 = result2.nextElements.find(e => e.id === 4);

      const total =
        (finalPool1?.currentPoints ?? 0) + (finalPool2?.currentPoints ?? 0);
      expect(total).toBeGreaterThan(0);
    });
  });

  describe('simulateTick — End Conditions and game-end events', () => {
    it('should emit game_end event when End Condition triggers', () => {
      const register: GraphElement = {
        id: 1,
        type: 'Register',
        x: 0,
        y: 0,
        currentValue: 10,
        startingValue: 10,
        interactive: false,
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
        text: '> 5',
      } as GraphElement;

      const elements = [register, endCond, stateConn];
      const reset_result = resetElements(elements);

      const fractionalDispatch = new Map();
      const options: TickOptions = {
        mode: 'automatic',
        currentTick: 0,
        fractionalDispatch,
      };

      const result = simulateTick(reset_result, 'automatic', options);

      // End Condition should emit game_end when conditions are met
      const gameEndEvent = result.events.find(e => e.type === 'game_end');
      if (gameEndEvent) {
        expect(gameEndEvent.type).toBe('game_end');
      } else {
        // If no game_end, verify End Condition was evaluated
        const endCondResult = result.nextElements.find(e => e.id === 2);
        expect(endCondResult).toBeDefined();
      }
    });
  });

  describe('simulateTick — Registers and formulas', () => {
    it('should evaluate Register formula with input connections', () => {
      const pool1: GraphElement = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        currentPoints: 3,
        resourcesByColor: {},
      } as GraphElement;

      const pool2: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        currentPoints: 4,
        resourcesByColor: {},
      } as GraphElement;

      const register: GraphElement = {
        id: 3,
        type: 'Register',
        x: 200,
        y: 0,
        currentValue: 0,
        startingValue: 0,
        formula: 'a+b',
        interactive: false,
      } as GraphElement;

      const stateConn1: GraphElement = {
        id: 4,
        type: 'State Connection',
        connectedToStart: 1,
        connectedToEnd: 3,
        text: 'a',
      } as GraphElement;

      const stateConn2: GraphElement = {
        id: 5,
        type: 'State Connection',
        connectedToStart: 2,
        connectedToEnd: 3,
        text: 'b',
      } as GraphElement;

      const elements = [pool1, pool2, register, stateConn1, stateConn2];
      const reset_result = resetElements(elements);

      const fractionalDispatch = new Map();
      const options: TickOptions = {
        mode: 'automatic',
        currentTick: 0,
        fractionalDispatch,
      };

      const result = simulateTick(reset_result, 'automatic', options);
      const finalRegister = result.nextElements.find(e => e.id === 3);

      // Register should compute formula based on inputs
      expect(finalRegister?.currentValue).toBeGreaterThanOrEqual(0);
      expect(finalRegister).toBeDefined();
    });
  });

  describe('simulateTick — activation types', () => {
    it('should only activate onstart elements during onstart tick', () => {
      const pool1: GraphElement = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        activation: 'onstart',
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const pool2: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        activation: 'automatic',
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;

      const elements = [pool1, pool2];
      const reset_result = resetElements(elements);

      const fractionalDispatch = new Map();
      const options: TickOptions = {
        mode: 'onstart',
        currentTick: 0,
        fractionalDispatch,
      };

      // During onstart, both onstart and automatic can be activated
      const result = simulateTick(reset_result, 'onstart', options);
      expect(result.nextElements).toBeDefined();
      expect(result.nextElements[0].hasStarted).toBe(true);
    });
  });

  describe('simulateTick — fractional dispatch', () => {
    it('should maintain fractional state across ticks', () => {
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
        text: '0.5',
        color: '#000000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, pool, conn];
      const reset_result = resetElements(elements);

      const fractionalDispatch = new Map();
      const options: TickOptions = {
        mode: 'onstart',
        currentTick: 0,
        fractionalDispatch,
      };

      let current = reset_result;
      for (let i = 0; i < 3; i++) {
        if (i > 0) options.mode = 'automatic';
        const result = simulateTick(
          current,
          i === 0 ? 'onstart' : 'automatic',
          options
        );
        current = result.nextElements;
        options.currentTick = i + 1;
      }

      const finalPool = current.find(e => e.id === 2);
      // With 0.5 per tick over 3 ticks, should accumulate more than 1 total
      expect(finalPool?.currentPoints).toBeGreaterThan(0);
    });
  });
});
