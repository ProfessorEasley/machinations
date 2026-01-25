import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { RegisterExpression } from '../utils/RegisterExpression';
import './Canvas.css';

interface CanvasProps {
  isRunning: boolean;
  selectedTool: string;
  elements?: GraphElement[];
  selectedElementIds?: number[];
  onElementsChange?: (elements: GraphElement[]) => void;
  onSelectionChange?: (selectedIds: number[]) => void;
  //externalElementUpdate?: {
  //elementId: number;
  //updates: Partial<GraphElement>;
  //} | null;
  onElementUpdate?: (elementId: number, updates: Partial<GraphElement>) => void;
  onElementSelection?: (element: GraphElement | null) => void;
  onToolChange?: (tool: string) => void;
  externalElementUpdate?: {
    elementId: number;
    updates: Partial<GraphElement>;
  } | null;
  toolProperties?: {
    textLabel: { text: string; color: string };
    group: { text: string; color: string };
    pool: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      resources: string;
      number: number;
      max: number;
      displayLimit: number;
    };
    gate: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      type: 'deterministic' | 'dice' | 'skill' | 'multiplayer' | 'strategy';
    };
    resourceConnection: {
      color: string;
      thickness: number;
      text: string;
      minValue: number;
      maxValue: number;
    };
    stateConnection: {
      color: string;
      thickness: number;
      text: string;
      minValue: number;
      maxValue: number;
    };
    source: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      resources: string;
    };
    convertor: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      resources: string;
    };
    trader: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
      resources: string;
    };
    drain: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
    };
    delay: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      queue: boolean;
    };
    register: {
      color: string;
      thickness: number;
      formula: string;
      minValue: number;
      maxValue: number;
      interactive: boolean;
      startingValue: number;
      step: number;
    };
    endCondition: {
      color: string;
      thickness: number;
      text: string;
      actions: number;
      pullMode: 'pull any' | 'pull all' | 'push any' | 'push all';
    };
    artificialIntelligence: {
      color: string;
      thickness: number;
      text: string;
      activation: 'passive' | 'interactive' | 'automatic' | 'onstart';
      actions: number;
      script: string;
    };
  };
}

type GraphElementType =
  | 'Text Label'
  | 'Group'
  | 'Chart'
  | 'Pool'
  | 'Gate'
  | 'Resource Connection'
  | 'State Connection'
  | 'Source'
  | 'Drain'
  | 'Convertor'
  | 'Trader'
  | 'Delay'
  | 'Register'
  | 'End Condition'
  | 'Artifical Intelligence';

interface GraphElement {
  id: number;
  type: GraphElementType;
  x: number;
  y: number;
  text?: string;
  width?: number;
  height?: number;
  color?: string;
  thickness?: number;
  activation?: 'passive' | 'interactive' | 'automatic' | 'onstart';
  pullMode?: 'pull any' | 'pull all' | 'push any' | 'push all';
  gateType?: 'deterministic' | 'dice' | 'skill' | 'multiplayer' | 'strategy';
  triggerCount?: number;
  lastGateValue?: number;
  resources?: string;
  number?: number;
  max?: number;
  displayLimit?: number;

  actions?: number;

  // Convertor-specific properties
  inputResources?: Record<string, number>; // Resource type -> amount stored
  outputResources?: Record<string, number>; // Resource type -> amount to produce
  conversionRate?: Record<string, number>; // Input resource -> output resource conversion rate

  // Trader-specific properties
  traderInputs?: Record<string, number>; // Resource type -> amount required for trade
  traderOutputs?: Record<string, number>; // Resource type -> amount provided in trade
  isIncompleteTrader?: boolean; // True if trader has < 2 inputs or < 2 outputs

  // Register-specific properties
  formula?: string;
  minValue?: number;
  maxValue?: number;
  interactive?: boolean | string;
  startingValue?: number;
  step?: number;
  currentValue?: number;

  // endCondition-specific properties
  isBlinking?: boolean;

  // For connection elements
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // Connection tracking
  connectedToStart?: number; // ID of element this connection starts from
  connectedToEnd?: number; // ID of element this connection ends at
  points?: { x: number; y: number }[];
  dynamicLabelBase?: number;
  dynamicLabelLastDelta?: number;
  conditionSatisfied?: boolean;
  hasUnsatisfiedCondition?: boolean;
  currentPoints?: number;
  hasStarted?: boolean;
  inhibited?: boolean;
}

const isResourceLikeConnection = (element: GraphElement) =>
  element.type === 'Resource Connection';

const getResourcePolylinePoints = (resource: GraphElement) => {
  const startPoint = {
    x: resource.startX ?? resource.x,
    y: resource.startY ?? resource.y,
  };
  const endPoint = {
    x: resource.endX ?? resource.x,
    y: resource.endY ?? resource.y,
  };
  return [startPoint, ...(resource.points ?? []), endPoint];
};

const getClosestPointOnPolyline = (
  point: { x: number; y: number },
  polyline: { x: number; y: number }[]
) => {
  let closestPoint = polyline[0];
  let closestDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segmentStart = polyline[i];
    const segmentEnd = polyline[i + 1];

    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;

    const t =
      ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) /
      lengthSquared;

    const clampedT = Math.max(0, Math.min(1, t));
    const projection = {
      x: segmentStart.x + clampedT * dx,
      y: segmentStart.y + clampedT * dy,
    };

    const distance = Math.hypot(point.x - projection.x, point.y - projection.y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPoint = projection;
    }
  }

  return { point: closestPoint, distance: closestDistance };
};

const RESOURCE_LABEL_EPSILON = 1e-6;

const parseTriggerChance = (raw?: string): number | null => {
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

const shouldActivateTrigger = (raw?: string): boolean => {
  const chance = parseTriggerChance(raw);
  if (chance === null) return false;
  if (chance >= 1) return true;
  return Math.random() < chance;
};

function getElementValue(element: GraphElement | undefined): number {
  if (!element) {
    return 0;
  }

  switch (element.type) {
    case 'Pool':
      if (
        element.currentPoints !== undefined &&
        element.currentPoints !== null
      ) {
        return element.currentPoints;
      }
      return typeof element.number === 'string'
        ? parseInt(element.number, 10) || 0
        : element.number || 0;

    case 'Register':
      return element.currentValue || 0;

    case 'Source':
      return typeof element.number === 'string'
        ? parseInt(element.number, 10) || 0
        : element.number || 0;

    default:
      return 0;
  }
}

const sanitizeResourceLabelValue = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 10) / 10; // keep at most one decimal
  return rounded < 0 ? 0 : rounded;
};

