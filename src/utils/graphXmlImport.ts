import { XMLParser } from 'fast-xml-parser';
import type { GraphElement, GraphElementType } from '../engine/types';

/**
 * Unified XML importer for graph diagrams.
 *
 * Accepts two schemas:
 *
 *   1. Native (`<diagram>`) — what {@link serializeGraphElementsToXml} produces.
 *      Each element is its own tag (`<source>`, `<pool>`, `<resourceConnection>` …),
 *      every element carries an explicit `id` attribute, and connections reference
 *      endpoints by id via `from` / `to`.
 *
 *   2. Legacy Machinations (`<graph version="v4.04">`) — the format used by the
 *      official desktop tool. Nodes are `<node symbol="…">`, connections are
 *      `<connection type="…">`, and endpoints reference siblings by their
 *      document-order index (`start="38"` ≙ the element at document position 38).
 *
 * Parsing is done with `fast-xml-parser` (no DOM), so this works in Node, the
 * browser, and Vitest. Replaces the legacy `parseGraphFromXml` that previously
 * lived inline in `Canvas.tsx`.
 */

export interface LoadGraphResult {
  elements: GraphElement[];
  warnings: string[];
}

const ATTR_PREFIX = '@_';

// fast-xml-parser preserveOrder structure:
//   { [tagName]: OrderedNode[],   ':@'?: Record<string,string> }
// Text nodes appear as { '#text': string }.
// CDATA appears as { '#cdata': [{ '#text': string }] }.
type OrderedNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Generic structural helpers
// ---------------------------------------------------------------------------

function nodeTag(node: OrderedNode): string | null {
  for (const k of Object.keys(node)) {
    if (k === ':@') continue;
    return k;
  }
  return null;
}

function nodeChildren(node: OrderedNode): OrderedNode[] {
  const tag = nodeTag(node);
  if (!tag) return [];
  const v = node[tag];
  return Array.isArray(v) ? (v as OrderedNode[]) : [];
}

function nodeAttrs(node: OrderedNode): Record<string, string> {
  return (node[':@'] as Record<string, string> | undefined) ?? {};
}

