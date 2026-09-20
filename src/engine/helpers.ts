import type {
  GraphElement,
  ResourceTransfer,
  FractionalDispatchState,
  LabelKind,
} from './types';
import { random } from './rng';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RESOURCE_LABEL_EPSILON = 1e-6;

export const MULTIPLICAND_LABEL_REGEX = /^([+-])\s*(x|\d+(?:\.\d+)?)\s*m$/i;
export const MULTIPLY_EXPRESSION_REGEX =
  /^\s*([+-]?\d+(?:\.\d+)?|x|y)\s*\*\s*([+-]?\d+(?:\.\d+)?|x|y)\s*$/i;

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

export const normalizeColor = (color?: string) => color || '#000000';

/** Stroke for Delay hourglass / held count: black on light fills, light on dark fills */
export function delayGlyphStrokeForFill(fill?: string): string {
  const hex = normalizeColor(fill || '#ffffff');
  const raw = hex.replace(/^#/, '');
  if (!/^[\da-f]{6}$/i.test(raw)) return '#000000';
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const lin = (x: number) =>
    x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#000000' : '#f5f5f5';
}

export const isResourceLikeConnection = (element: GraphElement) =>
  element.type === 'Resource Connection';

export function getElementValue(element: GraphElement | undefined): number {
  if (!element) return 0;

  if (element.type === 'Pool') {
    if (
      element.resourcesByColor &&
      Object.keys(element.resourcesByColor).length > 0
    ) {
      return Object.values(element.resourcesByColor).reduce(
        (sum, val) => sum + val,
        0
      );
    }
    return (
      element.currentPoints ??
      (typeof element.number === 'string'
        ? parseInt(element.number)
        : element.number || 0)
    );
  }

  if (element.type === 'Register') return element.currentValue || 0;

  if (element.type === 'Delay') {
    let sum = 0;
    for (const s of element.delaySlots ?? []) sum += s.amount;
    for (const p of element.delayPendingArrivals ?? []) sum += p.amount;
    for (const w of element.delayWaitQueue ?? []) sum += w.amount;
    return sum;
  }

  if (element.type === 'Source') {
    return typeof element.number === 'string'
      ? parseInt(element.number) || 0
      : element.number || 0;
  }

  return 0;
}

export const sanitizeResourceLabelValue = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 10) / 10;
  return rounded < 0 ? 0 : rounded;
};

// ---------------------------------------------------------------------------
// Trigger helpers
// ---------------------------------------------------------------------------

export const parseTriggerChance = (raw?: string): number | null => {
  const trimmed = (raw ?? '').trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === '*' || trimmed === 'trigger' || trimmed === 'fire') {
    return 1;
  }
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (!match) return null;
  const pct = parseFloat(match[1]);
  if (!Number.isFinite(pct)) return null;
  const clamped = Math.min(Math.max(pct, 0), 100);
  return clamped / 100;
};

export const shouldActivateTrigger = (raw?: string): boolean => {
  const chance = parseTriggerChance(raw);
  if (chance === null) return false;
  if (chance >= 1) return true;
  return random() < chance;
};

// ---------------------------------------------------------------------------
// Multiplicand / multiply helpers
// ---------------------------------------------------------------------------

export const parseMultiplicandDelta = (
  rawLabel: string,
  startElement: GraphElement | undefined,
  connection: GraphElement
): number | null => {
  const match = rawLabel.trim().match(MULTIPLICAND_LABEL_REGEX);
  if (!match || !startElement) return null;
  const sign = match[1] === '-' ? -1 : 1;
  const token = match[2].toLowerCase();
  const currentValue = getElementValue(startElement);
  const lastValue = connection.multiplicandLastSourceValue;
  connection.multiplicandLastSourceValue = currentValue;
  if (typeof lastValue !== 'number') return 0;
  const delta = currentValue - lastValue;
  if (delta <= 0) return 0;
  const perIncrement =
    token === 'x'
      ? currentValue
      : Number.isFinite(parseFloat(token))
        ? parseFloat(token)
        : 0;
  return sign * delta * perIncrement;
};

