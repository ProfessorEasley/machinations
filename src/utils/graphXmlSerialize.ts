import type { GraphElement, GraphElementType } from '../types/graph';
import type { ChartState } from './ChartUtils';

/** Canvas/runtime fields we persist where the XML importer understands them */
export type XmlSerializeElement = GraphElement & {
  script?: string;
  chartWidth?: number;
  chartHeight?: number;
  chartScaleX?: number;
  chartScaleY?: number;
  gateType?: string;
  points?: { x: number; y: number }[];
  connectedToStart?: number;
  connectedToEnd?: number;
  labelPosition?: number;
  resourcesByColor?: Record<string, number>;
  actions?: number;
  queue?: boolean;
  currentPoints?: number;
  inhibited?: boolean;
  inputResources?: Record<string, number>;
  outputResources?: Record<string, number>;
  conversionRate?: Record<string, number>;
  traderInputs?: Record<string, number>;
  traderOutputs?: Record<string, number>;
  isIncompleteTrader?: boolean;
  hasUnsatisfiedCondition?: boolean;
  conditionSatisfied?: boolean;
  chartState?: ChartState;
};

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeCdata(value: string): string {
  return value.replace(/]]>/g, ']]]]><![CDATA[>');
}

function poolStartingNumber(el: XmlSerializeElement): number {
  if (el.number != null && Number.isFinite(el.number)) {
    return Math.floor(el.number);
  }
  if (el.currentPoints != null && Number.isFinite(el.currentPoints)) {
    return Math.floor(el.currentPoints);
  }
  if (el.resourcesByColor && typeof el.resourcesByColor === 'object') {
    const sum = Object.values(el.resourcesByColor).reduce(
      (a, b) => a + (typeof b === 'number' ? b : 0),
      0
    );
    return Math.floor(sum);
  }
  return 0;
}

function tagForNodeType(type: GraphElementType): string {
  switch (type) {
    case 'Text Label':
      return 'textLabel';
    case 'Group':
      return 'group';
    case 'Chart':
      return 'chart';
    case 'Pool':
      return 'pool';
    case 'Gate':
      return 'gate';
    case 'Source':
      return 'source';
    case 'Drain':
      return 'drain';
    case 'Convertor':
      return 'convertor';
    case 'Trader':
      return 'trader';
    case 'Delay':
      return 'delay';
    case 'Register':
      return 'register';
    case 'End Condition':
      return 'endCondition';
    case 'Artifical Intelligence':
      // Match NODE_TAGS in Canvas `parseGraphFromXml` (intentional spelling)
      return 'artificalIntelligence';
    default:
      return 'element';
  }
}

function optionalAttr(name: string, value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '';
  const v = typeof value === 'number' ? String(value) : value;
  return ` ${name}="${escapeXmlAttr(v)}"`;
}

function isConnection(el: XmlSerializeElement) {
  return el.type === 'Resource Connection' || el.type === 'State Connection';
}

function serializeConnection(el: XmlSerializeElement): string {
  const isState = el.type === 'State Connection';
  const tag = isState ? 'stateConnection' : 'resourceConnection';
  const from =
    el.connectedToStart != null ? String(el.connectedToStart) : undefined;
  const to = el.connectedToEnd != null ? String(el.connectedToEnd) : undefined;

  const startX = el.startX ?? el.x;
  const startY = el.startY ?? el.y;
  const endX = el.endX ?? el.x;
  const endY = el.endY ?? el.y;

  let inner = '';
  const pts = el.points ?? [];
  for (const p of pts) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      inner += `\n    <point x="${p.x}" y="${p.y}"/>`;
    }
  }

  const labelPos =
    el.labelPosition != null && Number.isFinite(el.labelPosition)
      ? el.labelPosition
      : 0.5;

  const attrs = [
    optionalAttr('id', String(el.id)),
    optionalAttr('from', from),
    optionalAttr('to', to),
    optionalAttr('startX', startX),
    optionalAttr('startY', startY),
    optionalAttr('endX', endX),
    optionalAttr('endY', endY),
    optionalAttr('color', el.color),
    optionalAttr('thickness', el.thickness),
    optionalAttr('text', el.text),
    optionalAttr('labelPosition', labelPos),
  ].join('');

  if (inner) {
    return `  <${tag}${attrs}>${inner}\n  </${tag}>`;
  }
  return `  <${tag}${attrs}/>`;
}

