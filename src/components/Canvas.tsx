import React, { useState, useRef, useEffect, useCallback } from 'react';
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

  // For connection elements
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  // Connection tracking
  connectedToStart?: number; // ID of element this connection starts from
  connectedToEnd?: number; // ID of element this connection ends at
  currentPoints?: number;
  hasStarted?: boolean;
}

const Canvas: React.FC<CanvasProps> = ({
  isRunning,
  selectedTool,
  elements: externalElements,
  selectedElementIds: externalSelectedIds,
  onElementsChange,
  onSelectionChange,
  onElementUpdate,
  onElementSelection,
  //externalElementUpdate,
  toolProperties,
}) => {
  const [internalElements, setInternalElements] = useState<GraphElement[]>([]);
  const [internalSelectedIds, setInternalSelectedIds] = useState<number[]>([]);

  const elements = externalElements ?? internalElements;
  const selectedId = externalSelectedIds ?? internalSelectedIds;

  const setElements = useCallback(
    (
      newElements: GraphElement[] | ((prev: GraphElement[]) => GraphElement[])
    ) => {
      const updatedElements =
        typeof newElements === 'function' ? newElements(elements) : newElements;

      if (onElementsChange) {
        onElementsChange(updatedElements);
      } else {
        setInternalElements(updatedElements);
      }
    },
    [elements, onElementsChange]
  );

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
  const [editingId, setEditingId] = useState<number | null>(null);
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
  const [connectionStart, setConnectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [connectionEnd, setConnectionEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [connectionType, setConnectionType] = useState<GraphElementType | null>(
    null
  );

  const canvasRef = useRef<HTMLDivElement>(null);

  // ---------- Gate helpers ----------
  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  type LabelKind = 'prob' | 'cond' | 'interval' | 'else' | 'empty' | 'invalid';

  function classifyLabel(raw?: string): LabelKind {
    const s = (raw ?? '').trim();
    if (!s) return 'empty';
    if (s.toLowerCase() === 'else') return 'else';
    if (/^\d+\s*%$/.test(s)) return 'prob'; // "70%"
    if (/^\d+(\.\d+)?$/.test(s)) return 'prob'; // weight "4"
    if (/^(==|!=|>=|<=|>|<)\s*-?\d+(\.\d+)?$/.test(s)) return 'cond';
    if (/^-?\d+(\.\d+)?\s*-\s*-?\d+(\.\d+)?$/.test(s)) return 'interval';
    return 'invalid';
  }

  function parseInterval(raw: string): [number, number] | null {
    const m = raw
      .trim()
      .match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!m) return null;
    const a = parseFloat(m[1]),
      b = parseFloat(m[2]);
    return a <= b ? [a, b] : [b, a];
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

  // Decide a gate "value" for condition/interval labels.
  function generateGateValue(g: GraphElement): number {
    const sides = Math.max(2, g.actions ?? 6);
    if (g.gateType === 'dice') {
      return randInt(1, sides);
    }
    // deterministic cycle
    const prev = g.lastGateValue ?? 0;
    return (prev % sides) + 1;
  }

  /**
   * Choose one output connection given labels.
   * Condition-mode if there is ANY cond/interval label (ELSE ALONE does NOT trigger cond-mode).
   * Otherwise probability-mode:
   *  - If any '%' are present, '%'-labels are used and 'else' gets (100 - sum%).
   *  - If no '%', numeric weights & empty labels (weight 1) are used. 'else' has weight 0 by default.
   */
  function chooseGateOutput(
    gate: GraphElement,
    outputs: GraphElement[]
  ): GraphElement | null {
    if (outputs.length === 0) return null;

    const kinds = outputs.map(o => classifyLabel(o.text));

    // ---- condition mode (ignore 'else' when deciding to enter this mode)
    const hasRealCondition = kinds.some(k => k === 'cond' || k === 'interval');
    if (hasRealCondition) {
      const v = generateGateValue(gate);
      gate.lastGateValue = v;

      // try conds and intervals in order
      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i];
        const kind = kinds[i];
        if (kind === 'cond') {
          const fn = parseCond(o.text!);
          if (fn && fn(v)) return o;
        } else if (kind === 'interval') {
          const pair = parseInterval(o.text!);
          if (pair && v >= pair[0] && v <= pair[1]) return o;
        }
      }
      // else fallback
      const elseIdx = kinds.findIndex(k => k === 'else');
      return elseIdx >= 0 ? outputs[elseIdx] : null;
    }

    // ---- probability mode
    const isPercent = outputs.some(
      (o, i) => kinds[i] === 'prob' && /%$/.test((o.text ?? '').trim())
    );
    const weights = new Array(outputs.length).fill(0);
    const elseIdx = kinds.findIndex(k => k === 'else');

    if (isPercent) {
      // use only % labels; else gets remainder to 100
      let sumPercent = 0;
      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i];
        const s = (o.text ?? '').trim();
        if (kinds[i] === 'prob' && /%$/.test(s)) {
          const w = Math.max(0, parseInt(s, 10) || 0);
          weights[i] = w;
          sumPercent += w;
        }
      }
      if (elseIdx >= 0) {
        const rem = Math.max(0, 100 - sumPercent);
        weights[elseIdx] = rem;
        sumPercent += rem;
      }
      if (sumPercent <= 0) return elseIdx >= 0 ? outputs[elseIdx] : null;

      let r = Math.random() * sumPercent;
      for (let i = 0; i < outputs.length; i++) {
        r -= weights[i];
        if (r <= 0 && weights[i] > 0) return outputs[i];
      }
      return outputs[outputs.length - 1];
    } else {
      // plain weights: number => weight; empty => 1; else => 0 (unless you want to assign a weight)
      for (let i = 0; i < outputs.length; i++) {
        const kind = kinds[i];
        const s = (outputs[i].text ?? '').trim();
        if (kind === 'prob' && !/%$/.test(s)) {
          weights[i] = Math.max(0, parseFloat(s) || 0);
        } else if (kind === 'empty') {
          weights[i] = 1;
        } else {
          weights[i] = 0; // else/invalid default 0 in weight-mode
        }
      }
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) return elseIdx >= 0 ? outputs[elseIdx] : null;

      let r = Math.random() * total;
      for (let i = 0; i < outputs.length; i++) {
        r -= weights[i];
        if (r <= 0 && weights[i] > 0) return outputs[i];
      }
      return outputs[outputs.length - 1];
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
      if (element.currentPoints !== undefined && element.currentPoints !== null) {
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

  const runSimulationTick = (
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

    // PASS 0: initialize check
    if (activationType === 'onstart') {
      // console.log('🔄 [PASS 0] Initializing elements...');
      for (const element of nextElements) {
        if (element.type === 'Pool') {
          if (element.currentPoints === undefined || element.currentPoints === null) {
            const startingPoints = typeof element.number === 'string'
              ? parseInt(element.number, 10) || 0
              : element.number || 0;
            element.currentPoints = startingPoints;
            // console.log('  ✓ Pool initialized:', {
              // id: element.id,
              // currentPoints: element.currentPoints,
            // });
          }
        }
      }
    }

    // --------- PASS 1: generic connections (but SKIP Gate outputs) ---------
    for (const connection of nextElements) {
      if (
        connection.type !== 'Resource Connection' ||
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

      // Case 1: Source -> Pool
      if (startElement.type === 'Source' && endElement.type === 'Pool') {
        let isTriggerActive = false;
        if (activationType === 'automatic') {
          if (
            startElement.activation === 'automatic' ||
            startElement.activation === 'passive'
          )
            isTriggerActive = true;
        } else {
          if (startElement.activation === activationType)
            isTriggerActive = true;
        }
        const canFire =
          activationType !== 'onstart' || !startElement.hasStarted;
        const isTarget =
          !interactiveElementId || startElement.id === interactiveElementId;

        if (isTarget && isTriggerActive && canFire) {
          const currentPoolPoints = endElement.currentPoints || 0;
          const newTotal = currentPoolPoints + transferAmount;
          endElement.currentPoints = Math.min(
            newTotal,
            endElement.max ?? Infinity
          );
          if (activationType === 'onstart') startElement.hasStarted = true;
        }
      }

      // Case 2: Pool -> Drain
      if (startElement.type === 'Pool' && endElement.type === 'Drain') {
        let isTriggerActive = false;
        if (activationType === 'automatic') {
          if (
            endElement.activation === 'automatic' ||
            endElement.activation === 'passive'
          )
            isTriggerActive = true;
        } else {
          if (endElement.activation === activationType) isTriggerActive = true;
        }
        const canFire = activationType !== 'onstart' || !endElement.hasStarted;
        const isTarget =
          !interactiveElementId || endElement.id === interactiveElementId;

        if (isTarget && isTriggerActive && canFire) {
          const pointsAvailable = startElement.currentPoints || 0;
          const toTransfer = Math.min(transferAmount, pointsAvailable);
          if (toTransfer > 0)
            startElement.currentPoints = pointsAvailable - toTransfer;
          if (activationType === 'onstart') endElement.hasStarted = true;
        }
      }
    }

    // --------- PASS 2: process Gates ----------
    for (const gate of nextElements) {
      if (gate.type !== 'Gate') continue;

      // Activation gate check
      let isTriggerActive = false;
      if (activationType === 'automatic') {
        if (gate.activation === 'automatic' || gate.activation === 'passive')
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
        c => c.type === 'Resource Connection' && c.connectedToEnd === gate.id
      );

      // Collect outputs (both resource and state connections starting at this gate)
      const outputConns = nextElements.filter(
        c =>
          (c.type === 'Resource Connection' || c.type === 'State Connection') &&
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
          return;
        }

        // If Drain (via resource path) => "lost", do nothing.
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
          const chosen = chooseGateOutput(gate, outputConns);
          if (chosen) {
            // lastGateValue is set inside chooseGateOutput in condition-mode.
            deliverOne(chosen);
          }

          // else: dropped on the floor (no match and no 'else')
        }
      }

      if (activationType === 'onstart') gate.hasStarted = true;
    }

    // --------- PASS 3: process Convertors ----------
    for (const convertor of nextElements) {
      if (convertor.type !== 'Convertor') continue;

      // Activation check
      let isTriggerActive = false;
      if (activationType === 'automatic') {
        if (
          convertor.activation === 'automatic' ||
          convertor.activation === 'passive'
        )
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
        c =>
          c.type === 'Resource Connection' && c.connectedToEnd === convertor.id
      );

      // Collect output connections (resource connections starting at this convertor)
      const outputConns = nextElements.filter(
        c =>
          c.type === 'Resource Connection' &&
          c.connectedToStart === convertor.id
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
        const requiredInputs: Record<string, number> = {};
        for (const inputConn of inputConns) {
          const amount = parseInt(inputConn.text || '1', 10);
          if (!isNaN(amount) && amount > 0) {
            const resourceType = inputConn.text || 'default';
            requiredInputs[resourceType] = amount;
          }
        }

        // Parse output connection labels to determine output resources
        const outputAmounts: Record<string, number> = {};
        for (const outputConn of outputConns) {
          const amount = parseInt(outputConn.text || '1', 10);
          if (!isNaN(amount) && amount > 0) {
            const resourceType = outputConn.text || 'default';
            outputAmounts[resourceType] = amount;
          }
        }

        // Check if we can satisfy all input requirements
        let canConvert = true;
        if (convertor.pullMode === 'pull all') {
          // For pull all: need all inputs available simultaneously
          for (const [resourceType, requiredAmount] of Object.entries(
            requiredInputs
          )) {
            const connection = inputConns.find(c => c.text === resourceType);
            const inputElement = connection?.connectedToStart
              ? elementMap.get(connection.connectedToStart)
              : undefined;
            if (
              !inputElement ||
              (inputElement.currentPoints ?? 0) < requiredAmount
            ) {
              canConvert = false;
              break;
            }
          }
        } else {
          // For pull any: check if we have stored enough resources
          for (const [resourceType, requiredAmount] of Object.entries(
            requiredInputs
          )) {
            const stored = convertor.inputResources![resourceType] || 0;
            if (stored < requiredAmount) {
              canConvert = false;
              break;
            }
          }
        }

        if (canConvert) {
          // Consume input resources
          if (convertor.pullMode === 'pull all') {
            // Consume directly from input pools
            for (const [resourceType, requiredAmount] of Object.entries(
              requiredInputs
            )) {
              const inputConn = inputConns.find(c => c.text === resourceType);
              if (inputConn) {
                const inputElement = elementMap.get(
                  inputConn.connectedToStart!
                );
                if (inputElement) {
                  inputElement.currentPoints = Math.max(
                    0,
                    (inputElement.currentPoints ?? 0) - requiredAmount
                  );
                }
              }
            }
          } else {
            // Consume from stored resources
            for (const [resourceType, requiredAmount] of Object.entries(
              requiredInputs
            )) {
              const current = convertor.inputResources![resourceType] || 0;
              convertor.inputResources![resourceType] =
                current - requiredAmount;
            }
          }

          // Produce output resources
          for (const [resourceType, outputAmount] of Object.entries(
            outputAmounts
          )) {
            const outputConn = outputConns.find(c => c.text === resourceType);
            if (outputConn) {
              const outputElement = elementMap.get(outputConn.connectedToEnd!);
              if (outputElement && outputElement.type === 'Pool') {
                const current = outputElement.currentPoints ?? 0;
                const max = outputElement.max ?? Infinity;
                outputElement.currentPoints = Math.min(
                  current + outputAmount,
                  max
                );
              }
            }
          }
        } else {
          // For pull any mode, try to pull and store resources
          if (convertor.pullMode === 'pull any') {
            for (const inputConn of inputConns) {
              const inputElement = elementMap.get(inputConn.connectedToStart!);
              if (
                inputElement &&
                inputElement.type === 'Pool' &&
                (inputElement.currentPoints ?? 0) > 0
              ) {
                const amount = parseInt(inputConn.text || '1', 10);
                const available = Math.min(
                  amount,
                  inputElement.currentPoints ?? 0
                );

                if (available > 0) {
                  inputElement.currentPoints =
                    (inputElement.currentPoints ?? 0) - available;
                  const resourceType = inputConn.text || 'default';
                  const current = convertor.inputResources![resourceType] || 0;
                  convertor.inputResources![resourceType] = current + available;
                }
              }
            }
          }
        }
      }

      if (activationType === 'onstart') convertor.hasStarted = true;
    }

    // --------- PASS 4: process Traders ----------
    for (const trader of nextElements) {
      if (trader.type !== 'Trader') continue;

      // Activation check
      let isTriggerActive = false;
      if (activationType === 'automatic') {
        if (
          trader.activation === 'automatic' ||
          trader.activation === 'passive'
        )
          isTriggerActive = true;
      } else {
        if (trader.activation === activationType) isTriggerActive = true;
      }
      const canFire = activationType !== 'onstart' || !trader.hasStarted;
      const isTarget =
        !interactiveElementId || trader.id === interactiveElementId;

      if (!(isTriggerActive && canFire && isTarget)) continue;

      // Initialize trader storage if not exists
      if (!trader.traderInputs) {
        trader.traderInputs = {};
      }
      if (!trader.traderOutputs) {
        trader.traderOutputs = {};
      }

      // Collect input connections (resource connections ending at this trader)
      const inputConns = nextElements.filter(
        c => c.type === 'Resource Connection' && c.connectedToEnd === trader.id
      );

      // Collect output connections (resource connections starting at this trader)
      const outputConns = nextElements.filter(
        c =>
          c.type === 'Resource Connection' && c.connectedToStart === trader.id
      );

      if (inputConns.length === 0 || outputConns.length === 0) {
        if (activationType === 'onstart') trader.hasStarted = true;
        continue;
      }

      // Check if trader is incomplete (< 2 inputs or < 2 outputs)
      const isIncomplete = inputConns.length < 2 || outputConns.length < 2;
      trader.isIncompleteTrader = isIncomplete;

      // Determine actions this tick
      const actions = Math.max(1, trader.actions ?? 1);

      // Process each action
      for (let a = 0; a < actions; a++) {
        if (isIncomplete) {
          // Incomplete trader behaves like a convertor
          processIncompleteTrader(trader, inputConns, outputConns, elementMap);
        } else {
          // Complete trader - ensure resource conservation
          processCompleteTrader(trader, inputConns, outputConns, elementMap);
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
        if (register.currentValue === undefined || register.currentValue === null) {
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

    return nextElements;
  };

  // Helper function for incomplete trader (behaves like convertor)
  const processIncompleteTrader = (
    trader: GraphElement,
    inputConns: GraphElement[],
    outputConns: GraphElement[],
    elementMap: Map<number, GraphElement>
  ) => {
    // Parse input connection labels to determine required resources
    const requiredInputs: Record<string, number> = {};
    for (const inputConn of inputConns) {
      const amount = parseInt(inputConn.text || '1', 10);
      if (!isNaN(amount) && amount > 0) {
        const resourceType = inputConn.text || 'default';
        requiredInputs[resourceType] = amount;
      }
    }

    // Parse output connection labels to determine output resources
    const outputAmounts: Record<string, number> = {};
    for (const outputConn of outputConns) {
      const amount = parseInt(outputConn.text || '1', 10);
      if (!isNaN(amount) && amount > 0) {
        const resourceType = outputConn.text || 'default';
        outputAmounts[resourceType] = amount;
      }
    }

    // Check if we can satisfy all input requirements
    let canTrade = true;
    if (trader.pullMode === 'pull all') {
      // For pull all: need all inputs available simultaneously
      for (const [resourceType, requiredAmount] of Object.entries(
        requiredInputs
      )) {
        const connection = inputConns.find(c => c.text === resourceType);
        const inputElement = connection?.connectedToStart
          ? elementMap.get(connection.connectedToStart)
          : undefined;
        if (
          !inputElement ||
          (inputElement.currentPoints ?? 0) < requiredAmount
        ) {
          canTrade = false;
          break;
        }
      }
    } else {
      // For pull any: check if we have stored enough resources
      for (const [resourceType, requiredAmount] of Object.entries(
        requiredInputs
      )) {
        const stored = trader.traderInputs![resourceType] || 0;
        if (stored < requiredAmount) {
          canTrade = false;
          break;
        }
      }
    }

    if (canTrade) {
      // Consume input resources
      if (trader.pullMode === 'pull all') {
        // Consume directly from input pools
        for (const [resourceType, requiredAmount] of Object.entries(
          requiredInputs
        )) {
          const inputConn = inputConns.find(c => c.text === resourceType);
          if (inputConn) {
            const inputElement = elementMap.get(inputConn.connectedToStart!);
            if (inputElement) {
              inputElement.currentPoints = Math.max(
                0,
                (inputElement.currentPoints ?? 0) - requiredAmount
              );
            }
          }
        }
      } else {
        // Consume from stored resources
        for (const [resourceType, requiredAmount] of Object.entries(
          requiredInputs
        )) {
          const current = trader.traderInputs![resourceType] || 0;
          trader.traderInputs![resourceType] = current - requiredAmount;
        }
      }

      // Produce output resources
      for (const [resourceType, outputAmount] of Object.entries(
        outputAmounts
      )) {
        const outputConn = outputConns.find(c => c.text === resourceType);
        if (outputConn) {
          const outputElement = elementMap.get(outputConn.connectedToEnd!);
          if (outputElement && outputElement.type === 'Pool') {
            const current = outputElement.currentPoints ?? 0;
            const max = outputElement.max ?? Infinity;
            outputElement.currentPoints = Math.min(current + outputAmount, max);
          }
        }
      }
    } else {
      // For pull any mode, try to pull and store resources
      if (trader.pullMode === 'pull any') {
        for (const inputConn of inputConns) {
          const inputElement = elementMap.get(inputConn.connectedToStart!);
          if (
            inputElement &&
            inputElement.type === 'Pool' &&
            (inputElement.currentPoints ?? 0) > 0
          ) {
            const amount = parseInt(inputConn.text || '1', 10);
            const available = Math.min(amount, inputElement.currentPoints ?? 0);

            if (available > 0) {
              inputElement.currentPoints =
                (inputElement.currentPoints ?? 0) - available;
              const resourceType = inputConn.text || 'default';
              const current = trader.traderInputs![resourceType] || 0;
              trader.traderInputs![resourceType] = current + available;
            }
          }
        }
      }
    }
  };

  // Helper function for complete trader (ensures resource conservation)
  const processCompleteTrader = (
    trader: GraphElement,
    inputConns: GraphElement[],
    outputConns: GraphElement[],
    elementMap: Map<number, GraphElement>
  ) => {
    // Parse input connection labels to determine required resources
    const requiredInputs: Record<string, number> = {};
    for (const inputConn of inputConns) {
      const amount = parseInt(inputConn.text || '1', 10);
      if (!isNaN(amount) && amount > 0) {
        const resourceType = inputConn.text || 'default';
        requiredInputs[resourceType] = amount;
      }
    }

    // Parse output connection labels to determine output resources
    const outputAmounts: Record<string, number> = {};
    for (const outputConn of outputConns) {
      const amount = parseInt(outputConn.text || '1', 10);
      if (!isNaN(amount) && amount > 0) {
        const resourceType = outputConn.text || 'default';
        outputAmounts[resourceType] = amount;
      }
    }

    // Calculate total input and output amounts for conservation check
    const totalInputAmount = Object.values(requiredInputs).reduce(
      (sum, amount) => sum + amount,
      0
    );
    const totalOutputAmount = Object.values(outputAmounts).reduce(
      (sum, amount) => sum + amount,
      0
    );

    // For complete traders, ensure resource conservation (total input = total output)
    if (totalInputAmount !== totalOutputAmount) {
      // Scale output amounts to match input amounts for conservation
      const scaleFactor = totalInputAmount / totalOutputAmount;
      for (const resourceType in outputAmounts) {
        outputAmounts[resourceType] = Math.floor(
          outputAmounts[resourceType] * scaleFactor
        );
      }
    }

    // Check if we can satisfy all input requirements
    let canTrade = true;
    if (trader.pullMode === 'pull all') {
      // For pull all: need all inputs available simultaneously
      for (const [resourceType, requiredAmount] of Object.entries(
        requiredInputs
      )) {
        const connection = inputConns.find(c => c.text === resourceType);
        const inputElement = connection?.connectedToStart
          ? elementMap.get(connection.connectedToStart)
          : undefined;
        if (
          !inputElement ||
          (inputElement.currentPoints ?? 0) < requiredAmount
        ) {
          canTrade = false;
          break;
        }
      }
    } else {
      // For pull any: check if we have stored enough resources
      for (const [resourceType, requiredAmount] of Object.entries(
        requiredInputs
      )) {
        const stored = trader.traderInputs![resourceType] || 0;
        if (stored < requiredAmount) {
          canTrade = false;
          break;
        }
      }
    }

    if (canTrade) {
      // Consume input resources
      if (trader.pullMode === 'pull all') {
        // Consume directly from input pools
        for (const [resourceType, requiredAmount] of Object.entries(
          requiredInputs
        )) {
          const inputConn = inputConns.find(c => c.text === resourceType);
          if (inputConn) {
            const inputElement = elementMap.get(inputConn.connectedToStart!);
            if (inputElement) {
              inputElement.currentPoints = Math.max(
                0,
                (inputElement.currentPoints ?? 0) - requiredAmount
              );
            }
          }
        }
      } else {
        // Consume from stored resources
        for (const [resourceType, requiredAmount] of Object.entries(
          requiredInputs
        )) {
          const current = trader.traderInputs![resourceType] || 0;
          trader.traderInputs![resourceType] = current - requiredAmount;
        }
      }

      // Produce output resources
      for (const [resourceType, outputAmount] of Object.entries(
        outputAmounts
      )) {
        const outputConn = outputConns.find(c => c.text === resourceType);
        if (outputConn) {
          const outputElement = elementMap.get(outputConn.connectedToEnd!);
          if (outputElement && outputElement.type === 'Pool') {
            const current = outputElement.currentPoints ?? 0;
            const max = outputElement.max ?? Infinity;
            outputElement.currentPoints = Math.min(current + outputAmount, max);
          }
        }
      }
    } else {
      // For pull any mode, try to pull and store resources
      if (trader.pullMode === 'pull any') {
        for (const inputConn of inputConns) {
          const inputElement = elementMap.get(inputConn.connectedToStart!);
          if (
            inputElement &&
            inputElement.type === 'Pool' &&
            (inputElement.currentPoints ?? 0) > 0
          ) {
            const amount = parseInt(inputConn.text || '1', 10);
            const available = Math.min(amount, inputElement.currentPoints ?? 0);

            if (available > 0) {
              inputElement.currentPoints =
                (inputElement.currentPoints ?? 0) - available;
              const resourceType = inputConn.text || 'default';
              const current = trader.traderInputs![resourceType] || 0;
              trader.traderInputs![resourceType] = current + available;
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
      // Handle escape key to cancel connection creation
      if (e.key === 'Escape' && isCreatingConnection) {
        setIsCreatingConnection(false);
        setConnectionStart(null);
        setConnectionEnd(null);
        setConnectionType(null);
      }

      // Handle delete key to remove selected elements
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedId.length > 0
      ) {
        if (isRunning) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }
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
        (acc, el) => ({
          minX: Math.min(acc.minX, el.x),
          minY: Math.min(acc.minY, el.y),
          maxX: Math.max(acc.maxX, el.x + (el.width || 40)),
          maxY: Math.max(acc.maxY, el.y + (el.height || 40)),
        }),
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
  ]);

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
    excludeId?: number
  ): GraphElement | null => {
    const threshold = 60; // Maximum distance to consider an element "close"
    let closestElement: GraphElement | null = null;
    let closestDistance = threshold;

    elements.forEach(element => {
      if (element.id === excludeId) return;

      // Skip connection elements
      if (
        element.type === 'Resource Connection' ||
        element.type === 'State Connection'
      )
        return;

      const elementX = element.x;
      const elementY = element.y;
      let elementWidth = 40; // Default size for most elements
      let elementHeight = 40;

      // Adjust for different element types
      if (element.type === 'Group') {
        elementWidth = element.width || 200;
        elementHeight = element.height || 150;
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
    const elementWidth = element.type === 'Group' ? element.width || 200 : 40;
    const elementHeight = element.type === 'Group' ? element.height || 150 : 40;

    const left = element.x;
    const right = element.x + elementWidth;
    const top = element.y;
    const bottom = element.y + elementHeight;

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
          text: toolProperties?.textLabel?.text || 'Text Label',
          color: toolProperties?.textLabel?.color || '#000000',
        },
      ]);
      setEditingId(id);
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
    } else if (type === 'Pool') {
      const poolProps = toolProperties?.pool;
      const startingPoints = typeof poolProps?.number === 'string' ? parseInt(poolProps.number, 10) || 0 : poolProps?.number || 0;
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
    } else if (type === 'Resource Connection' || type === 'State Connection') {
      setIsCreatingConnection(true);
      setConnectionStart({ x, y });
      setConnectionEnd({ x, y });
      setConnectionType(type);
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
        },
      ]);
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
    } else {
      setElements(prev => [...prev, { id, type, x, y }]);
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

  // Click-to-place handler
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't clear selection if we just completed a box selection
    if (justCompletedBoxSelection) {
      setJustCompletedBoxSelection(false);
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
      setSelectedId([]);
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

  // Text label editing
  const handleTextChange = (id: number, value: string) => {
    setElements(elements =>
      elements.map(el => (el.id === id ? { ...el, text: value } : el))
    );
    // Notify parent component of the change
    if (onElementUpdate) {
      onElementUpdate(id, { text: value });
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
      if (element.type === 'Register' && 
        (element.interactive === true || element.interactive === 'true')) {
        // console.log('🖱️ Interactive Register clicked:', {
          // id: element.id,
          // currentValue: element.currentValue,
          // step: element.step,
        // });

        const step = typeof element.step === 'string' 
          ? parseInt(element.step, 10) || 1 
          : element.step || 1;
        const currentVal = element.currentValue || 0;
        const newValue = currentVal + step;
        const min = typeof element.minValue === 'string'
          ? parseInt(element.minValue, 10) || 0
          : element.minValue ?? -9999;
        const max = typeof element.maxValue === 'string'
          ? parseInt(element.maxValue, 10) || 50
          : element.maxValue ?? 9999;
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
    if (isCreatingConnection && connectionStart) {
      const rect = canvasRef.current!.getBoundingClientRect();
      setConnectionEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
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

    // Handle connection creation end
    if (
      isCreatingConnection &&
      connectionStart &&
      connectionEnd &&
      connectionType
    ) {
      const id = Date.now();

      // Find closest elements to start and end points
      const startElement = findClosestElement(
        connectionStart.x,
        connectionStart.y
      );
      const endElement = findClosestElement(connectionEnd.x, connectionEnd.y);

      console.log('Connection creation:', {
        startElement: startElement?.id,
        endElement: endElement?.id,
        startPos: { x: connectionStart.x, y: connectionStart.y },
        endPos: { x: connectionEnd.x, y: connectionEnd.y },
      });

      // Calculate connection points relative to element edges
      let finalStartX = connectionStart.x;
      let finalStartY = connectionStart.y;
      let finalEndX = connectionEnd.x;
      let finalEndY = connectionEnd.y;

      if (startElement) {
        const startEdgePoint = findClosestEdgePoint(
          connectionStart.x,
          connectionStart.y,
          startElement
        );
        finalStartX = startEdgePoint.x;
        finalStartY = startEdgePoint.y;
      }

      if (endElement) {
        const endEdgePoint = findClosestEdgePoint(
          connectionEnd.x,
          connectionEnd.y,
          endElement
        );
        finalEndX = endEdgePoint.x;
        finalEndY = endEdgePoint.y;
      }

      setElements(prev => [
        ...prev,
        {
          id,
          type: connectionType,
          x: finalStartX,
          y: finalStartY,
          startX: finalStartX,
          startY: finalStartY,
          endX: finalEndX,
          endY: finalEndY,
          connectedToStart: startElement?.id,
          connectedToEnd: endElement?.id,
          ...(connectionType === 'Resource Connection'
            ? toolProperties?.resourceConnection
            : {}),
          ...(connectionType === 'State Connection'
            ? toolProperties?.stateConnection
            : {}),
        },
      ]);
      setIsCreatingConnection(false);
      setConnectionStart(null);
      setConnectionEnd(null);
      setConnectionType(null);
      return;
    }

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

  // Render each element
  const renderElement = (el: GraphElement) => {
    const isSelected = selectedId.includes(el.id);
    switch (el.type) {
      case 'Text Label':
        return editingId === el.id ? (
          <input
            key={el.id}
            className={`text-label-input ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
              color: el.color || '#000000',
            }}
            value={el.text || ''}
            autoFocus
            onBlur={() => setEditingId(null)}
            onChange={e => handleTextChange(el.id, e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            key={el.id}
            className={`text-label-span ${selectedTool === 'Select' ? 'selectable' : 'clickable'} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
              color: el.color || '#000000',
            }}
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
                setEditingId(el.id);
              }
            }}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
          >
            {el.text}
          </span>
        );
      case 'Pool':
        return (
          <svg
            key={el.id}
            className={`svg-element pool-element ${
              selectedTool === 'Select' ? 'selectable' : ''
            } ${isSelected ? 'selected' : ''}`}
            style={{ left: el.x, top: el.y }}
            width={40}
            height={40}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            // onClick={e => {
            //   /* Add interactive logic here if Pools can be interactive */
            // }}
          >
            <circle
              cx={20}
              cy={20}
              r={18}
              className={`pool-circle ${isSelected ? 'selected' : ''}`}
              fill="white"
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
            />
            <text
              x="20"
              y="25"
              className="element-value-text"
              fill="black" // <-- The fix is here! Black text for the white pool.
            >
              {el.currentPoints || 0}
            </text>
          </svg>
        );
      case 'Source':
        return (
          <svg
            key={el.id}
            // Add 'clickable-element' to the className string
            className={`svg-element source-element clickable-element ${
              selectedTool === 'Select' ? 'selectable' : ''
            } ${isSelected ? 'selected' : ''}`}
            style={{ left: el.x, top: el.y }}
            width={40}
            height={40}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
          >
            <polygon
              points="20,5 35,35 5,35"
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`source-triangle ${isSelected ? 'selected' : ''}`}
            />
            <text
              x="20"
              y="30"
              className="element-value-text"
              fill="white"
              fontSize="20"
            >
              ∞
            </text>
          </svg>
        );
      case 'Drain':
        return (
          <svg
            key={el.id}
            // Add 'clickable-element' to the className string
            className={`svg-element drain-element clickable-element ${
              selectedTool === 'Select' ? 'selectable' : ''
            } ${isSelected ? 'selected' : ''}`}
            style={{ left: el.x, top: el.y }}
            width={40}
            height={40}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
          >
            <polygon
              points="5,5 35,5 20,35"
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth={el.thickness || 2}
              className={`drain-triangle ${isSelected ? 'selected' : ''}`}
            />
          </svg>
        );
      case 'Group':
        return (
          <div
            key={el.id}
            className={`group-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
              width: el.width || 200,
              height: el.height || 150,
              borderColor: el.color || '#666',
            }}
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
      case 'Gate':
        return (
          <svg
            key={el.id}
            className={`svg-element gate-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
            }}
            width={40}
            height={40}
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
              points="20,5 35,20 20,35 5,20"
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`gate-diamond ${isSelected ? 'selected' : ''}`}
            />
          </svg>
        );
      case 'Convertor':
        return (
          <svg
            key={el.id}
            className={`svg-element convertor-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
            }}
            width={40}
            height={40}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (isRunning && el.activation === 'interactive') {
                e.stopPropagation();
                handleInteractiveAction(el.id);
                return;
              }
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
              points="5,5 35,20 5,35"
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`convertor-shape ${isSelected ? 'selected' : ''}`}
            />
            <line x1="5" y1="5" x2="5" y2="35" className="convertor-line" />

            {/* Show stored resources for pull any mode */}
            {el.pullMode === 'pull any' &&
              el.inputResources &&
              Object.keys(el.inputResources).length > 0 && (
                <text
                  x="20"
                  y="15"
                  fontSize="8"
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
                x="20"
                y="30"
                fontSize="6"
                fill="white"
                textAnchor="middle"
                className="convertor-label"
              >
                {el.text}
              </text>
            )}
          </svg>
        );
      case 'Trader':
        return (
          <svg
            key={el.id}
            className={`svg-element trader-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
            }}
            width={40}
            height={40}
            onMouseDown={e => handleElementMouseDown(e, el.id)}
            onClick={e => {
              if (isRunning && el.activation === 'interactive') {
                e.stopPropagation();
                handleInteractiveAction(el.id);
                return;
              }
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
              points="8,5 35,5 32,35 5,35"
              fill="none"
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              strokeWidth="2"
              className={`trader-shape ${isSelected ? 'selected' : ''}`}
            />

            {/* Show stored resources for pull any mode */}
            {el.pullMode === 'pull any' &&
              el.traderInputs &&
              Object.keys(el.traderInputs).length > 0 && (
                <text
                  x="20"
                  y="15"
                  fontSize="8"
                  fill={el.color || '#000000'}
                  textAnchor="middle"
                  className="trader-storage"
                >
                  {Object.entries(el.traderInputs)
                    .map(([type, amount]) => `${type}:${amount}`)
                    .join(',')}
                </text>
              )}

            {/* Show trader status */}
            {el.text && (
              <text
                x="20"
                y="30"
                fontSize="6"
                fill={el.color || '#000000'}
                textAnchor="middle"
                className="trader-label"
              >
                {el.text}
              </text>
            )}

            {/* Show incomplete trader indicator */}
            {el.isIncompleteTrader && (
              <text
                x="20"
                y="25"
                fontSize="8"
                fill="yellow"
                textAnchor="middle"
                className="trader-incomplete"
              >
                INC
              </text>
            )}
          </svg>
        );
      case 'End Condition':
        return (
          <svg
            key={el.id}
            className={`svg-element end-condition-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
            }}
            width={40}
            height={40}
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
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`end-condition-rect ${isSelected ? 'selected' : ''}`}
            />
            <rect
              x="12"
              y="12"
              width="16"
              height="16"
              fill={el.color || '#000000'}
              className="end-condition-inner-rect"
            />
          </svg>
        );
      case 'Artifical Intelligence':
        return (
          <svg
            key={el.id}
            className={`svg-element ai-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
            }}
            width={40}
            height={40}
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
            <rect
              x="5"
              y="5"
              width="30"
              height="30"
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`ai-rect ${isSelected ? 'selected' : ''}`}
            />
            <text x="20" y="22" className="ai-text">
              AP
            </text>
          </svg>
        );
        case 'Register':
          return (
            <svg
              key={el.id}
              className={`svg-element register-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
              style={{
                left: el.x,
                top: el.y,
              }}
              width={40}
              height={40}
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
              {/* 白色背景方块 */}
              <rect
                x="5"
                y="5"
                width="30"
                height="30"
                fill="white"
                stroke={isSelected ? '#0078d4' : el.color || '#000000'}
                strokeWidth={el.thickness || 2}
                className={`register-rect ${isSelected ? 'selected' : ''}`}
              />
              {/* 显示当前值 */}
              <text
                x="20"
                y="26"
                className="register-text"
                fill="black"
                fontSize="14"
                textAnchor="middle"
                fontWeight="bold"
              >
                {el.currentValue !== undefined && el.currentValue !== null
                  ? el.currentValue
                  : 0}
              </text>
            </svg>
          );
      case 'Delay':
        return (
          <svg
            key={el.id}
            className={`svg-element delay-element ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: el.x,
              top: el.y,
            }}
            width={40}
            height={40}
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
              cx="20"
              cy="20"
              r="15"
              fill={el.color || '#000000'}
              stroke={isSelected ? '#0078d4' : el.color || '#000000'}
              className={`delay-circle ${isSelected ? 'selected' : ''}`}
            />
            <text x="20" y="22" className="delay-text">
              8
            </text>
          </svg>
        );
      case 'Resource Connection': {
        const sx = el.startX || el.x;
        const sy = el.startY || el.y;
        const ex = el.endX || el.x;
        const ey = el.endY || el.y;

        // Calculate bounding box with padding for the label and selection handles
        const left = Math.min(sx, ex) - 15;
        const top = Math.min(sy, ey) - 15;
        const width = Math.abs(ex - sx) + 30;
        const height = Math.abs(ey - sy) + 30;

        // Calculate the midpoint for the label, relative to the new bounding box
        const midX = sx - left + (ex - sx) / 2;
        const midY = sy - top + (ey - sy) / 2;

        return (
          <div
            key={el.id}
            className={`connection-container ${
              selectedTool === 'Select' ? 'selectable' : ''
            } ${isSelected ? 'selected' : ''}`}
            style={{ left, top, width, height }}
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
                    fill={el.color || '#333'}
                    className="arrow-polygon"
                  />
                </marker>
              </defs>
              <line
                x1={
                  (el.startX || el.x) -
                  Math.min(el.startX || el.x, el.endX || el.x) +
                  5
                }
                y1={
                  (el.startY || el.y) -
                  Math.min(el.startY || el.y, el.endY || el.y) +
                  5
                }
                x2={
                  (el.endX || el.x) -
                  Math.min(el.startX || el.x, el.endX || el.x) +
                  5
                }
                y2={
                  (el.endY || el.y) -
                  Math.min(el.startY || el.y, el.endY || el.y) +
                  5
                }
                className={`connection-line ${isSelected ? 'selected' : ''}`}
                markerEnd={`url(#arrowhead-${el.id})`}
              />
              {el.text && el.text !== '0' && (
                <text x={midX} y={midY} className="connection-label-text">
                  {el.text}
                </text>
              )}
            </svg>
            {isSelected && (
              <>
                <div
                  className="arrow-handle"
                  style={{
                    left: sx - left - 4,
                    top: sy - top - 4,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                <div
                  className="arrow-handle"
                  style={{
                    left: ex - left - 4,
                    top: ey - top - 4,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'end')}
                />
              </>
            )}
          </div>
        );
      }
      case 'State Connection':
        return (
          <div
            key={el.id}
            className={`connection-container ${selectedTool === 'Select' ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
            style={{
              left: Math.min(el.startX || el.x, el.endX || el.x) - 5,
              top: Math.min(el.startY || el.y, el.endY || el.y) - 5,
              width: Math.abs((el.endX || el.x) - (el.startX || el.x)) + 10,
              height: Math.abs((el.endY || el.y) - (el.startY || el.y)) + 10,
            }}
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
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill={el.color || '#000000'}
                    className="dashed-arrow-polygon"
                  />
                </marker>
              </defs>
              <line
                x1={
                  (el.startX || el.x) -
                  Math.min(el.startX || el.x, el.endX || el.x) +
                  5
                }
                y1={
                  (el.startY || el.y) -
                  Math.min(el.startY || el.y, el.endY || el.y) +
                  5
                }
                x2={
                  (el.endX || el.x) -
                  Math.min(el.startX || el.x, el.endX || el.x) +
                  5
                }
                y2={
                  (el.endY || el.y) -
                  Math.min(el.startY || el.y, el.endY || el.y) +
                  5
                }
                stroke={isSelected ? '#0078d4' : el.color || '#666'}
                strokeWidth={isSelected ? 3 : 2}
                strokeDasharray={isSelected ? '5,5' : '5,5'}
                className={`state-connection-line ${isSelected ? 'selected' : ''}`}
                markerEnd={`url(#arrowhead-dashed-${el.id})`}
              />
            </svg>
            {/* Resize handles for arrows */}
            {isSelected && (
              <>
                {/* Start point handle */}
                <div
                  className="arrow-handle"
                  style={{
                    left:
                      (el.startX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.startY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                {/* End point handle */}
                <div
                  className="arrow-handle"
                  style={{
                    left:
                      (el.endX || el.x) -
                      Math.min(el.startX || el.x, el.endX || el.x) +
                      1,
                    top:
                      (el.endY || el.y) -
                      Math.min(el.startY || el.y, el.endY || el.y) +
                      1,
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'end')}
                />
              </>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Render connection being created
  const renderConnectionPreview = () => {
    if (isCreatingConnection && connectionStart && connectionEnd) {
      const left = Math.min(connectionStart.x, connectionEnd.x) - 5;
      const top = Math.min(connectionStart.y, connectionEnd.y) - 5;
      const width = Math.abs(connectionEnd.x - connectionStart.x) + 10;
      const height = Math.abs(connectionEnd.y - connectionStart.y) + 10;

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
          <line
            x1={connectionStart.x - left + 5}
            y1={connectionStart.y - top + 5}
            x2={connectionEnd.x - left + 5}
            y2={connectionEnd.y - top + 5}
            className={`connection-line ${connectionType === 'State Connection' ? 'state-connection-line' : ''}`}
            markerEnd="url(#arrowhead-preview)"
          />
        </svg>
      );
    }
    return null;
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
      className={`canvas ${isRunning ? 'is-running' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleCanvasClick}
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
