import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { RegisterExpression } from '../utils/RegisterExpression';
import { parseAiScript, selectAiCommand } from '../utils/aiScript';
import './Canvas.css';
import ChartElement from './ChartElement';
import {
  createInitialChartState,
  createChartDataSeries,
  autoExpandScaleY,
  autoExpandNegScaleY,
} from '../utils/ChartUtils';
import './Chart.css';

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
    chart: {
      color: string;
      thickness: number;
      text: string;
      scaleX: number;
      scaleY: number;
    };
  };
}

interface CustomWindow extends Window {
  __GAME_ENDED__?: boolean;
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

  resourcesByColor?: Record<string, number>;

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
  dynamicLabelFractionNum?: number;
  dynamicLabelFractionDen?: number;
  lastStartValue?: number;
  conditionSatisfied?: boolean;
  hasUnsatisfiedCondition?: boolean;
  currentPoints?: number;
  hasStarted?: boolean;
  inhibited?: boolean;
  multiplicandValue?: number;
  multiplicandLastSourceValue?: number;
  labelPosition?: number;

  // Artificial Intelligence node script (from XML import + toolProperties)
  script?: string;

  // Chart
  chartWidth?: number;
  chartHeight?: number;
  chartScaleX?: number;
  chartScaleY?: number;

  chartState?: {
    scaleX: number;
    scaleY: number;
    negScaleY: number;
    defaultScaleX: number;
    defaultScaleY: number;
    dataSeries: Array<{
      connectionId: number;
      color: string;
      color2: string;
      thickness: number;
      name: string;
      data: number[];
      run: number;
    }>;
    tick: number;
    runs: number;
    highLighted: number;
  };
}

// ------------------------------
// XML Import (Upload + Parse)
// ------------------------------

type XmlImportResult = {
  elements: GraphElement[];
  warnings: string[];
};

const isProbablyXmlFile = (f: File) => {
  const nameOk = f.name.toLowerCase().endsWith('.xml');
  const typeOk = (f.type || '').toLowerCase().includes('xml');
  return nameOk || typeOk;
};

const attrAny = (el: Element, names: string[]): string | undefined => {
  for (const n of names) {
    const v = el.getAttribute(n);
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return undefined;
};

const numAttrAny = (
  el: Element,
  names: string[],
  fallback?: number
): number | undefined => {
  const raw = attrAny(el, names);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const textAny = (el: Element, names: string[]): string | undefined => {
  const a = attrAny(el, names);
  if (a != null) return a;
  // also allow <label> or <text> children
  for (const tag of names) {
    const child = el.querySelector(tag);
    if (child && child.textContent && child.textContent.trim()) {
      return child.textContent.trim();
    }
  }
  const t = el.textContent?.trim();
  return t ? t : undefined;
};

const normalizeActivation = (
  raw?: string
): GraphElement['activation'] | undefined => {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'passive') return 'passive';
  if (s === 'interactive') return 'interactive';
  if (s === 'automatic') return 'automatic';
  if (s === 'onstart' || s === 'on start') return 'onstart';
  return undefined;
};

const normalizePullMode = (
  raw?: string
): GraphElement['pullMode'] | undefined => {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase().replace(/[_]+/g, ' ');
  if (s === 'pull any') return 'pull any';
  if (s === 'pull all') return 'pull all';
  if (s === 'push any') return 'push any';
  if (s === 'push all') return 'push all';
  return undefined;
};

const normalizeGateType = (
  raw?: string
): GraphElement['gateType'] | undefined => {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'deterministic') return 'deterministic';
  if (s === 'dice') return 'dice';
  if (s === 'skill') return 'skill';
  if (s === 'multiplayer') return 'multiplayer';
  if (s === 'strategy') return 'strategy';
  return undefined;
};

const normalizeGraphElementType = (
  raw?: string
): GraphElementType | undefined => {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();

  // common aliases
  if (s === 'text label' || s === 'textlabel' || s === 'label' || s === 'text')
    return 'Text Label';
  if (s === 'group') return 'Group';
  if (s === 'chart') return 'Chart';
  if (s === 'pool') return 'Pool';
  if (s === 'gate') return 'Gate';
  if (
    s === 'resource connection' ||
    s === 'resourceconnection' ||
    s === 'resource'
  )
    return 'Resource Connection';
  if (s === 'state connection' || s === 'stateconnection' || s === 'state')
    return 'State Connection';
  if (s === 'source') return 'Source';
  if (s === 'drain') return 'Drain';
  if (s === 'convertor' || s === 'converter') return 'Convertor';
  if (s === 'trader') return 'Trader';
  if (s === 'delay') return 'Delay';
  if (s === 'register') return 'Register';
  if (s === 'end condition' || s === 'endcondition') return 'End Condition';
  if (
    s === 'artificial intelligence' ||
    s === 'ai' ||
    s === 'artifical intelligence' ||
    s === 'artificialplayer' ||
    s === 'artificial player' ||
    s === 'artificial_player'
  )
    return 'Artifical Intelligence'; // (your union spelling)

  return undefined;
};

const tagNameToType = (tag: string): GraphElementType | undefined => {
  const t = tag.toLowerCase();
  return normalizeGraphElementType(
    t.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
  );
};

const parsePointsAttr = (raw?: string): { x: number; y: number }[] => {
  if (!raw) return [];
  // supports:
  // "x1,y1 x2,y2 x3,y3"
  // or "x1 y1; x2 y2; ..."
  const cleaned = raw.trim().replace(/;/g, ' ');
  const parts = cleaned.split(/\s+/).filter(Boolean);

  const pts: { x: number; y: number }[] = [];
  for (const p of parts) {
    const m = p.split(',');
    if (m.length === 2) {
      const x = Number(m[0]);
      const y = Number(m[1]);
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
    }
  }
  return pts;
};

const parseChildPoints = (el: Element): { x: number; y: number }[] => {
  const pts: { x: number; y: number }[] = [];
  const pointEls = Array.from(el.querySelectorAll('point, pt, waypoint'));
  for (const p of pointEls) {
    const x = numAttrAny(p, ['x', 'cx', 'px']);
    const y = numAttrAny(p, ['y', 'cy', 'py']);
    if (x != null && y != null) pts.push({ x, y });
  }
  return pts;
};

// // stable-ish string -> number (32-bit)
// const hashToInt = (s: string): number => {
//   let h = 2166136261;
//   for (let i = 0; i < s.length; i++) {
//     h ^= s.charCodeAt(i);
//     h = Math.imul(h, 16777619);
//   }
//   // keep positive, within safe int
//   return h >>> 0 || 1;
// };

// const coerceId = (raw: string | undefined, fallback: number): number => {
//   if (!raw) return fallback;
//   const trimmed = raw.trim();
//   if (/^\d+$/.test(trimmed)) {
//     const n = Number(trimmed);
//     return Number.isFinite(n) ? n : fallback;
//   }
//   return hashToInt(trimmed);
// };

function parseGraphFromXml(xmlText: string): XmlImportResult {
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML parsing is not available in this environment.');
  }

  const warnings: string[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  // detect parsererror
  const perr = doc.getElementsByTagName('parsererror')[0];
  if (perr) {
    throw new Error(
      `Invalid XML: ${perr.textContent?.trim() || 'parsererror'}`
    );
  }

  // ------------------------------------------------------------------
  // STEP 1: Collect node+connection candidates IN ONE query (doc order)
  // ------------------------------------------------------------------
  const NODE_TAGS = [
    'element',
    'node',
    'item',
    'pool',
    'gate',
    'source',
    'drain',
    'convertor',
    'converter',
    'trader',
    'delay',
    'register',
    'endCondition',
    'end-condition',
    'textLabel',
    'text-label',
    'group',
    'ai',
    'artificialIntelligence',
    'artificalIntelligence',
  ];

  const CONN_TAGS = [
    'connection',
    'edge',
    'link',
    'resourceConnection',
    'resource-connection',
    'stateConnection',
    'state-connection',
  ];

  const CANDIDATE_SELECTOR = [...NODE_TAGS, ...CONN_TAGS].join(',');
  const orderedCandidates = Array.from(
    doc.querySelectorAll(CANDIDATE_SELECTOR)
  );

  // ✅ shared for nodes + connections
  const xmlRefToId = new Map<string, number>();

  const addXmlKey = (key: string | undefined, id: number) => {
    if (!key) return;
    const t = key.trim();
    if (!t) return;
    if (!xmlRefToId.has(t)) xmlRefToId.set(t, id);
  };

  const registerElementKeys = (el: Element, assignedId: number) => {
    // ✅ ordinal reference support (1-based)
    addXmlKey(String(assignedId), assignedId);
    // ✅ explicit ids/keys/names when present
    addXmlKey(attrAny(el, ['id', 'uid', 'key', 'name']), assignedId);
  };

  // ------------------------------------------------------------------
  // STEP 2: Sequential ID assignment state (1..n) across ALL elements
  // ------------------------------------------------------------------

  let nextSequentialId = 0;

  // Map any node reference tokens in XML -> our assigned node id
  // (supports id/uid/key/name AND also numeric node-index references)
  const nodeKeyToId = new Map<string, number>();
  const nodeIndexToId: number[] = []; // nodeOrdinal -> assigned nodeId

  const nodeElements: GraphElement[] = [];

  type ConnStub = {
    id: number;
    connType: GraphElementType;
    fromRaw?: string;
    toRaw?: string;
    color?: string;
    thickness?: number;
    label?: string;
    labelPosition?: number; // ✅ NEW
    allPts: { x: number; y: number }[];
    explicitStartX?: number;
    explicitStartY?: number;
    explicitEndX?: number;
    explicitEndY?: number;
    idRaw?: string;
  };

  const connStubs: ConnStub[] = [];

  const addNodeKey = (key: string | undefined, nodeId: number) => {
    if (!key) return;
    const t = key.trim();
    if (!t) return;
    if (!nodeKeyToId.has(t)) nodeKeyToId.set(t, nodeId);
  };

  let nodeOrdinal = 0;

  // ------------------------------------------------------------------
  // STEP 3: One pass over orderedCandidates (top->bottom in XML),
  // assign IDs sequentially to nodes + connections.
  // ------------------------------------------------------------------
  for (const el of orderedCandidates) {
    const assignedId = nextSequentialId++;
    registerElementKeys(el, assignedId);

    const rawType =
      attrAny(el, ['symbol', 'type', 'kind', 'class']) ??
      tagNameToType(el.tagName);
    const type = normalizeGraphElementType(rawType);
    if (!type) continue;

    const tagLower = el.tagName.toLowerCase();

    const isConnection =
      type === 'Resource Connection' ||
      type === 'State Connection' ||
      tagLower === 'connection' ||
      tagLower === 'edge' ||
      tagLower === 'link' ||
      tagLower.includes('connection');

    // ---------------- NODE ----------------
    if (!isConnection) {
      // (defensive) skip if it somehow maps to connection types
      // if (type === 'Resource Connection' || type === 'State Connection') continue;

      const x =
        numAttrAny(el, ['x', 'posX', 'cx', 'left']) ??
        numAttrAny(el, ['px', 'screenX']) ??
        100;
      const y =
        numAttrAny(el, ['y', 'posY', 'cy', 'top']) ??
        numAttrAny(el, ['py', 'screenY']) ??
        100;

      const color = attrAny(el, ['color', 'stroke', 'borderColor']);
      const thickness = numAttrAny(el, [
        'thickness',
        'strokeWidth',
        'borderWidth',
      ]);

      const label =
        type === 'Artifical Intelligence'
          ? attrAny(el, ['caption', 'label', 'title', 'name', 'text'])
          : textAny(el, ['text', 'label', 'title', 'name', 'caption']);
      const rawLabelPos = numAttrAny(el, ['labelPosition', 'labelPos']);
      const rawCaptionPos = numAttrAny(el, [
        'captionPos',
        'captionPosition',
        'caption_pos',
      ]);
      const labelPosition =
        rawLabelPos != null
          ? Math.max(0, Math.min(1, rawLabelPos))
          : rawCaptionPos != null
            ? (() => {
                const pos = ((rawCaptionPos % 1) + 1) % 1;
                // XML captionPos: 0.25 = above, 0.75 = below.
                const shifted = pos + 0.25;
                return shifted >= 1 ? shifted - 1 : shifted;
              })()
            : 0; // 0 = bottom

      const activation = normalizeActivation(
        attrAny(el, [
          'activation',
          'activationMode',
          'activation_mode',
          'activationmode',
          'actionMode',
          'action_mode',
          'mode',
        ])
      );

      const pullMode = normalizePullMode(
        attrAny(el, ['pullMode', 'pull', 'pushMode'])
      );
      const gateType = normalizeGateType(
        attrAny(el, ['gateType', 'typeMode', 'gate'])
      );

      const number = numAttrAny(el, [
        'number',
        'value',
        'start',
        'startingValue',
        'startingResources',
      ]);
      const max = numAttrAny(el, ['max', 'cap', 'limit']);
      const displayLimit = numAttrAny(el, [
        'displayLimit',
        'display',
        'showMax',
      ]);
      const actions = numAttrAny(el, ['actions', 'actionCount']);

      const formula = attrAny(el, ['formula', 'expr', 'expression']);
      const minValue = numAttrAny(el, ['minValue', 'min']);
      const maxValue = numAttrAny(el, ['maxValue', 'max']);
      const interactiveRaw = attrAny(el, ['interactive']);
      const interactive =
        interactiveRaw != null
          ? interactiveRaw.trim().toLowerCase() === 'true'
          : undefined;

      const step = numAttrAny(el, ['step']);
      const startingValue = numAttrAny(el, ['startingValue', 'startValue']);

      const script = textAny(el, ['script']);
      const chartWidth = numAttrAny(el, ['width', 'chartWidth', 'chartW']);
      const chartHeight = numAttrAny(el, ['height', 'chartHeight', 'chartH']);
      const chartScaleX = numAttrAny(el, ['scaleX', 'chartScaleX']);
      const chartScaleY = numAttrAny(el, ['scaleY', 'chartScaleY']);

      const base: GraphElement = {
        id: assignedId,
        type,
        x,
        y,
        text: label,
        color,
        thickness,
        activation,
        pullMode,
        gateType,
        actions: actions != null ? Math.max(1, actions) : undefined,
        number: number != null ? Math.floor(number) : undefined,
        max: max != null ? Math.floor(max) : undefined,
        displayLimit:
          displayLimit != null ? Math.floor(displayLimit) : undefined,

        // Register-specific
        formula: type === 'Register' ? (formula ?? '') : undefined,
        minValue: type === 'Register' ? (minValue ?? -9999) : undefined,
        maxValue: type === 'Register' ? (maxValue ?? 9999) : undefined,
        interactive: type === 'Register' ? (interactive ?? false) : undefined,
        startingValue: type === 'Register' ? (startingValue ?? 0) : undefined,
        step: type === 'Register' ? (step ?? 1) : undefined,

        ...(type === 'Artifical Intelligence' ? { script: script ?? '' } : {}),
        ...(type === 'Chart'
          ? {
              chartWidth,
              chartHeight,
              chartScaleX,
              chartScaleY,
            }
          : {}),
        labelPosition,
      };

      // Pool init
      if (type === 'Pool') {
        const startVal = base.number ?? 0;
        const c = base.color || '#000000';
        base.resourcesByColor = startVal > 0 ? { [c]: startVal } : {};
        base.currentPoints = startVal;
      }

      // Register init
      if (type === 'Register') {
        const sv = base.startingValue ?? 0;
        base.currentValue = base.interactive ? sv : 0;
      }

      // End condition defaults
      if (type === 'End Condition') {
        base.inhibited = true;
        base.isBlinking = false;
      }

      nodeElements.push(base);

      addNodeKey(String(nodeOrdinal), assignedId);
      nodeIndexToId[nodeOrdinal] = assignedId;
      nodeOrdinal++;

      continue;
    }

    // ---------------- CONNECTION ----------------
    const isState = type === 'State Connection' || tagLower.includes('state');

    const connType: GraphElementType = isState
      ? 'State Connection'
      : 'Resource Connection';

    const fromRaw = attrAny(el, [
      'from',
      'start',
      'source',
      'startId',
      'fromId',
      'a',
    ]);
    const toRaw = attrAny(el, ['to', 'end', 'target', 'endId', 'toId', 'b']);

    const color = attrAny(el, ['color', 'stroke']);
    const thickness = numAttrAny(el, ['thickness', 'strokeWidth']);
    const label = textAny(el, ['text', 'label']);
    const rawPos = numAttrAny(el, ['position', 'labelPosition', 'labelPos']);
    const labelPosition =
      rawPos == null ? 0.5 : Math.max(-1, Math.min(1, rawPos)); // default middle

    const ptsFromAttr = parsePointsAttr(
      attrAny(el, ['points', 'path', 'polyline'])
    );
    const ptsFromChildren = parseChildPoints(el);
    const allPts = ptsFromChildren.length > 0 ? ptsFromChildren : ptsFromAttr;

    const explicitStartX = numAttrAny(el, ['startX', 'x1', 'sx']);
    const explicitStartY = numAttrAny(el, ['startY', 'y1', 'sy']);
    const explicitEndX = numAttrAny(el, ['endX', 'x2', 'ex']);
    const explicitEndY = numAttrAny(el, ['endY', 'y2', 'ey']);

    const dumpAttrs = (el: Element) =>
      Array.from(el.attributes)
        .map(a => `${a.name}="${a.value}"`)
        .join(' ');

    if (!fromRaw || !toRaw) {
      console.warn('Missing endpoints on:', el.tagName, dumpAttrs(el));
    }

    connStubs.push({
      id: assignedId,
      connType,
      fromRaw,
      toRaw,
      color,
      thickness,
      label,
      labelPosition, // ✅ NEW
      allPts,
      explicitStartX,
      explicitStartY,
      explicitEndX,
      explicitEndY,
      idRaw: attrAny(el, ['id', 'uid', 'key']),
    });
  }

  if (nodeElements.length === 0) {
    warnings.push(
      'No node elements recognized. Your XML schema may need mapping tweaks.'
    );
  }

  // ------------------------------------------------------------------
  // STEP 4: Resolve connection endpoints AFTER we know all node ids,
  // while keeping connection ids already assigned in XML order.
  // ------------------------------------------------------------------
  const resolveRefToId = (raw?: string): number | undefined => {
    if (!raw) return undefined;
    const t = raw.trim();
    if (!t) return undefined;

    const mapped = xmlRefToId.get(t);
    if (mapped != null) return mapped;

    // numeric fallback (try 0-based then 1-based)
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (Number.isFinite(n))
        return xmlRefToId.get(String(n)) ?? xmlRefToId.get(String(n - 1));
    }

    return undefined;
  };

  const nodeById = new Map<number, GraphElement>(
    nodeElements.map(n => [n.id, n])
  );

  const connElements: GraphElement[] = [];

  for (const stub of connStubs) {
    const connectedToStart = resolveRefToId(stub.fromRaw);
    const connectedToEnd = resolveRefToId(stub.toRaw);

    const startNode =
      connectedToStart != null ? nodeById.get(connectedToStart) : undefined;
    const endNode =
      connectedToEnd != null ? nodeById.get(connectedToEnd) : undefined;

    // Treat XML <point> children as INTERMEDIATE waypoints
    const EPS = 5; // px tolerance in case endpoints are also included as points
    const startAnchor = startNode ? { x: startNode.x, y: startNode.y } : null;
    const endAnchor = endNode ? { x: endNode.x, y: endNode.y } : null;

    const pts = stub.allPts.slice(); // candidate intermediate points

    // If schema includes endpoints inside <point>, strip them when they're basically on the node
    if (startAnchor && pts.length) {
      const d0 = Math.hypot(pts[0].x - startAnchor.x, pts[0].y - startAnchor.y);
      if (d0 <= EPS) pts.shift();
    }
    if (endAnchor && pts.length) {
      const last = pts[pts.length - 1];
      const d1 = Math.hypot(last.x - endAnchor.x, last.y - endAnchor.y);
      if (d1 <= EPS) pts.pop();
    }

    // Endpoints come from the actual start/end elements (or explicit coords if present)
    const fallbackFirst = stub.allPts[0];
    const fallbackLast = stub.allPts[stub.allPts.length - 1];

    const startX =
      stub.explicitStartX ?? startAnchor?.x ?? fallbackFirst?.x ?? 50;
    const startY =
      stub.explicitStartY ?? startAnchor?.y ?? fallbackFirst?.y ?? 50;

    const endX = stub.explicitEndX ?? endAnchor?.x ?? fallbackLast?.x ?? 200;
    const endY = stub.explicitEndY ?? endAnchor?.y ?? fallbackLast?.y ?? 200;

    const conn: GraphElement = {
      id: stub.id,
      type: stub.connType,
      x: startX,
      y: startY,
      startX,
      startY,
      endX,
      endY,
      points: pts.length ? pts : undefined,
      text: stub.label,
      color: stub.color,
      thickness: stub.thickness,
      connectedToStart,
      connectedToEnd,
      labelPosition: stub.labelPosition, // ✅ NEW
    };

    console.log(stub.id, connectedToStart, connectedToEnd);

    if (connectedToStart == null || connectedToEnd == null) {
      warnings.push(
        `Connection ${stub.idRaw ?? stub.id} missing endpoint mapping (from="${stub.fromRaw}", to="${stub.toRaw}").`
      );
    }

    connElements.push(conn);
  }

  // ------------------------------------------------------------------
  // STEP 4.5: If a State Connection starts/ends at a connection,
  // snap its endpoint to the TARGET connection's label position.
  // ------------------------------------------------------------------

  const clamp01Local = (v: number) => Math.max(0, Math.min(1, v));

  const getPolylineForAnyConn = (c: GraphElement) => {
    const sx = c.startX ?? c.x;
    const sy = c.startY ?? c.y;
    const ex = c.endX ?? c.x;
    const ey = c.endY ?? c.y;
    return [{ x: sx, y: sy }, ...(c.points ?? []), { x: ex, y: ey }];
  };

  const getPointAndNormalOnPolylineAtTLocal = (
    points: { x: number; y: number }[],
    t: number
  ): { point: { x: number; y: number }; normal: { x: number; y: number } } => {
    if (points.length < 2) {
      const p = points[0] ?? { x: 0, y: 0 };
      return { point: p, normal: { x: 0, y: -1 } };
    }

    const clampedT = clamp01Local(t);

    let totalLength = 0;
    const segments: Array<{
      start: { x: number; y: number };
      end: { x: number; y: number };
      length: number;
    }> = [];

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) continue;
      segments.push({ start: a, end: b, length: len });
      totalLength += len;
    }

    if (segments.length === 0) {
      return { point: points[0], normal: { x: 0, y: -1 } };
    }

    const target = clampedT * totalLength;
    let traversed = 0;

    for (const seg of segments) {
      if (traversed + seg.length >= target) {
        const remaining = target - traversed;
        const localT = seg.length === 0 ? 0 : remaining / seg.length;

        const dx = seg.end.x - seg.start.x;
        const dy = seg.end.y - seg.start.y;
        const dlen = Math.hypot(dx, dy) || 1;

        const dir = { x: dx / dlen, y: dy / dlen };
        const normal = { x: -dir.y, y: dir.x };

        return {
          point: {
            x: seg.start.x + dx * localT,
            y: seg.start.y + dy * localT,
          },
          normal,
        };
      }
      traversed += seg.length;
    }

    const last = segments[segments.length - 1];
    const dx = last.end.x - last.start.x;
    const dy = last.end.y - last.start.y;
    const dlen = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / dlen, y: dy / dlen };
    const normal = { x: -dir.y, y: dir.x };
    return { point: last.end, normal };
  };

  // NOTE: offsetPx should match how you render labels.
  // If you want the State Connection to attach ON the line (not offset label text),
  // set offsetPx = 0.
  const getLabelAnchorForConnectionLocal = (
    targetConn: GraphElement,
    offsetPx = 16
  ) => {
    const rawPos = targetConn.labelPosition ?? 0.5;
    const pos = Math.max(-1, Math.min(1, rawPos));
    const side = pos < 0 ? -1 : 1;
    const t = clamp01Local(Math.abs(pos));

    const poly = getPolylineForAnyConn(targetConn);
    const { point, normal } = getPointAndNormalOnPolylineAtTLocal(poly, t);

    return {
      x: point.x + normal.x * offsetPx * side,
      y: point.y + normal.y * offsetPx * side,
    };
  };

  const allById = new Map<number, GraphElement>(
    [...nodeElements, ...connElements].map(el => [el.id, el])
  );

  type ConnEl = GraphElement & {
    type: 'Resource Connection' | 'State Connection';
  };

  const isConnEl = (e: GraphElement | undefined): e is ConnEl =>
    e != null &&
    (e.type === 'Resource Connection' || e.type === 'State Connection');

  // A few passes lets State->State->Resource chains settle.
  for (let iter = 0; iter < 4; iter++) {
    let changed = false;

    for (const sc of connElements) {
      if (sc.type !== 'State Connection') continue;

      // START can also be a connection (optional, but makes it consistent)
      if (sc.connectedToStart != null) {
        const startTarget = allById.get(sc.connectedToStart);
        if (isConnEl(startTarget)) {
          const p = getLabelAnchorForConnectionLocal(startTarget);
          if (
            sc.startX !== p.x ||
            sc.startY !== p.y ||
            sc.x !== p.x ||
            sc.y !== p.y
          ) {
            sc.startX = p.x;
            sc.startY = p.y;
            sc.x = p.x;
            sc.y = p.y;
            changed = true;
          }
        }
      }

      // END snaps to target connection label anchor
      if (sc.connectedToEnd != null) {
        const endTarget = allById.get(sc.connectedToEnd);
        if (isConnEl(endTarget)) {
          const p = getLabelAnchorForConnectionLocal(endTarget);
          if (sc.endX !== p.x || sc.endY !== p.y) {
            sc.endX = p.x;
            sc.endY = p.y;
            changed = true;
          }
        }
      }
    }

    if (!changed) break;
  }

  if (connElements.length === 0) {
    warnings.push(
      'No connection elements recognized. If your XML uses different tags/attrs, add them to selectors / endpoint attrs.'
    );
  }
  // Final: return combined
  // return { elements: [...nodeElements, ...connElements], warnings };
  return {
    elements: [...nodeElements, ...connElements].sort((a, b) => a.id - b.id),
    warnings,
  };
}

