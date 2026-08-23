import { describe, it, expect } from 'vitest';
import type {
  GraphElement,
  GraphElementType,
  LabelKind,
  ResourceTransfer,
  FractionalDispatchState,
} from '../types';

describe('engine/types', () => {
  it('supports GraphElement and GraphElementType values', () => {
    const elementType: GraphElementType = 'Pool';
    const element: GraphElement = {
      id: 1,
      type: elementType,
      x: 10,
      y: 20,
      text: 'Test',
    };

    expect(element.type).toBe('Pool');
    expect(element.text).toBe('Test');
  });

  it('supports ResourceTransfer and FractionalDispatchState shapes', () => {
    const transfer: ResourceTransfer = {
      connectionId: 2,
      units: 3,
      color: '#ff0000',
    };
    const dispatchState: FractionalDispatchState = {
      connectionId: 2,
      accumulator: 0.75,
      lastTick: 5,
    };

    expect(transfer.units).toBe(3);
    expect(dispatchState.accumulator).toBe(0.75);
  });

  it('allows LabelKind values to be assigned and used', () => {
    const label: LabelKind = 'interval';
    expect(label).toBe('interval');
  });
});
