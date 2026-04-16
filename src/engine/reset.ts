import type { GraphElement } from './types';
import { normalizeColor } from './helpers';

/**
 * Reset all elements to their initial simulation state.
 * Returns a new array (does not mutate the input).
 */
export function resetElements(elements: GraphElement[]): GraphElement[] {
  return elements.map(el => {
    const base: GraphElement = {
      ...el,
      hasStarted: false,
      triggerCount: 0,
      hasUnsatisfiedCondition: false,
      conditionSatisfied: undefined,
      dynamicLabelLastDelta: 0,
      lastStartValue: undefined,
      multiplicandLastSourceValue: undefined,
    };

    if (el.type === 'Pool') {
      const startVal =
        typeof el.number === 'string'
          ? parseInt(el.number) || 0
          : el.number || 0;
      const c = normalizeColor(el.color);
      const initialResources = startVal > 0 ? { [c]: startVal } : {};
      return {
        ...base,
        currentPoints: startVal,
        resourcesByColor: initialResources,
      };
    }

    if (el.type === 'Register') {
      return { ...base, currentValue: el.startingValue || 0 };
    }

    if (el.type === 'End Condition') {
      return { ...base, inhibited: true, isBlinking: false };
    }

    if (el.type === 'Convertor') {
      return { ...base, inputResources: {}, outputResources: {} };
    }

    if (el.type === 'Trader') {
      return { ...base, traderInputs: {}, traderOutputs: {} };
    }

    if (
      el.type === 'Resource Connection' &&
      (el.dynamicLabelBase !== undefined ||
        el.dynamicLabelFractionDen !== undefined)
    ) {
      const dynBase = el.dynamicLabelBase ?? 0;
      const den = el.dynamicLabelFractionDen;

      if (den != null && Number.isFinite(den) && den !== 0) {
        const num = Math.round(dynBase * den);
        return { ...base, text: `${num}/${den}` };
      }

      return { ...base, text: String(dynBase) };
    }

    return base;
  });
}