function getAttr(node: OrderedNode, name: string): string | undefined {
  const v = nodeAttrs(node)[ATTR_PREFIX + name];
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function attrAny(node: OrderedNode, names: string[]): string | undefined {
  for (const n of names) {
    const v = getAttr(node, n);
    if (v != null) return v;
  }
  return undefined;
}

function numAttrAny(node: OrderedNode, names: string[]): number | undefined {
  const raw = attrAny(node, names);
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function readNodeText(node: OrderedNode): string | undefined {
  const parts: string[] = [];
  const walk = (n: OrderedNode): void => {
    for (const [k, v] of Object.entries(n)) {
      if (k === ':@') continue;
      if (k === '#text' && typeof v === 'string') parts.push(v);
      else if (k === '#cdata' && Array.isArray(v)) {
        for (const cd of v) {
          const t = (cd as { '#text'?: string })['#text'];
          if (typeof t === 'string') parts.push(t);
        }
      } else if (Array.isArray(v)) {
        for (const child of v as OrderedNode[]) walk(child);
      }
    }
  };
  walk(node);
  const joined = parts.join('').trim();
  return joined ? joined : undefined;
}

function findChild(node: OrderedNode, tag: string): OrderedNode | undefined {
  for (const c of nodeChildren(node)) {
    if (nodeTag(c) === tag) return c;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Type / enum normalization (mirrors Canvas.tsx + io.ts behavior)
// ---------------------------------------------------------------------------

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

function normalizeGraphElementType(raw?: string): GraphElementType | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');

  if (s === 'text label' || s === 'textlabel' || s === 'label' || s === 'text')
    return 'Text Label';
  if (s === 'group' || s === 'groupbox' || s === 'group box') return 'Group';
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
    s === 'artificialintelligence' ||
    s === 'artificalintelligence'
  )
    return 'Artifical Intelligence';

  return undefined;
}

// Tag-name aliases used by the native serializer
function tagNameToType(tag: string): GraphElementType | undefined {
  return normalizeGraphElementType(tag);
}

// Legacy <node captionPos="…"> uses an offset that maps differently than
// the native [0,1] labelPosition. Mirrors Canvas behavior exactly.
function translateCaptionPos(raw: number): number {
  const pos = ((raw % 1) + 1) % 1;
  const shifted = pos + 0.25;
  return shifted >= 1 ? shifted - 1 : shifted;
}

// ---------------------------------------------------------------------------
// Element-builder helpers
// ---------------------------------------------------------------------------

const CONN_TAG_HINTS = new Set([
  'connection',
  'edge',
  'link',
  'resourceconnection',
  'stateconnection',
]);

function isConnectionElement(
  type: GraphElementType,
  tagLower: string
): boolean {
  return (
    type === 'Resource Connection' ||
    type === 'State Connection' ||
    CONN_TAG_HINTS.has(tagLower) ||
    tagLower.includes('connection')
  );
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

function readWalletPayload(
  node: OrderedNode
): Record<string, unknown> | undefined {
  const walletEl = findChild(node, 'walletData');
  if (!walletEl) return undefined;
  const raw = readNodeText(walletEl);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function readScriptText(node: OrderedNode): string | undefined {
  const scriptEl = findChild(node, 'script');
  if (!scriptEl) return undefined;
  return readNodeText(scriptEl);
}

function parsePointsAttr(raw?: string): { x: number; y: number }[] {
  if (!raw) return [];
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
}

function readChildPoints(node: OrderedNode): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (const c of nodeChildren(node)) {
    const tag = nodeTag(c);
    if (tag !== 'point' && tag !== 'pt' && tag !== 'waypoint') continue;
    const px = numAttrAny(c, ['x', 'cx', 'px']);
    const py = numAttrAny(c, ['y', 'cy', 'py']);
    if (px != null && py != null) pts.push({ x: px, y: py });
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Node + connection construction
// ---------------------------------------------------------------------------

interface ConnStub {
  id: number;
  type: GraphElementType;
  fromRaw?: string;
  toRaw?: string;
  color?: string;
  thickness?: number;
  text?: string;
  labelPosition: number;
  points: { x: number; y: number }[];
  explicitStartX?: number;
  explicitStartY?: number;
  explicitEndX?: number;
  explicitEndY?: number;
  rawIdAttr?: string;
}

function buildNode(
  type: GraphElementType,
  assignedId: number,
  rawNode: OrderedNode
): GraphElement {
  const x =
    numAttrAny(rawNode, ['x', 'posX', 'cx', 'left']) ??
    numAttrAny(rawNode, ['px', 'screenX']) ??
    100;
  const y =
    numAttrAny(rawNode, ['y', 'posY', 'cy', 'top']) ??
    numAttrAny(rawNode, ['py', 'screenY']) ??
    100;

  const color = attrAny(rawNode, [
    'color',
    'resourceColor',
    'stroke',
    'borderColor',
  ]);
  const thickness = numAttrAny(rawNode, [
    'thickness',
    'strokeWidth',
    'borderWidth',
  ]);
  const text = attrAny(rawNode, ['text', 'caption', 'label', 'title', 'name']);

  const rawLabelPos = numAttrAny(rawNode, ['labelPosition', 'labelPos']);
  const rawCaptionPos = numAttrAny(rawNode, [
    'captionPos',
    'captionPosition',
    'caption_pos',
  ]);
  const labelPosition =
    rawLabelPos != null
      ? Math.max(0, Math.min(1, rawLabelPos))
      : rawCaptionPos != null
        ? translateCaptionPos(rawCaptionPos)
        : 0;

  const activation = normalizeActivation(
    attrAny(rawNode, [
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
    attrAny(rawNode, ['pullMode', 'pull', 'pushMode'])
  );
  const gateType = normalizeGateType(
    attrAny(rawNode, ['gateType', 'typeMode', 'gate'])
  );

  const number = numAttrAny(rawNode, [
    'number',
    'startingResources',
    'startingValue',
    'start',
    'value',
  ]);
  const rawMax = numAttrAny(rawNode, ['max', 'capacity', 'cap', 'limit']);
  // Legacy uses capacity="-1" to mean "unlimited".
  const max = rawMax != null && rawMax >= 0 ? rawMax : undefined;
  const displayLimit = numAttrAny(rawNode, [
    'displayLimit',
    'displayCapacity',
    'display',
    'showMax',
  ]);
  const actions = numAttrAny(rawNode, ['actions', 'actionCount']);

  const el: GraphElement = {
    id: assignedId,
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
    labelPosition,
  };

  if (type === 'Register') {
    const formula = attrAny(rawNode, ['formula', 'expr', 'expression']);
    const minValue = numAttrAny(rawNode, ['minValue', 'min']);
    const maxValue = numAttrAny(rawNode, ['maxValue', 'max']);
    const interactiveRaw = attrAny(rawNode, ['interactive']);
    const interactive =
      interactiveRaw != null
        ? interactiveRaw.trim().toLowerCase() === 'true'
        : false;
    const startingValue =
      numAttrAny(rawNode, ['startingValue', 'startValue']) ?? 0;
    const step = numAttrAny(rawNode, ['step']) ?? 1;

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
    el.chartWidth = numAttrAny(rawNode, ['width', 'chartWidth', 'chartW']);
    el.chartHeight = numAttrAny(rawNode, ['height', 'chartHeight', 'chartH']);
    el.chartScaleX = numAttrAny(rawNode, ['scaleX', 'chartScaleX']);
    el.chartScaleY = numAttrAny(rawNode, ['scaleY', 'chartScaleY']);
  }

  if (type === 'Group') {
    el.width = numAttrAny(rawNode, ['width']) ?? 200;
    el.height = numAttrAny(rawNode, ['height']) ?? 150;
  }

  return el;
}

function buildConnectionStub(
  type: GraphElementType,
  assignedId: number,
  rawNode: OrderedNode
): ConnStub {
  const fromRaw = attrAny(rawNode, [
    'from',
    'start',
    'source',
    'startId',
    'fromId',
    'a',
  ]);
  const toRaw = attrAny(rawNode, ['to', 'end', 'target', 'endId', 'toId', 'b']);

  const color = attrAny(rawNode, ['color', 'stroke']);
  const thickness = numAttrAny(rawNode, ['thickness', 'strokeWidth']);
  const text = attrAny(rawNode, ['text', 'label']) ?? readNodeText(rawNode);

  const rawPos = numAttrAny(rawNode, ['position', 'labelPosition', 'labelPos']);
  const labelPosition =
    rawPos == null ? 0.5 : Math.max(-1, Math.min(1, rawPos));

  const ptsAttr = parsePointsAttr(
    attrAny(rawNode, ['points', 'path', 'polyline'])
  );
  const ptsChildren = readChildPoints(rawNode);
  const points = ptsChildren.length ? ptsChildren : ptsAttr;

  return {
    id: assignedId,
    type,
    fromRaw,
    toRaw,
    color,
    thickness,
    text,
    labelPosition,
    points,
    explicitStartX: numAttrAny(rawNode, ['startX', 'x1', 'sx']),
    explicitStartY: numAttrAny(rawNode, ['startY', 'y1', 'sy']),
    explicitEndX: numAttrAny(rawNode, ['endX', 'x2', 'ex']),
    explicitEndY: numAttrAny(rawNode, ['endY', 'y2', 'ey']),
    rawIdAttr: attrAny(rawNode, ['id', 'uid', 'key']),
  };
}

// ---------------------------------------------------------------------------
// Root finder + entry point
// ---------------------------------------------------------------------------

function findGraphRoot(tree: OrderedNode[]): OrderedNode | undefined {
  for (const candidate of ['diagram', 'graph']) {
    for (const node of tree) {
      if (nodeTag(node) === candidate) return node;
    }
  }
  for (const node of tree) {
    const tag = nodeTag(node);
    if (!tag || tag.startsWith('?') || tag.startsWith('#')) continue;
    for (const child of nodeChildren(node)) {
      const t = nodeTag(child);
      if (t == null) continue;
      if (normalizeGraphElementType(t) || t === 'connection' || t === 'node') {
        return node;
      }
    }
  }
  return undefined;
}

export function parseGraphFromXmlText(xmlText: string): LoadGraphResult {
  const warnings: string[] = [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ATTR_PREFIX,
    preserveOrder: true,
    trimValues: true,
    cdataPropName: '#cdata',
  });

  let tree: OrderedNode[];
  try {
    tree = parser.parse(xmlText) as OrderedNode[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid XML: ${msg}`);
  }

  const root = findGraphRoot(tree);
  if (!root) {
    throw new Error(
      'No <diagram> / <graph> root or recognizable graph elements found in XML.'
    );
  }

  // Pass 1: walk children in document order, classify, build nodes immediately,
  // stash connections as stubs. Track document-position → assigned id mapping.
  const nodes: GraphElement[] = [];
  const stubs: ConnStub[] = [];

  // Map from any reference token (explicit id, document position) → final id.
  const refToId = new Map<string, number>();
  // Document-order ordinal across all recognized elements (nodes + connections).
  let docIndex = 0;
  // Track explicitly used ids so we can avoid colliding when auto-assigning.
  const usedIds = new Set<number>();

  // First subpass: collect explicit ids so we don't reuse them as auto-assigned.
  for (const child of nodeChildren(root)) {
    const idAttr = attrAny(child, ['id', 'uid', 'key']);
    if (idAttr != null) {
      const n = Number(idAttr);
      if (Number.isFinite(n) && Number.isInteger(n)) usedIds.add(n);
    }
  }

  // For auto-assigned ids in legacy (no explicit ids), use the document index
  // so cross-references like start="38" resolve correctly.
  for (const child of nodeChildren(root)) {
    const tag = nodeTag(child);
    if (!tag) continue;
    const tagLower = tag.toLowerCase();

    // Type may come from tag name (native: <source>, <resourceConnection>)
    // or from a `symbol` / `type` attribute (legacy: <node symbol="Source">).
    const typeFromAttr = normalizeGraphElementType(
      attrAny(child, ['symbol', 'type', 'kind', 'class'])
    );
    const typeFromTag = tagNameToType(tag);
    const type = typeFromAttr ?? typeFromTag;

    if (!type) continue;

    // Determine this element's final id.
    const explicitId = attrAny(child, ['id', 'uid', 'key']);
    let assignedId: number;
    if (explicitId != null && /^-?\d+$/.test(explicitId)) {
      assignedId = Number(explicitId);
    } else {
      // No explicit numeric id: use document index, skipping any that collide
      // with explicit ids already reserved.
      assignedId = docIndex;
      while (usedIds.has(assignedId)) assignedId++;
      usedIds.add(assignedId);
    }

    // Register reference keys. Explicit ids take precedence over a colliding
    // document index from another element, and the first writer wins so that
    // an earlier element's id is not stomped by a later element's docIndex.
    const trySetRef = (key: string, id: number) => {
      if (!refToId.has(key)) refToId.set(key, id);
    };
    if (explicitId != null) trySetRef(explicitId.trim(), assignedId);
    trySetRef(String(docIndex), assignedId);

    docIndex++;

    if (isConnectionElement(type, tagLower)) {
      stubs.push(buildConnectionStub(type, assignedId, child));
    } else {
      nodes.push(buildNode(type, assignedId, child));
    }
  }

  // Pass 2: resolve connection endpoints now that all node ids are known.
  const nodeById = new Map<number, GraphElement>(nodes.map(n => [n.id, n]));
  const connections: GraphElement[] = [];

  const resolveRef = (raw?: string): number | undefined => {
    if (!raw) return undefined;
    const t = raw.trim();
    if (!t) return undefined;
    const mapped = refToId.get(t);
    if (mapped != null) return mapped;
    if (/^-?\d+$/.test(t)) {
      const n = Number(t);
      if (Number.isFinite(n)) {
        return refToId.get(String(n)) ?? refToId.get(String(n - 1));
      }
    }
    return undefined;
  };

  for (const stub of stubs) {
    const connectedToStart = resolveRef(stub.fromRaw);
    const connectedToEnd = resolveRef(stub.toRaw);

    const startNode =
      connectedToStart != null ? nodeById.get(connectedToStart) : undefined;
    const endNode =
      connectedToEnd != null ? nodeById.get(connectedToEnd) : undefined;

    // <point> children are waypoints. If the legacy schema also includes the
    // anchor positions as the first/last point, strip those when they sit on
    // top of the resolved node.
    const EPS = 5;
    const pts = stub.points.slice();
    if (startNode && pts.length) {
      const d = Math.hypot(pts[0].x - startNode.x, pts[0].y - startNode.y);
      if (d <= EPS) pts.shift();
    }
    if (endNode && pts.length) {
      const last = pts[pts.length - 1];
      const d = Math.hypot(last.x - endNode.x, last.y - endNode.y);
      if (d <= EPS) pts.pop();
    }

    const fallbackFirst = stub.points[0];
    const fallbackLast = stub.points[stub.points.length - 1];

    const startX =
      stub.explicitStartX ?? startNode?.x ?? fallbackFirst?.x ?? 50;
    const startY =
      stub.explicitStartY ?? startNode?.y ?? fallbackFirst?.y ?? 50;
    const endX = stub.explicitEndX ?? endNode?.x ?? fallbackLast?.x ?? 200;
    const endY = stub.explicitEndY ?? endNode?.y ?? fallbackLast?.y ?? 200;

    if (connectedToStart == null || connectedToEnd == null) {
      warnings.push(
        `Connection ${stub.rawIdAttr ?? stub.id} missing endpoint mapping ` +
          `(from="${stub.fromRaw ?? ''}", to="${stub.toRaw ?? ''}").`
      );
    }

    connections.push({
      id: stub.id,
      type: stub.type,
      x: startX,
      y: startY,
      startX,
      startY,
      endX,
      endY,
      points: pts.length ? pts : undefined,
      text: stub.text,
      color: stub.color,
      thickness: stub.thickness,
      connectedToStart,
      connectedToEnd,
      labelPosition: stub.labelPosition,
      inhibited: false,
    });
  }

  const elements = [...nodes, ...connections].sort((a, b) => a.id - b.id);

  if (elements.length === 0) {
    warnings.push('No simulation elements were parsed from the XML.');
  }

  return { elements, warnings };
}