interface ResourceTransfer {
  connectionId: number;
  units: number;
  color: string;
}

interface MovingToken {
  id: number;
  connectionId: number;
  color: string;
  path: { x: number; y: number }[];
  startTime: number;
  currentX: number;
  currentY: number;
}

// For tracking fractional resource dispatch progress
interface FractionalDispatchState {
  connectionId: number;
  accumulator: number; // Accumulates fractional values until we can dispatch a full resource
  lastTick: number; // Track when this was last updated
}

const isResourceLikeConnection = (element: GraphElement) =>
  element.type === 'Resource Connection';

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

const getPointOnPolylineAtT = (
  points: { x: number; y: number }[],
  t: number
): { x: number; y: number } => {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const clampedT = Math.max(0, Math.min(1, t));

  let totalLength = 0;
  const segments: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    length: number;
  }[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length === 0) continue;

    segments.push({ start, end, length });
    totalLength += length;
  }

  if (segments.length === 0) return points[0];

  const target = clampedT * totalLength;
  let traversed = 0;

  for (const segment of segments) {
    if (traversed + segment.length >= target) {
      const remaining = target - traversed;
      const localT = segment.length === 0 ? 0 : remaining / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * localT,
        y: segment.start.y + (segment.end.y - segment.start.y) * localT,
      };
    }
    traversed += segment.length;
  }

  const last = segments[segments.length - 1];
  return last.end;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const getPointAndNormalOnPolylineAtT = (
  points: { x: number; y: number }[],
  t: number
): { point: { x: number; y: number }; normal: { x: number; y: number } } => {
  if (points.length < 2) {
    const p = points[0] ?? { x: 0, y: 0 };
    return { point: p, normal: { x: 0, y: -1 } };
  }

  const clampedT = clamp01(t);

  let totalLength = 0;
  const segments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    length: number;
  }> = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    segments.push({ start: a, end: b, length: len });
    totalLength += len;
  }

  if (segments.length === 0) {
    return { point: points[0], normal: { x: 0, y: -1 } };
  }

  const target = clampedT * totalLength;
  let traversed = 0;

  for (const seg of segments) {
    if (traversed + seg.length >= target) {
      const remaining = target - traversed;
      const localT = seg.length === 0 ? 0 : remaining / seg.length;

      const dx = seg.end.x - seg.start.x;
      const dy = seg.end.y - seg.start.y;
      const len = Math.hypot(dx, dy) || 1;

      const dir = { x: dx / len, y: dy / len };
      const normal = { x: -dir.y, y: dir.x };

      return {
        point: {
          x: seg.start.x + dx * localT,
          y: seg.start.y + dy * localT,
        },
        normal,
      };
    }
    traversed += seg.length;
  }

  // fallback to end
  const last = segments[segments.length - 1];
  const dx = last.end.x - last.start.x;
  const dy = last.end.y - last.start.y;
  const len = Math.hypot(dx, dy) || 1;
  const dir = { x: dx / len, y: dy / len };
  const normal = { x: -dir.y, y: dir.x };

  return { point: last.end, normal };
};

const getLabelPointForConnection = (
  polyline: { x: number; y: number }[],
  labelPosition?: number,
  offsetPx = 16
) => {
  const pos =
    labelPosition == null ? 0.5 : Math.max(-1, Math.min(1, labelPosition));
  const side = pos < 0 ? -1 : 1; // which side of the line
  const t = clamp01(Math.abs(pos)); // 0..1 along the line start->end

  const { point, normal } = getPointAndNormalOnPolylineAtT(polyline, t);

  return {
    x: point.x + normal.x * offsetPx * side,
    y: point.y + normal.y * offsetPx * side,
  };
};

