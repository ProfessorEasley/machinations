import { describe, it, expect } from 'vitest';
import type { GraphElement } from '../types';
import { resetElements } from '../reset';

describe('engine/reset', () => {
  it('resets Pool elements with initial resources and current points', () => {
    const source: GraphElement = {
      id: 1,
      type: 'Pool',
      x: 0,
      y: 0,
      number: 5,
      color: '#0f0',
      currentPoints: 10,
      resourcesByColor: { '#0f0': 10 },
      hasStarted: true,
    };

    const result = resetElements([source]);
    expect(result).toHaveLength(1);
    expect(result[0].currentPoints).toBe(5);
    expect(result[0].resourcesByColor).toEqual({ '#0f0': 5 });
    expect(result[0].hasStarted).toBe(false);
    expect(source.currentPoints).toBe(10);
  });

  it('resets Register and End Condition elements correctly', () => {
    const register: GraphElement = {
      id: 2,
      type: 'Register',
      x: 0,
      y: 0,
      startingValue: 12,
      currentValue: 15,
      hasStarted: true,
    };
    const endCondition: GraphElement = {
      id: 3,
      type: 'End Condition',
      x: 0,
      y: 0,
      inhibited: false,
      isBlinking: true,
    };

    const [resetRegister, resetEnd] = resetElements([register, endCondition]);
    expect(resetRegister.currentValue).toBe(12);
    expect(resetRegister.hasStarted).toBe(false);
    expect(resetEnd.inhibited).toBe(true);
    expect(resetEnd.isBlinking).toBe(false);
  });

  it('resets Resource Connection dynamic labels with fraction formatting', () => {
    const dynamicConn: GraphElement = {
      id: 4,
      type: 'Resource Connection',
      x: 0,
      y: 0,
      dynamicLabelBase: 2.5,
      dynamicLabelFractionDen: 4,
      text: '0',
    };

    const [result] = resetElements([dynamicConn]);
    expect(result.text).toBe('10/4');
    expect(result.dynamicLabelLastDelta).toBe(0);
  });
});