export const parseMultiplyExpression = (rawLabel: string) => {
  const match = rawLabel.trim().match(MULTIPLY_EXPRESSION_REGEX);
  if (!match) return null;
  return { left: match[1], right: match[2] };
};

export function getBaseInputAmountFromMultiplyLabel(
  label?: string
): number | null {
  const s = (label ?? '').trim();
  if (!s.includes('*')) return null;
  const expr = parseMultiplyExpression(s);
  if (!expr) return null;
  const rightNum = parseFloat(expr.right);
  if (Number.isFinite(rightNum) && rightNum > 0) return rightNum;
  return 1;
}

// ---------------------------------------------------------------------------
// Dynamic resource label evaluation
// ---------------------------------------------------------------------------

export function evaluateDynamicResourceLabel(
  rawLabel: string,
  startElement?: GraphElement
): { matched: boolean; delta: number } {
  const normalized = rawLabel.trim().toLowerCase();
  if (!normalized) {
    return { matched: false, delta: 0 };
  }

  if (startElement) {
    const amountMatch = normalized.match(/^([+-])\s*x(?:\s*amount)?$/);
    if (amountMatch) {
      const sign = amountMatch[1] === '-' ? -1 : 1;
      const value = getElementValue(startElement);
      return { matched: true, delta: sign * value };
    }

    const xFractionMatch = normalized.match(/^([+-])\s*x\s*\/\s*(\d+)$/);
    if (xFractionMatch) {
      const sign = xFractionMatch[1] === '-' ? -1 : 1;
      const denominator = parseInt(xFractionMatch[2], 10);
      if (denominator > 0) {
        const value = getElementValue(startElement);
        return {
          matched: true,
          delta: sign * Math.floor(value / denominator),
        };
      }
      return { matched: true, delta: 0 };
    }
  }

  const numericFractionMatch = normalized.match(
    /^([+-])\s*(\d+)\s*\/\s*(\d+)$/
  );
  if (numericFractionMatch) {
    const sign = numericFractionMatch[1] === '-' ? -1 : 1;
    const numerator = parseInt(numericFractionMatch[2], 10);
    const denominator = parseInt(numericFractionMatch[3], 10);
    if (denominator > 0) {
      if (startElement) {
        const value = getElementValue(startElement);
        return {
          matched: true,
          delta: sign * Math.floor((value * numerator) / denominator),
        };
      }
      return {
        matched: true,
        delta: sign * Math.floor(numerator / denominator),
      };
    }
    return { matched: true, delta: 0 };
  }

  const numericMatch = normalized.match(/^([+-])\s*(\d+(?:\.\d+)?)$/);
  if (numericMatch) {
    const sign = numericMatch[1] === '-' ? -1 : 1;
    const magnitude = parseFloat(numericMatch[2]);
    if (!Number.isNaN(magnitude)) {
      if (startElement) {
        const value = getElementValue(startElement);
        return { matched: true, delta: sign * magnitude * value };
      }
      return { matched: true, delta: sign * magnitude };
    }
    return { matched: true, delta: 0 };
  }

  return { matched: false, delta: 0 };
}

// ---------------------------------------------------------------------------
// applyDynamicResourceLabels
// ---------------------------------------------------------------------------