function serializeNode(el: XmlSerializeElement): string {
  const tag = tagForNodeType(el.type);
  const attrs: string[] = [
    optionalAttr('id', String(el.id)),
    optionalAttr('x', el.x),
    optionalAttr('y', el.y),
    optionalAttr('color', el.color),
    optionalAttr('thickness', el.thickness),
  ];

  if (el.type === 'Artifical Intelligence') {
    const cap = (el.text ?? '').trim();
    if (cap) attrs.push(optionalAttr('caption', cap));
  } else if (el.type !== 'Chart' && el.text != null && String(el.text).trim()) {
    attrs.push(optionalAttr('text', String(el.text).trim()));
  }

  if (el.labelPosition != null && Number.isFinite(el.labelPosition)) {
    attrs.push(optionalAttr('labelPosition', el.labelPosition));
  }

  if (el.activation) attrs.push(optionalAttr('activation', el.activation));
  if (el.pullMode) attrs.push(optionalAttr('pullMode', el.pullMode));
  if (el.gateType) attrs.push(optionalAttr('gateType', el.gateType));
  if (el.actions != null) attrs.push(optionalAttr('actions', el.actions));

  if (el.type === 'Pool') {
    attrs.push(optionalAttr('number', poolStartingNumber(el)));
    if (el.max != null) attrs.push(optionalAttr('max', el.max));
    if (el.displayLimit != null)
      attrs.push(optionalAttr('displayLimit', el.displayLimit));
  } else {
    if (el.number != null) attrs.push(optionalAttr('number', el.number));
    if (el.max != null) attrs.push(optionalAttr('max', el.max));
    if (el.displayLimit != null)
      attrs.push(optionalAttr('displayLimit', el.displayLimit));
  }

  if (el.type === 'Register') {
    attrs.push(` formula="${escapeXmlAttr(String(el.formula ?? ''))}"`);
    attrs.push(optionalAttr('minValue', el.minValue ?? -9999));
    attrs.push(optionalAttr('maxValue', el.maxValue ?? 9999));
    if (el.interactive != null) {
      const iv =
        typeof el.interactive === 'boolean'
          ? el.interactive
            ? 'true'
            : 'false'
          : String(el.interactive);
      attrs.push(optionalAttr('interactive', iv));
    }
    attrs.push(optionalAttr('startingValue', el.startingValue ?? 0));
    attrs.push(optionalAttr('step', el.step ?? 1));
  }

  if (el.type === 'Group') {
    attrs.push(optionalAttr('width', el.width ?? 200));
    attrs.push(optionalAttr('height', el.height ?? 150));
  }

  if (el.type === 'Chart') {
    if (el.text != null && String(el.text).trim()) {
      attrs.push(optionalAttr('text', String(el.text).trim()));
    }
    attrs.push(optionalAttr('width', el.chartWidth));
    attrs.push(optionalAttr('height', el.chartHeight));
    attrs.push(optionalAttr('scaleX', el.chartScaleX));
    attrs.push(optionalAttr('scaleY', el.chartScaleY));
  }

  if (el.type === 'Artifical Intelligence' && el.script) {
    const script = String(el.script);
    const inner = `\n    <script><![CDATA[${escapeCdata(script)}]]></script>\n  `;
    return `  <${tag}${attrs.join('')}>${inner}</${tag}>`;
  }

  if (el.type === 'Convertor') {
    const payload = {
      inputResources: el.inputResources ?? {},
      outputResources: el.outputResources ?? {},
      conversionRate: el.conversionRate ?? {},
    };
    const inner = `\n    <walletData><![CDATA[${escapeCdata(JSON.stringify(payload))}]]></walletData>\n  `;
    return `  <${tag}${attrs.join('')}>${inner}</${tag}>`;
  }

  if (el.type === 'Trader') {
    const payload = {
      traderInputs: el.traderInputs ?? {},
      traderOutputs: el.traderOutputs ?? {},
      isIncompleteTrader: el.isIncompleteTrader ?? false,
    };
    const inner = `\n    <walletData><![CDATA[${escapeCdata(JSON.stringify(payload))}]]></walletData>\n  `;
    return `  <${tag}${attrs.join('')}>${inner}</${tag}>`;
  }

  return `  <${tag}${attrs.join('')}/>`;
}

/**
 * Serializes graph elements to XML that {@link parseGraphFromXml} in Canvas can import.
 * Elements must be ordered by ascending `id` to preserve endpoint references.
 */
export function serializeGraphElementsToXml(
  elements: XmlSerializeElement[]
): string {
  const sorted = [...elements].sort((a, b) => a.id - b.id);
  const nodes = sorted.filter(e => !isConnection(e));
  const conns = sorted.filter(e => isConnection(e));

  const body = [
    ...nodes.map(serializeNode),
    ...conns.map(serializeConnection),
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<diagram>
${body}
</diagram>
`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime: string
) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