function evaluateDynamicResourceLabel(
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

function applyDynamicResourceLabelsMutable(elementsList: GraphElement[]): void {
  if (!elementsList.length) return;

  const elementMap = new Map<number, GraphElement>(
    elementsList.map(el => [el.id, el])
  );

  const stateConnections = elementsList.filter(
    el =>
      el.type === 'State Connection' && el.connectedToStart && el.connectedToEnd
  );

  if (stateConnections.length === 0) return;

  for (const resource of elementsList) {
    if (!isResourceLikeConnection(resource)) continue;

    const related = stateConnections.filter(
      conn => conn.connectedToEnd === resource.id
    );
    if (related.length === 0) continue;

    const currentText = (resource.text ?? '').trim();
    const numeric = parseFloat(currentText);
    const hasNumeric = !Number.isNaN(numeric);
    const lastDelta = resource.dynamicLabelLastDelta ?? 0;

    if (typeof resource.dynamicLabelBase === 'number') {
      if (hasNumeric) {
        const expected = resource.dynamicLabelBase + lastDelta;
        if (Math.abs(numeric - expected) > RESOURCE_LABEL_EPSILON) {
          resource.dynamicLabelBase = numeric;
          resource.dynamicLabelLastDelta = 0;
        }
      } else {
        resource.dynamicLabelBase = 0;
        resource.dynamicLabelLastDelta = 0;
      }
    } else {
      resource.dynamicLabelBase = hasNumeric ? numeric : 0;
      resource.dynamicLabelLastDelta = 0;
    }

    const base = resource.dynamicLabelBase ?? 0;

    let totalDelta = 0;
    let hasDynamicMatch = false;

    for (const conn of related) {
      const startElement = conn.connectedToStart
        ? elementMap.get(conn.connectedToStart)
        : undefined;
      const { matched, delta } = evaluateDynamicResourceLabel(
        conn.text ?? '',
        startElement
      );
      if (matched) {
        totalDelta += delta;
        hasDynamicMatch = true;
      }
    }

    if (!hasDynamicMatch) continue;

    const finalValue = sanitizeResourceLabelValue(base + totalDelta);
    resource.text = String(finalValue);
    resource.dynamicLabelLastDelta = finalValue - base;
  }
}

function applyDynamicResourceLabels(
  elementsList: GraphElement[]
): GraphElement[] {
  const clonedElements = elementsList.map(el => ({ ...el }));
  applyDynamicResourceLabelsMutable(clonedElements);
  return clonedElements;
}

const Canvas: React.FC<CanvasProps> = ({
  isRunning,
  selectedTool,
  elements: externalElements,
  selectedElementIds: externalSelectedIds,
  onElementsChange,
  onSelectionChange,

  onElementSelection,
  onToolChange,
  //externalElementUpdate,
  toolProperties,
}) => {
  const [internalElements, setInternalElements] = useState<GraphElement[]>([]);
  const [internalSelectedIds, setInternalSelectedIds] = useState<number[]>([]);

  const elements = externalElements ?? internalElements;
  const selectedId = externalSelectedIds ?? internalSelectedIds;

  // const setElements = useCallback(
  //   (
  //     newElements: GraphElement[] | ((prev: GraphElement[]) => GraphElement[])
  //   ) => {
  //     const updatedElements =
  //       typeof newElements === 'function' ? newElements(elements) : newElements;

  //     if (onElementsChange) {
  //       onElementsChange(updatedElements);
  //     } else {
  //       setInternalElements(updatedElements);
  //     }
  //   },
  //   [elements, onElementsChange]
  // );

  const setSelectedId = useCallback(
    (newSelection: number[] | ((prev: number[]) => number[])) => {
      const updatedSelection =
        typeof newSelection === 'function'
          ? newSelection(selectedId)
          : newSelection;

      if (onSelectionChange) {
        onSelectionChange(updatedSelection);
      } else {
        setInternalSelectedIds(updatedSelection);
      }
    },
    [selectedId, onSelectionChange]
  );

  const [hasSimulationStarted, setHasSimulationStarted] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null
  );
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggedElements, setDraggedElements] = useState<GraphElement[] | null>(
    null
  );
  const [pasteCount, setPasteCount] = useState(0);

  // Bounding box selection state
  const [isSelectingBox, setIsSelectingBox] = useState(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [boxEnd, setBoxEnd] = useState<{ x: number; y: number } | null>(null);
  const [mouseDownOnCanvas, setMouseDownOnCanvas] = useState(false);
  const [justCompletedBoxSelection, setJustCompletedBoxSelection] =
    useState(false);

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizingId, setResizingId] = useState<number | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Connection creation state
  const [isCreatingConnection, setIsCreatingConnection] = useState(false);
  const [connectionType, setConnectionType] = useState<GraphElementType | null>(
    null
  );
  const [connectionPoints, setConnectionPoints] = useState<
    { x: number; y: number }[]
  >([]);
  const [connectionPreviewPoint, setConnectionPreviewPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  //setConnectionStart
  // const [connectionStart, setConnectionStart] = useState<{
  //   x: number;
  //   y: number;
  // } | null>(null);
  // const [connectionEnd, setConnectionEnd] = useState<{
  //   x: number;
  //   y: number;
  // } | null>(null);
  // const [connectionType, setConnectionType] = useState<GraphElementType | null>(
  //   null
  // );

  const [gameEnded, setGameEnded] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ---------- Gate helpers ----------
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  // ---------- Label parsing utilities ----------
  /**
   * Parse a connection label to get the resource amount.
   * Supports:
   * - Simple number: "5" -> 5
   * - Random range: "2-5" or "2-8" -> random value in range
   * - Fraction: "1/2" or "3/4" -> random based on probability
   * - Default: empty or invalid -> 1
   */
  function parseConnectionLabel(label?: string): number {
    const s = (label ?? '').trim();
    if (!s) return 1;

    // Check for random range (e.g., "2-5")
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

    // Check for fraction (e.g., "1/2", "3/4")
    const fractionMatch = s.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const num = parseInt(fractionMatch[1], 10);
      const den = parseInt(fractionMatch[2], 10);
      if (!isNaN(num) && !isNaN(den) && den > 0) {
        // Return num with probability num/den, 0 otherwise
        return Math.random() < num / den ? num : 0;
      }
    }

    // Check for simple number
    const num = parseFloat(s);
    if (!isNaN(num)) {
      return Math.floor(num);
    }

    // Default to 1 if can't parse
    return 1;
  }

  /**
   * Check if a connection label represents a trigger output (marked with "*")
   */
  function isTriggerOutput(label?: string): boolean {
    return (label ?? '').trim().includes('*');
  }

  type LabelKind = 'prob' | 'cond' | 'interval' | 'else' | 'empty' | 'invalid';

  // replace your classifyLabel with this
  function classifyLabel(raw?: string): LabelKind {
    const s0 = (raw ?? '').trim();
    if (!s0) return 'empty';
    if (s0.toLowerCase() === 'else') return 'else';
    const s = s0.replace(/[–—]/g, '-'); // normalize en/em dashes

    if (/^\d+\s*%$/.test(s)) return 'prob'; // "70%"
    if (/^\d+(\.\d+)?$/.test(s)) return 'prob'; // "4"
    if (/^(==|!=|>=|<=|>|<)\s*-?\d+(\.\d+)?$/.test(s)) return 'cond';
    if (/^-?\d+(\.\d+)?\s*-\s*-?\d+(\.\d+)?$/.test(s)) return 'interval';
    return 'invalid';
  }

  // replace your parseInterval with this
  function parseInterval(raw: string): [number, number] | null {
    const norm = raw.trim().replace(/[–—]/g, '-');
    const m = norm.match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const a = parseFloat(m[1]),
      b = parseFloat(m[2]);
    return a <= b ? [a, b] : [b, a]; // inclusive range
  }

  function parseCond(raw: string): ((v: number) => boolean) | null {
    const m = raw.trim().match(/^(==|!=|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const op = m[1],
      rhs = parseFloat(m[2]);
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

  function getIntervalWrapMax(outputs: GraphElement[]): number | null {
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

  const evaluateStateCondition = useCallback(
    (
      connection: GraphElement,
      elementMap: Map<number, GraphElement>
    ): { evaluated: boolean; satisfied: boolean } => {
      if (!connection.connectedToStart) {
        return { evaluated: false, satisfied: false };
      }
      const startEl = elementMap.get(connection.connectedToStart);
      if (!startEl) {
        return { evaluated: false, satisfied: false };
      }
      const labelText = (connection.text ?? '').trim();
      const kind = classifyLabel(labelText);

      if (kind === 'cond') {
        const fn = parseCond(labelText);
        if (fn) {
          const value = getElementValue(startEl);
          return { evaluated: true, satisfied: fn(value) };
        }
      } else if (kind === 'interval') {
        const range = parseInterval(labelText);
        if (range) {
          const value = getElementValue(startEl);
          return {
            evaluated: true,
            satisfied: value >= range[0] && value <= range[1],
          };
        }
      }

      return { evaluated: false, satisfied: false };
    },
    [classifyLabel, parseCond, parseInterval]
  );

  const updateStateConnectionVisualState = useCallback(
    (elementsList: GraphElement[]) => {
      const elementMap = new Map<number, GraphElement>(
        elementsList.map(el => [el.id, el])
      );
      const targetStates = new Map<number, boolean>();

      for (const connection of elementsList) {
        if (
          connection.type !== 'State Connection' ||
          !connection.connectedToStart ||
          !connection.connectedToEnd
        ) {
          if ('hasUnsatisfiedCondition' in connection) {
            connection.hasUnsatisfiedCondition = false;
          }
          continue;
        }
        const { evaluated, satisfied } = evaluateStateCondition(
          connection,
          elementMap
        );

        if (evaluated) {
          connection.conditionSatisfied = satisfied;
          connection.hasUnsatisfiedCondition = !satisfied;
          const prev = targetStates.get(connection.connectedToEnd);
          if (prev === undefined) {
            targetStates.set(connection.connectedToEnd, satisfied);
          } else {
            targetStates.set(connection.connectedToEnd, prev && satisfied);
          }
        } else {
          connection.hasUnsatisfiedCondition = false;
          connection.conditionSatisfied = undefined;
        }
      }

      targetStates.forEach((allSatisfied, targetId) => {
        const target = elementMap.get(targetId);
        if (target) {
          target.hasUnsatisfiedCondition = !allSatisfied;
        }
      });
    },
    [evaluateStateCondition]
  );

  const setElements = useCallback(
    (
      newElements: GraphElement[] | ((prev: GraphElement[]) => GraphElement[])
    ) => {
      const updatedElements =
        typeof newElements === 'function' ? newElements(elements) : newElements;

      const processedElements = applyDynamicResourceLabels(updatedElements);
      updateStateConnectionVisualState(processedElements);

      if (onElementsChange) {
        onElementsChange(processedElements);
      } else {
        setInternalElements(processedElements);
      }
    },
    [elements, onElementsChange, updateStateConnectionVisualState]
  );

  // Optional: allow "d6", "6", or "1d6" in gate.text. Fallback to 6.
  function getDiceSides(gate: GraphElement, outputs: GraphElement[]): number {
    const t = (gate.text ?? '').trim().toLowerCase();
    const m1 = t.match(/^d\s*(\d+)$/);
    const m2 = t.match(/^(\d+)\s*d\s*(\d+)$/);
    if (m1) return Math.max(2, parseInt(m1[1], 10));
    if (m2) return Math.max(2, parseInt(m2[2], 10));
    const wrap = getIntervalWrapMax(outputs);
    if (wrap && wrap >= 2) return wrap; // sensible default from labels
    return 6; // final fallback
  }

  // change signature to accept outputs
  function generateGateValue(
    gate: GraphElement,
    outputs: GraphElement[]
  ): number {
    // Random (dice) mode
    if (gate.gateType === 'dice') {
      const sides = getDiceSides(gate, outputs);
      return randInt(1, sides); // 1..sides
    }

    // Deterministic: cycle and wrap at the highest interval upper bound (if any)
    const wrapMax = getIntervalWrapMax(outputs);
    const prev = gate.lastGateValue ?? 0;
    const next = prev + 1;

    if (wrapMax && wrapMax >= 1) {
      const wrapped = ((next - 1) % wrapMax) + 1; // 1..wrapMax
      return wrapped;
    }
    return next; // no intervals -> monotone counter, no wrap
  }

  /**
   * Choose one output connection given labels.
   * Condition-mode if there is ANY cond/interval label (ELSE ALONE does NOT trigger cond-mode).
   * Otherwise probability-mode:
   *  - If any '%' are present, '%'-labels are used and 'else' gets (100 - sum%).
   *  - If no '%', numeric weights & empty labels (weight 1) are used. 'else' has weight 0 by default.
   */
  function chooseGateOutputs(
    gate: GraphElement,
    outputs: GraphElement[]
  ): GraphElement[] {
    if (outputs.length === 0) return [];

    const kinds = outputs.map(o => classifyLabel(o.text));
    const hasRealCondition = kinds.some(k => k === 'cond' || k === 'interval');

    // ---------- Condition / Interval mode ----------
    if (hasRealCondition) {
      const v = generateGateValue(gate, outputs); // NOTE: uses outputs
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
          const pair = parseInterval(o.text!);
          if (pair && v >= pair[0] && v <= pair[1]) matches.push(i);
        }
      }

      if (matches.length === 0) {
        const elseIdx = kinds.findIndex(k => k === 'else');
        return elseIdx >= 0 ? [outputs[elseIdx]] : [];
      }

      // IMPORTANT: If labels overlap, duplicate to *every* match.
      // (This makes overlaps work even if the gate's pullMode is 'pull any'.)
      if (matches.length > 1) {
        return matches.map(i => outputs[i]);
      }

      // Single match
      return [outputs[matches[0]]];
    }

    // ---------- Probability mode (unchanged: pick ONE) ----------
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

      let r = Math.random() * sumPercent;
      for (let i = 0; i < outputs.length; i++) {
        r -= weights[i];
        if (r <= 0 && weights[i] > 0) return [outputs[i]];
      }
      return [outputs[outputs.length - 1]];
    } else {
      const weights = outputs.map((o, i) => {
        const s = (o.text ?? '').trim();
        if (kinds[i] === 'prob' && !/%$/.test(s))
          return Math.max(0, parseFloat(s) || 0);
        if (kinds[i] === 'empty') return 1;
        return 0; // else/invalid default 0
      });
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) return elseIdx >= 0 ? [outputs[elseIdx]] : [];

      let r = Math.random() * total;
      for (let i = 0; i < outputs.length; i++) {
        r -= weights[i];
        if (r <= 0 && weights[i] > 0) return [outputs[i]];
      }
      return [outputs[outputs.length - 1]];
    }
  }

  /**
   * get current value of an element
   */
  const getElementValue = (element: GraphElement | undefined): number => {
    if (!element) {
      // console.log('⚠️ [getElementValue] Element is undefined');
      return 0;
    }

    //console.log('📈 [getElementValue] Getting value from:', {
    // type: element.type,
    // id: element.id,
    // currentPoints: element.currentPoints,
    // currentValue: element.currentValue,
    // number: element.number,
    // });

    switch (element.type) {
      case 'Pool':
        if (
          element.currentPoints !== undefined &&
          element.currentPoints !== null
        ) {
          return element.currentPoints;
        }
        return typeof element.number === 'string'
          ? parseInt(element.number, 10) || 0
          : element.number || 0;

      case 'Register':
        return element.currentValue || 0;

      case 'Source':
        return typeof element.number === 'string'
          ? parseInt(element.number, 10) || 0
          : element.number || 0;

      default:
        return 0;
    }
  };

  const applyStateConnectionDelta = (
    target: GraphElement,
    delta: number
  ): void => {
    if (!delta || !target) return;

    if (target.type === 'Pool') {
      const max = target.max ?? Infinity;
      const next = (target.currentPoints ?? 0) + delta;
      target.currentPoints =
        delta >= 0 ? Math.min(next, max) : Math.max(0, next);
      return;
    }

    if (target.type === 'Register') {
      const min = target.minValue ?? -Infinity;
      const max = target.maxValue ?? Infinity;
      const next = (target.currentValue ?? 0) + delta;
      target.currentValue = Math.min(Math.max(next, min), max);
      return;
    }
  };

  const runSimulationTick = useCallback(
    (
      elementsToUpdate: GraphElement[],
      activationType: 'automatic' | 'onstart' | 'interactive',
      interactiveElementId?: number
    ): GraphElement[] => {
      const nextElements = JSON.parse(
        JSON.stringify(elementsToUpdate)
      ) as GraphElement[];
      const elementMap = new Map<number, GraphElement>(
        nextElements.map(el => [el.id, el])
      );
      const stateConnectionsByStart = new Map<number, GraphElement[]>();
      for (const connection of nextElements) {
        if (
          connection.type === 'State Connection' &&
          connection.connectedToStart &&
          connection.connectedToEnd
        ) {
          const list = stateConnectionsByStart.get(connection.connectedToStart);
          if (list) {
            list.push(connection);
          } else {
            stateConnectionsByStart.set(connection.connectedToStart, [
              connection,
            ]);
          }
        }
      }

      const triggerFromArrival = (startElementId?: number) => {
        if (!startElementId) return;
        const outgoing = stateConnectionsByStart.get(startElementId);
        if (!outgoing || outgoing.length === 0) return;
        for (const conn of outgoing) {
          if (!shouldActivateTrigger(conn.text)) continue;
          const target = conn.connectedToEnd
            ? elementMap.get(conn.connectedToEnd)
            : undefined;
          if (!target) continue;
          target.triggerCount = (target.triggerCount ?? 0) + 1;
        }
      };

      // PASS 0: initialize check
      if (activationType === 'onstart') {
        // console.log('🔄 [PASS 0] Initializing elements...');
        for (const element of nextElements) {
          if (element.type === 'Pool') {
            if (
              element.currentPoints === undefined ||
              element.currentPoints === null
            ) {
              const startingPoints =
                typeof element.number === 'string'
                  ? parseInt(element.number, 10) || 0
                  : element.number || 0;
              element.currentPoints = startingPoints;
              // console.log('  ✓ Pool initialized:', {
              // id: element.id,
              // currentPoints: element.currentPoints,
              // });
            }
          }

          if (element.type === 'End Condition') {
            element.inhibited = true;
            element.isBlinking = false;
            console.log('🎯 [EndCondition] Initialized:', {
              id: element.id,
              text: element.text,
              inhibited: element.inhibited,
            });
          }
        }
      }

      for (const resetEl of nextElements) {
        if (resetEl.type === 'State Connection') {
          resetEl.conditionSatisfied = undefined;
        }
        if (resetEl.hasUnsatisfiedCondition) {
          resetEl.hasUnsatisfiedCondition = false;
        }
      }

      const targetConditionStates = new Map<number, boolean>();

      // --------- PASS 0.5: process State Connections (conditions & triggers, always on) ---------
      for (const connection of nextElements) {
        if (
          connection.type !== 'State Connection' ||
          !connection.connectedToStart ||
          !connection.connectedToEnd
        ) {
          continue;
        }

        const startEl = elementMap.get(connection.connectedToStart);
        const endEl = elementMap.get(connection.connectedToEnd);
        if (!startEl || !endEl) continue;

        const rawLabel = (connection.text ?? '').trim();

        if (endEl.type === 'Resource Connection') {
          const { matched } = evaluateDynamicResourceLabel(rawLabel, startEl);
          if (matched) {
            continue;
          }
        }

        const { evaluated, satisfied } = evaluateStateCondition(
          connection,
          elementMap
        );

        if (evaluated) {
          connection.conditionSatisfied = satisfied;
          connection.hasUnsatisfiedCondition = !satisfied;
          endEl.inhibited = !satisfied;
          const prev = targetConditionStates.get(endEl.id);
          if (prev === undefined) {
            targetConditionStates.set(endEl.id, satisfied);
          } else {
            targetConditionStates.set(endEl.id, prev && satisfied);
          }
        }

        const labelText = rawLabel;
        const kind = classifyLabel(labelText);

        if (kind === 'cond') {
          const fn = parseCond(labelText);
          if (fn) {
            const value = getElementValue(startEl);
            endEl.inhibited = !fn(value);
          }
        } else if (kind === 'interval') {
          const range = parseInterval(labelText);
          if (range) {
            const value = getElementValue(startEl);
            endEl.inhibited = !(value >= range[0] && value <= range[1]);
          }
        }
        // const percentMatch = rawLabel.match(/^(\d+(?:\.\d+)?)\s*%$/);
        // if (percentMatch) {
        //   const pctRaw = parseFloat(percentMatch[1]);
        //   const pctClamped = Math.min(Math.max(pctRaw, 0), 100);
        //   const probability = pctClamped / 100;
        //   if (Math.random() < probability) {
        //     endEl.triggerCount = (endEl.triggerCount ?? 0) + 1;
        //   }
        //   continue;
        // }

        if (parseTriggerChance(labelText) !== null) {
          continue;
        }

        if (kind === 'prob' || kind === 'empty') {
          const delta = parseConnectionLabel(labelText);
          applyStateConnectionDelta(endEl, delta);
        }
      }

      updateStateConnectionVisualState(nextElements);
      applyDynamicResourceLabelsMutable(nextElements);

      // --------- PASS 1: generic connections (but SKIP Gate outputs) ---------
      for (const connection of nextElements) {
        if (
          !isResourceLikeConnection(connection) ||
          !connection.connectedToStart ||
          !connection.connectedToEnd
        ) {
          continue;
        }
        const startElement = elementMap.get(connection.connectedToStart);
        const endElement = elementMap.get(connection.connectedToEnd);
        if (!startElement || !endElement) continue;

        // NEW: do not let generic logic touch Gate outputs; Gate handles its own routing.
        if (startElement.type === 'Gate') continue;

        // --- Safety Check for Transfer Amount ---
        let transferAmount = parseInt(connection.text || '0', 10);
        if (isNaN(transferAmount)) transferAmount = 0;
        if (transferAmount === 0) continue;

        // Case 1: Source -> Pool (handled in PASS 2.5 for proper label parsing)
        // Case 2: Pool -> Drain (handled in PASS 2.7 for proper label parsing)
      }

      const consumePassiveTrigger = (el: GraphElement) => {
        if ((el.triggerCount ?? 0) > 0) {
          el.triggerCount = (el.triggerCount ?? 0) - 1;
          return true;
        }
        return false;
      };

      // --------- PASS 1.5: process Pools with active firing modes ----------
      for (const pool of nextElements) {
        if (pool.type !== 'Pool') continue;

        // Activation check
        let isTriggerActive = false;
        if (activationType === 'automatic') {
          if (pool.activation === 'automatic') isTriggerActive = true;
        } else if (
          pool.activation === 'passive' &&
          consumePassiveTrigger(pool)
        ) {
          isTriggerActive = true;
        } else if (activationType === 'interactive') {
          if (pool.activation === 'interactive') {
            isTriggerActive =
              !interactiveElementId || pool.id === interactiveElementId;
          }
        } else if (activationType === 'onstart') {
          if (pool.activation === 'onstart' && !pool.hasStarted)
            isTriggerActive = true;
        }
        // Passive pools only fire when triggered externally (not in this pass)

        if (!isTriggerActive) continue;

        const poolPullMode = pool.pullMode || 'pull any';
        const currentResources = pool.currentPoints || 0;

        // Get input connections (connections ending at this pool)
        const inputConns = nextElements
          .filter(
            c => isResourceLikeConnection(c) && c.connectedToEnd === pool.id
          )
          .filter(conn => {
            const startEl = conn.connectedToStart
              ? elementMap.get(conn.connectedToStart)
              : undefined;
            // Sources push resources in their own pass; skip here to avoid double counting.
            return !startEl || startEl.type !== 'Source';
          });

        // Get output connections (connections starting at this pool)
        const outputConns = nextElements.filter(
          c => isResourceLikeConnection(c) && c.connectedToStart === pool.id
        );

        // Handle PULL modes (pull resources from inputs)
        if (poolPullMode === 'pull any' || poolPullMode === 'pull all') {
          if (inputConns.length === 0) continue;

          // Parse required amounts from input connections
          const requiredAmounts: number[] = inputConns.map(conn =>
            parseConnectionLabel(conn.text)
          );

          if (poolPullMode === 'pull all') {
            // Pull all: need all inputs available simultaneously
            const allAvailable = inputConns.every((conn, idx) => {
              const startEl = elementMap.get(conn.connectedToStart!);
              if (!startEl) return false;
              const required = requiredAmounts[idx];
              if (startEl.type === 'Source') return true; // Source is infinite
              if (startEl.type === 'Pool')
                return (startEl.currentPoints ?? 0) >= required;
              return false;
            });

            if (allAvailable) {
              // Consume from all inputs
              inputConns.forEach((conn, idx) => {
                const startEl = elementMap.get(conn.connectedToStart!);
                if (!startEl) return;
                const required = requiredAmounts[idx];
                if (startEl.type === 'Source') {
                  // Source produces, nothing to consume
                } else if (startEl.type === 'Pool') {
                  startEl.currentPoints = Math.max(
                    0,
                    (startEl.currentPoints ?? 0) - required
                  );
                }
                // Add to this pool
                const max = pool.max ?? Infinity;
                pool.currentPoints = Math.min(
                  (pool.currentPoints ?? 0) + required,
                  max
                );
                if (required > 0) triggerFromArrival(pool.id);
              });
            }
          } else {
            // Pull any: attempt to pull from any available input
            for (let idx = 0; idx < inputConns.length; idx++) {
              const conn = inputConns[idx];
              const startEl = elementMap.get(conn.connectedToStart!);
              if (!startEl) continue;
              const required = requiredAmounts[idx];

              let canPull = false;
              if (startEl.type === 'Source') {
                canPull = true;
              } else if (startEl.type === 'Pool') {
                canPull = (startEl.currentPoints ?? 0) >= required;
              }

              if (canPull) {
                if (startEl.type === 'Pool') {
                  startEl.currentPoints = Math.max(
                    0,
                    (startEl.currentPoints ?? 0) - required
                  );
                }
                const max = pool.max ?? Infinity;
                pool.currentPoints = Math.min(
                  (pool.currentPoints ?? 0) + required,
                  max
                );
                if (required > 0) triggerFromArrival(pool.id);
                break; // Only pull from one input in pull any mode
              }
            }
          }
        }
        // Handle PUSH modes (push resources to outputs)
        if (poolPullMode === 'push any' || poolPullMode === 'push all') {
          if (outputConns.length === 0 || currentResources <= 0) continue;

          // Parse amounts for output connections
          const outputAmounts: number[] = outputConns.map(conn =>
            parseConnectionLabel(conn.text)
          );
          const totalOutput = outputAmounts.reduce((sum, amt) => sum + amt, 0);

          if (poolPullMode === 'push all') {
            // Push all: only push if all outputs can accept resources
            const allCanAccept = outputConns.every((conn, idx) => {
              const endEl = elementMap.get(conn.connectedToEnd!);
              if (!endEl) return false;
              const amount = outputAmounts[idx];
              if (endEl.type === 'Drain') return true; // Drain always accepts
              if (endEl.type === 'Pool') {
                const max = endEl.max ?? Infinity;
                return (endEl.currentPoints ?? 0) + amount <= max;
              }
              return false;
            });

            if (allCanAccept && currentResources >= totalOutput) {
              // Push to all outputs
              outputConns.forEach((conn, idx) => {
                const endEl = elementMap.get(conn.connectedToEnd!);
                if (!endEl) return;
                const amount = outputAmounts[idx];
                if (endEl.type === 'Drain') {
                  // Drain consumes, do nothing
                } else if (endEl.type === 'Pool') {
                  const max = endEl.max ?? Infinity;
                  endEl.currentPoints = Math.min(
                    (endEl.currentPoints ?? 0) + amount,
                    max
                  );
                }
                if (amount > 0) triggerFromArrival(endEl.id);
              });
              pool.currentPoints = Math.max(0, currentResources - totalOutput);
            }
          } else {
            // Push any: push maximum possible, evenly distribute if needed
            const available = currentResources;
            if (available > 0 && totalOutput > 0) {
              // Calculate how much we can actually push
              const actualAmount = Math.min(available, totalOutput);

              // Evenly distribute to all outputs
              const perOutput = Math.floor(actualAmount / outputConns.length);
              const remainder = actualAmount % outputConns.length;

              outputConns.forEach((conn, idx) => {
                const endEl = elementMap.get(conn.connectedToEnd!);
                if (!endEl) return;
                const amount = perOutput + (idx < remainder ? 1 : 0);
                if (amount <= 0) return;

                if (endEl.type === 'Drain') {
                  // Drain consumes
                } else if (endEl.type === 'Pool') {
                  const max = endEl.max ?? Infinity;
                  endEl.currentPoints = Math.min(
                    (endEl.currentPoints ?? 0) + amount,
                    max
                  );
                }
                triggerFromArrival(endEl.id);
              });
              pool.currentPoints = Math.max(0, available - actualAmount);
            }
          }
        }

        // Handle PUSH modes (push resources to outputs)
        if (poolPullMode === 'push any' || poolPullMode === 'push all') {
          if (outputConns.length === 0 || currentResources <= 0) continue;

          // Parse amounts for output connections
          const outputAmounts: number[] = outputConns.map(conn =>
            parseConnectionLabel(conn.text)
          );
          const totalOutput = outputAmounts.reduce((sum, amt) => sum + amt, 0);

          if (poolPullMode === 'push all') {
            // Push all: only push if all outputs can accept resources
            const allCanAccept = outputConns.every((conn, idx) => {
              const endEl = elementMap.get(conn.connectedToEnd!);
              if (!endEl) return false;
              const amount = outputAmounts[idx];
              if (endEl.type === 'Drain') return true; // Drain always accepts
              if (endEl.type === 'Pool') {
                const max = endEl.max ?? Infinity;
                return (endEl.currentPoints ?? 0) + amount <= max;
              }
              return false;
            });

            if (allCanAccept && currentResources >= totalOutput) {
              // Push to all outputs
              outputConns.forEach((conn, idx) => {
                const endEl = elementMap.get(conn.connectedToEnd!);
                if (!endEl) return;
                const amount = outputAmounts[idx];
                if (endEl.type === 'Drain') {
                  // Drain consumes, do nothing
                } else if (endEl.type === 'Pool') {
                  const max = endEl.max ?? Infinity;
                  endEl.currentPoints = Math.min(
                    (endEl.currentPoints ?? 0) + amount,
                    max
                  );
                }
                if (amount > 0) triggerFromArrival(endEl.id);
              });
              pool.currentPoints = Math.max(0, currentResources - totalOutput);
            }
          } else {
            // Push any: push maximum possible, evenly distribute if needed
            const available = currentResources;
            if (available > 0 && totalOutput > 0) {
              // Calculate how much we can actually push
              // const actualAmount = Math.min(available, totalOutput);
              // // Evenly distribute to all outputs
              // const perOutput = Math.floor(actualAmount / outputConns.length);
              // const remainder = actualAmount % outputConns.length;
              // outputConns.forEach((conn, idx) => {
              //   const endEl = elementMap.get(conn.connectedToEnd!);
              //   if (!endEl) return;
              //   const amount = perOutput + (idx < remainder ? 1 : 0);
              //   if (amount <= 0) return;
              //   if (endEl.type === 'Drain') {
              //     // Drain consumes
              //   } else if (endEl.type === 'Pool') {
              //     const max = endEl.max ?? Infinity;
              //     endEl.currentPoints = Math.min(
              //       (endEl.currentPoints ?? 0) + amount,
              //       max
              //     );
              //   }
              // });
              // pool.currentPoints = Math.max(0, available - actualAmount);
            }
          }
        }

        if (activationType === 'onstart') pool.hasStarted = true;
      }

      // --------- PASS 2: process Gates ----------
      for (const gate of nextElements) {
        if (gate.type !== 'Gate') continue;

        // Activation gate check
        let isTriggerActive = false;
        if (activationType === 'automatic') {
          if (gate.activation === 'automatic') isTriggerActive = true;
        } else if (
          gate.activation === 'passive' &&
          consumePassiveTrigger(gate)
        ) {
          isTriggerActive = true;
        } else {
          if (gate.activation === activationType) isTriggerActive = true;
        }
        const canFire = activationType !== 'onstart' || !gate.hasStarted;
        const isTarget =
          !interactiveElementId || gate.id === interactiveElementId;

        if (!(isTriggerActive && canFire && isTarget)) continue;

        // Collect inputs (resource connections ending at this gate)
        const inputConns = nextElements.filter(
          c => isResourceLikeConnection(c) && c.connectedToEnd === gate.id
        );

        // Collect outputs (both resource and state connections starting at this gate)
        const outputConns = nextElements.filter(
          c =>
            (c.type === 'Resource Connection' ||
              c.type === 'State Connection') &&
            c.connectedToStart === gate.id
        );

        if (outputConns.length === 0) {
          if (activationType === 'onstart') gate.hasStarted = true;
          continue;
        }

        // Determine actions this tick
        const actions = Math.max(1, gate.actions ?? 1);

        // Helper: can we take 1 unit from a start element?
        const canTakeOne = (start: GraphElement): boolean => {
          if (start.type === 'Source') return true; // infinite
          if (start.type === 'Pool') return (start.currentPoints ?? 0) > 0;
          return false; // not supported as input (yet)
        };

        const takeOne = (start: GraphElement): boolean => {
          if (start.type === 'Source') return true;
          if (start.type === 'Pool') {
            const have = start.currentPoints ?? 0;
            if (have > 0) {
              start.currentPoints = have - 1;
              return true;
            }
          }
          return false;
        };

        const deliverOne = (outConn: GraphElement) => {
          const end = elementMap.get(outConn.connectedToEnd!);
          if (!end) return;

          if (outConn.type === 'State Connection') {
            // Trigger-only: discard resource, bump instrumentation
            end.triggerCount = (end.triggerCount ?? 0) + 1;
            // You can also flip flags or enqueue effects here if needed.
            return;
          }

          // Resource delivery
          if (end.type === 'Pool') {
            const cur = end.currentPoints ?? 0;
            const cap = end.max ?? Infinity;
            if (cur < cap) end.currentPoints = cur + 1;
            triggerFromArrival(end.id);
            return;
          }

          // If Drain (via resource path) => "lost", do nothing.
          if (end.type === 'Drain') {
            triggerFromArrival(end.id);
            return;
          }

          // If other types later need resource, add handling here.
        };

        // Run actions
        for (let a = 0; a < actions; a++) {
          // Build a list of inputs to consume from based on pullMode
          let inputsToUse: GraphElement[] = [];

          if ((gate.pullMode ?? 'pull any') === 'pull all') {
            for (const ic of inputConns) {
              const startEl = elementMap.get(ic.connectedToStart!);
              if (startEl && canTakeOne(startEl)) inputsToUse.push(startEl);
            }
            if (inputsToUse.length === 0) break; // nothing available this action
          } else {
            // pull any
            const best = inputConns.find(ic => {
              const se = elementMap.get(ic.connectedToStart!);
              return !!se && canTakeOne(se);
            });
            if (!best) break;
            const se = elementMap.get(best.connectedToStart!)!;
            inputsToUse = [se];
          }

          // Choose output once per resource taken
          for (const startEl of inputsToUse) {
            // Consume one unit
            if (!takeOne(startEl)) continue;

            // Decide which output gets it
            // NOTE: we give chooseGateOutput the *full* output list so labels compete
            // Decide which outputs get it (may be multiple on overlap)
            const chosenList = chooseGateOutputs(gate, outputConns);
            for (const ch of chosenList) {
              deliverOne(ch);
            }

            // If no match and no else, nothing is delivered (token dropped)

            // else: dropped on the floor (no match and no 'else')
          }
        }

        if (activationType === 'onstart') gate.hasStarted = true;
      }

      // --------- PASS 2.5: process Sources ----------
      for (const source of nextElements) {
        if (source.type !== 'Source') continue;

        // Activation check - Source produces based on output streams
        let isTriggerActive = false;
        if (activationType === 'automatic') {
          if (source.activation === 'automatic') isTriggerActive = true;
        } else if (
          source.activation === 'passive' &&
          consumePassiveTrigger(source)
        ) {
          isTriggerActive = true;
        } else {
          if (source.activation === activationType) isTriggerActive = true;
        }
        const canFire = activationType !== 'onstart' || !source.hasStarted;
        const isTarget =
          !interactiveElementId || source.id === interactiveElementId;

        if (!(isTriggerActive && canFire && isTarget)) continue;

        // Collect output connections (resource connections starting at this source)
        const outputConns = nextElements.filter(
          c => isResourceLikeConnection(c) && c.connectedToStart === source.id
        );

        if (outputConns.length === 0) {
          if (activationType === 'onstart') source.hasStarted = true;
          continue;
        }

        // Source produces resources equal to value of all output streams
        // Each output connection label is evaluated separately (for random/fraction)
        outputConns.forEach(outputConn => {
          const amount = parseConnectionLabel(outputConn.text);
          const endElement = elementMap.get(outputConn.connectedToEnd!);

          if (!endElement) return;

          // Check if this is a trigger output (marked with "*")
          const isTrigger = isTriggerOutput(outputConn.text);

          if (isTrigger) {
            // Trigger output: activate the target element
            endElement.triggerCount = (endElement.triggerCount ?? 0) + 1;
          } else {
            // Normal resource output
            if (endElement.type === 'Pool') {
              const current = endElement.currentPoints || 0;
              const max = endElement.max ?? Infinity;
              endElement.currentPoints = Math.min(current + amount, max);
              if (amount > 0) triggerFromArrival(endElement.id);
            }
          }
        });

        if (activationType === 'onstart') source.hasStarted = true;
      }

      // // --------- PASS 2.5: process Sources ----------
      // for (const source of nextElements) {
      //   if (source.type !== 'Source') continue;

      //   // Activation check - Source produces based on output streams
      //   let isTriggerActive = false;
      //   if (activationType === 'automatic') {
      //     if (source.activation === 'automatic') isTriggerActive = true;
      //   } else if (
      //     source.activation === 'passive' &&
      //     consumePassiveTrigger(source)
      //   ) {
      //     isTriggerActive = true;
      //   } else {
      //     if (source.activation === activationType) isTriggerActive = true;
      //   }
      //   const canFire = activationType !== 'onstart' || !source.hasStarted;
      //   const isTarget =
      //     !interactiveElementId || source.id === interactiveElementId;

      //   if (!(isTriggerActive && canFire && isTarget)) continue;

      //   // Collect output connections (resource connections starting at this source)
      //   const outputConns = nextElements.filter(
      //     c => isResourceLikeConnection(c) && c.connectedToStart === source.id
      //   );

      //   if (outputConns.length === 0) {
      //     if (activationType === 'onstart') source.hasStarted = true;
      //     continue;
      //   }

      //   // Source produces resources equal to value of all output streams
      //   // Each output connection label is evaluated separately (for random/fraction)
      //   outputConns.forEach(outputConn => {
      //     const amount = parseConnectionLabel(outputConn.text);
      //     const endElement = elementMap.get(outputConn.connectedToEnd!);

      //     if (!endElement) return;

      //     // Check if this is a trigger output (marked with "*")
      //     const isTrigger = isTriggerOutput(outputConn.text);

      //     if (isTrigger) {
      //       // Trigger output: activate the target element
      //       endElement.triggerCount = (endElement.triggerCount ?? 0) + 1;
      //     } else {
      //       // Normal resource output
      //       if (endElement.type === 'Pool') {
      //         const current = endElement.currentPoints || 0;
      //         const max = endElement.max ?? Infinity;
      //         endElement.currentPoints = Math.min(current + amount, max);
      //       }
      //     }
      //   });

      //   if (activationType === 'onstart') source.hasStarted = true;
      // }

      // --------- PASS 2.7: process Drains ----------
      for (const drain of nextElements) {
        if (drain.type !== 'Drain') continue;

        // Activation check
        let isTriggerActive = false;
        if (activationType === 'automatic') {
          if (drain.activation === 'automatic') isTriggerActive = true;
        } else if (
          drain.activation === 'passive' &&
          consumePassiveTrigger(drain)
        ) {
          isTriggerActive = true;
        } else {
          if (drain.activation === activationType) isTriggerActive = true;
        }
        const canFire = activationType !== 'onstart' || !drain.hasStarted;
        const isTarget =
          !interactiveElementId || drain.id === interactiveElementId;

        if (!(isTriggerActive && canFire && isTarget)) continue;

        // Collect input connections (resource connections ending at this drain)
        const inputConns = nextElements.filter(
          c => isResourceLikeConnection(c) && c.connectedToEnd === drain.id
        );

        // Collect output connections (state connections for trigger outputs)
        const outputConns = nextElements.filter(
          c => c.type === 'State Connection' && c.connectedToStart === drain.id
        );

        // Check if drain has trigger output (marked with "*")
        const hasTriggerOutput = outputConns.some(conn =>
          isTriggerOutput(conn.text)
        );

        // Parse input connection labels
        const requiredAmounts: number[] = inputConns.map(conn =>
          parseConnectionLabel(conn.text)
        );

        const drainPullMode = drain.pullMode || 'pull any';

        if (drainPullMode === 'pull all') {
          // Pull all: need all inputs available simultaneously
          const allAvailable = inputConns.every((conn, idx) => {
            const startEl = elementMap.get(conn.connectedToStart!);
            if (!startEl) return false;
            const required = requiredAmounts[idx];
            if (startEl.type === 'Source') return true; // Source is infinite
            if (startEl.type === 'Pool')
              return (startEl.currentPoints ?? 0) >= required;
            return false;
          });

          if (allAvailable) {
            // Consume from all inputs
            inputConns.forEach((conn, idx) => {
              const startEl = elementMap.get(conn.connectedToStart!);
              if (!startEl) return;
              const required = requiredAmounts[idx];
              if (startEl.type === 'Pool') {
                startEl.currentPoints = Math.max(
                  0,
                  (startEl.currentPoints ?? 0) - required
                );
              }
              // Resource is destroyed (Drain consumes)
            });
            triggerFromArrival(drain.id);

            // If trigger output exists, only trigger when all resources received
            if (hasTriggerOutput) {
              outputConns.forEach(conn => {
                if (isTriggerOutput(conn.text)) {
                  const endEl = elementMap.get(conn.connectedToEnd!);
                  if (endEl) {
                    endEl.triggerCount = (endEl.triggerCount ?? 0) + 1;
                  }
                }
              });
            }
          }
        } else {
          // Pull any: attempt to pull from any available input
          for (let idx = 0; idx < inputConns.length; idx++) {
            const conn = inputConns[idx];
            const startEl = elementMap.get(conn.connectedToStart!);
            if (!startEl) continue;
            const required = requiredAmounts[idx];

            let canPull = false;
            if (startEl.type === 'Source') {
              canPull = true;
            } else if (startEl.type === 'Pool') {
              canPull = (startEl.currentPoints ?? 0) >= required;
            }

            if (canPull) {
              if (startEl.type === 'Pool') {
                startEl.currentPoints = Math.max(
                  0,
                  (startEl.currentPoints ?? 0) - required
                );
              }
              // Resource is destroyed (Drain consumes)

              // For pull any, trigger immediately when resource is consumed
              triggerFromArrival(drain.id);
              if (hasTriggerOutput) {
                outputConns.forEach(conn => {
                  if (isTriggerOutput(conn.text)) {
                    const endEl = elementMap.get(conn.connectedToEnd!);
                    if (endEl) {
                      endEl.triggerCount = (endEl.triggerCount ?? 0) + 1;
                    }
                  }
                });
              }
              break; // Only pull from one input in pull any mode
            }
          }
        }

        if (activationType === 'onstart') drain.hasStarted = true;
      }

      // --------- PASS 3: process Convertors ----------
      for (const convertor of nextElements) {
        if (convertor.type !== 'Convertor') continue;

        // Activation check
        let isTriggerActive = false;
        if (activationType === 'automatic') {
          if (convertor.activation === 'automatic') isTriggerActive = true;
        } else if (
          convertor.activation === 'passive' &&
          consumePassiveTrigger(convertor)
        ) {
          isTriggerActive = true;
        } else {
          if (convertor.activation === activationType) isTriggerActive = true;
        }
        const canFire = activationType !== 'onstart' || !convertor.hasStarted;
        const isTarget =
          !interactiveElementId || convertor.id === interactiveElementId;

        if (!(isTriggerActive && canFire && isTarget)) continue;

        // Initialize convertor storage if not exists
        if (!convertor.inputResources) {
          convertor.inputResources = {};
        }
        if (!convertor.outputResources) {
          convertor.outputResources = {};
        }
        if (!convertor.conversionRate) {
          convertor.conversionRate = {};
        }

        // Collect input connections (resource connections ending at this convertor)
        const inputConns = nextElements.filter(
          c => isResourceLikeConnection(c) && c.connectedToEnd === convertor.id
        );

        // Collect output connections (resource connections starting at this convertor)
        const outputConns = nextElements.filter(
          c =>
            isResourceLikeConnection(c) && c.connectedToStart === convertor.id
        );

        if (inputConns.length === 0 || outputConns.length === 0) {
          if (activationType === 'onstart') convertor.hasStarted = true;
          continue;
        }

        // Determine actions this tick
        const actions = Math.max(1, convertor.actions ?? 1);

        // Process each action
        for (let a = 0; a < actions; a++) {
          // Parse input connection labels to determine required resources
          // Use connection ID as key to handle multiple connections with same label
          const requiredInputs: Map<number, number> = new Map();
          for (const inputConn of inputConns) {
            const amount = parseConnectionLabel(inputConn.text);
            if (amount > 0) {
              requiredInputs.set(inputConn.id, amount);
            }
          }

          // Parse output connection labels to determine output resources
          // Use connection ID as key to handle multiple connections with same label
          const outputAmounts: Map<number, number> = new Map();
          for (const outputConn of outputConns) {
            const amount = parseConnectionLabel(outputConn.text);
            if (amount > 0) {
              outputAmounts.set(outputConn.id, amount);
            }
          }

          // Check if we can satisfy all input requirements
          let canConvert = true;
          if (convertor.pullMode === 'pull all') {
            // For pull all: need all inputs available simultaneously
            for (const [connId, requiredAmount] of requiredInputs.entries()) {
              const connection = inputConns.find(c => c.id === connId);
              if (!connection) {
                canConvert = false;
                break;
              }
              const inputElement = connection.connectedToStart
                ? elementMap.get(connection.connectedToStart)
                : undefined;
              if (
                !inputElement ||
                (inputElement.type === 'Pool' &&
                  (inputElement.currentPoints ?? 0) < requiredAmount) ||
                (inputElement.type === 'Source' && false) // Source is always available
              ) {
                if (inputElement?.type !== 'Source') {
                  canConvert = false;
                  break;
                }
              }
            }
          } else {
            // For pull any: check if we have stored enough resources
            // Use connection text as key for storage
            for (const [connId, requiredAmount] of requiredInputs.entries()) {
              const connection = inputConns.find(c => c.id === connId);
              if (!connection) continue;
              const resourceKey = connection.text || 'default';
              const stored = convertor.inputResources![resourceKey] || 0;
              if (stored < requiredAmount) {
                canConvert = false;
                break;
              }
            }
          }

          if (canConvert) {
            let inputConsumed = 0;
            // Consume input resources
            if (convertor.pullMode === 'pull all') {
              // Consume directly from input pools
              for (const [connId, requiredAmount] of requiredInputs.entries()) {
                const inputConn = inputConns.find(c => c.id === connId);
                if (inputConn && inputConn.connectedToStart) {
                  const inputElement = elementMap.get(
                    inputConn.connectedToStart
                  );
                  if (inputElement && inputElement.type === 'Pool') {
                    inputElement.currentPoints = Math.max(
                      0,
                      (inputElement.currentPoints ?? 0) - requiredAmount
                    );
                    if (requiredAmount > 0) {
                      inputConsumed += requiredAmount;
                    }
                  }
                }
              }
            } else {
              // Consume from stored resources
              for (const [connId, requiredAmount] of requiredInputs.entries()) {
                const connection = inputConns.find(c => c.id === connId);
                if (!connection) continue;
                const resourceKey = connection.text || 'default';
                const current = convertor.inputResources![resourceKey] || 0;
                convertor.inputResources![resourceKey] =
                  current - requiredAmount;
              }
            }
            if (inputConsumed > 0) {
              triggerFromArrival(convertor.id);
            }

            // Produce output resources
            for (const [connId, outputAmount] of outputAmounts.entries()) {
              const outputConn = outputConns.find(c => c.id === connId);
              if (outputConn && outputConn.connectedToEnd) {
                const outputElement = elementMap.get(outputConn.connectedToEnd);
                if (outputElement && outputElement.type === 'Pool') {
                  const current = outputElement.currentPoints ?? 0;
                  const max = outputElement.max ?? Infinity;
                  outputElement.currentPoints = Math.min(
                    current + outputAmount,
                    max
                  );
                  if (outputAmount > 0) triggerFromArrival(outputElement.id);
                }
              }
            }
          } else {
            // For pull any mode, try to pull and store resources
            if (convertor.pullMode === 'pull any') {
              let collected = 0;
              for (const inputConn of inputConns) {
                const inputElement = elementMap.get(
                  inputConn.connectedToStart!
                );
                if (
                  inputElement &&
                  inputElement.type === 'Pool' &&
                  (inputElement.currentPoints ?? 0) > 0
                ) {
                  const amount = parseConnectionLabel(inputConn.text);
                  const available = Math.min(
                    amount,
                    inputElement.currentPoints ?? 0
                  );

                  if (available > 0) {
                    inputElement.currentPoints =
                      (inputElement.currentPoints ?? 0) - available;
                    const resourceKey = inputConn.text || 'default';
                    const current = convertor.inputResources![resourceKey] || 0;
                    convertor.inputResources![resourceKey] =
                      current + available;
                    collected += available;
                  }
                }
              }
              if (collected > 0) {
                triggerFromArrival(convertor.id);
              }
            }
          }
        }

        if (activationType === 'onstart') convertor.hasStarted = true;
      }

      // --------- PASS 4: process Traders ----------
      for (const trader of nextElements) {
        if (trader.type !== 'Trader') continue;

        // Initialize trader storage if not exists
        if (!trader.traderInputs) {
          trader.traderInputs = {};
        }
        if (!trader.traderOutputs) {
          trader.traderOutputs = {};
        }

        // Collect input connections (resource connections ending at this trader)
        const inputConns = nextElements.filter(
          c => isResourceLikeConnection(c) && c.connectedToEnd === trader.id
        );

        // Collect output connections (resource connections starting at this trader)
        const outputConns = nextElements.filter(
          c => isResourceLikeConnection(c) && c.connectedToStart === trader.id
        );

        // Collect trigger connections (state connections ending at this trader)
        const triggerConns = nextElements.filter(
          c => c.type === 'State Connection' && c.connectedToEnd === trader.id
        );

        if (inputConns.length === 0 || outputConns.length === 0) {
          if (activationType === 'onstart') trader.hasStarted = true;
          continue;
        }

        // Check if trader is incomplete (< 2 inputs or < 2 outputs)
        const isIncomplete = inputConns.length < 2 || outputConns.length < 2;
        trader.isIncompleteTrader = isIncomplete;

        // ACTIVATION: Trader activates in two ways:
        // 1. Input Activation: Resources arrive at the trader (check if any input has resources available)
        // 2. Gate/Trigger Activation: A gate or trigger connection fires into the trader
        let isActivated = false;

        // Check for trigger activation (gate/trigger connection)
        if (triggerConns.length > 0) {
          // Check if any trigger connection has fired (has triggerCount)
          if ((trader.triggerCount ?? 0) > 0) {
            isActivated = true;
            // Consume one trigger
            trader.triggerCount = (trader.triggerCount ?? 0) - 1;
          }
        }

        // Check for input activation (resources arriving)
        if (!isActivated) {
          // Check if any input connection has resources available
          for (const inputConn of inputConns) {
            const inputElement = inputConn.connectedToStart
              ? elementMap.get(inputConn.connectedToStart)
              : undefined;
            if (inputElement) {
              if (inputElement.type === 'Source') {
                // Source always has resources
                isActivated = true;
                break;
              } else if (
                inputElement.type === 'Pool' &&
                (inputElement.currentPoints ?? 0) > 0
              ) {
                // Pool has resources available
                isActivated = true;
                break;
              }
            }
          }
        }

        // Also check activation type (for automatic/passive/interactive/onstart)
        let isTriggerActive = false;
        if (activationType === 'automatic') {
          if (trader.activation === 'automatic') isTriggerActive = true;
        } else if (
          trader.activation === 'passive' &&
          consumePassiveTrigger(trader)
        ) {
          isTriggerActive = true;
        } else {
          if (trader.activation === activationType) isTriggerActive = true;
        }
        const canFire = activationType !== 'onstart' || !trader.hasStarted;
        const isTarget =
          !interactiveElementId || trader.id === interactiveElementId;

        // In Pull Any mode, always try to collect available resources (even if not fully activated)
        // This allows the trader to accumulate resources over time
        if (
          trader.pullMode === 'pull any' &&
          isTriggerActive &&
          canFire &&
          isTarget
        ) {
          collectResourcesForPullAny(
            trader,
            inputConns,
            elementMap,
            triggerFromArrival
          );
        }

        // Trader only processes trades if:
        // - It is activated (by resources or trigger) AND
        // - The activation type matches (automatic/passive/interactive/onstart) AND
        // - It can fire (hasn't started yet for onstart) AND
        // - It's the target (for interactive mode)
        if (!(isActivated && isTriggerActive && canFire && isTarget)) {
          if (activationType === 'onstart') trader.hasStarted = true;
          continue;
        }

        // Determine actions this tick
        const actions = Math.max(1, trader.actions ?? 1);

        // Process each action
        for (let a = 0; a < actions; a++) {
          if (isIncomplete) {
            // Incomplete trader behaves like a convertor
            processIncompleteTrader(
              trader,
              inputConns,
              outputConns,
              elementMap,
              triggerFromArrival
            );
          } else {
            // Complete trader - ensure resource conservation
            processCompleteTrader(
              trader,
              inputConns,
              outputConns,
              elementMap,
              triggerFromArrival
            );
          }
        }

        if (activationType === 'onstart') trader.hasStarted = true;
      }

      // --------- PASS 5: Calculate Registers ----------
      // console.log('🔧 [PASS 5] Starting Register calculation...');
      for (const register of nextElements) {
        if (register.type !== 'Register') continue;

        // console.log('📊 [Register] Found register:', {
        // id: register.id,
        // formula: register.formula,
        // interactive: register.interactive,
        // currentValue: register.currentValue,
        // });

        if (register.interactive === true || register.interactive === 'true') {
          if (
            register.currentValue === undefined ||
            register.currentValue === null
          ) {
            register.currentValue = register.startingValue || 0;
            // console.log('🎮 Interactive Register initialized:', {
            // id: register.id,
            // startingValue: register.startingValue,
            // currentValue: register.currentValue,
            // });
          }
          continue;
        }
        // Collect input state connections ending at this register
        const inputConns = nextElements.filter(
          c => c.type === 'State Connection' && c.connectedToEnd === register.id
        );

        // console.log('📊 [Register] Input connections:', {
        // count: inputConns.length,
        // connections: inputConns.map(c => ({
        // id: c.id,
        // text: c.text,
        // from: c.connectedToStart,
        // to: c.connectedToEnd,
        // })),
        // });

        const formula = register.formula || register.text || '';
        if (!formula && inputConns.length === 0) {
          register.currentValue = 0;
          // console.log('📊 [Register] No inputs, value = 0');
          continue;
        }
        // console.log('📊 [Register] Formula:', formula);

        // max
        if (formula.toLowerCase() === 'max') {
          if (inputConns.length === 0) {
            register.currentValue = 0;
            continue;
          }
          let maxVal = -Infinity;
          for (const conn of inputConns) {
            const sourceEl = elementMap.get(conn.connectedToStart!);
            const sourceValue = getElementValue(sourceEl);
            // console.log('📊 [Register] Max - checking:', sourceValue);
            if (sourceValue > maxVal) maxVal = sourceValue;
          }
          register.currentValue = maxVal === -Infinity ? 0 : maxVal;
          // console.log('📊 [Register] Max result:', register.currentValue);
          continue;
        }

        // min
        if (formula.toLowerCase() === 'min') {
          if (inputConns.length === 0) {
            register.currentValue = 0;
            continue;
          }
          let minVal = Infinity;
          for (const conn of inputConns) {
            const sourceEl = elementMap.get(conn.connectedToStart!);
            const sourceValue = getElementValue(sourceEl);
            // console.log('📊 [Register] Min - checking:', sourceValue);
            if (sourceValue < minVal) minVal = sourceValue;
          }
          register.currentValue = minVal === Infinity ? 0 : minVal;
          // console.log('📊 [Register] Min result:', register.currentValue);
          continue;
        }

        // calculate expression
        try {
          const variables = new Array(23).fill(0);
          // console.log('📊 [Register] Building variables...');

          for (const conn of inputConns) {
            const label = (conn.text || '').trim().toLowerCase();

            // console.log('📊 [Register] Processing connection:', {
            // label,
            // isVariable: label.length === 1 && RegisterExpression.isVariable(label),
            // });

            if (label.length === 1 && RegisterExpression.isVariable(label)) {
              const varIndex = label.charCodeAt(0) - 97; // a=0, b=1, ...
              const sourceEl = elementMap.get(conn.connectedToStart!);
              const sourceValue = getElementValue(sourceEl);

              variables[varIndex] = sourceValue;

              // console.log('📊 [Register] Variable set:', {
              // variable: label,
              // index: varIndex,
              // value: sourceValue,
              // sourceElement: sourceEl?.type,
              // sourceId: sourceEl?.id,
              // });
            }
          }

          // console.log('📊 [Register] Variables array:', variables.slice(0, 5));

          const postfix = RegisterExpression.toPostfix(formula);
          // console.log('📊 [Register] Postfix:', postfix);
          let calculatedValue = RegisterExpression.evaluate(postfix, variables);
          // console.log('📊 [Register] Calculated value (raw):', calculatedValue);

          const min = register.minValue ?? -9999;
          const max = register.maxValue ?? 9999;
          calculatedValue = Math.min(Math.max(calculatedValue, min), max);

          register.currentValue = Math.floor(calculatedValue);
          // console.log('📊 [Register] Final value:', register.currentValue);
        } catch (error) {
          console.error('Register expression error:', error);
          register.currentValue = 0;
        }
      }
      // console.log('✅ [PASS 5] Register calculation complete');

      // --------- PASS 6: Check EndConditions ----------
      console.log('🎯 [PASS 6] Starting EndCondition check...');
      for (const endCondition of nextElements) {
        if (endCondition.type !== 'End Condition') continue;

        // collect all input State Connections
        const inputConns = nextElements.filter(
          c =>
            c.type === 'State Connection' &&
            c.connectedToEnd === endCondition.id
        );

        console.log('🎯 [EndCondition] Checking:', {
          id: endCondition.id,
          text: endCondition.text,
          inputCount: inputConns.length,
          currentInhibited: endCondition.inhibited,
        });

        // if no input connections, matain inhibited state
        if (inputConns.length === 0) {
          console.log(
            '⚠️ [EndCondition] No input connections, remaining inhibited'
          );
          continue;
        }

        // check if all input connections are met
        let allConditionsMet = true;
        const conditionDetails: Array<{
          label: string;
          value: number;
          met: boolean;
        }> = [];

        for (const conn of inputConns) {
          const startEl = elementMap.get(conn.connectedToStart!);
          if (!startEl) {
            allConditionsMet = false;
            continue;
          }

          const labelText = (conn.text ?? '').trim();
          const kind = classifyLabel(labelText);

          // only check condition types (cond or interval)
          if (kind === 'cond') {
            const fn = parseCond(labelText);
            if (fn) {
              const value = getElementValue(startEl);
              const conditionMet = fn(value);

              conditionDetails.push({
                label: labelText,
                value: value,
                met: conditionMet,
              });

              if (!conditionMet) {
                allConditionsMet = false;
              }
            }
          } else if (kind === 'interval') {
            const range = parseInterval(labelText);
            if (range) {
              const value = getElementValue(startEl);
              const conditionMet = value >= range[0] && value <= range[1];

              conditionDetails.push({
                label: labelText,
                value: value,
                met: conditionMet,
              });

              if (!conditionMet) {
                allConditionsMet = false;
              }
            }
          }
        }

        console.log('🎯 [EndCondition] Condition details:', conditionDetails);

        // update inhibited state
        const wasInhibited = endCondition.inhibited;
        endCondition.inhibited = !allConditionsMet;

        console.log('🎯 [EndCondition] Final state:', {
          id: endCondition.id,
          text: endCondition.text,
          allConditionsMet: allConditionsMet,
          wasInhibited: wasInhibited,
          nowInhibited: endCondition.inhibited,
        });

        // if changed from inhibited to not inhibited, trigger game end
        if (wasInhibited && !endCondition.inhibited) {
          console.log('🎊🎊🎊 [EndCondition] VICTORY! Game Over!');
          console.log('🎊 Victory condition:', endCondition.text || 'Unnamed');
          endCondition.isBlinking = true;

          // send game end event
          const gameEndEvent = new CustomEvent('game-end', {
            detail: {
              endConditionId: endCondition.id,
              message: endCondition.text || 'Victory!',
              timestamp: Date.now(),
            },
          });
          document.dispatchEvent(gameEndEvent);
          break;
        }
      }
      console.log('✅ [PASS 6] EndCondition check complete');

      applyDynamicResourceLabelsMutable(nextElements);
      updateStateConnectionVisualState(nextElements);

      return nextElements;
    },
    []
  );

  // Helper function to collect resources for Pull Any mode
  const collectResourcesForPullAny = (
    trader: GraphElement,
    inputConns: GraphElement[],
    elementMap: Map<number, GraphElement>,
    onArrival: (startElementId?: number) => void
  ) => {
    for (const inputConn of inputConns) {
      const inputElement = inputConn.connectedToStart
        ? elementMap.get(inputConn.connectedToStart)
        : undefined;
      if (
        inputElement &&
        inputElement.type === 'Pool' &&
        (inputElement.currentPoints ?? 0) > 0
      ) {
        const amount = parseConnectionLabel(inputConn.text);
        const available = Math.min(amount, inputElement.currentPoints ?? 0);

        if (available > 0) {
          inputElement.currentPoints =
            (inputElement.currentPoints ?? 0) - available;
          // Use connection ID as key to uniquely identify each input connection
          const resourceKey = `conn_${inputConn.id}`;
          const current = trader.traderInputs![resourceKey] || 0;
          trader.traderInputs![resourceKey] = current + available;
          onArrival(trader.id);
        }
      } else if (inputElement && inputElement.type === 'Source') {
        // Source has infinite resources, collect the amount specified
        const amount = parseConnectionLabel(inputConn.text);
        const resourceKey = `conn_${inputConn.id}`;
        const current = trader.traderInputs![resourceKey] || 0;
        trader.traderInputs![resourceKey] = current + amount;
        if (amount > 0) onArrival(trader.id);
      }
    }
  };

  // Helper function for incomplete trader (behaves like convertor - can create/destroy resources)
  const processIncompleteTrader = (
    trader: GraphElement,
    inputConns: GraphElement[],
    outputConns: GraphElement[],
    elementMap: Map<number, GraphElement>,
    onArrival: (startElementId?: number) => void
  ) => {
    // Parse input connection labels to determine required resources
    // Use connection ID as key to handle multiple connections
    const requiredInputs: Map<number, number> = new Map();
    for (const inputConn of inputConns) {
      const amount = parseConnectionLabel(inputConn.text);
      if (amount > 0) {
        requiredInputs.set(inputConn.id, amount);
      }
    }

    // Parse output connection labels to determine output resources
    // Use connection ID as key to handle multiple connections
    const outputAmounts: Map<number, number> = new Map();
    for (const outputConn of outputConns) {
      const amount = parseConnectionLabel(outputConn.text);
      if (amount > 0) {
        outputAmounts.set(outputConn.id, amount);
      }
    }

    if (trader.pullMode === 'pull all') {
      // PULL ALL MODE: Trade only happens if ALL inputs are available simultaneously
      let canTrade = true;

      // Check if all inputs are available
      for (const [connId, requiredAmount] of requiredInputs.entries()) {
        const inputConn = inputConns.find(c => c.id === connId);
        if (!inputConn) {
          canTrade = false;
          break;
        }
        const inputElement = inputConn.connectedToStart
          ? elementMap.get(inputConn.connectedToStart)
          : undefined;
        if (!inputElement) {
          canTrade = false;
          break;
        }
        if (inputElement.type === 'Source') {
          // Source always has resources
          continue;
        } else if (inputElement.type === 'Pool') {
          if ((inputElement.currentPoints ?? 0) < requiredAmount) {
            canTrade = false;
            break;
          }
        } else {
          canTrade = false;
          break;
        }
      }

      if (canTrade) {
        // Consume all inputs
        let totalInputConsumed = 0;
        for (const [connId, requiredAmount] of requiredInputs.entries()) {
          const inputConn = inputConns.find(c => c.id === connId);
          if (inputConn) {
            const inputElement = elementMap.get(inputConn.connectedToStart!);
            if (inputElement && inputElement.type === 'Pool') {
              inputElement.currentPoints = Math.max(
                0,
                (inputElement.currentPoints ?? 0) - requiredAmount
              );
              if (requiredAmount > 0) {
                totalInputConsumed += requiredAmount;
              }
            }
            // Source doesn't need to be consumed (infinite)
          }
        }
        if (totalInputConsumed > 0) {
          onArrival(trader.id);
        }

        // INCOMPLETE TRADER LOGIC:
        // - If multiple inputs → single output: sum all inputs and send to output
        // - If single input → multiple outputs: split input and send to all outputs
        if (inputConns.length > 1 && outputConns.length === 1) {
          // Multiple inputs, single output: sum all inputs
          let totalInput = 0;
          for (const amount of requiredInputs.values()) {
            totalInput += amount;
          }

          const outputConn = outputConns[0];
          const outputElement = elementMap.get(outputConn.connectedToEnd!);
          if (outputElement && outputElement.type === 'Pool') {
            const current = outputElement.currentPoints ?? 0;
            const max = outputElement.max ?? Infinity;
            outputElement.currentPoints = Math.min(current + totalInput, max);
            if (totalInput > 0) onArrival(outputElement.id);
          }
        } else if (inputConns.length === 1 && outputConns.length > 1) {
          // Single input, multiple outputs: split input to all outputs
          const inputAmount = requiredInputs.values().next().value || 0;

          for (const outputConn of outputConns) {
            const outputElement = elementMap.get(outputConn.connectedToEnd!);
            if (outputElement && outputElement.type === 'Pool') {
              const current = outputElement.currentPoints ?? 0;
              const max = outputElement.max ?? Infinity;
              outputElement.currentPoints = Math.min(
                current + inputAmount,
                max
              );
              if (inputAmount > 0) onArrival(outputElement.id);
            }
          }
        } else {
          // Fallback: use output amounts as specified (for edge cases)
          for (const [connId, outputAmount] of outputAmounts.entries()) {
            const outputConn = outputConns.find(c => c.id === connId);
            if (outputConn) {
              const outputElement = elementMap.get(outputConn.connectedToEnd!);
              if (outputElement && outputElement.type === 'Pool') {
                const current = outputElement.currentPoints ?? 0;
                const max = outputElement.max ?? Infinity;
                outputElement.currentPoints = Math.min(
                  current + outputAmount,
                  max
                );
                if (outputAmount > 0) onArrival(outputElement.id);
              }
            }
          }
        }
      }
      // If canTrade is false, nothing happens (no partial trade)
    } else {
      // PULL ANY MODE: Execute trades when all inputs are satisfied
      // (Resources are collected before processing, so we check stored resources here)

      // Check if we have enough stored resources for at least one complete trade
      let canTrade = true;
      let minTrades = Infinity;

      for (const [connId, requiredAmount] of requiredInputs.entries()) {
        const resourceKey = `conn_${connId}`;
        const stored = trader.traderInputs![resourceKey] || 0;
        if (stored < requiredAmount) {
          canTrade = false;
          break;
        }
        // Calculate how many trades we can do with this resource
        const possibleTrades = Math.floor(stored / requiredAmount);
        minTrades = Math.min(minTrades, possibleTrades);
      }

      if (canTrade && minTrades > 0) {
        // Execute as many complete trades as possible
        const tradesToExecute = minTrades;

        // Consume stored resources
        for (const [connId, requiredAmount] of requiredInputs.entries()) {
          const resourceKey = `conn_${connId}`;
          const current = trader.traderInputs![resourceKey] || 0;
          trader.traderInputs![resourceKey] =
            current - requiredAmount * tradesToExecute;
        }

        // INCOMPLETE TRADER LOGIC:
        // - If multiple inputs → single output: sum all inputs and send to output
        // - If single input → multiple outputs: split input and send to all outputs
        if (inputConns.length > 1 && outputConns.length === 1) {
          // Multiple inputs, single output: sum all inputs
          let totalInputPerTrade = 0;
          for (const amount of requiredInputs.values()) {
            totalInputPerTrade += amount;
          }

          const outputConn = outputConns[0];
          const outputElement = elementMap.get(outputConn.connectedToEnd!);
          if (outputElement && outputElement.type === 'Pool') {
            const current = outputElement.currentPoints ?? 0;
            const max = outputElement.max ?? Infinity;
            outputElement.currentPoints = Math.min(
              current + totalInputPerTrade * tradesToExecute,
              max
            );
            if (totalInputPerTrade * tradesToExecute > 0) {
              onArrival(outputElement.id);
            }
          }
        } else if (inputConns.length === 1 && outputConns.length > 1) {
          // Single input, multiple outputs: split input to all outputs
          const inputAmount = requiredInputs.values().next().value || 0;

          for (const outputConn of outputConns) {
            const outputElement = elementMap.get(outputConn.connectedToEnd!);
            if (outputElement && outputElement.type === 'Pool') {
              const current = outputElement.currentPoints ?? 0;
              const max = outputElement.max ?? Infinity;
              outputElement.currentPoints = Math.min(
                current + inputAmount * tradesToExecute,
                max
              );
              if (inputAmount * tradesToExecute > 0) {
                onArrival(outputElement.id);
              }
            }
          }
        } else {
          // Fallback: use output amounts as specified (for edge cases)
          for (const [connId, outputAmount] of outputAmounts.entries()) {
            const outputConn = outputConns.find(c => c.id === connId);
            if (outputConn) {
              const outputElement = elementMap.get(outputConn.connectedToEnd!);
              if (outputElement && outputElement.type === 'Pool') {
                const current = outputElement.currentPoints ?? 0;
                const max = outputElement.max ?? Infinity;
                outputElement.currentPoints = Math.min(
                  current + outputAmount * tradesToExecute,
                  max
                );
                if (outputAmount * tradesToExecute > 0) {
                  onArrival(outputElement.id);
                }
              }
            }
          }
        }
      }
    }
  };

  // Helper function for complete trader (ensures resource conservation - no creation/destruction)
  const processCompleteTrader = (
    trader: GraphElement,
    inputConns: GraphElement[],
    outputConns: GraphElement[],
    elementMap: Map<number, GraphElement>,
    onArrival: (startElementId?: number) => void
  ) => {
    // Parse input connection labels to determine required resources
    // Use connection ID as key to handle multiple connections
    const requiredInputs: Map<number, number> = new Map();
    for (const inputConn of inputConns) {
      const amount = parseConnectionLabel(inputConn.text);
      if (amount > 0) {
        requiredInputs.set(inputConn.id, amount);
      }
    }

    // Parse output connection labels to determine output resources
    // Use connection ID as key to handle multiple connections
    const outputAmounts: Map<number, number> = new Map();
    for (const outputConn of outputConns) {
      const amount = parseConnectionLabel(outputConn.text);
      if (amount > 0) {
        outputAmounts.set(outputConn.id, amount);
      }
    }

    // Build mapping of input connections to their source pools and colors
    // and output connections to their destination pools
    const inputInfo: Array<{
      connId: number;
      amount: number;
      sourcePoolId?: number;
      color?: string;
    }> = [];
    for (const inputConn of inputConns) {
      const amount = requiredInputs.get(inputConn.id) || 0;
      const sourceElement = inputConn.connectedToStart
        ? elementMap.get(inputConn.connectedToStart)
        : undefined;
      inputInfo.push({
        connId: inputConn.id,
        amount,
        sourcePoolId: sourceElement?.id,
        color: inputConn.color,
      });
    }

    const outputInfo: Array<{
      connId: number;
      destPoolId?: number;
      color?: string;
    }> = [];
    for (const outputConn of outputConns) {
      const destElement = outputConn.connectedToEnd
        ? elementMap.get(outputConn.connectedToEnd)
        : undefined;
      outputInfo.push({
        connId: outputConn.id,
        destPoolId: destElement?.id,
        color: outputConn.color,
      });
    }

    // Check if all connections have the same color (or are black/default)
    // If so, all resources should go to one output
    const allInputColors = inputInfo.map(i => i.color || '#000000');
    const allOutputColors = outputInfo.map(o => o.color || '#000000');
    const allColors = [...allInputColors, ...allOutputColors];
    const hasColorDifferentiation = new Set(allColors).size > 1;

    // Match inputs to outputs for resource exchange
    // Strategy: Match each input to an output that goes to a different pool
    // Priority: 1) Color matching (different colors), 2) Pool ID matching (different pools), 3) Round-robin
    const createInputOutputMapping = (): Map<number, number> => {
      const mapping = new Map<number, number>(); // input connId -> output connId
      const usedOutputs = new Set<number>();

      for (const input of inputInfo) {
        let bestMatch: number | null = null;
        let bestScore = -1;

        for (const output of outputInfo) {
          if (usedOutputs.has(output.connId)) continue;

          // Skip if output goes to the same pool as input source (no self-trade)
          if (
            input.sourcePoolId &&
            output.destPoolId &&
            input.sourcePoolId === output.destPoolId
          ) {
            continue;
          }

          // Calculate match score
          let score = 0;
          // Prefer different colors
          if (input.color && output.color && input.color !== output.color) {
            score += 10;
          }
          // Prefer different pools
          if (
            input.sourcePoolId &&
            output.destPoolId &&
            input.sourcePoolId !== output.destPoolId
          ) {
            score += 5;
          }
          // Base score for any valid match
          score += 1;

          if (score > bestScore) {
            bestScore = score;
            bestMatch = output.connId;
          }
        }

        if (bestMatch !== null) {
          mapping.set(input.connId, bestMatch);
          usedOutputs.add(bestMatch);
        }
      }

      return mapping;
    };

    if (trader.pullMode === 'pull all') {
      // PULL ALL MODE: Trade only happens if ALL inputs are available simultaneously
      let canTrade = true;

      // Check if all inputs are available
      for (const [connId, requiredAmount] of requiredInputs.entries()) {
        const inputConn = inputConns.find(c => c.id === connId);
        if (!inputConn) {
          canTrade = false;
          break;
        }
        const inputElement = inputConn.connectedToStart
          ? elementMap.get(inputConn.connectedToStart)
          : undefined;
        if (!inputElement) {
          canTrade = false;
          break;
        }
        if (inputElement.type === 'Source') {
          // Source always has resources
          continue;
        } else if (inputElement.type === 'Pool') {
          if ((inputElement.currentPoints ?? 0) < requiredAmount) {
            canTrade = false;
            break;
          }
        } else {
          canTrade = false;
          break;
        }
      }

      if (canTrade) {
        // Consume all inputs
        let totalInputConsumed = 0;
        for (const [connId, requiredAmount] of requiredInputs.entries()) {
          const inputConn = inputConns.find(c => c.id === connId);
          if (inputConn) {
            const inputElement = elementMap.get(inputConn.connectedToStart!);
            if (inputElement && inputElement.type === 'Pool') {
              inputElement.currentPoints = Math.max(
                0,
                (inputElement.currentPoints ?? 0) - requiredAmount
              );
              if (requiredAmount > 0) {
                totalInputConsumed += requiredAmount;
              }
            }
            // Source doesn't need to be consumed (infinite)
          }
        }
        if (totalInputConsumed > 0) {
          onArrival(trader.id);
        }

        // COMPLETE TRADER LOGIC: Exchange resources
        if (!hasColorDifferentiation) {
          // No color differentiation: send all resources to one output
          let totalInput = 0;
          for (const input of inputInfo) {
            totalInput += input.amount;
          }

          // Send all resources to the first output
          if (outputConns.length > 0) {
            const outputConn = outputConns[0];
            const outputElement = elementMap.get(outputConn.connectedToEnd!);
            if (outputElement && outputElement.type === 'Pool') {
              const current = outputElement.currentPoints ?? 0;
              const max = outputElement.max ?? Infinity;
              outputElement.currentPoints = Math.min(current + totalInput, max);
              if (totalInput > 0) onArrival(outputElement.id);
            }
          }
        } else {
          // Color differentiation: match inputs to outputs and exchange resources
          const inputOutputMapping = createInputOutputMapping();

          for (const input of inputInfo) {
            const outputConnId = inputOutputMapping.get(input.connId);
            if (outputConnId !== undefined) {
              const outputConn = outputConns.find(c => c.id === outputConnId);
              if (outputConn) {
                const outputElement = elementMap.get(
                  outputConn.connectedToEnd!
                );
                if (outputElement && outputElement.type === 'Pool') {
                  const current = outputElement.currentPoints ?? 0;
                  const max = outputElement.max ?? Infinity;
                  // Send the amount from this input to this output
                  outputElement.currentPoints = Math.min(
                    current + input.amount,
                    max
                  );
                  if (input.amount > 0) onArrival(outputElement.id);
                }
              }
            }
          }
        }
      }
      // If canTrade is false, nothing happens (no partial trade)
    } else {
      // PULL ANY MODE: Execute trades when all inputs are satisfied
      // (Resources are collected before processing, so we check stored resources here)

      // Check if we have enough stored resources for at least one complete trade
      let canTrade = true;
      let minTrades = Infinity;

      for (const [connId, requiredAmount] of requiredInputs.entries()) {
        const resourceKey = `conn_${connId}`;
        const stored = trader.traderInputs![resourceKey] || 0;
        if (stored < requiredAmount) {
          canTrade = false;
          break;
        }
        // Calculate how many trades we can do with this resource
        const possibleTrades = Math.floor(stored / requiredAmount);
        minTrades = Math.min(minTrades, possibleTrades);
      }

      if (canTrade && minTrades > 0) {
        // Execute as many complete trades as possible
        const tradesToExecute = minTrades;

        // Consume stored resources
        for (const [connId, requiredAmount] of requiredInputs.entries()) {
          const resourceKey = `conn_${connId}`;
          const current = trader.traderInputs![resourceKey] || 0;
          trader.traderInputs![resourceKey] =
            current - requiredAmount * tradesToExecute;
        }

        // COMPLETE TRADER LOGIC: Exchange resources
        if (!hasColorDifferentiation) {
          // No color differentiation: send all resources to one output
          let totalInputPerTrade = 0;
          for (const input of inputInfo) {
            totalInputPerTrade += input.amount;
          }

          // Send all resources to the first output
          if (outputConns.length > 0) {
            const outputConn = outputConns[0];
            const outputElement = elementMap.get(outputConn.connectedToEnd!);
            if (outputElement && outputElement.type === 'Pool') {
              const current = outputElement.currentPoints ?? 0;
              const max = outputElement.max ?? Infinity;
              outputElement.currentPoints = Math.min(
                current + totalInputPerTrade * tradesToExecute,
                max
              );
              if (totalInputPerTrade * tradesToExecute > 0) {
                onArrival(outputElement.id);
              }
            }
          }
        } else {
          // Color differentiation: match inputs to outputs and exchange resources
          const inputOutputMapping = createInputOutputMapping();

          for (const input of inputInfo) {
            const outputConnId = inputOutputMapping.get(input.connId);
            if (outputConnId !== undefined) {
              const outputConn = outputConns.find(c => c.id === outputConnId);
              if (outputConn) {
                const outputElement = elementMap.get(
                  outputConn.connectedToEnd!
                );
                if (outputElement && outputElement.type === 'Pool') {
                  const current = outputElement.currentPoints ?? 0;
                  const max = outputElement.max ?? Infinity;
                  // Send the amount from this input to this output (multiplied by trades)
                  outputElement.currentPoints = Math.min(
                    current + input.amount * tradesToExecute,
                    max
                  );
                  if (input.amount * tradesToExecute > 0) {
                    onArrival(outputElement.id);
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  const handleInteractiveAction = (elementId: number) => {
    // This will only be called by onClick when isRunning is true.
    setElements(currentElements =>
      runSimulationTick(currentElements, 'interactive', elementId)
    );
  };

  useEffect(() => {
    let simulationInterval: NodeJS.Timeout | undefined;

    // A. When "Run" is first clicked for a session:
    if (isRunning && !hasSimulationStarted) {
      console.log('--- Running OnStart ---'); // LOG
      try {
        // Add try...catch
        setElements(currentElements =>
          runSimulationTick(currentElements, 'onstart')
        );
      } catch (error) {
        console.error('⛔️ Error during OnStart tick:', error); // Log the error
        // Optionally stop simulation on error:
        // setIsRunning(false); // You'd need setIsRunning from props or context
      }
      setHasSimulationStarted(true);
    }

    // B. While the simulation is running:
    if (isRunning) {
      // 2. Start the timer for all "Automatic" actions.
      simulationInterval = setInterval(() => {
        console.log('--- Running Automatic Tick ---'); // LOG
        try {
          // Add try...catch
          setElements(currentElements => {
            // Optional: Log state before if needed for complex bugs
            // console.log('Elements BEFORE tick:', JSON.stringify(currentElements));
            const nextState = runSimulationTick(currentElements, 'automatic');
            // Optional: Log state after if needed
            // console.log('Elements AFTER tick:', JSON.stringify(nextState));
            return nextState;
          });
        } catch (error) {
          console.error('⛔️ Error during Automatic tick:', error); // Log the error
          if (simulationInterval) clearInterval(simulationInterval); // Stop interval on error
          // Optionally stop simulation on error:
          // setIsRunning(false); // Needs setIsRunning from props/context
        }
      }, 1000); // Ticks every 1 second.
    }

    // C. When "Stop" is clicked:
    if (!isRunning && hasSimulationStarted) {
      // 3. Reset the state for the next run.
      setHasSimulationStarted(false);
      setElements(currentElements =>
        currentElements.map(el => ({ ...el, hasStarted: false }))
      );
    }

    // D. Cleanup:
    return () => {
      if (simulationInterval) {
        clearInterval(simulationInterval);
      }
    };
    // Ensure ALL dependencies used inside are listed.
    // If setIsRunning comes from props/context, add it too.
  }, [isRunning, hasSimulationStarted, setElements, runSimulationTick]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Allow Escape to work even in input fields to switch to Select tool
        if (e.key === 'Escape') {
          e.preventDefault();
          if (onToolChange) {
            onToolChange('Select');
          }
        }
        return;
      }

      // Handle escape key to switch to Select tool or cancel connection creation
      if (e.key === 'Escape') {
        if (isCreatingConnection) {
          setIsCreatingConnection(false);
          setConnectionType(null);
          setConnectionPoints([]);
          setConnectionPreviewPoint(null);
        }
        if (onToolChange) {
          onToolChange('Select');
        }
      }

      // Handle delete key to remove selected elements
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedId.length > 0
      ) {
        if (isRunning) return;
        e.preventDefault();

        setElements(prev => prev.filter(el => !selectedId.includes(el.id)));
        setSelectedId([]);
      }
    };

    //edit
    const handleSelectAll = () => {
      const allIds = elements.map(el => el.id);
      setSelectedId(allIds);
      console.log('Selected all elements:', allIds.length);
    };

    const handleDeleteSelected = () => {
      if (selectedId.length > 0) {
        setElements(prev => prev.filter(el => !selectedId.includes(el.id)));
        setSelectedId([]);
        console.log('Deleted selected elements');
      }
    };

    const handlePasteElements = (event: CustomEvent) => {
      const { elements: clipboardElements } = event.detail;
      if (clipboardElements && clipboardElements.length > 0) {
        const maxId = Math.max(...elements.map(el => el.id), 0);
        const offset = (pasteCount + 1) * 20;

        const pastedElements = clipboardElements.map(
          (el: GraphElement, index: number) => ({
            ...el,
            id: maxId + index + 1,
            x: el.x + offset,
            y: el.y + offset,
            connectedToStart: undefined,
            connectedToEnd: undefined,
          })
        );

        setElements(prev => [...prev, ...pastedElements]);
        setSelectedId(pastedElements.map((el: { id: GraphElement }) => el.id));
        setPasteCount(prev => prev + 1);
        console.log('Pasted elements with offset:', offset);
      }
    };

    const handleResetPasteCount = () => {
      setPasteCount(0);
      console.log('Reset paste count on new copy');
    };

    const handleUndo = () => {
      console.log('Undo event received in Canvas');
    };

    const handleRedo = () => {
      console.log('Redo event received in Canvas');
    };

    const handleZoomFit = () => {
      console.log('Zoom to fit triggered');
      if (elements.length === 0) return;

      const bounds = elements.reduce(
        (acc, el) => {
          let width = el.width;
          let height = el.height;
          if (!width || !height) {
            if (el.type === 'Group') {
              width = el.width || 200;
              height = el.height || 150;
            } else {
              const size = getElementSize(el.thickness);
              width = size;
              height = size;
            }
          }
          return {
            minX: Math.min(acc.minX, el.x - width / 2),
            minY: Math.min(acc.minY, el.y - height / 2),
            maxX: Math.max(acc.maxX, el.x + width / 2),
            maxY: Math.max(acc.maxY, el.y + height / 2),
          };
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      );
      const canvasWidth = canvasRef.current?.clientWidth || 800;
      const canvasHeight = canvasRef.current?.clientHeight || 600;
      const contentWidth = bounds.maxX - bounds.minX;
      const contentHeight = bounds.maxY - bounds.minY;

      const scaleX = (canvasWidth - 100) / contentWidth;
      const scaleY = (canvasHeight - 100) / contentHeight;
      const scale = Math.min(scaleX, scaleY, 1);

      console.log('Zoom calculated:', {
        bounds,
        scale,
        canvasWidth,
        canvasHeight,
      });

      const zoomEvent = new CustomEvent('canvas-zoom-update', {
        detail: { bounds, scale, elementCount: elements.length },
      });
      document.dispatchEvent(zoomEvent);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('canvas-select-all', handleSelectAll);
    document.addEventListener('canvas-delete-selected', handleDeleteSelected);
    document.addEventListener(
      'canvas-paste-elements',
      handlePasteElements as EventListener
    );
    document.addEventListener(
      'canvas-reset-paste-count',
      handleResetPasteCount
    );
    document.addEventListener('canvas-undo', handleUndo);
    document.addEventListener('canvas-redo', handleRedo);
    document.addEventListener('canvas-zoom-fit', handleZoomFit);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('canvas-select-all', handleSelectAll);
      document.removeEventListener(
        'canvas-delete-selected',
        handleDeleteSelected
      );
      document.removeEventListener(
        'canvas-paste-elements',
        handlePasteElements as EventListener
      );
      document.removeEventListener(
        'canvas-reset-paste-count',
        handleResetPasteCount
      );
      document.removeEventListener('canvas-undo', handleUndo);
      document.removeEventListener('canvas-redo', handleRedo);
      document.removeEventListener('canvas-zoom-fit', handleZoomFit);
    };
  }, [
    isCreatingConnection,
    selectedId,
    elements,
    setElements,
    setSelectedId,
    pasteCount,
    isRunning,
    onToolChange,
  ]);

  useEffect(() => {
    const handleGameEnd = () => {
      setGameEnded(true);
    };

    document.addEventListener('game-end', handleGameEnd);

    return () => {
      document.removeEventListener('game-end', handleGameEnd);
    };
  }, []);

  useEffect(() => {
    if (!isRunning) {
      setGameEnded(false);
    }
  }, [isRunning]);

  useEffect(() => {
    if (!onElementSelection) return;

    if (selectedId.length === 1) {
      const el = elements.find(e => e.id === selectedId[0]) || null;
      onElementSelection(el);
    } else if (selectedId.length === 0) {
      onElementSelection(null);
    }
  }, [selectedId, elements, onElementSelection]);

  // Helper function to find the closest element to a point
  const findClosestElement = (
    x: number,
    y: number,
    excludeId?: number,
    options?: { includeConnections?: boolean }
  ): GraphElement | null => {
    const threshold = 60; // Maximum distance to consider an element "close"
    let closestElement: GraphElement | null = null;
    let closestDistance = threshold;
    const includeConnections = options?.includeConnections ?? false;

    elements.forEach(element => {
      if (element.id === excludeId) return;

      if (element.type === 'Resource Connection') {
        if (!includeConnections) return;
        const polyline = getResourcePolylinePoints(element);
        if (polyline.length < 2) return;
        const { distance } = getClosestPointOnPolyline({ x, y }, polyline);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestElement = element;
        }
        return;
      }

      if (element.type === 'State Connection') {
        return;
      }

      const elementX = element.x;
      const elementY = element.y;
      let elementWidth: number;
      let elementHeight: number;

      // Adjust for different element types
      if (element.type === 'Group') {
        elementWidth = element.width || 200;
        elementHeight = element.height || 150;
      } else {
        const size = getElementSize(element.thickness);
        elementWidth = size;
        elementHeight = size;
      }

      // Calculate distance to element center
      const centerX = elementX + elementWidth / 2;
      const centerY = elementY + elementHeight / 2;
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestElement = element;
      }
    });

    return closestElement;
  };

  // Helper function to find the closest edge point of an element
  const findClosestEdgePoint = (
    x: number,
    y: number,
    element: GraphElement
  ): { x: number; y: number } => {
    let elementWidth: number;
    let elementHeight: number;
    if (element.type === 'Group') {
      elementWidth = element.width || 200;
      elementHeight = element.height || 150;
    } else {
      const size = getElementSize(element.thickness);
      elementWidth = size;
      elementHeight = size;
    }

    const offsetX = elementWidth / 2;
    const offsetY = elementHeight / 2;
    const left = element.x - offsetX;
    const right = element.x + offsetX;
    const top = element.y - offsetY;
    const bottom = element.y + offsetY;

    // Calculate distances to each edge
    const distances = {
      left: Math.abs(x - left),
      right: Math.abs(x - right),
      top: Math.abs(y - top),
      bottom: Math.abs(y - bottom),
    };

    // Find the closest edge
    const closestEdge = Object.keys(distances).reduce((a, b) =>
      distances[a as keyof typeof distances] <
      distances[b as keyof typeof distances]
        ? a
        : b
    );

    // Calculate the connection point on the closest edge
    let connectionX = x;
    let connectionY = y;

    switch (closestEdge) {
      case 'left':
        connectionX = left;
        connectionY = Math.max(top, Math.min(bottom, y));
        break;
      case 'right':
        connectionX = right;
        connectionY = Math.max(top, Math.min(bottom, y));
        break;
      case 'top':
        connectionX = Math.max(left, Math.min(right, x));
        connectionY = top;
        break;
      case 'bottom':
        connectionX = Math.max(left, Math.min(right, x));
        connectionY = bottom;
        break;
    }

    return { x: connectionX, y: connectionY };
  };

  const normalizeVector = (
    dx: number,
    dy: number
  ): { x: number; y: number } => {
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  };

  const getPolylineMidpoint = (
    points: { x: number; y: number }[]
  ): {
    point: { x: number; y: number };
    normal: { x: number; y: number };
  } => {
    if (points.length === 0) {
      return { point: { x: 0, y: 0 }, normal: { x: 0, y: -1 } };
    }
    if (points.length === 1) {
      return { point: points[0], normal: { x: 0, y: -1 } };
    }

    let totalLength = 0;
    const segments: Array<{
      start: { x: number; y: number };
      end: { x: number; y: number };
      length: number;
    }> = [];

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length === 0) continue;
      segments.push({ start, end, length });
      totalLength += length;
    }

    if (segments.length === 0) {
      return { point: points[0], normal: { x: 0, y: -1 } };
    }

    const target = totalLength / 2;
    let traversed = 0;
    for (const segment of segments) {
      if (traversed + segment.length >= target) {
        const remaining = target - traversed;
        const t = remaining / segment.length;
        const midX = segment.start.x + (segment.end.x - segment.start.x) * t;
        const midY = segment.start.y + (segment.end.y - segment.start.y) * t;
        const direction = normalizeVector(
          segment.end.x - segment.start.x,
          segment.end.y - segment.start.y
        );
        const normal = normalizeVector(-direction.y, direction.x);
        return { point: { x: midX, y: midY }, normal };
      }
      traversed += segment.length;
    }

    const lastSegment = segments[segments.length - 1];
    const direction = normalizeVector(
      lastSegment.end.x - lastSegment.start.x,
      lastSegment.end.y - lastSegment.start.y
    );
    const normal = normalizeVector(-direction.y, direction.x);
    return { point: lastSegment.end, normal };
  };

  const placeElement = (
    type: GraphElementType,
    clientX: number,
    clientY: number,
    target: HTMLDivElement
  ) => {
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const id = Date.now();

    if (type === 'Text Label') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          text: toolProperties?.textLabel?.text || '',
          color: toolProperties?.textLabel?.color || '#000000',
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Group') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          width: 200,
          height: 150,
          text: toolProperties?.group?.text || '',
          color: toolProperties?.group?.color || '#000000',
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Pool') {
      const poolProps = toolProperties?.pool;
      const startingPoints =
        typeof poolProps?.number === 'string'
          ? parseInt(poolProps.number, 10) || 0
          : poolProps?.number || 0;
      const maxPoints = poolProps?.max;

      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: poolProps?.color,
          thickness: poolProps?.thickness,
          text: poolProps?.text,
          activation: poolProps?.activation,
          pullMode: poolProps?.pullMode,
          resources: poolProps?.resources,
          displayLimit: poolProps?.displayLimit,
          max: maxPoints,
          number: startingPoints,
          currentPoints: maxPoints
            ? Math.min(startingPoints, maxPoints)
            : startingPoints,
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Resource Connection' || type === 'State Connection') {
      setIsCreatingConnection(true);
      const startPoint = { x, y };
      setConnectionType(type);
      setConnectionPoints([startPoint]);
      setConnectionPreviewPoint(startPoint);
    } else if (type === 'Source') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          ...toolProperties?.source,
          // Use the 'text' (Label) field for starting points
          currentPoints: parseInt(toolProperties?.source?.text || '0', 10),
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Gate') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.gate?.color,
          thickness: toolProperties?.gate?.thickness,
          text: toolProperties?.gate?.text,
          activation: toolProperties?.gate?.activation,
          actions: toolProperties?.gate?.actions,
          pullMode: toolProperties?.gate?.pullMode,
          gateType: toolProperties?.gate?.type,
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Drain') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.drain?.color,
          thickness: toolProperties?.drain?.thickness,
          text: toolProperties?.drain?.text,
          activation: toolProperties?.drain?.activation,
          actions: toolProperties?.drain?.actions,
          pullMode: toolProperties?.drain?.pullMode,
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Convertor') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.convertor?.color,
          thickness: toolProperties?.convertor?.thickness,
          text: toolProperties?.convertor?.text,
          activation: toolProperties?.convertor?.activation,
          actions: toolProperties?.convertor?.actions,
          pullMode: toolProperties?.convertor?.pullMode,
          resources: toolProperties?.convertor?.resources,
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Trader') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.trader?.color,
          thickness: toolProperties?.trader?.thickness,
          text: toolProperties?.trader?.text,
          activation: toolProperties?.trader?.activation,
          actions: toolProperties?.trader?.actions,
          pullMode: toolProperties?.trader?.pullMode,
          resources: toolProperties?.trader?.resources,
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Delay') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.delay?.color,
          thickness: toolProperties?.delay?.thickness,
          text: toolProperties?.delay?.text,
          activation: toolProperties?.delay?.activation,
          actions: toolProperties?.delay?.actions,
          queue: toolProperties?.delay?.queue,
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Register') {
      const interactive = toolProperties?.register?.interactive ?? false;
      const startingValue = toolProperties?.register?.startingValue ?? 0;

      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.register?.color,
          thickness: toolProperties?.register?.thickness,
          formula: toolProperties?.register?.formula || '',
          minValue: toolProperties?.register?.minValue ?? -9999,
          maxValue: toolProperties?.register?.maxValue ?? 9999,
          interactive: interactive,
          startingValue: startingValue,
          step: toolProperties?.register?.step ?? 1,
          currentValue: interactive ? startingValue : 0,
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'End Condition') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.endCondition?.color,
          thickness: toolProperties?.endCondition?.thickness,
          text: toolProperties?.endCondition?.text,
          actions: toolProperties?.endCondition?.actions,
          pullMode: toolProperties?.endCondition?.pullMode,
          inhibited: true,
          isBlinking: false,
        },
      ]);
      setSelectedId([id]);
    } else if (type === 'Artifical Intelligence') {
      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: toolProperties?.artificialIntelligence?.color,
          thickness: toolProperties?.artificialIntelligence?.thickness,
          text: toolProperties?.artificialIntelligence?.text,
          activation: toolProperties?.artificialIntelligence?.activation,
          actions: toolProperties?.artificialIntelligence?.actions,
          script: toolProperties?.artificialIntelligence?.script,
        },
      ]);
      setSelectedId([id]);
    } else {
      setElements(prev => [...prev, { id, type, x, y }]);
      setSelectedId([id]);
    }
  };

  // Handle dropping a tool onto the canvas
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (isRunning) return;
    e.preventDefault();
    const tool = e.dataTransfer.getData('tool') as GraphElementType;
    if (tool) {
      placeElement(tool, e.clientX, e.clientY, e.currentTarget);
    }
  };

  // Allow dropping by preventing default
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const finalizeConnection = (finalPoint: { x: number; y: number }) => {
    if (
      !isCreatingConnection ||
      !connectionType ||
      connectionPoints.length === 0
    ) {
      return;
    }

    const pointsSequence = [...connectionPoints];
    const lastPoint = pointsSequence[pointsSequence.length - 1];
    if (
      !lastPoint ||
      lastPoint.x !== finalPoint.x ||
      lastPoint.y !== finalPoint.y
    ) {
      pointsSequence.push(finalPoint);
    }

    if (pointsSequence.length < 2) {
      return;
    }

    const startPoint = pointsSequence[0];
    const endPoint = pointsSequence[pointsSequence.length - 1];

    const startElement = findClosestElement(startPoint.x, startPoint.y);
    const endElement = findClosestElement(
      endPoint.x,
      endPoint.y,
      undefined,
      connectionType === 'State Connection'
        ? { includeConnections: true }
        : undefined
    );

    const snappedPoints = pointsSequence.map((point, index) => {
      if (index === 0 && startElement) {
        return findClosestEdgePoint(startPoint.x, startPoint.y, startElement);
      }
      if (index === pointsSequence.length - 1 && endElement) {
        if (endElement.type === 'Resource Connection') {
          const polyline = getResourcePolylinePoints(endElement);
          const { point: anchorPoint } = getClosestPointOnPolyline(
            { x: endPoint.x, y: endPoint.y },
            polyline
          );
          return anchorPoint;
        }
        return findClosestEdgePoint(endPoint.x, endPoint.y, endElement);
      }
      return point;
    });

    const startCoord = snappedPoints[0];
    const endCoord = snappedPoints[snappedPoints.length - 1];
    const intermediatePoints = snappedPoints.slice(1, snappedPoints.length - 1);

    const connectionProps =
      connectionType === 'Resource Connection'
        ? toolProperties?.resourceConnection
        : toolProperties?.stateConnection;

    const id = Date.now();

    const newConnection: GraphElement = {
      id,
      type: connectionType,
      ...(connectionProps || {}),
      x: startCoord.x,
      y: startCoord.y,
      startX: startCoord.x,
      startY: startCoord.y,
      endX: endCoord.x,
      endY: endCoord.y,
      connectedToStart: startElement?.id,
      connectedToEnd: endElement?.id,
      points: intermediatePoints.length > 0 ? intermediatePoints : undefined,
    };

    setElements(prev => [...prev, newConnection]);
    setSelectedId([id]);

    setIsCreatingConnection(false);
    setConnectionType(null);
    setConnectionPoints([]);
    setConnectionPreviewPoint(null);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCreatingConnection || !canvasRef.current) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    finalizeConnection(point);
  };

  // Click-to-place handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't clear selection if we just completed a box selection
    if (justCompletedBoxSelection) {
      setJustCompletedBoxSelection(false);
      return;
    }

    if (isCreatingConnection) {
      if (e.detail > 1 || !canvasRef.current) {
        return;
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setConnectionPoints(prev => [...prev, point]);
      setConnectionPreviewPoint(point);
      return;
    }

    // Only clear selection if clicking directly on canvas (not on elements) and not using Ctrl/Cmd
    if (
      selectedTool === 'Select' &&
      e.target === canvasRef.current &&
      !isSelectingBox &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      setSelectedId([]);
    }
    if (selectedTool && selectedTool !== 'Select') {
      if (isRunning) return;
      placeElement(
        selectedTool as GraphElementType,
        e.clientX,
        e.clientY,
        e.currentTarget
      );
      // Don't clear selection - the newly placed element will be selected in placeElement
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool === 'Select' && e.target === canvasRef.current) {
      setMouseDownOnCanvas(true);
      setIsSelectingBox(false);
      const rect = canvasRef.current!.getBoundingClientRect();
      setBoxStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setBoxEnd(null);

      // If not holding Ctrl/Cmd, clear selection when starting box selection
      if (!e.ctrlKey && !e.metaKey) {
        setSelectedId([]);
      }
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, id: number) => {
    // Stop the event from bubbling up to the canvas immediately.
    e.stopPropagation();

    const element = elements.find(el => el.id === id);
    if (!element) return;

    console.log(
      `[LOG 1] Mousedown on element ID: ${id}, Type: ${element.type}`
    );

    // --- RUN MODE LOGIC ---
    // If the simulation is running, we only care about interactive actions.
    if (isRunning) {
      if (
        element.type === 'Register' &&
        (element.interactive === true || element.interactive === 'true')
      ) {
        // console.log('🖱️ Interactive Register clicked:', {
        // id: element.id,
        // currentValue: element.currentValue,
        // step: element.step,
        // });

        const step =
          typeof element.step === 'string'
            ? parseInt(element.step, 10) || 1
            : element.step || 1;
        const currentVal = element.currentValue || 0;
        const newValue = currentVal + step;
        const min =
          typeof element.minValue === 'string'
            ? parseInt(element.minValue, 10) || 0
            : (element.minValue ?? -9999);
        const max =
          typeof element.maxValue === 'string'
            ? parseInt(element.maxValue, 10) || 50
            : (element.maxValue ?? 9999);
        const clampedValue = Math.min(Math.max(newValue, min), max);

        // console.log('🖱️ Register value update:', {
        // from: currentVal,
        // to: clampedValue,
        // step: step,
        // min: min,
        // max: max,
        // });

        setElements(prev =>
          prev.map(el =>
            el.id === id ? { ...el, currentValue: clampedValue } : el
          )
        );
        return;
      }

      if (element.activation === 'interactive') {
        handleInteractiveAction(id);
      }
      return;
    }

    // --- EDIT MODE LOGIC ---
    // If we get here, it means isRunning is false.
    if (selectedTool === 'Select') {
      // Handle selection
      if (e.ctrlKey || e.metaKey) {
        setSelectedId(prev =>
          prev.includes(id) ? prev.filter(selId => selId !== id) : [...prev, id]
        );
      } else {
        if (!selectedId.includes(id)) {
          if (!(selectedId.length === 1 && selectedId[0] === id)) {
            setSelectedId([id]);
          }
        }
      }

      // Prepare for dragging
      setDraggingId(id);
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left - element.x,
          y: e.clientY - rect.top - element.y,
        });
      }
    }
  };

  // Mouse move to drag selected element(s) or update bounding box or resize or create connection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isRunning) return;
    if (selectedTool === 'Select' && mouseDownOnCanvas && boxStart) {
      setIsSelectingBox(true);
      const rect = canvasRef.current!.getBoundingClientRect();
      setBoxEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    // Handle connection creation
    if (isCreatingConnection) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setConnectionPreviewPoint(point);
      return;
    }

    // Handle resize
    if (isResizing) {
      // Check if it's arrow resize
      if (resizeHandle === 'start' || resizeHandle === 'end') {
        handleArrowResizeMove(e);
      } else {
        handleResizeMove(e);
      }
      return;
    }

    // ...existing drag logic for elements...
    if (selectedTool === 'Select') {
      if (draggingId !== null && dragOffset) {
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const newX = e.clientX - rect.left - dragOffset.x;
          const newY = e.clientY - rect.top - dragOffset.y;
          const baseElements = draggedElements || elements;
          const draggingElement = baseElements.find(el => el.id === draggingId);

          if (!draggingElement) return;

          const deltaX = newX - draggingElement.x;
          const deltaY = newY - draggingElement.y;

          const updatedElements = baseElements.map(el =>
            selectedId.includes(el.id)
              ? { ...el, x: el.x + deltaX, y: el.y + deltaY }
              : el
          );

          const finalElements = updatedElements.map(element => {
            if (
              element.type !== 'Resource Connection' &&
              element.type !== 'State Connection'
            ) {
              return element;
            }

            const updatedElement = { ...element };
            let needsUpdate = false;

            selectedId.forEach(movedId => {
              const movedElement = updatedElements.find(
                el => el.id === movedId
              );
              if (!movedElement) return;

              if (element.connectedToStart === movedId) {
                const startEdgePoint = findClosestEdgePoint(
                  element.endX || element.x,
                  element.endY || element.y,
                  movedElement
                );
                updatedElement.startX = startEdgePoint.x;
                updatedElement.startY = startEdgePoint.y;
                updatedElement.x = updatedElement.startX;
                updatedElement.y = updatedElement.startY;
                needsUpdate = true;
              }

              if (element.connectedToEnd === movedId) {
                const endEdgePoint = findClosestEdgePoint(
                  element.startX || element.x,
                  element.startY || element.y,
                  movedElement
                );
                updatedElement.endX = endEdgePoint.x;
                updatedElement.endY = endEdgePoint.y;
                needsUpdate = true;
              }
            });

            return needsUpdate ? updatedElement : element;
          });

          setDraggedElements(finalElements);
        }
      }
    }
  };

  // Mouse up to end dragging or bounding box selection or resize or create connection
  const handleMouseUp = () => {
    const wasDragging = draggingId !== null && dragOffset !== null;
    if (wasDragging && draggedElements) {
      setElements(draggedElements);
      setDraggedElements(null);
    }

    setMouseDownOnCanvas(false);
    setDragOffset(null);
    setDraggingId(null);

    // Handle resize end
    if (isResizing) {
      handleResizeEnd();
      return;
    }

    if (selectedTool === 'Select' && isSelectingBox && boxStart && boxEnd) {
      const x1 = Math.min(boxStart.x, boxEnd.x);
      const y1 = Math.min(boxStart.y, boxEnd.y);
      const x2 = Math.max(boxStart.x, boxEnd.x);
      const y2 = Math.max(boxStart.y, boxEnd.y);
      const selected = elements
        .filter(el => el.x >= x1 && el.x <= x2 && el.y >= y1 && el.y <= y2)
        .map(el => el.id);
      // Add to existing selection instead of replacing it
      setSelectedId(prev => {
        const newSelection = [...prev];
        selected.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
      setIsSelectingBox(false);
      setBoxStart(null);
      setBoxEnd(null);
      setJustCompletedBoxSelection(true);
    }
  };

  // Handle resize start
  const handleResizeStart = (
    e: React.MouseEvent,
    id: number,
    handle: string
  ) => {
    if (isRunning) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizingId(id);
    setResizeHandle(handle);

    const element = elements.find(el => el.id === id);
    if (element && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setResizeStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: element.width || 200,
        height: element.height || 150,
      });
    }
  };

  // Handle resize during mouse move
  const handleResizeMove = (e: React.MouseEvent) => {
    if (isResizing && resizingId && resizeStart && resizeHandle) {
      const element = elements.find(el => el.id === resizingId);
      if (element && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        let newWidth = element.width || 200;
        let newHeight = element.height || 150;
        let newX = element.x;
        let newY = element.y;

        const deltaX = currentX - resizeStart.x;
        const deltaY = currentY - resizeStart.y;

        switch (resizeHandle) {
          case 'se': // Southeast
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            break;
          case 'sw': // Southwest
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height + deltaY);
            newX = element.x + (element.width || 200) - newWidth;
            break;
          case 'ne': // Northeast
            newWidth = Math.max(50, resizeStart.width + deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newY = element.y + (element.height || 150) - newHeight;
            break;
          case 'nw': // Northwest
            newWidth = Math.max(50, resizeStart.width - deltaX);
            newHeight = Math.max(50, resizeStart.height - deltaY);
            newX = element.x + (element.width || 200) - newWidth;
            newY = element.y + (element.height || 150) - newHeight;
            break;
        }

        setElements(prev =>
          prev.map(el =>
            el.id === resizingId
              ? { ...el, x: newX, y: newY, width: newWidth, height: newHeight }
              : el
          )
        );
      }
    }
  };

  // Handle resize end
  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizingId(null);
    setResizeHandle(null);
    setResizeStart(null);
  };

  // Handle arrow resize start
  const handleArrowResizeStart = (
    e: React.MouseEvent,
    id: number,
    handle: 'start' | 'end'
  ) => {
    if (isRunning) return;
    e.stopPropagation();
    setIsResizing(true);
    setResizingId(id);
    setResizeHandle(handle);

    const element = elements.find(el => el.id === id);
    if (element && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setResizeStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        width: 0, // Not used for arrows
        height: 0, // Not used for arrows
      });
    }
  };

  // Handle arrow resize during mouse move
  const handleArrowResizeMove = (e: React.MouseEvent) => {
    if (
      isResizing &&
      resizingId &&
      resizeStart &&
      resizeHandle &&
      (resizeHandle === 'start' || resizeHandle === 'end')
    ) {
      const element = elements.find(el => el.id === resizingId);
      if (element && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        setElements(prev =>
          prev.map(el => {
            if (el.id === resizingId) {
              if (resizeHandle === 'start') {
                return {
                  ...el,
                  startX: currentX,
                  startY: currentY,
                  x: currentX,
                  y: currentY,
                };
              } else {
                return {
                  ...el,
                  endX: currentX,
                  endY: currentY,
                };
              }
            }
            return el;
          })
        );
      }
    }
  };

  // Calculate element size based on thickness
  // Default thickness is 2, default size is 40
  // Size increases slowly as thickness increases, max size is 50
  const getElementSize = (thickness?: number): number => {
    const defaultThickness = 2;
    const defaultSize = 40;
    const maxSize = 50;
    const thicknessValue = thickness || defaultThickness;
    // Size increases slowly: 1.25 units per thickness point above default
    const calculatedSize =
      defaultSize + (thicknessValue - defaultThickness) * 1.25;
    return Math.min(calculatedSize, maxSize);
  };

  // Render each element
  const renderElement = (el: GraphElement) => {
    const isSelected = selectedId.includes(el.id);
    const applyConditionStyle = (style: CSSProperties = {}): CSSProperties =>
      el.hasUnsatisfiedCondition ? { ...style, opacity: 0.4 } : style;
    switch (el.type) {
      case 'Text Label':
        return (
          <span
            key={el.id}
            className={`text-label-span ${selectedTool === 'Select' ? 'selectable' : 'clickable'} ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x,
              top: el.y,
              color: el.color || '#000000',
            })}
            onClick={e => {
              if (isRunning) return;
              if (selectedTool === 'Select') {
                e.stopPropagation();
                // Multi-select with Ctrl/Cmd
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              } else {
                e.stopPropagation();
                setSelectedId([el.id]);
              }
            }}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
          >
            {el.text || 'Text Label'}
          </span>
        );
      case 'Pool': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const radius = (size / 40) * 18; // Scale radius proportionally
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <svg
            key={el.id}
            className={`svg-element pool-element ${
              selectedTool === 'Select' ? 'selectable' : ''
            } ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x - offset,
              top: el.y - offset,
            })}
            width={size}
            height={size}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <circle
              cx={center}
              cy={center}
              r={radius}
              className={`pool-circle ${isSelected ? 'selected' : ''}`}
              fill="white"
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
            />
            <text
              x={center - size / 4}
              y={center + size / 8}
              className="element-value-text"
              fill="black" // <-- The fix is here! Black text for the white pool.
            >
              {el.currentPoints !== undefined && el.currentPoints !== null
                ? el.currentPoints
                : el.number !== undefined && el.number !== null
                  ? el.number
                  : 0}
            </text>
          </svg>
        );
      }
      case 'Source': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <svg
            key={el.id}
            className={`svg-element source-element clickable-element ${
              selectedTool === 'Select' ? 'selectable' : ''
            } ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x - offset,
              top: el.y - offset,
            })}
            width={size}
            height={size}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <polygon
              points={`${center},${5 * scale} ${35 * scale},${35 * scale} ${5 * scale},${35 * scale}`}
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`source-triangle ${isSelected ? 'selected' : ''}`}
            />
            <text
              x={14 * scale}
              y={30 * scale}
              className="element-value-text"
              fill="black"
              fontSize={20 * scale}
            >
              ∞
            </text>
          </svg>
        );
      }
      case 'Drain': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <svg
            key={el.id}
            className={`svg-element drain-element clickable-element ${
              selectedTool === 'Select' ? 'selectable' : ''
            } ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x - offset,
              top: el.y - offset,
            })}
            width={size}
            height={size}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <polygon
              points={`${5 * scale},${5 * scale} ${35 * scale},${5 * scale} ${center},${35 * scale}`}
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`drain-triangle ${isSelected ? 'selected' : ''}`}
            />
          </svg>
        );
      }
      case 'Group':
        return (
          <div
            key={el.id}
            className={`group-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x,
              top: el.y,
              width: el.width || 200,
              height: el.height || 150,
              borderColor: el.color || '#666',
            })}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            {/* Group text content */}
            {el.text && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: el.color || '#000000',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                {el.text}
              </div>
            )}
            {/* Resize handles */}
            {isSelected && (
              <>
                {/* Southeast handle */}
                <div
                  className="resize-handle se"
                  onMouseDown={e => handleResizeStart(e, el.id, 'se')}
                />
                {/* Southwest handle */}
                <div
                  className="resize-handle sw"
                  onMouseDown={e => handleResizeStart(e, el.id, 'sw')}
                />
                {/* Northeast handle */}
                <div
                  className="resize-handle ne"
                  onMouseDown={e => handleResizeStart(e, el.id, 'ne')}
                />
                {/* Northwest handle */}
                <div
                  className="resize-handle nw"
                  onMouseDown={e => handleResizeStart(e, el.id, 'nw')}
                />
              </>
            )}
          </div>
        );
      case 'Gate': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <svg
            key={el.id}
            className={`svg-element gate-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x - offset,
              top: el.y - offset,
            })}
            width={size}
            height={size}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <polygon
              points={`${center},${5 * scale} ${35 * scale},${center} ${center},${35 * scale} ${5 * scale},${center}`}
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`gate-diamond ${isSelected ? 'selected' : ''}`}
            />
          </svg>
        );
      }
      case 'Convertor': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <svg
            key={el.id}
            className={`svg-element convertor-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x - offset,
              top: el.y - offset,
            })}
            width={size}
            height={size}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <polygon
              points={`${5 * scale},${5 * scale} ${35 * scale},${center} ${5 * scale},${35 * scale}`}
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`convertor-shape ${isSelected ? 'selected' : ''}`}
            />
            <line
              x1={5 * scale}
              y1={5 * scale}
              x2={5 * scale}
              y2={35 * scale}
              className="convertor-line"
            />

            {/* Show stored resources for pull any mode */}
            {el.pullMode === 'pull any' &&
              el.inputResources &&
              Object.keys(el.inputResources).length > 0 && (
                <text
                  x={center}
                  y={15 * scale}
                  fontSize={8 * scale}
                  fill="white"
                  textAnchor="middle"
                  className="convertor-storage"
                >
                  {Object.entries(el.inputResources)
                    .map(([type, amount]) => `${type}:${amount}`)
                    .join(',')}
                </text>
              )}

            {/* Show conversion status */}
            {el.text && (
              <text
                x={center}
                y={30 * scale}
                fontSize={6 * scale}
                fill="white"
                textAnchor="middle"
                className="convertor-label"
              >
                {el.text}
              </text>
            )}
          </svg>
        );
      }
      case 'Trader': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <svg
            key={el.id}
            className={`svg-element trader-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x - offset,
              top: el.y - offset,
            })}
            width={size}
            height={size}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            {/* Trader shape - parallelogram outline with no fill */}
            <polygon
              points={`${8 * scale},${5 * scale} ${35 * scale},${5 * scale} ${32 * scale},${35 * scale} ${5 * scale},${35 * scale}`}
              fill="none"
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`trader-shape ${isSelected ? 'selected' : ''}`}
            />

            {/* Show trader status */}
            {el.text && (
              <text
                x={center}
                y={30 * scale}
                fontSize={6 * scale}
                fill={el.color || '#000000'}
                textAnchor="middle"
                className="trader-label"
              >
                {el.text}
              </text>
            )}
          </svg>
        );
      }
      case 'End Condition': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <g key={el.id}>
            {/* EndCondition SVG element*/}
            <svg
              className={`svg-element end-condition-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${el.isBlinking ? 'blinking' : ''} ${!el.inhibited ? 'victory' : ''}`}
              style={applyConditionStyle({
                left: el.x - offset,
                top: el.y - offset,
              })}
              width={size}
              height={size}
              onMouseDown={e => handleElementMouseDown(e, el.id)}
              onClick={e => {
                if (selectedTool === 'Select') {
                  e.stopPropagation();
                  if (e.ctrlKey || e.metaKey) {
                    setSelectedId(prev =>
                      prev.includes(el.id)
                        ? prev.filter(selId => selId !== el.id)
                        : [...prev, el.id]
                    );
                  } else {
                    setSelectedId([el.id]);
                  }
                }
              }}
            >
              {/* outline */}
              <rect
                x={5 * scale}
                y={5 * scale}
                width={30 * scale}
                height={30 * scale}
                fill={el.inhibited ? '#808080' : el.color || '#000000'}
                stroke={isSelected ? '#0078d4' : el.color || '#000000'}
                strokeWidth={el.thickness || 2}
                className={`end-condition-rect ${isSelected ? 'selected' : ''}`}
              />
              {/* inner rect */}
              <rect
                x={12 * scale}
                y={12 * scale}
                width={16 * scale}
                height={16 * scale}
                fill={el.inhibited ? '#a0a0a0' : el.color || '#000000'}
                className="end-condition-inner-rect"
              />

              {/* light blue indicator */}
              {!el.inhibited && (
                <circle
                  cx={center}
                  cy={center}
                  r={4 * scale}
                  fill="#87CEEB"
                  className="condition-met-indicator"
                />
              )}
            </svg>

            {/* Label */}
            {el.text && (
              <div
                className={`end-condition-label ${el.isBlinking ? 'blinking' : ''}`}
                style={applyConditionStyle({
                  position: 'absolute',
                  left: el.x - offset,
                  top: el.y - offset + size + 5,
                  fontSize: `${12 * scale}px`,
                  fontWeight: 'bold',
                  color: el.color || '#000000',
                  textAlign: 'center',
                  width: `${size}px`,
                  pointerEvents: 'none',
                  userSelect: 'none',
                })}
              >
                {el.text}
              </div>
            )}
          </g>
        );
      }
      case 'Register': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <svg
            key={el.id}
            className={`svg-element register-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x - offset,
              top: el.y - offset,
            })}
            width={size}
            height={size}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            {/* white background */}
            <rect
              x={5 * scale}
              y={5 * scale}
              width={30 * scale}
              height={30 * scale}
              fill="white"
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`register-rect ${isSelected ? 'selected' : ''}`}
            />
            {/* show current value */}
            <text
              x={center}
              y={center + size / 8}
              className="register-text"
              fill="black"
              fontSize={14 * scale}
              textAnchor="middle"
              fontWeight="bold"
            >
              {el.currentValue !== undefined && el.currentValue !== null
                ? el.currentValue
                : 0}
            </text>
          </svg>
        );
      }
      case 'Delay': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <svg
            key={el.id}
            className={`svg-element delay-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={applyConditionStyle({
              left: el.x - offset,
              top: el.y - offset,
            })}
            width={size}
            height={size}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (selectedTool === 'Select') {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <circle
              cx={center}
              cy={center}
              r={15 * scale}
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`delay-circle ${isSelected ? 'selected' : ''}`}
            />
            <text
              x={center}
              y={center + 2 * scale}
              className="delay-text"
              fontSize={14 * scale}
            >
              8
            </text>
          </svg>
        );
      }
      case 'Resource Connection': {
        const startPoint = {
          x: el.startX ?? el.x,
          y: el.startY ?? el.y,
        };
        const endPoint = {
          x: el.endX ?? el.x,
          y: el.endY ?? el.y,
        };
        const pathPoints = [startPoint, ...(el.points ?? []), endPoint];

        if (pathPoints.length < 2) {
          return null;
        }

        const padding = 15;
        const { point: midPoint, normal } = getPolylineMidpoint(pathPoints);
        const labelOffset = 14;
        const labelPoint = {
          x: midPoint.x + normal.x * labelOffset,
          y: midPoint.y + normal.y * labelOffset,
        };

        const pointsForBounds = [...pathPoints, labelPoint];
        const xs = pointsForBounds.map(p => p.x);
        const ys = pointsForBounds.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const left = minX - padding;
        const top = minY - padding;
        const width = Math.max(maxX - minX, 1) + padding * 2;
        const height = Math.max(maxY - minY, 1) + padding * 2;

        const polyPoints = pathPoints
          .map(point => `${point.x - left},${point.y - top}`)
          .join(' ');

        const labelX = labelPoint.x - left;
        const labelY = labelPoint.y - top;
        const isConditionUnsatisfied = !!el.hasUnsatisfiedCondition;
        const baseConnectionColor = el.color || '#000000';
        const stateStroke = isConditionUnsatisfied
          ? '#B0B0B0'
          : baseConnectionColor;
        const markerStroke = stateStroke;
        const containerClasses = [
          'connection-container',
          selectedTool === 'Select' ? 'selectable' : '',
          isSelected ? 'selected' : '',
        ];
        if (isConditionUnsatisfied) {
          containerClasses.push('condition-pending');
        }

        return (
          <div
            key={el.id}
            className={containerClasses.join(' ').trim()}
            style={applyConditionStyle({ left, top, width, height })}
            onMouseDown={e => {
              e.stopPropagation();
              if (selectedTool === 'Select') {
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <svg className="connection-svg">
              <defs>
                <marker
                  id={`arrowhead-${el.id}`}
                  className="arrow-marker"
                  viewBox="0 0 10 7"
                  refX="10"
                  refY="3.5"
                  markerWidth="10"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill={markerStroke}
                    className="arrow-polygon"
                  />
                </marker>
              </defs>
              <polyline
                points={polyPoints}
                className={`connection-line ${isSelected ? 'selected' : ''}`}
                fill="none"
                stroke={stateStroke}
                markerEnd={`url(#arrowhead-${el.id})`}
              />
              {el.text && el.text !== '0' && (
                <text
                  x={labelX}
                  y={labelY}
                  className="connection-label-text"
                  fill={
                    isConditionUnsatisfied ? '#8a8a8a' : baseConnectionColor
                  }
                >
                  {el.text}
                </text>
              )}
            </svg>
            {isSelected && (
              <>
                <div
                  className="arrow-handle"
                  style={{
                    left: startPoint.x - left - 4,
                    top: startPoint.y - top - 4,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                <div
                  className="arrow-handle"
                  style={{
                    left: endPoint.x - left - 4,
                    top: endPoint.y - top - 4,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'end')}
                />
              </>
            )}
          </div>
        );
      }
      case 'State Connection': {
        const startPoint = {
          x: el.startX ?? el.x,
          y: el.startY ?? el.y,
        };
        const endPoint = {
          x: el.endX ?? el.x,
          y: el.endY ?? el.y,
        };
        const pathPoints = [startPoint, ...(el.points ?? []), endPoint];

        if (pathPoints.length < 2) {
          return null;
        }

        const padding = 15;
        const { point: midPoint, normal } = getPolylineMidpoint(pathPoints);
        const labelOffset = 14;
        const labelPoint = {
          x: midPoint.x + normal.x * labelOffset,
          y: midPoint.y + normal.y * labelOffset,
        };

        const pointsForBounds = [...pathPoints, labelPoint];
        const xs = pointsForBounds.map(p => p.x);
        const ys = pointsForBounds.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const left = minX - padding;
        const top = minY - padding;
        const width = Math.max(maxX - minX, 1) + padding * 2;
        const height = Math.max(maxY - minY, 1) + padding * 2;

        const polyPoints = pathPoints
          .map(point => `${point.x - left},${point.y - top}`)
          .join(' ');

        const labelX = labelPoint.x - left;
        const labelY = labelPoint.y - top;

        const targetElement = elements.find(
          element => element.id === el.connectedToEnd
        );
        const isConditionUnsatisfied =
          (targetElement && targetElement.hasUnsatisfiedCondition) ||
          (typeof targetElement === 'undefined' &&
            el.conditionSatisfied === false);
        // const stateStroke = isConditionUnsatisfied ? '#B0B0B0' : '#000000';
        // const markerStroke = stateStroke;
        const labelFill = isConditionUnsatisfied ? '#888888' : '#000000';
        const containerClasses = [
          'connection-container',
          selectedTool === 'Select' ? 'selectable' : '',
          isSelected ? 'selected' : '',
        ];
        if (isConditionUnsatisfied) {
          containerClasses.push('condition-pending');
        }

        return (
          <div
            key={el.id}
            className={containerClasses.join(' ').trim()}
            style={applyConditionStyle({ left, top, width, height })}
            onMouseDown={e => {
              e.stopPropagation();
              if (selectedTool === 'Select') {
                if (e.ctrlKey || e.metaKey) {
                  setSelectedId(prev =>
                    prev.includes(el.id)
                      ? prev.filter(selId => selId !== el.id)
                      : [...prev, el.id]
                  );
                } else {
                  setSelectedId([el.id]);
                }
              }
            }}
          >
            <svg className="connection-svg">
              <defs>
                <marker
                  id={`arrowhead-dashed-${el.id}`}
                  className="arrow-marker"
                  viewBox="0 0 10 7"
                  refX="10"
                  refY="3.5"
                  markerWidth="10"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    // fill={markerStroke}
                    fill={el.color || '#000000'}
                    className="dashed-arrow-polygon"
                  />
                </marker>
              </defs>
              <polyline
                points={polyPoints}
                // stroke={stateStroke}
                stroke={isConditionUnsatisfied ? '#B0B0B0' : el.color || '#666'}
                strokeWidth={isSelected ? 3 : 2}
                strokeDasharray="5,5"
                fill="none"
                className={`state-connection-line ${isSelected ? 'selected' : ''}`}
                markerEnd={`url(#arrowhead-dashed-${el.id})`}
              />
              {el.text && el.text !== '0' && (
                <text
                  x={labelX}
                  y={labelY}
                  className="connection-label-text"
                  fill={labelFill}
                >
                  {el.text}
                </text>
              )}
            </svg>
            {isSelected && (
              <>
                <div
                  className="arrow-handle"
                  style={{
                    left: startPoint.x - left - 4,
                    top: startPoint.y - top - 4,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                <div
                  className="arrow-handle"
                  style={{
                    left: endPoint.x - left - 4,
                    top: endPoint.y - top - 4,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'end')}
                />
              </>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  // Render connection being created
  const renderConnectionPreview = () => {
    if (!isCreatingConnection || connectionPoints.length === 0) {
      return null;
    }

    const previewPoints = [...connectionPoints];
    const lastFixed = previewPoints[previewPoints.length - 1];
    if (connectionPreviewPoint) {
      const { x: px, y: py } = connectionPreviewPoint;
      if (!lastFixed || lastFixed.x !== px || lastFixed.y !== py) {
        previewPoints.push(connectionPreviewPoint);
      }
    }

    if (previewPoints.length < 2) {
      return null;
    }

    const padding = 15;
    const xs = previewPoints.map(p => p.x);
    const ys = previewPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const left = minX - padding;
    const top = minY - padding;
    const width = Math.max(maxX - minX, 1) + padding * 2;
    const height = Math.max(maxY - minY, 1) + padding * 2;

    const polyPoints = previewPoints
      .map(point => `${point.x - left},${point.y - top}`)
      .join(' ');

    return (
      <svg
        className="connection-preview"
        style={{
          left,
          top,
          width,
          height,
        }}
      >
        <defs>
          <marker id="arrowhead-preview" className="arrow-marker">
            <polygon points="0 0, 10 3.5, 0 7" className="arrow-polygon" />
          </marker>
        </defs>
        <polyline
          points={polyPoints}
          className={`connection-line ${connectionType === 'State Connection' ? 'state-connection-line' : ''}`}
          fill="none"
          markerEnd="url(#arrowhead-preview)"
        />
      </svg>
    );
  };

  // Render bounding box selection rectangle
  const renderSelectionBox = () => {
    if (isSelectingBox && boxStart && boxEnd) {
      const left = Math.min(boxStart.x, boxEnd.x);
      const top = Math.min(boxStart.y, boxEnd.y);
      const width = Math.abs(boxEnd.x - boxStart.x);
      const height = Math.abs(boxEnd.y - boxStart.y);
      return (
        <div
          className="selection-box"
          style={{
            left,
            top,
            width,
            height,
          }}
        />
      );
    }
    return null;
  };

  const displayElements = draggedElements || elements;

  return (
    <div
      ref={canvasRef}
      className={`canvas ${isRunning ? 'is-running' : ''} ${gameEnded ? 'game-ended' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      onMouseMove={handleMouseMove}
      onMouseDown={handleCanvasMouseDown}
      onMouseUp={handleMouseUp}
    >
      {displayElements.map(renderElement)}
      {renderConnectionPreview()}
      {renderSelectionBox()}
    </div>
  );
};

export default Canvas;