export function applyDynamicResourceLabelsMutable(
  elementsList: GraphElement[]
): void {
  if (!elementsList.length) return;

  const elementMap = new Map<number, GraphElement>(
    elementsList.map(el => [el.id, el])
  );

  const stateConnections = elementsList.filter(
    el =>
      el.type === 'State Connection' &&
      el.connectedToStart != null &&
      el.connectedToEnd != null
  );

  if (stateConnections.length === 0) return;

  for (const resource of elementsList) {
    if (!isResourceLikeConnection(resource)) continue;

    const related = stateConnections.filter(
      conn => conn.connectedToEnd === resource.id
    );
    if (related.length === 0) continue;

    let multiplicandDelta = 0;
    for (const conn of related) {
      const startElement = conn.connectedToStart
        ? elementMap.get(conn.connectedToStart)
        : undefined;
      const delta = parseMultiplicandDelta(conn.text ?? '', startElement, conn);
      if (delta != null) {
        multiplicandDelta += delta;
      }
    }

    if (multiplicandDelta !== 0) {
      const expr = parseMultiplyExpression(resource.text ?? '');
      if (expr) {
        const parsedLeft = parseFloat(expr.left);
        const base = Number.isFinite(parsedLeft)
          ? parsedLeft
          : (resource.multiplicandValue ?? 1);
        const nextValue = base + multiplicandDelta;
        resource.multiplicandValue = nextValue;
        resource.text = `${nextValue}*${expr.right}`;
      }
    }

    const currentText = (resource.text ?? '').trim();
    const multiplyExpr = parseMultiplyExpression(currentText);
    if (multiplyExpr) {
      continue;
    }

    const fractionMatch = currentText.match(/^\s*(-?\d+)\s*\/\s*(\d+)\s*$/);
    const fractionNum = fractionMatch ? parseInt(fractionMatch[1], 10) : null;
    const fractionDen = fractionMatch ? parseInt(fractionMatch[2], 10) : null;
    const hasFraction =
      fractionMatch != null &&
      fractionNum != null &&
      fractionDen != null &&
      !Number.isNaN(fractionNum) &&
      !Number.isNaN(fractionDen) &&
      fractionDen > 0;

    const numeric = hasFraction
      ? fractionNum! / fractionDen!
      : parseFloat(currentText);
    const hasNumeric = !Number.isNaN(numeric);
    const lastDelta = resource.dynamicLabelLastDelta ?? 0;

    if (typeof resource.dynamicLabelBase === 'number') {
      if (hasNumeric) {
        const expected = resource.dynamicLabelBase + lastDelta;
        if (Math.abs(numeric - expected) > RESOURCE_LABEL_EPSILON) {
          resource.dynamicLabelBase = numeric;
          resource.dynamicLabelLastDelta = 0;
          if (hasFraction) {
            resource.dynamicLabelFractionNum = fractionNum ?? undefined;
            resource.dynamicLabelFractionDen = fractionDen ?? undefined;
          } else {
            resource.dynamicLabelFractionNum = undefined;
            resource.dynamicLabelFractionDen = undefined;
          }
        }
      } else {
        resource.dynamicLabelBase = 0;
        resource.dynamicLabelLastDelta = 0;
        resource.dynamicLabelFractionNum = undefined;
        resource.dynamicLabelFractionDen = undefined;
      }
    } else {
      resource.dynamicLabelBase = hasNumeric ? numeric : 0;
      resource.dynamicLabelLastDelta = 0;
      if (hasFraction) {
        resource.dynamicLabelFractionNum = fractionNum ?? undefined;
        resource.dynamicLabelFractionDen = fractionDen ?? undefined;
      } else {
        resource.dynamicLabelFractionNum = undefined;
        resource.dynamicLabelFractionDen = undefined;
      }
    }

    const base = resource.dynamicLabelBase ?? 0;
    const baseFractionNum = resource.dynamicLabelFractionNum;
    const baseFractionDen = resource.dynamicLabelFractionDen;

    let totalDelta = 0;
    let hasDynamicMatch = false;
    let hasChangeBasedMatch = false;
    let hasAbsoluteMatch = false;

    for (const conn of related) {
      const startElement = conn.connectedToStart
        ? elementMap.get(conn.connectedToStart)
        : undefined;

      const rawLabel = (conn.text ?? '').trim();
      const lowerLabel = rawLabel.toLowerCase();
      const isConstantNumeric =
        !!rawLabel &&
        !lowerLabel.includes('x') &&
        !lowerLabel.includes('*') &&
        /^([+-])?\s*\d+(?:\.\d+)?\s*(?:\/\s*\d+)?\s*$/.test(rawLabel);

      if (isConstantNumeric && startElement) {
        const currentStartValue = getElementValue(startElement);
        const lastStartValue =
          typeof conn.lastStartValue === 'number'
            ? conn.lastStartValue
            : undefined;

        if (lastStartValue == null) {
          conn.lastStartValue = currentStartValue;
          continue;
        }

        const change = currentStartValue - lastStartValue;
        conn.lastStartValue = currentStartValue;
        if (change === 0) continue;

        const { matched, delta } = evaluateDynamicResourceLabel(rawLabel);
        if (matched && delta !== 0) {
          totalDelta += delta * change;
          hasDynamicMatch = true;
          hasChangeBasedMatch = true;
        }
        continue;
      }

      const { matched, delta } = evaluateDynamicResourceLabel(
        rawLabel,
        startElement
      );
      if (matched) {
        totalDelta += delta;
        hasDynamicMatch = true;
        hasAbsoluteMatch = true;
      }
    }

    if (!hasDynamicMatch) continue;

    const shouldAccumulateChangeOnly = hasChangeBasedMatch && !hasAbsoluteMatch;

    if (baseFractionNum != null && baseFractionDen != null) {
      if (shouldAccumulateChangeOnly) {
        const prevNum =
          typeof resource.dynamicLabelFractionNum === 'number'
            ? resource.dynamicLabelFractionNum
            : baseFractionNum;
        const nextNum = prevNum + totalDelta;
        resource.text = `${nextNum}/${baseFractionDen}`;
        resource.dynamicLabelLastDelta = nextNum / baseFractionDen - base;
        resource.dynamicLabelFractionNum = nextNum;
        resource.dynamicLabelFractionDen = baseFractionDen;
      } else {
        const nextNum = baseFractionNum + totalDelta;
        resource.text = `${nextNum}/${baseFractionDen}`;
        resource.dynamicLabelLastDelta = nextNum / baseFractionDen - base;
        resource.dynamicLabelFractionNum = nextNum;
        resource.dynamicLabelFractionDen = baseFractionDen;
      }
    } else {
      if (shouldAccumulateChangeOnly) {
        const prevDelta = resource.dynamicLabelLastDelta ?? 0;
        const finalValue = sanitizeResourceLabelValue(
          base + prevDelta + totalDelta
        );
        resource.text = String(finalValue);
        resource.dynamicLabelLastDelta = finalValue - base;
      } else {
        const finalValue = sanitizeResourceLabelValue(base + totalDelta);
        resource.text = String(finalValue);
        resource.dynamicLabelLastDelta = finalValue - base;
      }
    }
  }
}

