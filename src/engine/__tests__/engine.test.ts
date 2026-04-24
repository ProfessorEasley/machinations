import { describe, it, expect, vi, afterEach } from 'vitest';
import type { GraphElement, FractionalDispatchState } from '../types';
import {
  normalizeColor,
  getElementValue,
  sanitizeResourceLabelValue,
  parseTriggerChance,
  shouldActivateTrigger,
  parseMultiplicandDelta,
  parseMultiplyExpression,
  getBaseInputAmountFromMultiplyLabel,
  evaluateDynamicResourceLabel,
  applyDynamicResourceLabels,
  recordTransfer,
  handleDecimalResourceDispatch,
  evaluateArithmeticExpression,
  parseConnectionLabel,
  isTriggerOutput,
  classifyLabel,
  parseInterval,
  parseCond,
  getDiceSides,
  generateGateValue,
  chooseGateOutputs,
} from '../helpers';

describe('engine/helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('primitive helpers', () => {
    it('normalizes undefined color to black', () => {
      expect(normalizeColor(undefined)).toBe('#000000');
    });

    it('returns Pool total from resourcesByColor', () => {
      const pool = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        resourcesByColor: { red: 2, blue: 3 },
      } as GraphElement;
      expect(getElementValue(pool)).toBe(5);
    });

    it('returns currentValue for Register and default 0 for unknown elements', () => {
      const reg = {
        id: 2,
        type: 'Register',
        x: 0,
        y: 0,
        currentValue: 7,
      } as GraphElement;
      expect(getElementValue(reg)).toBe(7);
      const unknown = { id: 3, type: 'Gate', x: 0, y: 0 } as GraphElement;
      expect(getElementValue(unknown)).toBe(0);
    });

    it('rounds and clamps resource label values', () => {
      expect(sanitizeResourceLabelValue(1.27)).toBe(1.3);
      expect(sanitizeResourceLabelValue(-2.1)).toBe(0);
      expect(sanitizeResourceLabelValue(Infinity)).toBe(0);
    });
  });

  describe('trigger helpers', () => {
    it('parses trigger chance expressions', () => {
      expect(parseTriggerChance('50%')).toBe(0.5);
      expect(parseTriggerChance('trigger')).toBe(1);
      expect(parseTriggerChance('  *  ')).toBe(1);
      expect(parseTriggerChance('bad')).toBeNull();
    });

    it('evaluates activation probability using random', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.25);
      expect(shouldActivateTrigger('50%')).toBe(true);
      vi.spyOn(Math, 'random').mockReturnValue(0.75);
      expect(shouldActivateTrigger('50%')).toBe(false);
    });
  });

  describe('multiplicand and multiply parsing', () => {
    it('parses multiply expressions and extracts base input amount', () => {
      expect(parseMultiplyExpression('3*x')).toEqual({ left: '3', right: 'x' });
      expect(getBaseInputAmountFromMultiplyLabel('5*3')).toBe(3);
      expect(getBaseInputAmountFromMultiplyLabel('x*2')).toBe(2);
      expect(getBaseInputAmountFromMultiplyLabel('bad')).toBeNull();
    });

    it('computes multiplicand delta based on previous value', () => {
      const start = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        currentPoints: 8,
      } as GraphElement;
      const conn = {
        id: 10,
        type: 'Resource Connection',
        x: 0,
        y: 0,
        text: '+ xm',
        multiplicandLastSourceValue: 5,
      } as GraphElement;
      expect(parseMultiplicandDelta('+ xm', start, conn)).toBe(24);
      expect(conn.multiplicandLastSourceValue).toBe(8);
    });

    it('returns zero when there is no previous source value', () => {
      const start = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        currentPoints: 4,
      } as GraphElement;
      const conn = {
        id: 11,
        type: 'Resource Connection',
        x: 0,
        y: 0,
        text: '+ xm',
      } as GraphElement;
      expect(parseMultiplicandDelta('+ xm', start, conn)).toBe(0);
      expect(conn.multiplicandLastSourceValue).toBe(4);
    });
  });

  describe('dynamic resource label evaluation', () => {
    it('evaluates x-based and fraction labels with a start element', () => {
      const source = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        currentPoints: 7,
      } as GraphElement;
      expect(evaluateDynamicResourceLabel('+ x', source)).toEqual({
        matched: true,
        delta: 7,
      });
      expect(evaluateDynamicResourceLabel('- x/2', source)).toEqual({
        matched: true,
        delta: -3,
      });
      expect(evaluateDynamicResourceLabel('+ 1/2', source)).toEqual({
        matched: true,
        delta: 3,
      });
      expect(evaluateDynamicResourceLabel('- 2', source)).toEqual({
        matched: true,
        delta: -14,
      });
    });

    it('ignores unsupported labels', () => {
      expect(evaluateDynamicResourceLabel('foo', undefined)).toEqual({
        matched: false,
        delta: 0,
      });
    });

    it('updates resource text when dynamic labels are applied', () => {
      const pool = {
        id: 1,
        type: 'Pool',
        x: 0,
        y: 0,
        currentPoints: 2,
      } as GraphElement;
      const resource = {
        id: 2,
        type: 'Resource Connection',
        x: 0,
        y: 0,
        text: '5',
      } as GraphElement;
      const stateConnection = {
        id: 3,
        type: 'State Connection',
        x: 0,
        y: 0,
        connectedToStart: pool.id,
        connectedToEnd: resource.id,
        text: '+ x',
      } as GraphElement;

      const result = applyDynamicResourceLabels([
        pool,
        resource,
        stateConnection,
      ]);
      const updated = result.find(el => el.id === resource.id)!;
      expect(updated.text).toBe('7');
    });
  });

  describe('transfer recording and dispatch', () => {
    it('records a transfer with source resource color override', () => {
      const transfers: Array<{
        connectionId: number;
        units: number;
        color: string;
      }> = [];
      const conn = {
        id: 8,
        type: 'Resource Connection',
        x: 0,
        y: 0,
        color: '#00ff00',
      } as GraphElement;
      const source = {
        id: 9,
        type: 'Pool',
        x: 0,
        y: 0,
        resources: 'blue',
      } as GraphElement;
      recordTransfer(transfers, conn, 3, source);
      expect(transfers).toEqual([{ connectionId: 8, units: 3, color: 'blue' }]);
    });

    it('ignores invalid transfer inputs', () => {
      const transfers: Array<{
        connectionId: number;
        units: number;
        color: string;
      }> = [];
      recordTransfer(transfers, undefined, 5);
      expect(transfers).toHaveLength(0);
      recordTransfer(
        transfers,
        { id: 10, type: 'Gate', x: 0, y: 0 } as GraphElement,
        5
      );
      expect(transfers).toHaveLength(0);
      recordTransfer(
        transfers,
        { id: 10, type: 'Resource Connection', x: 0, y: 0 } as GraphElement,
        0
      );
      expect(transfers).toHaveLength(0);
    });

    it('handles fractional dispatch across ticks', () => {
      const state = new Map<number, FractionalDispatchState>();
      const connection = {
        id: 99,
        type: 'Resource Connection',
        x: 0,
        y: 0,
      } as GraphElement;
      expect(handleDecimalResourceDispatch(connection, 0.4, state, 1)).toBe(0);
      expect(state.get(99)?.accumulator).toBe(0.4);
      expect(handleDecimalResourceDispatch(connection, 0.8, state, 2)).toBe(1);
      expect(state.get(99)?.accumulator).toBeCloseTo(0.2);
    });
  });

  describe('expression parsing and label utils', () => {
    it('evaluates arithmetic expressions and rejects invalid input', () => {
      expect(evaluateArithmeticExpression('1 + 2 * 3')).toBe(7);
      expect(evaluateArithmeticExpression('(5-2)/3')).toBe(1);
      expect(evaluateArithmeticExpression('4/0')).toBeNull();
      expect(evaluateArithmeticExpression('bad')).toBeNull();
    });

    it('parses connection labels with ranges, fractions, and arithmetic', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      expect(parseConnectionLabel('1-3')).toBe(1);
      expect(parseConnectionLabel('  4/5 ')).toBe(0.8);
      expect(parseConnectionLabel('2*3')).toBe(6);
      expect(parseConnectionLabel('1+2')).toBe(3);
      expect(parseConnectionLabel('foo')).toBe(1);
    });

    it('recognizes trigger output patterns', () => {
      expect(isTriggerOutput('5*x')).toBe(true);
      expect(isTriggerOutput('1')).toBe(false);
    });

    it('classifies and parses label kinds', () => {
      expect(classifyLabel('')).toBe('empty');
      expect(classifyLabel('else')).toBe('else');
      expect(classifyLabel('25%')).toBe('prob');
      expect(classifyLabel('>=10')).toBe('cond');
      expect(classifyLabel('1-5')).toBe('interval');
      expect(classifyLabel('foo')).toBe('invalid');
      expect(parseInterval('10 - 4')).toEqual([4, 10]);
      const cond = parseCond('< 3');
      expect(cond).toBeInstanceOf(Function);
      expect(cond?.(2)).toBe(true);
      expect(cond?.(5)).toBe(false);
    });
  });

  describe('gate helpers', () => {
    it('selects correct dice sides from gate labels and output intervals', () => {
      const gate = {
        id: 1,
        type: 'Gate',
        x: 0,
        y: 0,
        text: 'd4',
      } as GraphElement;
      expect(getDiceSides(gate, [])).toBe(4);
      expect(getDiceSides({ ...gate, text: '2d8' }, [])).toBe(8);
      expect(
        getDiceSides({ ...gate, text: 'foo' }, [
          {
            id: 2,
            type: 'Resource Connection',
            x: 0,
            y: 0,
            text: '1-3',
          } as GraphElement,
        ])
      ).toBe(3);
    });

    it('generates gate values deterministically for sequence gates', () => {
      const gate = {
        id: 2,
        type: 'Gate',
        x: 0,
        y: 0,
        gateType: 'deterministic',
        lastGateValue: 2,
      } as GraphElement;
      expect(generateGateValue(gate, [])).toBe(3);
      expect(generateGateValue({ ...gate, lastGateValue: 5 }, [])).toBe(6);
    });

    it('chooses outputs based on a conditional gate', () => {
      const gate = {
        id: 3,
        type: 'Gate',
        x: 0,
        y: 0,
        gateType: 'dice',
      } as GraphElement;
      const outputs = [
        {
          id: 4,
          type: 'Resource Connection',
          x: 0,
          y: 0,
          text: '1-2',
        } as GraphElement,
        {
          id: 5,
          type: 'Resource Connection',
          x: 0,
          y: 0,
          text: 'else',
        } as GraphElement,
      ];
      vi.spyOn(Math, 'random').mockReturnValue(0.1);
      const chosen = chooseGateOutputs(gate, outputs);
      expect(chosen).toHaveLength(1);
      expect(chosen[0].id).toBe(4);
    });
  });
});
