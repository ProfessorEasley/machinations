import { readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import type { GraphElement, GraphElementType } from './types';

/**
 * Headless XML loader for simulation graphs.
 *
 * Round-trip compatible with `serializeGraphElementsToXml` from
 * `src/utils/graphXmlSerialize.ts`. Uses `fast-xml-parser` instead of the
 * browser `DOMParser`, so this module works in Node, Vitest, and any other
 * non-DOM runtime.
 *
 * For legacy multi-schema XML files saved outside this app, use the older
 * importer in `Canvas.tsx` (which still relies on the browser DOMParser).
 */

export interface LoadGraphResult {
  elements: GraphElement[];
  warnings: string[];
}

const NODE_TAG_TO_TYPE: Record<string, GraphElementType> = {
  textLabel: 'Text Label',
  'text-label': 'Text Label',
  group: 'Group',
  chart: 'Chart',
  pool: 'Pool',
  gate: 'Gate',
  source: 'Source',
  drain: 'Drain',
  convertor: 'Convertor',
  converter: 'Convertor',
  trader: 'Trader',
  delay: 'Delay',
  register: 'Register',
  endCondition: 'End Condition',
  'end-condition': 'End Condition',
  artificalIntelligence: 'Artifical Intelligence',
  artificialIntelligence: 'Artifical Intelligence',
  ai: 'Artifical Intelligence',
};

const CONNECTION_TAGS = new Set([
  'resourceConnection',
  'resource-connection',
  'stateConnection',
  'state-connection',
]);

const ALL_KNOWN_TAGS = new Set<string>([
  ...Object.keys(NODE_TAG_TO_TYPE),
  ...CONNECTION_TAGS,
]);

const ATTR_PREFIX = '@_';

type RawNode = Record<string, unknown>;

function getAttr(node: RawNode, name: string): string | undefined {
  const v = node[ATTR_PREFIX + name];
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function getNumAttr(node: RawNode, name: string): number | undefined {
  const raw = getAttr(node, name);
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeActivation(raw?: string): GraphElement['activation'] {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === 'passive') return 'passive';
  if (s === 'interactive') return 'interactive';
  if (s === 'automatic') return 'automatic';
  if (s === 'onstart' || s === 'on start') return 'onstart';
  return undefined;
}

function normalizePullMode(raw?: string): GraphElement['pullMode'] {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase().replace(/_+/g, ' ');
  if (s === 'pull any') return 'pull any';
  if (s === 'pull all') return 'pull all';
  if (s === 'push any') return 'push any';
  if (s === 'push all') return 'push all';
  return undefined;
}

function normalizeGateType(raw?: string): GraphElement['gateType'] {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (
    s === 'deterministic' ||
    s === 'dice' ||
    s === 'skill' ||
    s === 'multiplayer' ||
    s === 'strategy'
  ) {
    return s as GraphElement['gateType'];
  }
  return undefined;
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function toNumberRecord(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(val);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function readWalletPayload(node: RawNode): Record<string, unknown> | undefined {
  const wallet = node['walletData'];
  if (wallet == null) return undefined;

  let raw: string | undefined;
  if (typeof wallet === 'string') {
    raw = wallet;
  } else if (typeof wallet === 'object' && wallet !== null) {
    const w = wallet as Record<string, unknown>;
    if (typeof w['#text'] === 'string') raw = w['#text'];
    else if (typeof w['#cdata'] === 'string') raw = w['#cdata'];
  }

  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function readScriptText(node: RawNode): string | undefined {
  const script = node['script'];
  if (script == null) return undefined;
  if (typeof script === 'string') return script;
  if (typeof script === 'object' && script !== null) {
    const s = script as Record<string, unknown>;
    if (typeof s['#text'] === 'string') return s['#text'];
    if (typeof s['#cdata'] === 'string') return s['#cdata'];
  }
  return undefined;
}

function buildNode(
  tagName: string,
  rawNode: RawNode,
  warnings: string[]
): GraphElement | undefined {
  const type = NODE_TAG_TO_TYPE[tagName];
  if (!type) return undefined;

  const idAttr = getNumAttr(rawNode, 'id');
  if (idAttr == null) {
    warnings.push(`<${tagName}> is missing required "id" attribute; skipped.`);
    return undefined;
  }

  const x = getNumAttr(rawNode, 'x') ?? 0;
  const y = getNumAttr(rawNode, 'y') ?? 0;
  const color = getAttr(rawNode, 'color');
  const thickness = getNumAttr(rawNode, 'thickness');
  const text = getAttr(rawNode, 'text') ?? getAttr(rawNode, 'caption');
  const activation = normalizeActivation(getAttr(rawNode, 'activation'));
  const pullMode = normalizePullMode(getAttr(rawNode, 'pullMode'));
  const gateType = normalizeGateType(getAttr(rawNode, 'gateType'));
  const actions = getNumAttr(rawNode, 'actions');
  const number = getNumAttr(rawNode, 'number');
  const max = getNumAttr(rawNode, 'max');
  const displayLimit = getNumAttr(rawNode, 'displayLimit');
  const labelPosition = getNumAttr(rawNode, 'labelPosition');

  const el: GraphElement = {
    id: idAttr,
    type,
    x,
    y,
    text,
    color,
    thickness,
    activation,
    pullMode,
    gateType,
    actions: actions != null ? Math.max(1, Math.floor(actions)) : undefined,
    number: number != null ? Math.floor(number) : undefined,
    max: max != null ? Math.floor(max) : undefined,
    displayLimit: displayLimit != null ? Math.floor(displayLimit) : undefined,
    labelPosition: labelPosition ?? 0,
  };

  if (type === 'Register') {
    const formula = getAttr(rawNode, 'formula');
    const minValue = getNumAttr(rawNode, 'minValue');
    const maxValue = getNumAttr(rawNode, 'maxValue');
    const interactiveRaw = getAttr(rawNode, 'interactive');
    const interactive =
      interactiveRaw != null ? interactiveRaw.toLowerCase() === 'true' : false;
    const startingValue = getNumAttr(rawNode, 'startingValue') ?? 0;
    const step = getNumAttr(rawNode, 'step') ?? 1;

    el.formula = formula ?? '';
    el.minValue = minValue ?? -9999;
    el.maxValue = maxValue ?? 9999;
    el.interactive = interactive;
    el.startingValue = startingValue;
    el.step = step;
    el.currentValue = interactive ? startingValue : 0;
  }

  if (type === 'Pool') {
    const startVal = el.number ?? 0;
    const c = el.color || '#000000';
    el.resourcesByColor = startVal > 0 ? { [c]: startVal } : {};
    el.currentPoints = startVal;
  }

  if (type === 'End Condition') {
    el.inhibited = true;
    el.isBlinking = false;
  }

  if (type === 'Convertor' || type === 'Trader') {
    const wallet = readWalletPayload(rawNode);
    if (wallet) {
      if (type === 'Convertor') {
        const ir = toNumberRecord(wallet.inputResources);
        const or = toNumberRecord(wallet.outputResources);
        const cr = toNumberRecord(wallet.conversionRate);
        if (ir) el.inputResources = ir;
        if (or) el.outputResources = or;
        if (cr) el.conversionRate = cr;
      } else {
        const ti = toNumberRecord(wallet.traderInputs);
        const to = toNumberRecord(wallet.traderOutputs);
        if (ti) el.traderInputs = ti;
        if (to) el.traderOutputs = to;
        if (typeof wallet.isIncompleteTrader === 'boolean') {
          el.isIncompleteTrader = wallet.isIncompleteTrader;
        }
      }
    }
  }

  if (type === 'Artifical Intelligence') {
    el.script = readScriptText(rawNode) ?? '';
  }

  if (type === 'Chart') {
    el.chartWidth = getNumAttr(rawNode, 'width');
    el.chartHeight = getNumAttr(rawNode, 'height');
    el.chartScaleX = getNumAttr(rawNode, 'scaleX');
    el.chartScaleY = getNumAttr(rawNode, 'scaleY');
  }

  if (type === 'Group') {
    el.width = getNumAttr(rawNode, 'width') ?? 200;
    el.height = getNumAttr(rawNode, 'height') ?? 150;
  }

  if (type === 'Delay') {
    const queueRaw = getAttr(rawNode, 'queue');
    if (queueRaw != null) {
      el.queue = queueRaw.trim().toLowerCase() === 'true';
    }
    if (!el.activation) el.activation = 'automatic';
  }

  return el;
}

function buildConnection(
  tagName: string,
  rawNode: RawNode,
  warnings: string[]
): GraphElement | undefined {
  const isState =
    tagName === 'stateConnection' || tagName === 'state-connection';
  const type: GraphElementType = isState
    ? 'State Connection'
    : 'Resource Connection';

  const id = getNumAttr(rawNode, 'id');
  if (id == null) {
    warnings.push(`<${tagName}> is missing required "id" attribute; skipped.`);
    return undefined;
  }

  const from = getNumAttr(rawNode, 'from');
  const to = getNumAttr(rawNode, 'to');
  if (from == null || to == null) {
    warnings.push(
      `Connection id=${id} is missing from/to endpoint(s); kept but disconnected.`
    );
  }

  const startX = getNumAttr(rawNode, 'startX') ?? 0;
  const startY = getNumAttr(rawNode, 'startY') ?? 0;
  const endX = getNumAttr(rawNode, 'endX') ?? 0;
  const endY = getNumAttr(rawNode, 'endY') ?? 0;

  const rawPoints = asArray<RawNode>(rawNode['point'] as RawNode | RawNode[]);
  const points = rawPoints
    .map(p => {
      const px = getNumAttr(p, 'x');
      const py = getNumAttr(p, 'y');
      return px != null && py != null ? { x: px, y: py } : null;
    })
    .filter((p): p is { x: number; y: number } => p != null);

  const labelPosition = getNumAttr(rawNode, 'labelPosition') ?? 0.5;

  return {
    id,
    type,
    x: startX,
    y: startY,
    startX,
    startY,
    endX,
    endY,
    points: points.length ? points : undefined,
    text: getAttr(rawNode, 'text'),
    color: getAttr(rawNode, 'color'),
    thickness: getNumAttr(rawNode, 'thickness'),
    connectedToStart: from,
    connectedToEnd: to,
    labelPosition,
    inhibited: false,
  };
}

/**
 * Parse a serialized graph XML string into a flat array of `GraphElement`s
 * suitable for `runSimulation` / `simulateTick`.
 */
export function loadGraphFromXml(xmlText: string): LoadGraphResult {
  const warnings: string[] = [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    parseAttributeValue: false,
    trimValues: true,
    cdataPropName: '#cdata',
  });

  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xmlText) as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid XML: ${msg}`);
  }

  // Expected root: <diagram>...</diagram>. Fall back to first object key.
  const rootCandidates = ['diagram', 'Graph', 'graph'];
  let root: Record<string, unknown> | undefined;
  for (const k of rootCandidates) {
    const v = doc[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      root = v as Record<string, unknown>;
      break;
    }
  }
  if (!root) {
    // try any top-level container that holds known tags
    for (const v of Object.values(doc)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const candidate = v as Record<string, unknown>;
        if (Object.keys(candidate).some(k => ALL_KNOWN_TAGS.has(k))) {
          root = candidate;
          break;
        }
      }
    }
  }
  if (!root) {
    throw new Error(
      'No <diagram> root or recognizable graph elements found in XML.'
    );
  }

  const elements: GraphElement[] = [];

  for (const [tagName, value] of Object.entries(root)) {
    if (!ALL_KNOWN_TAGS.has(tagName)) continue;
    const items = asArray<RawNode>(value as RawNode | RawNode[]);
    for (const item of items) {
      const isConn = CONNECTION_TAGS.has(tagName);
      const built = isConn
        ? buildConnection(tagName, item, warnings)
        : buildNode(tagName, item, warnings);
      if (built) elements.push(built);
    }
  }

  if (elements.length === 0) {
    warnings.push('No simulation elements were parsed from the XML.');
  }

  elements.sort((a, b) => a.id - b.id);
  return { elements, warnings };
}

/**
 * Read a file from disk and parse it. Convenience wrapper for CLI / Node use.
 */
export function loadGraphFromFile(path: string): LoadGraphResult {
  const xml = readFileSync(path, 'utf8');
  return loadGraphFromXml(xml);
}