export function applyDynamicResourceLabels(
  elementsList: GraphElement[]
): GraphElement[] {
  const clonedElements = elementsList.map(el => ({ ...el }));
  applyDynamicResourceLabelsMutable(clonedElements);
  return clonedElements;
}

// ---------------------------------------------------------------------------
// Transfer recording
// ---------------------------------------------------------------------------

export const recordTransfer = (
  transfers: ResourceTransfer[] | undefined,
  conn: GraphElement | undefined,
  units: number,
  sourceElement?: GraphElement
): void => {
  if (!transfers || !conn || conn.type !== 'Resource Connection') return;
  if (units <= 0) return;

  let tokenColor = normalizeColor(conn.color);

  if (sourceElement && sourceElement.resources) {
    const resourceColorStr = sourceElement.resources.trim();
    if (resourceColorStr) {
      const resourceColor = normalizeColor(resourceColorStr);
      if (
        resourceColor &&
        resourceColor !== '#000000' &&
        resourceColor !== '#000' &&
        resourceColor.toLowerCase() !== 'black'
      ) {
        tokenColor = resourceColor;
      }
    }
  }

  transfers.push({
    connectionId: conn.id,
    units,
    color: tokenColor,
  });
};

// ---------------------------------------------------------------------------
// Fractional / decimal dispatch
// ---------------------------------------------------------------------------