/** Get canvas position for a node's label. labelPosition 0 = bottom, 0.25 = right, 0.5 = top, 0.75 = left. */
const getLabelPointOnNodeBoundary = (
  cx: number,
  cy: number,
  size: number,
  labelPosition: number,
  offsetPx = 10
): { x: number; y: number } => {
  const pos = Math.max(0, Math.min(1, labelPosition));
  const angle = pos * 2 * Math.PI - Math.PI / 2;
  const r = size / 2 + offsetPx;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
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

const MULTIPLICAND_LABEL_REGEX = /^([+-])\s*(x|\d+(?:\.\d+)?)\s*m$/i;
const MULTIPLY_EXPRESSION_REGEX =
  /^\s*([+-]?\d+(?:\.\d+)?|x|y)\s*\*\s*([+-]?\d+(?:\.\d+)?|x|y)\s*$/i;

const parseMultiplicandDelta = (
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

const parseMultiplyExpression = (rawLabel: string) => {
  const match = rawLabel.trim().match(MULTIPLY_EXPRESSION_REGEX);
  if (!match) return null;
  return { left: match[1], right: match[2] };
};

/** For multiplicand labels like "1*10" or "2*10", returns the base input amount per output (e.g. 10). Used to compute output count = currentInput / base. */
function getBaseInputAmountFromMultiplyLabel(label?: string): number | null {
  const s = (label ?? '').trim();
  if (!s.includes('*')) return null;
  const expr = parseMultiplyExpression(s);
  if (!expr) return null;
  const rightNum = parseFloat(expr.right);
  if (Number.isFinite(rightNum) && rightNum > 0) return rightNum;
  return 1;
}

function getElementValue(element: GraphElement | undefined): number {
  if (!element) return 0;

  if (element.type === 'Pool') {
    // ✅ Sum all colors to get true total
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

  if (element.type === 'Source') {
    return typeof element.number === 'string'
      ? parseInt(element.number) || 0
      : element.number || 0;
  }

  return 0;
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
        const prevDelta = resource.dynamicLabelLastDelta ?? 0;
        const prevNum =
          baseFractionNum + Math.round(prevDelta * baseFractionDen);
        const nextNum = prevNum + Math.round(totalDelta * baseFractionDen);
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

function applyDynamicResourceLabels(
  elementsList: GraphElement[]
): GraphElement[] {
  const clonedElements = elementsList.map(el => ({ ...el }));
  applyDynamicResourceLabelsMutable(clonedElements);
  return clonedElements;
}

// Helper to normalize color strings
const normalizeColor = (color?: string) => color || '#000000';

const recordTransfer = (
  transfers: ResourceTransfer[] | undefined,
  conn: GraphElement | undefined,
  units: number,
  sourceElement?: GraphElement
): void => {
  if (!transfers || !conn || conn.type !== 'Resource Connection') return;
  if (units <= 0) return;

  // Determine the color to use for the tokens
  // Priority: source element's resources color > connection color
  let tokenColor = normalizeColor(conn.color); // Default to connection color

  // If source element has a resources color property and it's not black/default, use that instead
  if (sourceElement && sourceElement.resources) {
    const resourceColorStr = sourceElement.resources.trim();
    if (resourceColorStr) {
      const resourceColor = normalizeColor(resourceColorStr);
      // Use source element's resource color if it's explicitly set (not black/default)
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

// Helper functions for decimal resource dispatching
function handleDecimalResourceDispatch(
  connection: GraphElement,
  labelValue: number,
  fractionalDispatchMap: Map<number, FractionalDispatchState>,
  currentTick: number
): number {
  if (labelValue >= 1) {
    // For values >= 1, dispatch as normal (can be fractional like 1.5)
    return labelValue;
  }

  if (labelValue <= 0) return 0;

  // For values < 1 (like 0.5, 0.2), use accumulator approach
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

  // Add the fractional value to accumulator
  state.accumulator += labelValue;
  state.lastTick = currentTick;

  // Check if we can dispatch full resources
  const resourcesToDispatch = Math.floor(state.accumulator);
  if (resourcesToDispatch > 0) {
    state.accumulator -= resourcesToDispatch;
    console.log(
      `Decimal dispatch: Connection ${connectionId}, label ${labelValue}, dispatching ${resourcesToDispatch} resources, remaining accumulator: ${state.accumulator}`
    );
    return resourcesToDispatch;
  }

  return 0;
}

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function evaluateArithmeticExpression(raw: string): number | null {
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

// Supports: "5", "2-5", "1/2", "0.5", default 1
function parseConnectionLabel(label?: string): number {
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

  // Multiplicand/dynamic labels (e.g. "5*x" from State Connection modifier) — use numeric part
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
  if (!isNaN(num)) return num; // Changed: Keep decimal values instead of flooring

  return 1;
}

function isTriggerOutput(label?: string): boolean {
  return (label ?? '').trim().includes('*');
}

type LabelKind = 'prob' | 'cond' | 'interval' | 'else' | 'empty' | 'invalid';

function classifyLabel(raw?: string): LabelKind {
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

function parseInterval(raw: string): [number, number] | null {
  const norm = raw.trim().replace(/[–—]/g, '-');
  const m = norm.match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[2]);
  return a <= b ? [a, b] : [b, a];
}

function parseCond(raw: string): ((v: number) => boolean) | null {
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

function getDiceSides(gate: GraphElement, outputs: GraphElement[]): number {
  const t = (gate.text ?? '').trim().toLowerCase();
  const m1 = t.match(/^d\s*(\d+)$/);
  const m2 = t.match(/^(\d+)\s*d\s*(\d+)$/);
  if (m1) return Math.max(2, parseInt(m1[1], 10));
  if (m2) return Math.max(2, parseInt(m2[2], 10));
  const wrap = getIntervalWrapMax(outputs);
  if (wrap && wrap >= 2) return wrap;
  return 6;
}

function generateGateValue(
  gate: GraphElement,
  outputs: GraphElement[]
): number {
  if (gate.gateType === 'dice') {
    const sides = getDiceSides(gate, outputs);
    return randInt(1, sides);
  }

  const wrapMax = getIntervalWrapMax(outputs);
  const prev = gate.lastGateValue ?? 0;
  const next = prev + 1;

  if (wrapMax && wrapMax >= 1) {
    return ((next - 1) % wrapMax) + 1;
  }
  return next;
}

function chooseGateOutputs(
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

    let r = Math.random() * sumPercent;
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

  let r = Math.random() * total;
  for (let i = 0; i < outputs.length; i++) {
    r -= weights[i];
    if (r <= 0 && weights[i] > 0) return [outputs[i]];
  }
  return [outputs[outputs.length - 1]];
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

  // Keep the latest elements in a ref so we can use them in stable callbacks
  const elementsRef = useRef<GraphElement[]>(elements);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

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
  const [draggingLabelElementId, setDraggingLabelElementId] = useState<
    number | null
  >(null);
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
  const [hoveredChartConnId, setHoveredChartConnId] = useState<number | null>(
    null
  );

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

  // Waypoint dragging state
  const [draggingWaypoint, setDraggingWaypoint] = useState<{
    connectionId: number;
    waypointIndex: number;
  } | null>(null);

  const [gameEnded, setGameEnded] = useState(false);
  const gameEndedRef = useRef(false);
  const nextIdRef = useRef(0);

  // Sync ref with state
  useEffect(() => {
    gameEndedRef.current = gameEnded;
  }, [gameEnded]);

  useEffect(() => {
    // Whenever the tool changes (e.g., from 'Select' to 'Pool'), clears selection.
    if (selectedTool !== 'Select') {
      setSelectedId([]);
    }
  }, [selectedTool, setSelectedId]);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ---------- Moving Tokens (for Resource Connections) ----------
  const TOKEN_TRAVEL_TIME = 600; // ms

  const [movingTokens, setMovingTokens] = useState<MovingToken[]>([]);
  const nextTokenIdRef = useRef(1);

  // Track fractional dispatch progress for decimal-labeled connections
  const fractionalDispatchRef = useRef<Map<number, FractionalDispatchState>>(
    new Map()
  );
  const currentTickRef = useRef(0);

  const getResourcePolylinePointsForConnection = (
    resource: GraphElement,
    elementsSnapshot: GraphElement[]
  ) => {
    const startNode = elementsSnapshot.find(
      node => node.id === resource.connectedToStart
    );
    const endNode = elementsSnapshot.find(
      node => node.id === resource.connectedToEnd
    );

    let startPoint = {
      x: resource.startX ?? resource.x,
      y: resource.startY ?? resource.y,
    };
    let endPoint = {
      x: resource.endX ?? resource.x,
      y: resource.endY ?? resource.y,
    };

    if (startNode && endNode) {
      const startTargetPoint =
        resource.points && resource.points.length > 0
          ? resource.points[0]
          : { x: endNode.x, y: endNode.y };
      const endTargetPoint =
        resource.points && resource.points.length > 0
          ? resource.points[resource.points.length - 1]
          : { x: startNode.x, y: startNode.y };

      startPoint = snapNodeToEdgeInDirection(startNode, startTargetPoint);
      endPoint = snapNodeToEdgeInDirection(endNode, endTargetPoint);
    } else if (startNode) {
      startPoint = { x: startNode.x, y: startNode.y };
    } else if (endNode) {
      endPoint = { x: endNode.x, y: endNode.y };
    }

    return [startPoint, ...(resource.points ?? []), endPoint];
  };

  const spawnMovingTokens = useCallback(
    (transfers: ResourceTransfer[], elementsSnapshot: GraphElement[]) => {
      const tokensToAdd: MovingToken[] = [];
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now();

      for (const tr of transfers) {
        const conn = elementsSnapshot.find(el => el.id === tr.connectionId);
        if (!conn) continue;

        // Full polyline for this connection (start + points + end)
        const basePolyline = getResourcePolylinePointsForConnection(
          conn,
          elementsSnapshot
        );
        if (basePolyline.length < 2) continue;

        const unitsToShow = Math.min(tr.units, 5); // Cap for performance

        for (let i = 0; i < unitsToShow; i++) {
          const id = nextTokenIdRef.current++;

          // Slight offset so multiple tokens don't sit exactly on top of each other
          let path = basePolyline;
          if (unitsToShow > 1 && basePolyline.length >= 2) {
            const offset = (i - (unitsToShow - 1) / 2) * 4;
            const dx = basePolyline[1].x - basePolyline[0].x;
            const dy = basePolyline[1].y - basePolyline[0].y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;

            path = basePolyline.map(p => ({
              x: p.x + nx * offset,
              y: p.y + ny * offset,
            }));
          }

          tokensToAdd.push({
            id,
            connectionId: tr.connectionId,
            color: tr.color, // ✅ Use specific color
            path,
            startTime: now,
            currentX: path[0].x,
            currentY: path[0].y,
          });
          setTimeout(() => {
            setMovingTokens(prev => prev.filter(t => t.id !== id));
          }, TOKEN_TRAVEL_TIME + 50);
        }
      }

      if (tokensToAdd.length) {
        setMovingTokens(prev => [...prev, ...tokensToAdd]);
      }
    },
    []
  );

  useEffect(() => {
    if (movingTokens.length === 0) return;

    let animationFrameId: number;

    const animate = (time: number) => {
      const now =
        time ||
        (typeof performance !== 'undefined' ? performance.now() : Date.now());

      setMovingTokens(prevTokens => {
        if (prevTokens.length === 0) return prevTokens;

        const updated: MovingToken[] = [];

        for (const token of prevTokens) {
          const elapsed = now - token.startTime;
          const t = Math.min(1, elapsed / TOKEN_TRAVEL_TIME); // 0 → 1 over lifetime
          const p = getPointOnPolylineAtT(token.path, t);

          if (elapsed < TOKEN_TRAVEL_TIME + 50) {
            updated.push({
              ...token,
              currentX: p.x,
              currentY: p.y,
            });
          }
        }

        return updated;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [movingTokens.length]);

  const evaluateStateCondition = useCallback(
    (
      connection: GraphElement,
      elementMap: Map<number, GraphElement>
    ): { evaluated: boolean; satisfied: boolean } => {
      if (connection.connectedToStart == null) {
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
    []
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
          connection.connectedToStart == null ||
          connection.connectedToEnd == null
        ) {
          if (
            connection.type !== 'Resource Connection' &&
            'hasUnsatisfiedCondition' in connection
          ) {
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
    (updater: GraphElement[] | ((prev: GraphElement[]) => GraphElement[])) => {
      if (onElementsChange) {
        // ✅ Controlled mode: use latest from ref
        const base = elementsRef.current;
        const updated = typeof updater === 'function' ? updater(base) : updater;

        const processed = applyDynamicResourceLabels(updated);
        updateStateConnectionVisualState(processed);

        onElementsChange(processed);
        // Keep ref in sync with what we just sent up
        elementsRef.current = processed;
      } else {
        // ✅ Internal mode: let React compose updates (auto + interactive)
        setInternalElements(prev => {
          const updated =
            typeof updater === 'function' ? updater(prev) : updater;

          const processed = applyDynamicResourceLabels(updated);
          updateStateConnectionVisualState(processed);

          // Keep ref in sync for the next update
          elementsRef.current = processed;

          return processed;
        });
      }
    },
    [onElementsChange, updateStateConnectionVisualState]
  );

  // ------------------------------
  // XML Import wiring (inside Canvas)
  // ------------------------------
  const xmlFileInputRef = useRef<HTMLInputElement>(null);
  const [xmlImportError, setXmlImportError] = useState<string | null>(null);

  const importXmlText = useCallback(
    (xmlText: string) => {
      setXmlImportError(null);

      const { elements: imported, warnings } = parseGraphFromXml(xmlText);
      if (warnings.length) {
        console.warn('XML import warnings:', warnings);
      }

      // stop any running visuals/state
      setMovingTokens([]);
      setGameEnded(false);
      gameEndedRef.current = false;

      // Reset fractional dispatch state
      fractionalDispatchRef.current.clear();
      currentTickRef.current = 0;

      const maxId = imported.reduce((m, el) => Math.max(m, el.id), -1);
      nextIdRef.current = maxId + 1;
      // load the imported diagram
      setElements(imported);
      setSelectedId([]);
    },
    [setElements, setSelectedId]
  );

  const handleXmlFileChosen = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      try {
        const file = e.target.files?.[0];
        // allow re-upload same file
        e.target.value = '';

        if (!file) return;
        if (!isProbablyXmlFile(file)) {
          throw new Error('Please select an .xml file.');
        }

        const text = await file.text();
        importXmlText(text);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to import XML.';
        console.error(err);
        setXmlImportError(msg);
      }
    },
    [importXmlText]
  );

  const openXmlPicker = useCallback(() => {
    xmlFileInputRef.current?.click();
  }, []);

  // Optional: allow other UI (TopBar) to trigger it via event
  useEffect(() => {
    const onImport = (ev: Event) => {
      const ce = ev as CustomEvent<{ xmlText?: string; fileName?: string }>;

      // If sidebar provided the XML text, import immediately
      if (ce.detail?.xmlText) {
        importXmlText(ce.detail.xmlText);
        return;
      }

      // Otherwise fallback to file picker
      openXmlPicker();
    };

    document.addEventListener('canvas-import-xml', onImport as EventListener);

    return () => {
      document.removeEventListener(
        'canvas-import-xml',
        onImport as EventListener
      );
    };
  }, [openXmlPicker, importXmlText]);

  const applyStateConnectionDelta = (
    target: GraphElement,
    delta: number
  ): void => {
    if (!delta || !target) return;

    if (target.type === 'Pool') {
      const max = target.max ?? Infinity;

      // ✅ FIX: Update the specific color wallet so it persists
      if (!target.resourcesByColor) target.resourcesByColor = {};

      // Use the pool's defined color (or black) for the modifier
      const colorKey = target.color || '#000000';
      const currentVal = target.resourcesByColor[colorKey] || 0;

      // Calculate new total to check against MAX
      const currentTotal = getElementValue(target); // Use our robust getter
      const space = max - currentTotal;

      // Only add what fits (or remove whatever amount)
      // If delta is negative, we can go down. If positive, check space.
      let actualDelta = delta;
      if (delta > 0) {
        actualDelta = Math.min(delta, space);
      }

      const nextVal = Math.max(0, currentVal + actualDelta);
      target.resourcesByColor[colorKey] = nextVal;

      // Update total for display immediately
      target.currentPoints = Object.values(target.resourcesByColor).reduce(
        (a, b) => a + b,
        0
      );
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
      interactiveElementId?: number,
      transfers?: ResourceTransfer[]
    ): GraphElement[] => {
      // Increment tick counter for fractional dispatch tracking
      currentTickRef.current += 1;
      const currentTick = currentTickRef.current;

      const nextElements = JSON.parse(
        JSON.stringify(elementsToUpdate)
      ) as GraphElement[];
      const elementMap = new Map<number, GraphElement>(
        nextElements.map(el => [el.id, el])
      );
      const forcedActivationIds = new Set<number>();
      const aiScriptCache = new Map<number, ReturnType<typeof parseAiScript>>();

      const getElementLabel = (element: GraphElement): string | undefined => {
        const withName = element as GraphElement & {
          name?: string;
          label?: string;
        };
        return element.text ?? withName.name ?? withName.label;
      };

      const labelToElement = new Map<string, GraphElement>();
      for (const element of nextElements) {
        const label = getElementLabel(element);
        if (label && !labelToElement.has(label)) {
          labelToElement.set(label, element);
        }
      }

      const resolveElementByIdentifier = (
        identifier: string
      ): GraphElement | undefined => {
        const trimmed = identifier.trim();
        if (!trimmed) return undefined;
        const byLabel = labelToElement.get(trimmed);
        if (byLabel) return byLabel;
        const id = Number(trimmed);
        if (!Number.isNaN(id)) return elementMap.get(id);
        return undefined;
      };

      const getValueForIdentifier = (identifier: string): number =>
        getElementValue(resolveElementByIdentifier(identifier));

      const queueForcedActivation = (identifier: string) => {
        const target = resolveElementByIdentifier(identifier);
        if (target) forcedActivationIds.add(target.id);
      };

      const isForcedActivation = (element: GraphElement): boolean =>
        forcedActivationIds.has(element.id);

      // Accumulate register modifiers here so PASS 5 can apply them (and not get overwritten by formulas)
      const registerDeltaById = new Map<number, number>();

      // =======================================================================
      // Helper: Check if a ResourceConnection is inhibited by StateConnections
      // This mirrors the original Machinations checkInhibition() logic
      // =======================================================================
      const isConnectionInhibitedByState = (conn: GraphElement): boolean => {
        if (conn.type !== 'Resource Connection') return false;

        // =========================================================
        // Check 1: Is any incoming StateConnection's condition unsatisfied?
        // =========================================================
        const incomingStateConnections = nextElements.filter(
          el => el.type === 'State Connection' && el.connectedToEnd === conn.id
        );

        for (const stateConn of incomingStateConnections) {
          const labelText = (stateConn.text ?? '').trim();
          const kind = classifyLabel(labelText);
          const isActivator = kind === 'cond' || kind === 'interval';

          if (isActivator) {
            const startEl = elementMap.get(stateConn.connectedToStart!);
            if (!startEl) continue;

            const value = getElementValue(startEl);
            let conditionSatisfied = false;

            if (kind === 'cond') {
              const fn = parseCond(labelText);
              if (fn) conditionSatisfied = fn(value);
            } else if (kind === 'interval') {
              const range = parseInterval(labelText);
              if (range)
                conditionSatisfied = value >= range[0] && value <= range[1];
            }

            if (!conditionSatisfied) {
              return true;
            }
          }
        }

        // =========================================================
        // Check 2: Is the START NODE inhibited by any StateConnection?
        // =========================================================
        const startNodeId = conn.connectedToStart;
        if (startNodeId != null) {
          // Find all StateConnections that point TO the start node with condition labels
          const stateConnsToStartNode = nextElements.filter(
            el =>
              el.type === 'State Connection' &&
              el.connectedToEnd === startNodeId
          );

          for (const stateConn of stateConnsToStartNode) {
            const labelText = (stateConn.text ?? '').trim();
            const kind = classifyLabel(labelText);
            const isActivator = kind === 'cond' || kind === 'interval';

            if (isActivator) {
              const sourceEl = elementMap.get(stateConn.connectedToStart!);
              if (!sourceEl) continue;

              const value = getElementValue(sourceEl);
              let conditionSatisfied = false;

              if (kind === 'cond') {
                const fn = parseCond(labelText);
                if (fn) conditionSatisfied = fn(value);
              } else if (kind === 'interval') {
                const range = parseInterval(labelText);
                if (range)
                  conditionSatisfied = value >= range[0] && value <= range[1];
              }

              // If the start node has an unsatisfied condition, this connection is inhibited
              if (!conditionSatisfied) {
                console.log(
                  `[DEBUG] ResourceConn ${conn.id} inhibited because start node ${startNodeId} has unsatisfied condition from StateConn ${stateConn.id} (${labelText})`
                );
                return true;
              }
            }
          }
        }

        return false;
      };

      const updateAllConnectionInhibitionState = () => {
        for (const conn of nextElements) {
          if (conn.type === 'Resource Connection') {
            const isInhibited = isConnectionInhibitedByState(conn);
            conn.inhibited = isInhibited;
            conn.hasUnsatisfiedCondition = isInhibited;
          }
        }
      };

      // --- Internal Helpers for Color Logic ---
      const normalizeColor = (c?: string) => c || '#000000';

      const getResCount = (el: GraphElement, color: string): number => {
        if (!el.resourcesByColor) return 0;
        return el.resourcesByColor[color] || 0;
      };

      const modResCount = (el: GraphElement, color: string, delta: number) => {
        if (!el.resourcesByColor) el.resourcesByColor = {};
        const current = el.resourcesByColor[color] || 0;
        const next = Math.max(0, current + delta);
        el.resourcesByColor[color] = Math.round(next * 100) / 100;

        // Sync total
        el.currentPoints = Object.values(el.resourcesByColor).reduce(
          (a, b) => a + b,
          0
        );
      };

      const canTakeUnits = (
        start: GraphElement,
        units: number,
        color: string
      ): boolean => {
        if (units <= 0) return false;
        if (start.type === 'Source') return true;
        if (start.type === 'Pool') return getResCount(start, color) >= units;
        return false;
      };

      const takeUnits = (
        start: GraphElement,
        units: number,
        color: string
      ): number => {
        if (units <= 0) return 0;
        if (start.type === 'Source') return units;
        if (start.type === 'Pool') {
          const have = getResCount(start, color);
          const used = Math.min(have, units);
          modResCount(start, color, -used);
          return used;
        }
        return 0;
      };

      const deliverUnits = (
        outConn: GraphElement,
        units: number,
        sourceElement?: GraphElement
      ) => {
        if (units <= 0) return;
        const end = elementMap.get(outConn.connectedToEnd!);
        if (!end) return;

        const color = normalizeColor(outConn.color);

        // Use recordTransfer for Resource Connections to apply source element's resources color
        if (outConn.type === 'Resource Connection') {
          if (transfers)
            recordTransfer(transfers, outConn, units, sourceElement);
        } else if (transfers) {
          // For State Connections, push directly (no color from source needed)
          transfers.push({ connectionId: outConn.id, units, color });
        }

        if (outConn.type === 'State Connection') {
          end.triggerCount = (end.triggerCount ?? 0) + units;
          return;
        }

        if (end.type === 'Pool') {
          const currentTotal = end.currentPoints ?? 0;
          const max = end.max ?? Infinity;
          const space = max - currentTotal;
          const accepted = Math.min(units, space);
          if (accepted > 0) modResCount(end, color, accepted);
        }
      };

      // =======================================================================
      // PASS 0: Initialization
      // =======================================================================
      if (activationType === 'onstart') {
        for (const element of nextElements) {
          if (element.type === 'Pool') {
            if (!element.resourcesByColor) {
              element.resourcesByColor = {};
              const startVal =
                typeof element.number === 'string'
                  ? parseInt(element.number) || 0
                  : element.number || 0;
              if (startVal > 0) {
                const poolColor = normalizeColor(element.color);
                element.resourcesByColor[poolColor] = startVal;
                element.currentPoints = startVal;
              } else {
                element.currentPoints = 0;
              }
            }
          }
          if (element.type === 'End Condition') {
            element.inhibited = true;
            element.isBlinking = false;
          }
          // Init storage for advanced elements
          if (element.type === 'Convertor' && !element.inputResources)
            element.inputResources = {};
          if (element.type === 'Trader') {
            if (!element.traderInputs) element.traderInputs = {};
            if (!element.traderOutputs) element.traderOutputs = {};
          }
          if (element.type === 'Chart') {
            const defaultScaleX = element.chartScaleX ?? 0;
            const defaultScaleY = element.chartScaleY ?? 0;

            if (!element.chartState) {
              element.chartState = createInitialChartState(
                defaultScaleX,
                defaultScaleY
              );
            }

            element.chartState.runs += 1;
            element.chartState.highLighted = element.chartState.runs - 1;
            element.chartState.tick = 0;

            const inputConnections = nextElements.filter(
              conn =>
                conn.type === 'State Connection' &&
                conn.connectedToEnd === element.id
            );

            for (const conn of inputConnections) {
              const sourceElement = elementMap.get(conn.connectedToStart!);
              const initialValue = sourceElement
                ? getElementValue(sourceElement)
                : 0;
              const name = sourceElement?.text || '';

              const series = createChartDataSeries(
                conn.id,
                conn.color || '#000000',
                conn.thickness || 2,
                name,
                initialValue,
                element.chartState.highLighted
              );

              element.chartState.dataSeries.push(series);
            }
          }
        }
      }

      // Reset tick flags
      for (const resetEl of nextElements) {
        if (resetEl.type === 'State Connection') {
          resetEl.conditionSatisfied = undefined;
        }
        if (resetEl.hasUnsatisfiedCondition) {
          resetEl.hasUnsatisfiedCondition = false;
        }
      }
      updateAllConnectionInhibitionState();

      // =======================================================================
      // PASS 0.5: State Connections (Modifiers & Triggers)
      // =======================================================================
      for (const connection of nextElements) {
        if (
          connection.type !== 'State Connection' ||
          connection.connectedToStart == null ||
          connection.connectedToEnd == null
        )
          continue;

        const startEl = elementMap.get(connection.connectedToStart);
        const endEl = elementMap.get(connection.connectedToEnd);
        if (!startEl || !endEl) continue;

        // SKIP End Conditions (Handled in Pass 6)
        if (endEl.type === 'End Condition') continue;

        // SKIP Resource Connections (Handled by label parser later)
        if (endEl.type === 'Resource Connection') continue;

        const rawLabel = (connection.text ?? '').trim();
        const kind = classifyLabel(rawLabel);

        // Apply Modifiers
        if (kind === 'prob' || kind === 'empty') {
          const perUnit = parseConnectionLabel(rawLabel);

          // ✅ Pool -> Register: apply per resource in the pool
          if (endEl.type === 'Register') {
            let delta = perUnit;
            if (startEl.type === 'Pool') {
              const unitsInPool = getElementValue(startEl); // sums all colors
              delta = perUnit * unitsInPool;
            }
            if (delta !== 0) {
              registerDeltaById.set(
                endEl.id,
                (registerDeltaById.get(endEl.id) ?? 0) + delta
              );
            }
          } else {
            // existing behavior for Pools / other targets
            // applyStateConnectionDelta(endEl, perUnit);
          }
        }

        // Handle Triggers
        const isLabelTrigger =
          shouldActivateTrigger(rawLabel) || isTriggerOutput(rawLabel);
        if (startEl.type === 'Gate' || isLabelTrigger) {
          endEl.triggerCount = (endEl.triggerCount ?? 0) + 1;
        }
      }

      // Update visuals for labels (e.g. Resource Connections "+x")
      applyDynamicResourceLabelsMutable(nextElements);

      // --------- PASS 1: generic connections (but SKIP Gate outputs) ---------
      for (const connection of nextElements) {
        if (
          !isResourceLikeConnection(connection) ||
          connection.connectedToStart == null ||
          connection.connectedToEnd == null
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

      // =======================================================================
      // PASS 0.8: Artificial Intelligence
      // =======================================================================
      for (const ai of nextElements) {
        if (ai.type !== 'Artifical Intelligence') continue;

        const isForced = isForcedActivation(ai);
        let isTriggerActive = isForced;
        if (!isTriggerActive) {
          if (activationType === 'automatic') {
            if (ai.activation === 'automatic') isTriggerActive = true;
            else if (ai.activation === 'passive' && consumePassiveTrigger(ai))
              isTriggerActive = true;
          } else if (activationType === 'interactive') {
            if (
              ai.activation === 'interactive' &&
              interactiveElementId === ai.id
            )
              isTriggerActive = true;
          } else if (activationType === 'onstart') {
            if (ai.activation === 'onstart' && !ai.hasStarted)
              isTriggerActive = true;
          }
        }

        if (!isTriggerActive) continue;

        const actions = Math.max(1, ai.actions ?? 1);
        const cachedLines = aiScriptCache.get(ai.id);
        const lines = cachedLines ?? parseAiScript(ai.script ?? '');
        if (!cachedLines) aiScriptCache.set(ai.id, lines);

        for (let a = 0; a < actions; a++) {
          const command = selectAiCommand(lines, getValueForIdentifier);
          if (!command) break;
          if (command.type === 'fire') {
            command.targets.forEach(queueForcedActivation);
          } else {
            const choices = command.targets;
            if (choices.length > 0) {
              const idx = Math.floor(Math.random() * choices.length);
              queueForcedActivation(choices[idx]);
            }
          }
        }

        if (activationType === 'onstart') ai.hasStarted = true;
      }

      // =======================================================================
      // PASS 1: Pools
      // =======================================================================
      for (const pool of nextElements) {
        if (pool.type !== 'Pool') continue;

        const isForced = isForcedActivation(pool);
        let isTriggerActive = isForced;
        if (!isTriggerActive) {
          if (activationType === 'automatic') {
            if (pool.activation === 'automatic') isTriggerActive = true;
            else if (
              pool.activation === 'passive' &&
              consumePassiveTrigger(pool)
            )
              isTriggerActive = true;
          } else if (activationType === 'interactive') {
            if (
              pool.activation === 'interactive' &&
              interactiveElementId === pool.id
            )
              isTriggerActive = true;
          } else if (activationType === 'onstart') {
            if (pool.activation === 'onstart' && !pool.hasStarted)
              isTriggerActive = true;
          }
        }

        if (!isTriggerActive) continue;

        // PULL
        const inputConns = nextElements.filter(
          c =>
            isResourceLikeConnection(c) &&
            c.connectedToEnd === pool.id &&
            !c.inhibited // Filter out inhibited connections
        );
        const validInputs = inputConns.filter(c => {
          const start = elementMap.get(c.connectedToStart!);
          return !start || start.type !== 'Source';
        });

        const requirements = validInputs
          .map(conn => {
            const labelValue = parseConnectionLabel(conn.text);
            // For pool pulls, use decimal logic when pool is triggered
            const unitsToRequest = handleDecimalResourceDispatch(
              conn,
              labelValue,
              fractionalDispatchRef.current,
              currentTick
            );
            return {
              conn,
              units: unitsToRequest,
              color: normalizeColor(conn.color),
              startEl: elementMap.get(conn.connectedToStart!),
            };
          })
          .filter(r => r.startEl && r.units > 0);

        if (pool.pullMode === 'pull all') {
          if (
            requirements.every(r => canTakeUnits(r.startEl!, r.units, r.color))
          ) {
            requirements.forEach(r => {
              const taken = takeUnits(r.startEl!, r.units, r.color);
              const space = (pool.max ?? Infinity) - (pool.currentPoints ?? 0);
              const accepted = Math.min(taken, space);
              modResCount(pool, r.color, accepted);
              if (transfers)
                recordTransfer(transfers, r.conn, accepted, r.startEl);
            });
          }
        } else {
          // pull any
          for (const r of requirements) {
            if (canTakeUnits(r.startEl!, r.units, r.color)) {
              const taken = takeUnits(r.startEl!, r.units, r.color);
              const space = (pool.max ?? Infinity) - (pool.currentPoints ?? 0);
              const accepted = Math.min(taken, space);
              modResCount(pool, r.color, accepted);
              if (transfers)
                recordTransfer(transfers, r.conn, accepted, r.startEl);
              break;
            }
          }
        }

        // PUSH
        if (pool.pullMode === 'push any' || pool.pullMode === 'push all') {
          const outputConns = nextElements.filter(
            c =>
              isResourceLikeConnection(c) &&
              c.connectedToStart === pool.id &&
              !c.inhibited // Filter out inhibited connections
          );
          const outputs = outputConns
            .map(conn => {
              const labelValue = parseConnectionLabel(conn.text);
              // Calculate actual units to dispatch using decimal logic
              const unitsToDispatch = handleDecimalResourceDispatch(
                conn,
                labelValue,
                fractionalDispatchRef.current,
                currentTick
              );
              return {
                conn,
                units: unitsToDispatch,
                color: normalizeColor(conn.color),
                endEl: elementMap.get(conn.connectedToEnd!),
              };
            })
            .filter(o => o.endEl && o.units > 0);

          if (pool.pullMode === 'push all') {
            const allAvail = outputs.every(
              o => getResCount(pool, o.color) >= o.units
            );
            if (allAvail) {
              outputs.forEach(o => {
                let canDeliver = true;
                if (o.endEl!.type === 'Pool') {
                  const cap =
                    (o.endEl!.max ?? Infinity) - (o.endEl!.currentPoints ?? 0);
                  if (cap < o.units) canDeliver = false;
                }
                if (canDeliver) {
                  modResCount(pool, o.color, -o.units);
                  if (o.endEl!.type === 'Pool')
                    modResCount(o.endEl!, o.color, o.units);
                  if (transfers)
                    recordTransfer(transfers, o.conn, o.units, pool);
                }
              });
            }
          } else {
            for (const o of outputs) {
              if (getResCount(pool, o.color) >= o.units) {
                let canDeliver = true;
                if (o.endEl!.type === 'Pool') {
                  const cap =
                    (o.endEl!.max ?? Infinity) - (o.endEl!.currentPoints ?? 0);
                  if (cap < o.units) canDeliver = false;
                }
                if (canDeliver) {
                  modResCount(pool, o.color, -o.units);
                  if (o.endEl!.type === 'Pool')
                    modResCount(o.endEl!, o.color, o.units);
                  if (transfers)
                    recordTransfer(transfers, o.conn, o.units, pool);
                }
              }
            }
          }
        }
        if (activationType === 'onstart') pool.hasStarted = true;
      }

      // =======================================================================
      // PASS 2: Gates
      // =======================================================================
      for (const gate of nextElements) {
        if (gate.type !== 'Gate') continue;
        const isForced = isForcedActivation(gate);
        let isTriggerActive = isForced;
        if (!isTriggerActive) {
          if (activationType === 'automatic') {
            if (gate.activation === 'automatic') isTriggerActive = true;
            else if (
              gate.activation === 'passive' &&
              consumePassiveTrigger(gate)
            )
              isTriggerActive = true;
          } else if (activationType === 'interactive') {
            if (
              gate.activation === 'interactive' &&
              interactiveElementId === gate.id
            )
              isTriggerActive = true;
          } else if (activationType === 'onstart') {
            if (gate.activation === 'onstart' && !gate.hasStarted)
              isTriggerActive = true;
          }
        }
        if (
          !isTriggerActive ||
          (!isForced && activationType !== 'onstart' && gate.hasStarted)
        )
          continue;

        const inputConns = nextElements.filter(
          c =>
            isResourceLikeConnection(c) &&
            c.connectedToEnd === gate.id &&
            !c.inhibited // Filter out inhibited connections
        );
        const outputConns = nextElements.filter(
          c =>
            (isResourceLikeConnection(c) || c.type === 'State Connection') &&
            c.connectedToStart === gate.id &&
            !(c.type === 'Resource Connection' && c.inhibited) // Filter inhibited Resource Connections
        );
        const actions = Math.max(1, gate.actions ?? 1);

        for (let a = 0; a < actions; a++) {
          const inputs = inputConns
            .map(conn => ({
              conn,
              units: parseConnectionLabel(conn.text),
              color: normalizeColor(conn.color),
              startEl: elementMap.get(conn.connectedToStart!),
            }))
            .filter(i => i.startEl && i.units > 0);

          if (gate.pullMode === 'pull all') {
            const allAvail = inputs.every(i =>
              canTakeUnits(i.startEl!, i.units, i.color)
            );
            if (!allAvail) break;
            inputs.forEach(i => {
              const taken = takeUnits(i.startEl!, i.units, i.color);
              if (taken > 0) {
                if (transfers)
                  recordTransfer(transfers, i.conn, taken, i.startEl);
                for (let k = 0; k < taken; k++) {
                  const chosen = chooseGateOutputs(gate, outputConns);
                  chosen.forEach(out => deliverUnits(out, 1, i.startEl));
                }
              }
            });
          } else {
            for (const i of inputs) {
              if (canTakeUnits(i.startEl!, i.units, i.color)) {
                const taken = takeUnits(i.startEl!, i.units, i.color);
                if (taken > 0) {
                  if (transfers)
                    recordTransfer(transfers, i.conn, taken, i.startEl);
                  for (let k = 0; k < taken; k++) {
                    const chosen = chooseGateOutputs(gate, outputConns);
                    chosen.forEach(out => deliverUnits(out, 1, i.startEl));
                  }
                }
              }
            }
          }
        }
        if (activationType === 'onstart') gate.hasStarted = true;
      }

      // =======================================================================
      // PASS 2.5: Sources
      // =======================================================================
      for (const source of nextElements) {
        if (source.type !== 'Source') continue;
        const isForced = isForcedActivation(source);
        let isTriggerActive = isForced;
        if (!isTriggerActive) {
          if (activationType === 'automatic') {
            if (source.activation === 'automatic') isTriggerActive = true;
            else if (
              source.activation === 'passive' &&
              consumePassiveTrigger(source)
            )
              isTriggerActive = true;
          } else if (activationType === 'interactive') {
            if (
              source.activation === 'interactive' &&
              interactiveElementId === source.id
            )
              isTriggerActive = true;
          } else if (activationType === 'onstart') {
            if (source.activation === 'onstart' && !source.hasStarted)
              isTriggerActive = true;
          }
        }

        const canRun =
          isForced || activationType !== 'onstart' || !source.hasStarted;
        if (isTriggerActive && canRun) {
          const outputConns = nextElements.filter(
            c =>
              isResourceLikeConnection(c) &&
              c.connectedToStart === source.id &&
              !c.inhibited // Filter out inhibited connections
          );
          outputConns.forEach(conn => {
            const labelValue = parseConnectionLabel(conn.text);
            if (labelValue > 0) {
              // Use decimal dispatch logic for fractional labels
              const amountToDispatch = handleDecimalResourceDispatch(
                conn,
                labelValue,
                fractionalDispatchRef.current,
                currentTick
              );
              if (amountToDispatch > 0) {
                deliverUnits(conn, amountToDispatch, source);
              }
            }
          });
          if (activationType === 'onstart') source.hasStarted = true;
        }
      }

      // =======================================================================
      // PASS 2.7: Drains
      // =======================================================================
      for (const drain of nextElements) {
        if (drain.type !== 'Drain') continue;
        const isForced = isForcedActivation(drain);
        let isTriggerActive = isForced;
        if (!isTriggerActive) {
          if (activationType === 'automatic') {
            if (drain.activation === 'automatic') isTriggerActive = true;
            else if (
              drain.activation === 'passive' &&
              consumePassiveTrigger(drain)
            )
              isTriggerActive = true;
          } else if (activationType === 'interactive') {
            if (
              drain.activation === 'interactive' &&
              interactiveElementId === drain.id
            )
              isTriggerActive = true;
          } else if (activationType === 'onstart') {
            if (drain.activation === 'onstart' && !drain.hasStarted)
              isTriggerActive = true;
          }
        }

        const canRun =
          isForced || activationType !== 'onstart' || !drain.hasStarted;
        if (isTriggerActive && canRun) {
          const inputConns = nextElements.filter(
            c =>
              isResourceLikeConnection(c) &&
              c.connectedToEnd === drain.id &&
              !c.inhibited // Filter out inhibited connections
          );
          inputConns.forEach(conn => {
            const startEl = elementMap.get(conn.connectedToStart!);
            const labelValue = parseConnectionLabel(conn.text);
            const color = normalizeColor(conn.color);

            if (startEl && labelValue > 0) {
              // Use decimal dispatch logic for fractional labels
              const amountToTake = handleDecimalResourceDispatch(
                conn,
                labelValue,
                fractionalDispatchRef.current,
                currentTick
              );

              if (
                amountToTake > 0 &&
                canTakeUnits(startEl, amountToTake, color)
              ) {
                const taken = takeUnits(startEl, amountToTake, color);
                if (transfers) recordTransfer(transfers, conn, taken, startEl);
                const stateOuts = nextElements.filter(
                  c =>
                    c.type === 'State Connection' &&
                    c.connectedToStart === drain.id &&
                    (isTriggerOutput(c.text) || shouldActivateTrigger(c.text))
                );
                stateOuts.forEach(out => {
                  const target = elementMap.get(out.connectedToEnd!);
                  if (target)
                    target.triggerCount = (target.triggerCount ?? 0) + 1;
                });
              }
            }
          });
          if (activationType === 'onstart') drain.hasStarted = true;
        }
      }

      // =======================================================================
      // PASS 3: Convertors
      // =======================================================================
      for (const convertor of nextElements) {
        if (convertor.type !== 'Convertor') continue;

        const isForced = isForcedActivation(convertor);
        let isTriggerActive = isForced;
        if (!isTriggerActive) {
          if (activationType === 'automatic') {
            if (convertor.activation === 'automatic') isTriggerActive = true;
            else if (
              convertor.activation === 'passive' &&
              consumePassiveTrigger(convertor)
            )
              isTriggerActive = true;
          } else if (activationType === 'interactive') {
            if (
              convertor.activation === 'interactive' &&
              interactiveElementId === convertor.id
            )
              isTriggerActive = true;
          } else if (activationType === 'onstart') {
            if (convertor.activation === 'onstart' && !convertor.hasStarted)
              isTriggerActive = true;
          }
        }

        if (!isTriggerActive) continue;

        if (!convertor.inputResources) convertor.inputResources = {};

        const inputConns = nextElements.filter(
          c =>
            isResourceLikeConnection(c) &&
            c.connectedToEnd === convertor.id &&
            !c.inhibited // Filter out inhibited connections
        );
        const outputConns = nextElements.filter(
          c =>
            isResourceLikeConnection(c) &&
            c.connectedToStart === convertor.id &&
            !c.inhibited // Filter out inhibited connections
        );

        if (inputConns.length === 0 || outputConns.length === 0) {
          if (activationType === 'onstart') convertor.hasStarted = true;
          continue;
        }

        const actions = Math.max(1, convertor.actions ?? 1);

        for (let a = 0; a < actions; a++) {
          const inputs = inputConns
            .map(conn => ({
              conn,
              units: parseConnectionLabel(conn.text),
              color: normalizeColor(conn.color),
              key: conn.text || 'default',
              startEl: elementMap.get(conn.connectedToStart!),
            }))
            .filter(i => i.units > 0);

          const outputs = outputConns
            .map(conn => {
              const raw = (conn.text ?? '').trim();
              const percentMatch = raw.match(/^([+-]?\d+(?:\.\d+)?)\s*%$/);
              const probability = percentMatch
                ? Math.min(1, Math.max(0, parseFloat(percentMatch[1]) / 100))
                : undefined;

              return {
                conn,
                units: percentMatch ? 1 : parseConnectionLabel(conn.text),
                probability,
                color: normalizeColor(conn.color),
                endEl: elementMap.get(conn.connectedToEnd!),
              };
            })
            .filter(o => o.units > 0);

          // Output count from conversion ratio: e.g. 10 in → 1 out, so 20 in → 2 out. Base = right part of multiplicand label (e.g. "2*10" → base 10).
          // 0*10 = 0 input → no output
          const anyMultiplicandInputZero = inputConns.some(
            conn =>
              (conn.text ?? '').includes('*') &&
              parseConnectionLabel(conn.text) === 0
          );
          const ratios = inputs
            .filter(i => (i.conn.text ?? '').includes('*'))
            .map(i => {
              const base = getBaseInputAmountFromMultiplyLabel(i.conn.text);
              return base != null && base > 0 ? Math.floor(i.units / base) : 1;
            });
          const speedFactor = anyMultiplicandInputZero
            ? 0
            : ratios.length > 0
              ? Math.min(...ratios)
              : 1;

          let canConvert = !anyMultiplicandInputZero;

          if (canConvert && convertor.pullMode === 'pull all') {
            canConvert = inputs.every(i => {
              const stored = convertor.inputResources![i.key] || 0;
              if (stored >= i.units) return true;
              return i.startEl && canTakeUnits(i.startEl, i.units, i.color);
            });
          } else if (canConvert) {
            canConvert = inputs.some(i => {
              const stored = convertor.inputResources![i.key] || 0;
              if (stored >= i.units) return true;
              return i.startEl && canTakeUnits(i.startEl, i.units, i.color);
            });
          }

          if (canConvert) {
            inputs.forEach(i => {
              let amountNeeded = i.units;
              const stored = convertor.inputResources![i.key] || 0;
              if (stored >= amountNeeded) {
                convertor.inputResources![i.key] = stored - amountNeeded;
                amountNeeded = 0;
              } else if (stored > 0) {
                amountNeeded -= stored;
                convertor.inputResources![i.key] = 0;
              }

              if (amountNeeded > 0 && i.startEl) {
                if (
                  convertor.pullMode === 'pull all' ||
                  canTakeUnits(i.startEl, amountNeeded, i.color)
                ) {
                  const taken = takeUnits(i.startEl, amountNeeded, i.color);
                  if (
                    taken < amountNeeded &&
                    convertor.pullMode === 'pull any'
                  ) {
                    convertor.inputResources![i.key] =
                      (convertor.inputResources![i.key] || 0) + taken;
                  }
                  if (taken > 0 && transfers)
                    recordTransfer(transfers, i.conn, taken, i.startEl);
                }
              }
            });

            outputs.forEach(o => {
              if (
                typeof o.probability === 'number' &&
                Math.random() > o.probability
              ) {
                return;
              }
              deliverUnits(o.conn, o.units * speedFactor, convertor);
            });
          } else {
            if (convertor.pullMode === 'pull any') {
              for (const inputConn of inputConns) {
                const inputElement = elementMap.get(
                  inputConn.connectedToStart!
                );
                const req = inputs.find(i => i.conn.id === inputConn.id);
                if (!req) continue;

                if (
                  inputElement &&
                  inputElement.type === 'Pool' &&
                  getResCount(inputElement, req.color) > 0
                ) {
                  const available = Math.min(
                    req.units,
                    getResCount(inputElement, req.color)
                  );
                  if (available > 0) {
                    modResCount(inputElement, req.color, -available);
                    recordTransfer(
                      transfers,
                      inputConn,
                      available,
                      inputElement
                    );
                    const resourceKey = inputConn.text || 'default';
                    convertor.inputResources![resourceKey] =
                      (convertor.inputResources![resourceKey] || 0) + available;
                  }
                }
              }
            }
          }
        }
        if (activationType === 'onstart') convertor.hasStarted = true;
      }

      // =======================================================================
      // PASS 4: Traders
      // =======================================================================
      for (const trader of nextElements) {
        if (trader.type !== 'Trader') continue;
        if (!trader.traderInputs) trader.traderInputs = {};
        if (!trader.traderOutputs) trader.traderOutputs = {};

        const inputConns = nextElements.filter(
          c =>
            isResourceLikeConnection(c) &&
            c.connectedToEnd === trader.id &&
            !c.inhibited // Filter out inhibited connections
        );
        const outputConns = nextElements.filter(
          c =>
            isResourceLikeConnection(c) &&
            c.connectedToStart === trader.id &&
            !c.inhibited // Filter out inhibited connections
        );
        const triggerConns = nextElements.filter(
          c => c.type === 'State Connection' && c.connectedToEnd === trader.id
        );

        if (inputConns.length === 0 || outputConns.length === 0) {
          if (activationType === 'onstart') trader.hasStarted = true;
          continue;
        }

        const isIncomplete = inputConns.length < 2 || outputConns.length < 2;
        trader.isIncompleteTrader = isIncomplete;

        let isActivated = false;
        if (triggerConns.length > 0) {
          if ((trader.triggerCount ?? 0) > 0) {
            isActivated = true;
            trader.triggerCount = (trader.triggerCount ?? 0) - 1;
          }
        }
        if (!isActivated) {
          for (const inputConn of inputConns) {
            const inputElement = inputConn.connectedToStart
              ? elementMap.get(inputConn.connectedToStart)
              : undefined;
            if (inputElement) {
              if (inputElement.type === 'Source') {
                isActivated = true;
                break;
              } else if (
                inputElement.type === 'Pool' &&
                (inputElement.currentPoints ?? 0) > 0
              ) {
                isActivated = true;
                break;
              }
            }
          }
        }

        const isForced = isForcedActivation(trader);
        let isTriggerActive = isForced;
        if (!isTriggerActive) {
          if (activationType === 'automatic') {
            if (trader.activation === 'automatic') isTriggerActive = true;
            else if (
              trader.activation === 'passive' &&
              consumePassiveTrigger(trader)
            )
              isTriggerActive = true;
          } else if (activationType === 'interactive') {
            if (
              trader.activation === 'interactive' &&
              interactiveElementId === trader.id
            )
              isTriggerActive = true;
          } else if (activationType === 'onstart') {
            if (trader.activation === 'onstart' && !trader.hasStarted)
              isTriggerActive = true;
          }
        }

        const canFire =
          isForced || activationType !== 'onstart' || !trader.hasStarted;

        if (trader.pullMode === 'pull any' && isTriggerActive && canFire) {
          for (const inputConn of inputConns) {
            const inputElement = inputConn.connectedToStart
              ? elementMap.get(inputConn.connectedToStart)
              : undefined;
            const amount = parseConnectionLabel(inputConn.text);
            const color = normalizeColor(inputConn.color);

            if (inputElement && inputElement.type === 'Pool') {
              const avail = Math.min(amount, getResCount(inputElement, color));
              if (avail > 0) {
                modResCount(inputElement, color, -avail);
                const key = `conn_${inputConn.id}`;
                const current = trader.traderInputs![key] || 0;
                trader.traderInputs![key] = current + avail;
                // Show animation for resources entering trader
                if (transfers) {
                  recordTransfer(transfers, inputConn, avail, inputElement);
                }
              }
            } else if (inputElement && inputElement.type === 'Source') {
              const key = `conn_${inputConn.id}`;
              const current = trader.traderInputs![key] || 0;
              trader.traderInputs![key] = current + amount;
              // Show animation for resources entering trader from Source
              if (transfers) {
                recordTransfer(transfers, inputConn, amount, inputElement);
              }
            }
          }
        }

        if (!(isActivated && isTriggerActive && canFire)) {
          if (activationType === 'onstart') trader.hasStarted = true;
          continue;
        }

        const actions = Math.max(1, trader.actions ?? 1);

        for (let a = 0; a < actions; a++) {
          if (isIncomplete) {
            processIncompleteTrader(
              trader,
              inputConns,
              outputConns,
              elementMap,
              transfers
            );
          } else {
            processCompleteTrader(
              trader,
              inputConns,
              outputConns,
              elementMap,
              transfers
            );
          }
        }
        if (activationType === 'onstart') trader.hasStarted = true;
      }

      // =======================================================================
      // PASS 5: Registers
      // =======================================================================
      for (const register of nextElements) {
        if (register.type !== 'Register') continue;

        const min = register.minValue ?? -9999;
        const max = register.maxValue ?? 9999;

        // ✅ Always apply Pool->Register modifiers (summed in PASS 0.5)
        const delta = registerDeltaById.get(register.id) ?? 0;

        const isInteractive =
          register.interactive === true || register.interactive === 'true';

        // Ensure there is always a stable base
        if (register.currentValue === undefined) {
          register.currentValue = register.startingValue ?? 0;
        }

        // Interactive registers: keep existing behavior (user-controlled base),
        // but still apply the computed delta.
        if (isInteractive) {
          if (delta !== 0) applyStateConnectionDelta(register, delta);
          continue;
        }

        // Non-interactive registers:
        // 1) Compute base from formula if present
        // 2) Otherwise base = startingValue
        let baseValue = register.startingValue ?? 0;

        const inputConns = nextElements.filter(
          c => c.type === 'State Connection' && c.connectedToEnd === register.id
        );
        if (inputConns.length > 0 && register.formula) {
          try {
            const variables = new Array(23).fill(0);
            for (const conn of inputConns) {
              const label = (conn.text || '').trim().toLowerCase();
              if (label.length === 1 && RegisterExpression.isVariable(label)) {
                const idx = label.charCodeAt(0) - 97;
                const src = elementMap.get(conn.connectedToStart!);
                variables[idx] = getElementValue(src);
              }
            }
            const postfix = RegisterExpression.toPostfix(register.formula);
            const val = RegisterExpression.evaluate(postfix, variables);

            // formula gives the base (clamped + floored like your original)
            baseValue = Math.floor(Math.min(Math.max(val, min), max));
          } catch (e) {
            console.log(e);
            baseValue = 0;
          }
        }

        // ✅ Final register value always includes the computed delta
        const nextVal = baseValue + delta;
        register.currentValue = Math.min(
          Math.max(Math.floor(nextVal), min),
          max
        );
      }

      // =======================================================================
      // PASS 6: End Conditions
      // =======================================================================
      for (const endCond of nextElements) {
        if (endCond.type !== 'End Condition') continue;
        const inputConns = nextElements.filter(
          c => c.type === 'State Connection' && c.connectedToEnd === endCond.id
        );
        if (inputConns.length === 0) continue;

        let allMet = true;
        for (const conn of inputConns) {
          const startEl = elementMap.get(conn.connectedToStart!);
          const label = (conn.text || '').trim();
          const kind = classifyLabel(label);

          if (startEl && kind === 'cond') {
            const fn = parseCond(label);
            if (fn) {
              const val = getElementValue(startEl);
              const satisfied = fn(val);
              conn.conditionSatisfied = satisfied;
              conn.hasUnsatisfiedCondition = !satisfied;
              if (!satisfied) allMet = false;
            }
          } else if (startEl && kind === 'interval') {
            const range = parseInterval(label);
            if (range) {
              const val = getElementValue(startEl);
              const satisfied = val >= range[0] && val <= range[1];
              conn.conditionSatisfied = satisfied;
              conn.hasUnsatisfiedCondition = !satisfied;
              if (!satisfied) allMet = false;
            }
          }
        }

        const wasInhibited = endCond.inhibited;
        endCond.inhibited = !allMet;

        if (
          wasInhibited &&
          !endCond.inhibited &&
          (activationType === 'automatic' || activationType === 'onstart')
        ) {
          endCond.isBlinking = true;

          // ✅ STOP THE LOOP IMMEDIATELY
          if (typeof window !== 'undefined') {
            (window as unknown as CustomWindow).__GAME_ENDED__ = true;
          }

          document.dispatchEvent(
            new CustomEvent('game-end', {
              detail: { message: endCond.text || 'Victory!' },
            })
          );
        }
      }
      // console.log('✅ [PASS 6] EndCondition check complete');

      // applyDynamicResourceLabelsMutable(nextElements);
      updateStateConnectionVisualState(nextElements);

      // =======================================================================
      // PASS 7: Chart data collection
      // =======================================================================
      for (const chart of nextElements) {
        if (chart.type !== 'Chart' || !chart.chartState) continue;

        if (activationType !== 'automatic') continue;

        chart.chartState.tick += 1;

        console.log(
          '[Chart Debug] Tick:',
          chart.chartState.tick,
          'scaleX:',
          chart.chartState.scaleX,
          'scaleY:',
          chart.chartState.scaleY
        );

        const inputConnections = nextElements.filter(
          conn =>
            conn.type === 'State Connection' && conn.connectedToEnd === chart.id
        );

        for (const conn of inputConnections) {
          const sourceElement = elementMap.get(conn.connectedToStart!);
          if (!sourceElement) continue;

          let value = getElementValue(sourceElement);

          const labelValue = parseFloat(conn.text || '1') || 1;
          value = value * labelValue;

          if (isNaN(value)) value = 0;

          console.log(
            '[Chart Debug] Value:',
            value,
            'Current scaleY:',
            chart.chartState.scaleY
          );

          if (
            chart.chartState.defaultScaleX > 0 &&
            chart.chartState.tick > chart.chartState.defaultScaleX
          ) {
            continue;
          }

          if (
            chart.chartState.defaultScaleY > 0 &&
            value > chart.chartState.defaultScaleY
          ) {
            continue;
          }

          const series = chart.chartState.dataSeries.find(
            s =>
              s.connectionId === conn.id &&
              s.run === chart.chartState!.highLighted
          );

          if (series) {
            series.data.push(value);

            if (chart.chartState.defaultScaleY === 0) {
              const oldScaleY = chart.chartState.scaleY;
              chart.chartState.scaleY = autoExpandScaleY(
                chart.chartState.scaleY,
                value
              );
              if (oldScaleY !== chart.chartState.scaleY) {
                console.log(
                  '[Chart Debug] Y axis expanded from',
                  oldScaleY,
                  'to',
                  chart.chartState.scaleY
                );
              }
            }

            if (chart.chartState.defaultScaleY >= 0 && value < 0) {
              chart.chartState.negScaleY = autoExpandNegScaleY(
                chart.chartState.negScaleY,
                value
              );
            }
          }
        }

        if (
          chart.chartState.defaultScaleX <= 0 &&
          chart.chartState.tick > chart.chartState.scaleX &&
          chart.chartState.scaleX <= (chart.chartWidth || 200) - 10
        ) {
          const oldScaleX = chart.chartState.scaleX;
          chart.chartState.scaleX += 10;
          console.log(
            '[Chart Debug] X axis expanded from',
            oldScaleX,
            'to',
            chart.chartState.scaleX
          );
        }
      }

      return nextElements;
    },
    [updateStateConnectionVisualState]
  );

  const runSimulationAndCollectTransfers = useCallback(
    (
      elementsToUpdate: GraphElement[],
      activationType: 'automatic' | 'onstart' | 'interactive',
      interactiveElementId?: number
    ): { nextElements: GraphElement[]; transfers: ResourceTransfer[] } => {
      const transfers: ResourceTransfer[] = [];
      const nextElements = runSimulationTick(
        elementsToUpdate,
        activationType,
        interactiveElementId,
        transfers
      );
      return { nextElements, transfers };
    },
    [runSimulationTick]
  );

  const setElementsRef = useRef(setElements);
  const spawnMovingTokensRef = useRef(spawnMovingTokens);
  const runSimulationRef = useRef(runSimulationAndCollectTransfers);

  useEffect(() => {
    setElementsRef.current = setElements;
  }, [setElements]);

  useEffect(() => {
    spawnMovingTokensRef.current = spawnMovingTokens;
  }, [spawnMovingTokens]);

  useEffect(() => {
    runSimulationRef.current = runSimulationAndCollectTransfers;
  }, [runSimulationAndCollectTransfers]);

  // Helper function to collect resources for Pull Any mode
  // const collectResourcesForPullAny = (
  //   trader: GraphElement,
  //   inputConns: GraphElement[],
  //   elementMap: Map<number, GraphElement>
  // ) => {
  //   for (const inputConn of inputConns) {
  //     const inputElement = inputConn.connectedToStart
  //       ? elementMap.get(inputConn.connectedToStart)
  //       : undefined;
  //     if (
  //       inputElement &&
  //       inputElement.type === 'Pool' &&
  //       (inputElement.currentPoints ?? 0) > 0
  //     ) {
  //       const amount = parseConnectionLabel(inputConn.text);
  //       const available = Math.min(amount, inputElement.currentPoints ?? 0);

  //       if (available > 0) {
  //         inputElement.currentPoints =
  //           (inputElement.currentPoints ?? 0) - available;
  //         // Use connection ID as key to uniquely identify each input connection
  //         const resourceKey = `conn_${inputConn.id}`;
  //         const current = trader.traderInputs![resourceKey] || 0;
  //         trader.traderInputs![resourceKey] = current + available;
  //       }
  //     } else if (inputElement && inputElement.type === 'Source') {
  //       // Source has infinite resources, collect the amount specified
  //       const amount = parseConnectionLabel(inputConn.text);
  //       const resourceKey = `conn_${inputConn.id}`;
  //       const current = trader.traderInputs![resourceKey] || 0;
  //       trader.traderInputs![resourceKey] = current + amount;
  //     }
  //   }
  // };

  // Helper function for incomplete trader (behaves like convertor - can create/destroy resources)
  const processIncompleteTrader = (
    trader: GraphElement,
    inputConns: GraphElement[],
    outputConns: GraphElement[],
    elementMap: Map<number, GraphElement>,
    transfers?: ResourceTransfer[]
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
        for (const [connId, requiredAmount] of requiredInputs.entries()) {
          const inputConn = inputConns.find(c => c.id === connId);
          if (inputConn) {
            const inputElement = elementMap.get(inputConn.connectedToStart!);
            if (inputElement && inputElement.type === 'Pool') {
              inputElement.currentPoints = Math.max(
                0,
                (inputElement.currentPoints ?? 0) - requiredAmount
              );
              recordTransfer(
                transfers,
                inputConn,
                requiredAmount,
                inputElement
              );
            } else if (inputElement && inputElement.type === 'Source') {
              // Source doesn't need to be consumed (infinite), but show animation
              if (transfers) {
                recordTransfer(
                  transfers,
                  inputConn,
                  requiredAmount,
                  inputElement
                );
              }
            }
          }
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
            const accepted = Math.min(totalInput, max - current);
            if (accepted > 0 && transfers) {
              recordTransfer(transfers, outputConn, accepted, trader);
            }
            outputElement.currentPoints = Math.min(current + totalInput, max);
          }
        } else if (inputConns.length === 1 && outputConns.length > 1) {
          // Single input, multiple outputs: split input to all outputs
          const inputAmount = requiredInputs.values().next().value || 0;

          for (const outputConn of outputConns) {
            const outputElement = elementMap.get(outputConn.connectedToEnd!);
            if (outputElement && outputElement.type === 'Pool') {
              const current = outputElement.currentPoints ?? 0;
              const max = outputElement.max ?? Infinity;
              const accepted = Math.min(inputAmount, max - current);
              if (accepted > 0 && transfers) {
                recordTransfer(transfers, outputConn, accepted, trader);
              }
              outputElement.currentPoints = Math.min(
                current + inputAmount,
                max
              );
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
                const accepted = Math.min(outputAmount, max - current);
                if (accepted > 0 && transfers) {
                  recordTransfer(transfers, outputConn, accepted, trader);
                }
                outputElement.currentPoints = Math.min(
                  current + outputAmount,
                  max
                );
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
            const totalOutput = totalInputPerTrade * tradesToExecute;
            const accepted = Math.min(totalOutput, max - current);
            if (accepted > 0 && transfers) {
              recordTransfer(transfers, outputConn, accepted, trader);
            }
            outputElement.currentPoints = Math.min(current + totalOutput, max);
          }
        } else if (inputConns.length === 1 && outputConns.length > 1) {
          // Single input, multiple outputs: split input to all outputs
          const inputAmount = requiredInputs.values().next().value || 0;

          for (const outputConn of outputConns) {
            const outputElement = elementMap.get(outputConn.connectedToEnd!);
            if (outputElement && outputElement.type === 'Pool') {
              const current = outputElement.currentPoints ?? 0;
              const max = outputElement.max ?? Infinity;
              const totalOutput = inputAmount * tradesToExecute;
              const accepted = Math.min(totalOutput, max - current);
              if (accepted > 0 && transfers) {
                recordTransfer(transfers, outputConn, accepted, trader);
              }
              outputElement.currentPoints = Math.min(
                current + totalOutput,
                max
              );
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
                const totalOutput = outputAmount * tradesToExecute;
                const accepted = Math.min(totalOutput, max - current);
                if (accepted > 0 && transfers) {
                  recordTransfer(transfers, outputConn, accepted, trader);
                }
                outputElement.currentPoints = Math.min(
                  current + totalOutput,
                  max
                );
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
    transfers?: ResourceTransfer[]
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
        for (const [connId, requiredAmount] of requiredInputs.entries()) {
          const inputConn = inputConns.find(c => c.id === connId);
          if (inputConn) {
            const inputElement = elementMap.get(inputConn.connectedToStart!);
            if (inputElement && inputElement.type === 'Pool') {
              inputElement.currentPoints = Math.max(
                0,
                (inputElement.currentPoints ?? 0) - requiredAmount
              );
              recordTransfer(
                transfers,
                inputConn,
                requiredAmount,
                inputElement
              );
            } else if (inputElement && inputElement.type === 'Source') {
              // Source doesn't need to be consumed (infinite), but show animation
              if (transfers) {
                recordTransfer(
                  transfers,
                  inputConn,
                  requiredAmount,
                  inputElement
                );
              }
            }
          }
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
              const accepted = Math.min(totalInput, max - current);
              if (accepted > 0 && transfers) {
                recordTransfer(transfers, outputConn, accepted, trader);
              }
              outputElement.currentPoints = Math.min(current + totalInput, max);
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
                  const accepted = Math.min(input.amount, max - current);
                  if (accepted > 0 && transfers) {
                    recordTransfer(transfers, outputConn, accepted, trader);
                  }
                  // Send the amount from this input to this output
                  outputElement.currentPoints = Math.min(
                    current + input.amount,
                    max
                  );
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
              const totalOutput = totalInputPerTrade * tradesToExecute;
              const accepted = Math.min(totalOutput, max - current);
              if (accepted > 0 && transfers) {
                recordTransfer(transfers, outputConn, accepted, trader);
              }
              outputElement.currentPoints = Math.min(
                current + totalOutput,
                max
              );
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
                  const totalOutput = input.amount * tradesToExecute;
                  const accepted = Math.min(totalOutput, max - current);
                  if (accepted > 0 && transfers) {
                    recordTransfer(transfers, outputConn, accepted, trader);
                  }
                  // Send the amount from this input to this output (multiplied by trades)
                  outputElement.currentPoints = Math.min(
                    current + totalOutput,
                    max
                  );
                }
              }
            }
          }
        }
      }
    }
  };

  const handleInteractiveAction = (elementId: number) => {
    console.log('🔥 Interactive tick for', elementId);
    setElements(currentElements => {
      const { nextElements, transfers } = runSimulationAndCollectTransfers(
        currentElements,
        'interactive', // ⬅️ use a dedicated interactive tick
        elementId
      );

      if (transfers.length) {
        spawnMovingTokens(transfers, nextElements);
      }

      return nextElements;
    });
  };

  // const handleInteractiveAction = (elementId: number) => {
  //   setElements(currentElements => {
  //     const { nextElements, transfers } = runSimulationAndCollectTransfers(
  //       currentElements,
  //       'interactive',
  //       elementId
  //     );
  //     if (transfers.length) {
  //       spawnMovingTokens(transfers, nextElements);
  //     }
  //     return nextElements;
  //   });
  // };

  useEffect(() => {
    let simulationInterval: NodeJS.Timeout | undefined;

    if (typeof window !== 'undefined') {
      (window as unknown as CustomWindow).__GAME_ENDED__ = false;
    }

    // =======================================================================
    // A. START: When "Run" is clicked
    // =======================================================================
    if (isRunning && !hasSimulationStarted) {
      console.log('--- Starting Simulation ---');
      setHasSimulationStarted(true);
      setGameEnded(false);
      gameEndedRef.current = false;

      // Reset fractional dispatch state for new simulation
      fractionalDispatchRef.current.clear();
      currentTickRef.current = 0;

      // 1. FORCE RESET ELEMENTS (Clean slate before starting)
      // This handles the case where we "Froze" the board on the previous Game Over
      setElementsRef.current(prev => {
        const resetElements = prev.map(el => {
          const baseReset = {
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
              ...baseReset,
              currentPoints: startVal,
              resourcesByColor: initialResources,
            };
          }
          if (el.type === 'Register')
            return { ...baseReset, currentValue: el.startingValue || 0 };
          if (el.type === 'End Condition')
            return { ...baseReset, inhibited: true, isBlinking: false };
          if (el.type === 'Convertor')
            return { ...baseReset, inputResources: {}, outputResources: {} };
          if (el.type === 'Trader')
            return { ...baseReset, traderInputs: {}, traderOutputs: {} };
          if (
            el.type === 'Resource Connection' &&
            (el.dynamicLabelBase !== undefined ||
              el.dynamicLabelFractionDen !== undefined)
          ) {
            if (
              el.dynamicLabelFractionNum != null &&
              el.dynamicLabelFractionDen != null
            ) {
              return {
                ...baseReset,
                text: `${el.dynamicLabelFractionNum}/${el.dynamicLabelFractionDen}`,
              };
            }
            return { ...baseReset, text: String(el.dynamicLabelBase) };
          }
          return baseReset;
        });

        // 2. Run the "OnStart" tick immediately on the clean elements
        const { nextElements, transfers } = runSimulationRef.current(
          resetElements,
          'onstart'
        );
        if (transfers.length)
          spawnMovingTokensRef.current(transfers, nextElements);

        return nextElements;
      });
    }

    // B. While the simulation is running:
    if (isRunning) {
      // 2. Start the timer for all "Automatic" actions.
      simulationInterval = setInterval(() => {
        // ✅ FREEZE LOGIC: If game ended, do NOT update elements, do NOT spawn tokens.
        // Just return to keep the current state frozen on screen.
        if (
          gameEndedRef.current ||
          (typeof window !== 'undefined' &&
            (window as unknown as CustomWindow).__GAME_ENDED__)
        ) {
          return;
        }
        try {
          // Add try...catch
          setElementsRef.current(currentElements => {
            const { nextElements, transfers } = runSimulationRef.current(
              currentElements,
              'automatic'
            );
            if (transfers.length) {
              spawnMovingTokensRef.current(transfers, nextElements);
            }
            return nextElements;
          });
        } catch (error) {
          console.error('⛔️ Error during Automatic tick:', error); // Log the error
          if (simulationInterval) clearInterval(simulationInterval); // Stop interval on error
          // Optionally stop simulation on error:
          // setIsRunning(false); // Needs setIsRunning from props/context
        }
      }, 1000); // Ticks every 1 second.
    }

    // =======================================================================
    // C. STOP: When "Stop" is clicked OR Parent stops it
    // =======================================================================
    if (!isRunning && hasSimulationStarted) {
      console.log('--- Stopped ---');
      setHasSimulationStarted(false);

      // ✅ VITAL FIX:
      // If the game ended due to Victory, DO NOT RESET the board.
      // We want to keep the "Victory" state visible (Frozen).
      // The Reset will happen automatically at the start of the *next* run (Block A).
      if (gameEndedRef.current) {
        console.log('--- Game Over State Frozen (No Reset) ---');
        return;
      }

      // If it was a manual stop (user clicked Stop), Reset immediately.
      console.log('--- Manual Stop: Resetting Board ---');
      setMovingTokens([]);
      setGameEnded(false);

      // Reset fractional dispatch state
      fractionalDispatchRef.current.clear();
      currentTickRef.current = 0;

      setElementsRef.current(prev =>
        prev.map(el => {
          const baseReset = {
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
              ...baseReset,
              currentPoints: startVal,
              resourcesByColor: initialResources,
            };
          }
          if (el.type === 'Register')
            return { ...baseReset, currentValue: el.startingValue || 0 };
          if (el.type === 'End Condition')
            return { ...baseReset, inhibited: true, isBlinking: false };
          if (el.type === 'Convertor')
            return { ...baseReset, inputResources: {}, outputResources: {} };
          if (el.type === 'Trader')
            return { ...baseReset, traderInputs: {}, traderOutputs: {} };
          if (
            el.type === 'Resource Connection' &&
            (el.dynamicLabelBase !== undefined ||
              el.dynamicLabelFractionDen !== undefined)
          ) {
            if (
              el.dynamicLabelFractionNum != null &&
              el.dynamicLabelFractionDen != null
            ) {
              return {
                ...baseReset,
                text: `${el.dynamicLabelFractionNum}/${el.dynamicLabelFractionDen}`,
              };
            }
            return { ...baseReset, text: String(el.dynamicLabelBase) };
          }
          return baseReset;
        })
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
  }, [isRunning, hasSimulationStarted]);

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

      if (isRunning) return;

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
        setSelectedId(pastedElements.map((el: GraphElement) => el.id));
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
      gameEndedRef.current = true;
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
        const polyline = getResourcePolylinePointsForConnection(
          element,
          elements
        );
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

  // Helper function to snap a node's center to its edge in the direction of another point
  const snapNodeToEdgeInDirection = (
    node: GraphElement,
    targetPoint: { x: number; y: number }
  ): { x: number; y: number } => {
    const nodeCenter = { x: node.x, y: node.y };

    // Get node size
    let nodeWidth: number;
    let nodeHeight: number;
    if (node.type === 'Group') {
      nodeWidth = node.width || 200;
      nodeHeight = node.height || 150;
    } else {
      const size = getElementSize(node.thickness);
      nodeWidth = size;
      nodeHeight = size;
    }

    const offsetX = nodeWidth / 2;
    const offsetY = nodeHeight / 2;
    const left = node.x - offsetX;
    const right = node.x + offsetX;
    const top = node.y - offsetY;
    const bottom = node.y + offsetY;

    // Calculate direction from node center to target point
    const dx = targetPoint.x - nodeCenter.x;
    const dy = targetPoint.y - nodeCenter.y;
    const distance = Math.hypot(dx, dy);

    if (distance === 0) {
      // If target is at same position, return node center
      return nodeCenter;
    }

    // Normalize direction
    const dirX = dx / distance;
    const dirY = dy / distance;

    // Find intersection of ray from node center in direction of target with node edges
    // Calculate t values where ray intersects each edge
    const tLeft =
      offsetX > 0 ? (left - nodeCenter.x) / (dirX || 1e-10) : Infinity;
    const tRight =
      offsetX > 0 ? (right - nodeCenter.x) / (dirX || 1e-10) : Infinity;
    const tTop =
      offsetY > 0 ? (top - nodeCenter.y) / (dirY || 1e-10) : Infinity;
    const tBottom =
      offsetY > 0 ? (bottom - nodeCenter.y) / (dirY || 1e-10) : Infinity;

    // Find the closest positive t (intersection in direction of target)
    const validTs = [
      dirX > 0 ? tRight : tLeft,
      dirY > 0 ? tBottom : tTop,
    ].filter(t => t > 0);

    const t = Math.min(...validTs);

    if (!isFinite(t)) {
      return nodeCenter;
    }

    // Calculate intersection point
    const intersectionX = nodeCenter.x + dirX * t;
    const intersectionY = nodeCenter.y + dirY * t;

    return { x: intersectionX, y: intersectionY };
  };

  // const normalizeVector = (
  //   dx: number,
  //   dy: number
  // ): { x: number; y: number } => {
  //   const len = Math.hypot(dx, dy);
  //   if (len === 0) return { x: 0, y: 0 };
  //   return { x: dx / len, y: dy / len };
  // };

  // const getPolylineMidpoint = (
  //   points: { x: number; y: number }[]
  // ): {
  //   point: { x: number; y: number };
  //   normal: { x: number; y: number };
  // } => {
  //   if (points.length === 0) {
  //     return { point: { x: 0, y: 0 }, normal: { x: 0, y: -1 } };
  //   }
  //   if (points.length === 1) {
  //     return { point: points[0], normal: { x: 0, y: -1 } };
  //   }

  //   let totalLength = 0;
  //   const segments: Array<{
  //     start: { x: number; y: number };
  //     end: { x: number; y: number };
  //     length: number;
  //   }> = [];

  //   for (let i = 0; i < points.length - 1; i++) {
  //     const start = points[i];
  //     const end = points[i + 1];
  //     const length = Math.hypot(end.x - start.x, end.y - start.y);
  //     if (length === 0) continue;
  //     segments.push({ start, end, length });
  //     totalLength += length;
  //   }

  //   if (segments.length === 0) {
  //     return { point: points[0], normal: { x: 0, y: -1 } };
  //   }

  //   const target = totalLength / 2;
  //   let traversed = 0;
  //   for (const segment of segments) {
  //     if (traversed + segment.length >= target) {
  //       const remaining = target - traversed;
  //       const t = remaining / segment.length;
  //       const midX = segment.start.x + (segment.end.x - segment.start.x) * t;
  //       const midY = segment.start.y + (segment.end.y - segment.start.y) * t;
  //       const direction = normalizeVector(
  //         segment.end.x - segment.start.x,
  //         segment.end.y - segment.start.y
  //       );
  //       const normal = normalizeVector(-direction.y, direction.x);
  //       return { point: { x: midX, y: midY }, normal };
  //     }
  //     traversed += segment.length;
  //   }

  //   const lastSegment = segments[segments.length - 1];
  //   const direction = normalizeVector(
  //     lastSegment.end.x - lastSegment.start.x,
  //     lastSegment.end.y - lastSegment.start.y
  //   );
  //   const normal = normalizeVector(-direction.y, direction.x);
  //   return { point: lastSegment.end, normal };
  // };

  const placeElement = (
    type: GraphElementType,
    clientX: number,
    clientY: number,
    target: HTMLDivElement
  ) => {
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const id = nextIdRef.current++;

    if (type === 'Chart') {
      const chartProps = toolProperties?.chart;
      const defaultScaleX = chartProps?.scaleX ?? 0;
      const defaultScaleY = chartProps?.scaleY ?? 0;

      setElements(prev => [
        ...prev,
        {
          id,
          type,
          x,
          y,
          color: chartProps?.color || '#000000',
          thickness: chartProps?.thickness || 2,
          text: chartProps?.text || '',
          labelPosition: 0,
          chartWidth: 200,
          chartHeight: 150,
          chartScaleX: defaultScaleX,
          chartScaleY: defaultScaleY,
          chartState: createInitialChartState(defaultScaleX, defaultScaleY),
        },
      ]);
      setSelectedId([id]);
      return;
    }

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
          labelPosition: 0,
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
          labelPosition: 0,
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
          labelPosition: 0,
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
          labelPosition: 0,
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
          labelPosition: 0,
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
          labelPosition: 0,
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
          labelPosition: 0,
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
          labelPosition: 0,
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
          labelPosition: 0,
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
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (isRunning) return;
    e.preventDefault();

    // 1) If user dropped a file, prefer XML import
    const files = Array.from(e.dataTransfer.files ?? []);
    const xmlFile = files.find(isProbablyXmlFile);
    if (xmlFile) {
      try {
        const text = await xmlFile.text();
        importXmlText(text);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Failed to import XML.';
        console.error(err);
        setXmlImportError(msg);
      }
      return;
    }

    // 2) Otherwise, keep your existing tool drop behavior

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
          const polyline = getResourcePolylinePointsForConnection(
            endElement,
            elements
          );
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

    const id = nextIdRef.current++;

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
      labelPosition: 0.5,
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
    // If running, ignore canvas clicks (or handle panning if you have that)
    if (isRunning) return;

    // We ONLY care about deselecting or box-selecting if we are in 'Select' mode
    if (selectedTool === 'Select') {
      // 1. If clicking strictly on the canvas (background)
      if (e.target === canvasRef.current) {
        // 2. Clear selection immediately (unless holding Ctrl for box select addition)
        if (!e.ctrlKey && !e.metaKey) {
          setSelectedId([]);
        }

        // 3. Start Box Selection
        setMouseDownOnCanvas(true);
        setIsSelectingBox(false); // Reset flag
        const rect = canvasRef.current.getBoundingClientRect();
        setBoxStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setBoxEnd(null);
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

    // Handle node label dragging (move label around element boundary)
    if (draggingLabelElementId !== null && canvasRef.current) {
      const el = elements.find(el => el.id === draggingLabelElementId);
      if (el) {
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const angle = Math.atan2(canvasY - el.y, canvasX - el.x);
        let labelPosition = (angle + Math.PI / 2) / (2 * Math.PI);
        if (labelPosition < 0) labelPosition += 1;
        if (labelPosition > 1) labelPosition -= 1;
        setElements(prev =>
          prev.map(n =>
            n.id === draggingLabelElementId ? { ...n, labelPosition } : n
          )
        );
      }
      return;
    }

    // Handle waypoint dragging
    if (draggingWaypoint && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      setElements(prev =>
        prev.map(el => {
          if (el.id === draggingWaypoint.connectionId && el.points) {
            const updatedPoints = [...el.points];
            updatedPoints[draggingWaypoint.waypointIndex] = {
              x: newX,
              y: newY,
            };
            return { ...el, points: updatedPoints };
          }
          return el;
        })
      );
      return;
    }

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
    // End waypoint dragging
    if (draggingWaypoint) {
      setDraggingWaypoint(null);
      return;
    }

    const wasDragging = draggingId !== null && dragOffset !== null;
    if (wasDragging && draggedElements) {
      setElements(draggedElements);
      setDraggedElements(null);
    }

    setMouseDownOnCanvas(false);
    setDragOffset(null);
    setDraggingId(null);
    setDraggingLabelElementId(null);

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

  // Render text label under/beside a node; position controlled by el.labelPosition (0=bottom, draggable when selected)
  const renderNodeLabel = (el: GraphElement, size: number) => {
    const labelText = (el.text ?? '').trim();
    if (!labelText) return null;
    const pos = getLabelPointOnNodeBoundary(
      el.x,
      el.y,
      size,
      el.labelPosition ?? 0
    );
    const canDrag =
      !isRunning && selectedTool === 'Select' && selectedId.includes(el.id);
    const isDraggingLabel = draggingLabelElementId === el.id;
    return (
      <div
        key={`label-${el.id}`}
        className="node-label"
        style={{
          position: 'absolute',
          left: pos.x,
          top: pos.y,
          transform: 'translate(-50%, -50%)',
          fontSize: 11,
          fontWeight: 'bold',
          color: el.color || '#000000',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          pointerEvents: canDrag ? 'auto' : 'none',
          cursor: canDrag ? (isDraggingLabel ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
        }}
        onMouseDown={e => {
          if (canDrag) {
            e.stopPropagation();
            setDraggingLabelElementId(el.id);
          }
        }}
      >
        {labelText}
      </div>
    );
  };

  // Render each element
  const renderElement = (el: GraphElement) => {
    const isSelected = !isRunning && selectedId.includes(el.id);
    const selectableClass =
      !isRunning && selectedTool === 'Select' ? 'selectable' : '';
    const applyConditionStyle = (style: CSSProperties = {}): CSSProperties =>
      el.hasUnsatisfiedCondition ? { ...style, opacity: 0.4 } : style;
    switch (el.type) {
      case 'Text Label': {
        let labelClass = '';
        if (!isRunning) {
          labelClass = selectedTool === 'Select' ? 'selectable' : 'clickable';
        }
        return (
          <span
            key={el.id}
            className={`text-label-span ${labelClass} ${isSelected ? 'selected' : ''}`}
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
      }
      case 'Pool': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const radius = (size / 40) * 18; // Scale radius proportionally
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <>
            <svg
              key={el.id}
              className={`svg-element pool-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Source': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <>
            <svg
              key={el.id}
              className={`svg-element source-element clickable-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
                fontSize={14 * scale}
              >
                ∞
              </text>
            </svg>
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Drain': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <>
            <svg
              key={el.id}
              className={`svg-element drain-element clickable-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Group':
        return (
          <div
            key={el.id}
            className={`group-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
                  fontSize: '11px',
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
          <>
            <svg
              key={el.id}
              className={`svg-element gate-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Convertor': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <>
            <svg
              key={el.id}
              className={`svg-element convertor-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
                    fontSize={5 * scale}
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
                  fontSize={4.5 * scale}
                  fill="white"
                  textAnchor="middle"
                  className="convertor-label"
                >
                  {el.text}
                </text>
              )}
            </svg>
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Trader': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <>
            <svg
              key={el.id}
              className={`svg-element trader-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
                  fontSize={4.5 * scale}
                  fill={el.color || '#000000'}
                  textAnchor="middle"
                  className="trader-label"
                >
                  {el.text}
                </text>
              )}
            </svg>
            {renderNodeLabel(el, size)}
          </>
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
              className={`svg-element end-condition-element ${selectableClass} ${isSelected ? 'selected' : ''} ${el.isBlinking ? 'blinking' : ''} ${!el.inhibited ? 'victory' : ''}`}
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
            {renderNodeLabel(el, size)}
          </g>
        );
      }
      case 'Artifical Intelligence': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <>
            <svg
              key={el.id}
              className={`svg-element ai-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
              <rect
                x={5 * scale}
                y={5 * scale}
                width={30 * scale}
                height={30 * scale}
                fill="white"
                stroke={isSelected ? '#0078d4' : el.color || '#000000'}
                strokeWidth={el.thickness || 2}
                className={`ai-rect ${isSelected ? 'selected' : ''}`}
              />
              <text
                x={center}
                y={center + 2 * scale}
                className="ai-text"
                fill={el.color || '#000000'}
                fontSize={12 * scale}
                fontWeight="bold"
                textAnchor="middle"
              >
                AP
              </text>
              <text
                x={33 * scale}
                y={9 * scale}
                className="ai-star"
                fill={el.color || '#000000'}
                fontSize={10 * scale}
                fontWeight="bold"
                textAnchor="middle"
              >
                *
              </text>
            </svg>
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Register': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <>
            <svg
              key={el.id}
              className={`svg-element register-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
                fontSize={11 * scale}
                textAnchor="middle"
                fontWeight="bold"
              >
                {el.currentValue !== undefined && el.currentValue !== null
                  ? el.currentValue
                  : 0}
              </text>
            </svg>
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Delay': {
        const size = getElementSize(el.thickness);
        const center = size / 2;
        const scale = size / 40;
        const offset = size / 2; // Offset to center element at el.x, el.y
        return (
          <>
            <svg
              key={el.id}
              className={`svg-element delay-element ${selectableClass} ${isSelected ? 'selected' : ''}`}
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
                fontSize={11 * scale}
              >
                8
              </text>
            </svg>
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Resource Connection': {
        // Get the connected nodes to calculate proper positioning
        const startNode = elements.find(
          node => node.id === el.connectedToStart
        );
        const endNode = elements.find(node => node.id === el.connectedToEnd);

        let startPoint = {
          x: el.startX ?? el.x,
          y: el.startY ?? el.y,
        };
        let endPoint = {
          x: el.endX ?? el.x,
          y: el.endY ?? el.y,
        };

        // Snap nodes to their edges in the direction of the next point (first waypoint or end node)
        if (startNode && endNode) {
          // If there are waypoints, snap start to first waypoint; otherwise snap to end node
          const startTargetPoint =
            el.points && el.points.length > 0
              ? el.points[0]
              : { x: endNode.x, y: endNode.y };

          // If there are waypoints, snap end to last waypoint; otherwise snap to start node
          const endTargetPoint =
            el.points && el.points.length > 0
              ? el.points[el.points.length - 1]
              : { x: startNode.x, y: startNode.y };

          startPoint = snapNodeToEdgeInDirection(startNode, startTargetPoint);
          endPoint = snapNodeToEdgeInDirection(endNode, endTargetPoint);
        } else if (startNode) {
          startPoint = { x: startNode.x, y: startNode.y };
        } else if (endNode) {
          endPoint = { x: endNode.x, y: endNode.y };
        }

        // Include intermediate waypoints if they exist, creating a polyline that follows breakpoints
        const pathPoints = [startPoint, ...(el.points ?? []), endPoint];

        if (pathPoints.length < 2) {
          return null;
        }

        const padding = 15;
        const polyline = pathPoints;
        type LegacyPositionCarrier = { position?: unknown };

        const legacyPosRaw = (el as LegacyPositionCarrier).position;
        const legacyPosNum =
          typeof legacyPosRaw === 'number'
            ? legacyPosRaw
            : typeof legacyPosRaw === 'string'
              ? Number(legacyPosRaw)
              : NaN;

        const labelPos =
          el.labelPosition ??
          (Number.isFinite(legacyPosNum) ? legacyPosNum : undefined) ??
          0.5;

        const labelPoint = getLabelPointForConnection(polyline, labelPos);

        // const labelPoint = getLabelPointForConnection(
        //   polyline,
        //   el.labelPosition ?? (el as any).position ?? 0.5
        // );

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
          selectableClass,
          isSelected ? 'selected' : '',
        ];
        if (isConditionUnsatisfied) {
          containerClasses.push('condition-pending');
        }

        return (
          <div
            key={el.id}
            className={containerClasses.join(' ').trim()}
            style={applyConditionStyle({
              left,
              top,
              width,
              height,
              pointerEvents: 'none',
            })}
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
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <polygon
                    points="0 0, 6 5, 0 10"
                    fill={markerStroke}
                    stroke={markerStroke}
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
                style={{ pointerEvents: 'visibleStroke', cursor: 'pointer' }}
              />
              {el.text && el.text !== '0' && (
                <text
                  x={labelX}
                  y={labelY}
                  className="connection-label-text"
                  fill={
                    isConditionUnsatisfied ? '#8a8a8a' : baseConnectionColor
                  }
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                  {el.text}
                </text>
              )}
              {/* Show waypoint circles when connection is selected */}
              {isSelected &&
                el.points &&
                el.points.length > 0 &&
                el.points.map((point, index) => (
                  <circle
                    key={`waypoint-${index}`}
                    cx={point.x - left}
                    cy={point.y - top}
                    r="5"
                    fill={baseConnectionColor}
                    stroke="#fff"
                    strokeWidth="2"
                    style={{ cursor: 'grab', pointerEvents: 'auto' }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      setDraggingWaypoint({
                        connectionId: el.id,
                        waypointIndex: index,
                      });
                    }}
                  />
                ))}
            </svg>
            {isSelected && (
              <>
                <div
                  className="arrow-handle"
                  style={{
                    left: startPoint.x - left - 4,
                    top: startPoint.y - top - 4,
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                <div
                  className="arrow-handle"
                  style={{
                    left: endPoint.x - left - 4,
                    top: endPoint.y - top - 4,
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'end')}
                />
              </>
            )}
          </div>
        );
      }
      case 'State Connection': {
        // Get the connected nodes to calculate proper positioning
        const startTarget = elements.find(
          node => node.id === el.connectedToStart
        );
        const endTarget = elements.find(node => node.id === el.connectedToEnd);

        let startPoint = {
          x: el.startX ?? el.x,
          y: el.startY ?? el.y,
        };
        let endPoint = {
          x: el.endX ?? el.x,
          y: el.endY ?? el.y,
        };

        // Snap nodes to their edges in the direction of the next point (first waypoint or end node)
        const startIsConn = isConnectionElement(startTarget);
        const endIsConn = isConnectionElement(endTarget);
        const isChartConnection = endTarget?.type === 'Chart';
        const getArrowPoints = (
          tip: { x: number; y: number },
          from: { x: number; y: number },
          offsetLeft: number,
          offsetTop: number
        ): string => {
          const dx = tip.x - from.x;
          const dy = tip.y - from.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const size = 8;
          const tx = tip.x - offsetLeft;
          const ty = tip.y - offsetTop;
          const bx = tx - ux * size;
          const by = ty - uy * size;
          const px = -uy * (size / 2);
          const py = ux * (size / 2);
          return `${tx},${ty} ${bx + px},${by + py} ${bx - px},${by - py}`;
        };

        if (startTarget && endTarget && !startIsConn && !endIsConn) {
          // If there are waypoints, snap start to first waypoint; otherwise snap to end node
          const startTargetPoint =
            el.points && el.points.length > 0
              ? el.points[0]
              : { x: endTarget.x, y: endTarget.y };

          // If there are waypoints, snap end to last waypoint; otherwise snap to start node
          const endTargetPoint =
            el.points && el.points.length > 0
              ? el.points[el.points.length - 1]
              : { x: startTarget.x, y: startTarget.y };

          startPoint = snapNodeToEdgeInDirection(startTarget, startTargetPoint);
          endPoint = snapNodeToEdgeInDirection(endTarget, endTargetPoint);
        } else if (startTarget && !startIsConn) {
          startPoint = { x: startTarget.x, y: startTarget.y };
        } else if (endTarget && !endIsConn) {
          endPoint = { x: endTarget.x, y: endTarget.y };
        }

        if (endTarget && endTarget.type === 'Resource Connection') {
          const labelAnchor = getResourceConnectionLabelAnchor(endTarget);
          if (labelAnchor) {
            endPoint = labelAnchor;
          }
        }

        // Include intermediate waypoints if they exist, creating a polyline that follows breakpoints
        const pathPoints = [startPoint, ...(el.points ?? []), endPoint];

        if (pathPoints.length < 2) {
          return null;
        }

        const padding = 15;
        const polyline = pathPoints;
        type LegacyPositionCarrier = { position?: unknown };

        const legacyPosRaw = (el as LegacyPositionCarrier).position;
        const legacyPosNum =
          typeof legacyPosRaw === 'number'
            ? legacyPosRaw
            : typeof legacyPosRaw === 'string'
              ? Number(legacyPosRaw)
              : NaN;

        const labelPos =
          el.labelPosition ??
          (Number.isFinite(legacyPosNum) ? legacyPosNum : undefined) ??
          0.5;

        const labelPoint = getLabelPointForConnection(polyline, labelPos);

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
          selectableClass,
          isSelected ? 'selected' : '',
        ];
        if (isConditionUnsatisfied) {
          containerClasses.push('condition-pending');
        }

        return (
          <div
            key={el.id}
            className={containerClasses.join(' ').trim()}
            style={applyConditionStyle({
              left,
              top,
              width,
              height,
              pointerEvents: 'none',
            })}
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
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <polygon
                    points="0 0, 6 5, 0 10"
                    fill={el.color || '#000000'}
                    stroke={el.color || '#000000'}
                    strokeWidth="1"
                    // opacity={isChartConnection && !isSelected ? 0 : 1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
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
                strokeOpacity={isChartConnection && !isSelected ? 0 : 1}
                className={`state-connection-line ${isSelected ? 'selected' : ''}`}
                markerEnd={`url(#arrowhead-dashed-${el.id})`}
                style={{ pointerEvents: 'visibleStroke', cursor: 'pointer' }}
              />
              {isChartConnection && (
                <>
                  <g
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredChartConnId(el.id)}
                    onMouseLeave={() => setHoveredChartConnId(null)}
                    onMouseDown={e => {
                      e.stopPropagation();
                      setSelectedId([el.id]);
                    }}
                  >
                    {(() => {
                      const dx = pathPoints[1].x - startPoint.x;
                      const dy = pathPoints[1].y - startPoint.y;
                      const len = Math.hypot(dx, dy) || 1;
                      const ux = dx / len;
                      const uy = dy / len;
                      const cx = startPoint.x - left;
                      const cy = startPoint.y - top;
                      const stemLen = 6;
                      const arrowSize = 6;
                      const color =
                        hoveredChartConnId === el.id
                          ? '#f5a623'
                          : el.color || '#000000';
                      const lx = cx + ux * stemLen;
                      const ly = cy + uy * stemLen;
                      const tx = cx + ux * (stemLen + arrowSize);
                      const ty = cy + uy * (stemLen + arrowSize);
                      const px = -uy * (arrowSize / 2);
                      const py = ux * (arrowSize / 2);
                      return (
                        <>
                          <line
                            x1={cx}
                            y1={cy}
                            x2={lx}
                            y2={ly}
                            stroke={color}
                            strokeWidth={2}
                          />
                          <polygon
                            points={`${tx},${ty} ${lx + px},${ly + py} ${lx - px},${ly - py}`}
                            fill={color}
                          />
                        </>
                      );
                    })()}
                  </g>
                  <polygon
                    points={getArrowPoints(
                      endPoint,
                      pathPoints[pathPoints.length - 2],
                      left,
                      top
                    )}
                    fill={
                      hoveredChartConnId === el.id
                        ? '#f5a623'
                        : el.color || '#000000'
                    }
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredChartConnId(el.id)}
                    onMouseLeave={() => setHoveredChartConnId(null)}
                    onMouseDown={e => {
                      e.stopPropagation();
                      setSelectedId([el.id]);
                    }}
                  />
                </>
              )}
              {el.text && el.text !== '0' && (
                <text
                  x={labelX}
                  y={labelY}
                  className="connection-label-text"
                  fill={labelFill}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                >
                  {el.text}
                </text>
              )}
              {/* Show waypoint circles when connection is selected */}
              {isSelected &&
                el.points &&
                el.points.length > 0 &&
                el.points.map((point, index) => (
                  <circle
                    key={`waypoint-${index}`}
                    cx={point.x - left}
                    cy={point.y - top}
                    r="5"
                    fill={el.color || '#000000'}
                    stroke="#fff"
                    strokeWidth="2"
                    style={{ cursor: 'grab', pointerEvents: 'auto' }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      setDraggingWaypoint({
                        connectionId: el.id,
                        waypointIndex: index,
                      });
                    }}
                  />
                ))}
            </svg>
            {isSelected && (
              <>
                <div
                  className="arrow-handle"
                  style={{
                    left: startPoint.x - left - 4,
                    top: startPoint.y - top - 4,
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'start')}
                />
                <div
                  className="arrow-handle"
                  style={{
                    left: endPoint.x - left - 4,
                    top: endPoint.y - top - 4,
                    pointerEvents: 'auto',
                  }}
                  onMouseDown={e => handleArrowResizeStart(e, el.id, 'end')}
                />
              </>
            )}
          </div>
        );
      }
      case 'Chart': {
        const chartState =
          el.chartState ||
          // change
          createInitialChartState(el.chartScaleX ?? 0, el.chartScaleY ?? 0);
        const chartSize = Math.max(el.chartWidth || 200, el.chartHeight || 150);

        return (
          <>
            <ChartElement
              key={el.id}
              id={el.id}
              x={el.x}
              y={el.y}
              width={el.chartWidth || 200}
              height={el.chartHeight || 150}
              color={el.color || '#000000'}
              thickness={el.thickness || 2}
              text={el.text}
              chartState={chartState}
              isSelected={isSelected}
              isRunning={isRunning}
              visibleRuns={25}
              selectableClass={selectableClass}
              applyConditionStyle={applyConditionStyle}
              onMouseDown={e => {
                e.stopPropagation();
                handleElementMouseDown(e, el.id);
              }}
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
              onResize={(newWidth, newHeight) => {
                setElements(prev =>
                  prev.map(element =>
                    element.id === el.id
                      ? {
                          ...element,
                          chartWidth: newWidth,
                          chartHeight: newHeight,
                        }
                      : element
                  )
                );
              }}
              onClear={() => {
                setElements(prev =>
                  prev.map(element =>
                    element.id === el.id
                      ? {
                          ...element,
                          // change
                          chartState: createInitialChartState(
                            el.chartScaleX ?? 0,
                            el.chartScaleY ?? 0
                          ),
                        }
                      : element
                  )
                );
              }}
              onPrevious={() => {
                setElements(prev =>
                  prev.map(element => {
                    if (element.id === el.id && element.chartState) {
                      const newHighLighted = Math.max(
                        0,
                        element.chartState.highLighted - 1
                      );
                      return {
                        ...element,
                        chartState: {
                          ...element.chartState,
                          highLighted: newHighLighted,
                        },
                      };
                    }
                    return element;
                  })
                );
              }}
              onNext={() => {
                setElements(prev =>
                  prev.map(element => {
                    if (element.id === el.id && element.chartState) {
                      const newHighLighted = Math.min(
                        element.chartState.runs - 1,
                        element.chartState.highLighted + 1
                      );
                      return {
                        ...element,
                        chartState: {
                          ...element.chartState,
                          highLighted: newHighLighted,
                        },
                      };
                    }
                    return element;
                  })
                );
              }}
            />
            {renderNodeLabel(el, chartSize)}
          </>
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

  const isConnectionElement = (element: GraphElement | undefined) =>
    element != null &&
    (element.type === 'Resource Connection' ||
      element.type === 'State Connection');

  const getResourceConnectionLabelAnchor = (
    conn: GraphElement
  ): { x: number; y: number } | null => {
    if (conn.type !== 'Resource Connection') return null;

    const startNode = elements.find(node => node.id === conn.connectedToStart);
    const endNode = elements.find(node => node.id === conn.connectedToEnd);

    let startPoint = {
      x: conn.startX ?? conn.x,
      y: conn.startY ?? conn.y,
    };
    let endPoint = {
      x: conn.endX ?? conn.x,
      y: conn.endY ?? conn.y,
    };

    const startIsConn = isConnectionElement(startNode);
    const endIsConn = isConnectionElement(endNode);

    if (startNode && endNode && !startIsConn && !endIsConn) {
      const startTargetPoint =
        conn.points && conn.points.length > 0
          ? conn.points[0]
          : { x: endNode.x, y: endNode.y };
      const endTargetPoint =
        conn.points && conn.points.length > 0
          ? conn.points[conn.points.length - 1]
          : { x: startNode.x, y: startNode.y };

      startPoint = snapNodeToEdgeInDirection(startNode, startTargetPoint);
      endPoint = snapNodeToEdgeInDirection(endNode, endTargetPoint);
    } else if (startNode && !startIsConn) {
      startPoint = { x: startNode.x, y: startNode.y };
    } else if (endNode && !endIsConn) {
      endPoint = { x: endNode.x, y: endNode.y };
    }

    const pathPoints = [startPoint, ...(conn.points ?? []), endPoint];
    if (pathPoints.length < 2) return null;

    type LegacyPositionCarrier = { position?: unknown };
    const legacyPosRaw = (conn as LegacyPositionCarrier).position;
    const legacyPosNum =
      typeof legacyPosRaw === 'number'
        ? legacyPosRaw
        : typeof legacyPosRaw === 'string'
          ? Number(legacyPosRaw)
          : NaN;

    const labelPos =
      conn.labelPosition ??
      (Number.isFinite(legacyPosNum) ? legacyPosNum : undefined) ??
      0.5;

    return getLabelPointForConnection(pathPoints, labelPos);
  };

  // const displayElements = draggedElements || elements;
  const displayElements = React.useMemo(() => {
    const list = draggedElements || elements;
    return [...list].sort((a, b) => {
      const isAConn =
        a.type === 'Resource Connection' || a.type === 'State Connection';
      const isBConn =
        b.type === 'Resource Connection' || b.type === 'State Connection';

      // If A is connection and B is node, A goes first (bottom layer)
      if (isAConn && !isBConn) return -1;
      // If A is node and B is connection, B goes first (bottom layer)
      if (!isAConn && isBConn) return 1;

      // Otherwise maintain creation order
      return a.id - b.id;
    });
  }, [draggedElements, elements]);

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
      {movingTokens.map(token => (
        <div
          key={token.id}
          className="moving-token"
          style={{
            position: 'absolute',
            // small radius: center the 8×8 dot on the point
            left: token.currentX - 4,
            top: token.currentY - 4,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: token.color || '#000000',
            pointerEvents: 'none',
          }}
        />
      ))}
      <input
        ref={xmlFileInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        style={{ display: 'none' }}
        onChange={handleXmlFileChosen}
      />

      {xmlImportError && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 9999,
            background: 'white',
            padding: 8,
            border: '1px solid #ccc',
          }}
        >
          <b>XML Import Error:</b> {xmlImportError}
        </div>
      )}
    </div>
  );
};

export default Canvas;