export function handleDecimalResourceDispatch(
  connection: GraphElement,
  labelValue: number,
  fractionalDispatchMap: Map<number, FractionalDispatchState>,
  currentTick: number
): number {
  if (labelValue >= 1) {
    return labelValue;
  }

  if (labelValue <= 0) return 0;

  const connectionId = connection.id;
  let state = fractionalDispatchMap.get(connectionId);

  if (!state) {
    state = {
      connectionId,
      accumulator: 0,
      lastTick: currentTick,
    };
    fractionalDispatchMap.set(connectionId, state);
  }

  state.accumulator += labelValue;
  state.lastTick = currentTick;

  const resourcesToDispatch = Math.floor(state.accumulator);
  if (resourcesToDispatch > 0) {
    state.accumulator -= resourcesToDispatch;
    return resourcesToDispatch;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Random
// ---------------------------------------------------------------------------

export const randInt = (min: number, max: number) =>
  Math.floor(random() * (max - min + 1)) + min;

// ---------------------------------------------------------------------------
// Arithmetic expression parser
// ---------------------------------------------------------------------------

export function evaluateArithmeticExpression(raw: string): number | null {
  const expr = raw.replace(/\s+/g, '');
  if (!expr) return null;

  type Token =
    | { type: 'num'; value: number }
    | { type: 'op'; value: '+' | '-' | '*' | '/' }
    | { type: 'lparen' }
    | { type: 'rparen' };

  const tokens: Token[] = [];
  let i = 0;

  const numberRe = /^(?:\d+\.?\d*|\.\d+)/;

  while (i < expr.length) {
    const ch = expr[i];
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    const match = expr.slice(i).match(numberRe);
    if (!match) return null;
    const value = parseFloat(match[0]);
    if (!Number.isFinite(value)) return null;
    tokens.push({ type: 'num', value });
    i += match[0].length;
  }

  let idx = 0;

  const parseFactor = (): number | null => {
    const token = tokens[idx];
    if (!token) return null;

    if (token.type === 'op' && (token.value === '+' || token.value === '-')) {
      idx += 1;
      const inner = parseFactor();
      if (inner == null) return null;
      return token.value === '-' ? -inner : inner;
    }

    if (token.type === 'lparen') {
      idx += 1;
      const inner = parseExpr();
      if (inner == null) return null;
      if (tokens[idx]?.type !== 'rparen') return null;
      idx += 1;
      return inner;
    }

    if (token.type === 'num') {
      idx += 1;
      return token.value;
    }

    return null;
  };

  const parseTerm = (): number | null => {
    let left = parseFactor();
    if (left == null) return null;

    while (true) {
      const token = tokens[idx];
      if (
        !token ||
        token.type !== 'op' ||
        (token.value !== '*' && token.value !== '/')
      ) {
        break;
      }
      idx += 1;
      const right = parseFactor();
      if (right == null) return null;
      if (token.value === '/') {
        if (right === 0) return null;
        left = left / right;
      } else {
        left = left * right;
      }
    }

    return left;
  };

  const parseExpr = (): number | null => {
    let left = parseTerm();
    if (left == null) return null;

    while (true) {
      const token = tokens[idx];
      if (
        !token ||
        token.type !== 'op' ||
        (token.value !== '+' && token.value !== '-')
      ) {
        break;
      }
      idx += 1;
      const right = parseTerm();
      if (right == null) return null;
      left = token.value === '+' ? left + right : left - right;
    }

    return left;
  };

  const result = parseExpr();
  if (result == null) return null;
  if (idx !== tokens.length) return null;
  if (!Number.isFinite(result)) return null;
  return result;
}

// ---------------------------------------------------------------------------
// Connection label parsing
// ---------------------------------------------------------------------------

export function parseConnectionLabel(label?: string): number {
  const s = (label ?? '').trim();
  if (!s) return 1;

  const rangeMatch = s.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max)) {
      return randInt(
        Math.floor(Math.min(min, max)),
        Math.floor(Math.max(min, max))
      );
    }
  }

  const fractionMatch = s.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    if (!isNaN(num) && !isNaN(den) && den > 0) {
      return num / den;
    }
  }

  const multiplyExpr = parseMultiplyExpression(s);
  if (multiplyExpr) {
    const leftNum = parseFloat(multiplyExpr.left);
    const rightNum = parseFloat(multiplyExpr.right);
    const leftNumeric = Number.isFinite(leftNum);
    const rightNumeric = Number.isFinite(rightNum);
    if (leftNumeric && rightNumeric) return leftNum * rightNum;
    if (leftNumeric) return leftNum;
    if (rightNumeric) return rightNum;
    return 1;
  }

  const arithmetic = evaluateArithmeticExpression(s);
  if (arithmetic != null) return arithmetic;

  const num = parseFloat(s);
  if (!isNaN(num)) return num;

  return 1;
}

export function isTriggerOutput(label?: string): boolean {
  return (label ?? '').trim().includes('*');
}

// ---------------------------------------------------------------------------
// Label classification / condition parsing
// ---------------------------------------------------------------------------

export function classifyLabel(raw?: string): LabelKind {
  const s0 = (raw ?? '').trim();
  if (!s0) return 'empty';
  if (s0.toLowerCase() === 'else') return 'else';
  const s = s0.replace(/[–—]/g, '-');

  if (/^[+-]?\d+\s*%$/.test(s)) return 'prob';
  if (/^[+-]?\d+(\.\d+)?$/.test(s)) return 'prob';
  if (/^(==|!=|>=|<=|>|<)\s*-?\d+(\.\d+)?$/.test(s)) return 'cond';
  if (/^-?\d+(\.\d+)?\s*-\s*-?\d+(\.\d+)?$/.test(s)) return 'interval';
  return 'invalid';
}

export function parseInterval(raw: string): [number, number] | null {
  const norm = raw.trim().replace(/[–—]/g, '-');
  const m = norm.match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  return a <= b ? [a, b] : [b, a];
}

export function parseCond(raw: string): ((v: number) => boolean) | null {
  const m = raw.trim().match(/^(==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const op = m[1];
  const rhs = parseFloat(m[2]);
  return (v: number) => {
    switch (op) {
      case '==':
        return v === rhs;
      case '!=':
        return v !== rhs;
      case '>=':
        return v >= rhs;
      case '<=':
        return v <= rhs;
      case '>':
        return v > rhs;
      case '<':
        return v < rhs;
      default:
        return false;
    }
  };
}

// ---------------------------------------------------------------------------
// Gate helpers
// ---------------------------------------------------------------------------

export function getIntervalWrapMax(outputs: GraphElement[]): number | null {
  let hi = -Infinity;
  for (const o of outputs) {
    if (!o.text) continue;
    if (classifyLabel(o.text) === 'interval') {
      const rng = parseInterval(o.text);
      if (rng) hi = Math.max(hi, rng[1]);
    }
  }
  return isFinite(hi) ? hi : null;
}

export function getDiceSides(
  gate: GraphElement,
  outputs: GraphElement[]
): number {
  const t = (gate.text ?? '').trim().toLowerCase();
  const m1 = t.match(/^d\s*(\d+)$/);
  const m2 = t.match(/^(\d+)\s*d\s*(\d+)$/);
  if (m1) return Math.max(2, parseInt(m1[1], 10));
  if (m2) return Math.max(2, parseInt(m2[2], 10));
  const wrap = getIntervalWrapMax(outputs);
  if (wrap && wrap >= 2) return wrap;
  return 6;
}

/**
 * How many dice a `dice` gate rolls, from a label like `2D6`.
 *
 * Plain `D6` and an unlabelled gate roll one die. The count used to be parsed
 * and then thrown away, so `2D6` rolled a single six-sided die: a flat 1-6
 * instead of the 2-12 triangular distribution the label promises.
 */
export function getDiceCount(gate: GraphElement): number {
  const t = (gate.text ?? '').trim().toLowerCase();
  const m = t.match(/^(\d+)\s*d\s*\d+$/);
  if (!m) return 1;
  return Math.max(1, parseInt(m[1], 10));
}

export function generateGateValue(
  gate: GraphElement,
  outputs: GraphElement[]
): number {
  if (gate.gateType === 'dice') {
    const sides = getDiceSides(gate, outputs);
    const count = getDiceCount(gate);
    let total = 0;
    for (let i = 0; i < count; i++) total += randInt(1, sides);
    return total;
  }

  const wrapMax = getIntervalWrapMax(outputs);
  const prev = gate.lastGateValue ?? 0;
  const next = prev + 1;

  if (wrapMax && wrapMax >= 1) {
    return ((next - 1) % wrapMax) + 1;
  }
  return next;
}

export function chooseGateOutputs(
  gate: GraphElement,
  outputs: GraphElement[]
): GraphElement[] {
  if (outputs.length === 0) return [];

  const kinds = outputs.map(o => classifyLabel(o.text));
  const hasRealCondition = kinds.some(k => k === 'cond' || k === 'interval');

  if (hasRealCondition) {
    const v = generateGateValue(gate, outputs);
    gate.lastGateValue = v;

    const matches: number[] = [];
    for (let i = 0; i < outputs.length; i++) {
      const o = outputs[i];
      const kind = kinds[i];
      if (!o.text) continue;

      if (kind === 'cond') {
        const fn = parseCond(o.text);
        if (fn && fn(v)) matches.push(i);
      } else if (kind === 'interval') {
        const pair = parseInterval(o.text);
        if (pair && v >= pair[0] && v <= pair[1]) matches.push(i);
      }
    }

    if (matches.length === 0) {
      const elseIdx = kinds.findIndex(k => k === 'else');
      return elseIdx >= 0 ? [outputs[elseIdx]] : [];
    }

    return matches.map(i => outputs[i]);
  }

  const isPercent = outputs.some(
    (o, i) => kinds[i] === 'prob' && /%$/.test((o.text ?? '').trim())
  );
  const elseIdx = kinds.findIndex(k => k === 'else');

  if (isPercent) {
    let sumPercent = 0;
    const weights = outputs.map((o, i) => {
      const s = (o.text ?? '').trim();
      if (kinds[i] === 'prob' && /%$/.test(s)) {
        const w = Math.max(0, parseInt(s, 10) || 0);
        sumPercent += w;
        return w;
      }
      return 0;
    });

    if (elseIdx >= 0) {
      const rem = Math.max(0, 100 - sumPercent);
      weights[elseIdx] = rem;
      sumPercent += rem;
    }

    if (sumPercent <= 0) return elseIdx >= 0 ? [outputs[elseIdx]] : [];

    let r = random() * sumPercent;
    for (let i = 0; i < outputs.length; i++) {
      r -= weights[i];
      if (r <= 0 && weights[i] > 0) return [outputs[i]];
    }
    return [outputs[outputs.length - 1]];
  }

  const weights = outputs.map((o, i) => {
    const s = (o.text ?? '').trim();
    if (kinds[i] === 'prob' && !/%$/.test(s))
      return Math.max(0, parseFloat(s) || 0);
    if (kinds[i] === 'empty') return 1;
    return 0;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return elseIdx >= 0 ? [outputs[elseIdx]] : [];

  let r = random() * total;
  for (let i = 0; i < outputs.length; i++) {
    r -= weights[i];
    if (r <= 0 && weights[i] > 0) return [outputs[i]];
  }
  return [outputs[outputs.length - 1]];
}
