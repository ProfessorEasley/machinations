import type { XmlSerializeElement } from './graphXmlSerialize';
import {
  getElementSize,
  getResourcePolylineWorldPoints,
  getStateConnectionWorldPath,
  getLabelPointForConnection,
} from './canvasElementGeometry';
import { renderChartElementSvg } from './chartSvgExport';

function escapeSvgText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isConn(el: XmlSerializeElement) {
  return el.type === 'Resource Connection' || el.type === 'State Connection';
}

type BBox = { minX: number; minY: number; maxX: number; maxY: number };

const emptyBBox: BBox = {
  minX: Infinity,
  minY: Infinity,
  maxX: -Infinity,
  maxY: -Infinity,
};

function mergeBBox(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function expandPoint(b: BBox, x: number, y: number): BBox {
  return mergeBBox(b, {
    minX: x,
    minY: y,
    maxX: x,
    maxY: y,
  });
}

function nodeBBox(el: XmlSerializeElement): BBox {
  let b = { ...emptyBBox };

  switch (el.type) {
    case 'Text Label': {
      const t = (el.text ?? 'Text').length;
      const w = Math.max(60, t * 7);
      b = expandPoint(b, el.x, el.y);
      b = mergeBBox(b, {
        minX: el.x,
        minY: el.y,
        maxX: el.x + w,
        maxY: el.y + 18,
      });
      break;
    }
    case 'Group': {
      const w = el.width ?? 200;
      const h = el.height ?? 150;
      b = mergeBBox(b, {
        minX: el.x,
        minY: el.y,
        maxX: el.x + w,
        maxY: el.y + h,
      });
      break;
    }
    case 'Chart': {
      const w = el.chartWidth ?? 200;
      const h = el.chartHeight ?? 150;
      const cap = (el.text ?? '').trim();
      b = mergeBBox(b, {
        minX: el.x,
        minY: el.y - 20,
        maxX: el.x + w,
        maxY: el.y + h + (cap ? 22 : 0),
      });
      break;
    }
    default: {
      if (!isConn(el)) {
        const size = getElementSize(el.thickness);
        const r = size / 2;
        b = mergeBBox(b, {
          minX: el.x - r,
          minY: el.y - r,
          maxX: el.x + r,
          maxY: el.y + r,
        });
      }
    }
  }

  const label = (el.text ?? '').trim();
  if (label && !isConn(el) && el.type !== 'Text Label') {
    b = expandPoint(b, el.x, el.y + getElementSize(el.thickness) / 2 + 14);
  }

  return b;
}

function connectionBBoxFromPath(path: { x: number; y: number }[]): BBox {
  let b = { ...emptyBBox };
  for (const p of path) {
    b = expandPoint(b, p.x, p.y);
  }
  return b;
}

function computeBounds(
  elements: XmlSerializeElement[],
  connectionPaths: Map<number, { x: number; y: number }[]>
): BBox {
  let box = { ...emptyBBox };
  for (const el of elements) {
    if (isConn(el)) {
      const path = connectionPaths.get(el.id);
      if (path && path.length) {
        box = mergeBBox(box, connectionBBoxFromPath(path));
      }
    } else {
      box = mergeBBox(box, nodeBBox(el));
    }
  }
  if (!Number.isFinite(box.minX)) {
    return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
  }
  return box;
}

function sortForDrawing(
  elements: XmlSerializeElement[]
): XmlSerializeElement[] {
  return [...elements].sort((a, b) => {
    const aC = isConn(a);
    const bC = isConn(b);
    if (aC && !bC) return -1;
    if (!aC && bC) return 1;
    return a.id - b.id;
  });
}

/** Stroke color for nodes (matches canvas: CSS uses stroke from element color). */
function strokeColor(el: XmlSerializeElement) {
  return el.color && el.color.trim() ? el.color : '#000000';
}

type LegacyPos = { position?: unknown };

function connectionLabelPosition(el: XmlSerializeElement): number {
  const raw = (el as LegacyPos).position;
  const legacyPosNum =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return (
    el.labelPosition ??
    (Number.isFinite(legacyPosNum) ? legacyPosNum : undefined) ??
    0.5
  );
}

function renderResourceConnectionSvg(
  el: XmlSerializeElement,
  elements: XmlSerializeElement[],
  markerId: string
): string {
  const path = getResourcePolylineWorldPoints(el, elements);
  if (path.length < 2) return '';

  const isGrey = !!el.hasUnsatisfiedCondition;
  const base = strokeColor(el);
  const stroke = isGrey ? '#B0B0B0' : base;
  const sw = el.thickness ?? 2;
  const pts = path.map(p => `${p.x},${p.y}`).join(' ');
  const labelPos = connectionLabelPosition(el);
  const labelPoint = getLabelPointForConnection(path, labelPos);
  const label = (el.text ?? '').trim();
  const labelFill = isGrey ? '#8a8a8a' : base;

  let s = `<defs>
    <marker id="${markerId}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <polygon points="0 0, 6 5, 0 10" fill="${escapeSvgText(stroke)}" stroke="${escapeSvgText(stroke)}" stroke-width="1"/>
    </marker>
  </defs>`;
  s += `<polyline fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}" marker-end="url(#${markerId})" points="${pts}"/>`;
  if (label && label !== '0') {
    s += `<text x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" font-size="11" fill="${escapeSvgText(labelFill)}">${escapeSvgText(label)}</text>`;
  }
  return s;
}

function renderStateConnectionSvg(
  el: XmlSerializeElement,
  elements: XmlSerializeElement[],
  markerId: string
): string {
  const path = getStateConnectionWorldPath(el, elements);
  if (path.length < 2) return '';

  const endTarget = elements.find(n => n.id === el.connectedToEnd);
  const targetGrey =
    (endTarget && endTarget.hasUnsatisfiedCondition) ||
    (typeof endTarget === 'undefined' && el.conditionSatisfied === false);
  const stroke = targetGrey ? '#B0B0B0' : el.color || '#666';
  const sw = 2;
  const pts = path.map(p => `${p.x},${p.y}`).join(' ');
  const labelPos = connectionLabelPosition(el);
  const labelPoint = getLabelPointForConnection(path, labelPos);
  const label = (el.text ?? '').trim();
  const labelFill = targetGrey ? '#888888' : '#000000';
  const markerFill = el.color || '#000000';

  let s = `<defs>
    <marker id="${markerId}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <polygon points="0 0, 6 5, 0 10" fill="${escapeSvgText(markerFill)}" stroke="${escapeSvgText(markerFill)}" stroke-width="1"/>
    </marker>
  </defs>`;
  s += `<polyline fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}" stroke-dasharray="5,5" marker-end="url(#${markerId})" points="${pts}"/>`;
  if (label && label !== '0') {
    s += `<text x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" font-size="11" fill="${escapeSvgText(labelFill)}">${escapeSvgText(label)}</text>`;
  }
  return s;
}

/**
 * Renders node SVG matching on-canvas appearance: CSS makes most shapes stroke-only (fill none).
 */
function renderNodeSvg(el: XmlSerializeElement): string {
  const nodeType = el.type;
  const size = getElementSize(el.thickness);
  const center = size / 2;
  const scale = size / 40;
  const stroke = strokeColor(el);
  const sw = el.thickness ?? 2;
  const x0 = el.x - center;
  const y0 = el.y - center;

  let shape = '';
  switch (el.type) {
    case 'Text Label':
      return `<text x="${el.x}" y="${el.y}" fill="${escapeSvgText(stroke)}" font-size="16" font-weight="400" font-family="system-ui, sans-serif">${escapeSvgText(el.text || 'Text Label')}</text>`;
    case 'Group': {
      const w = el.width ?? 200;
      const h = el.height ?? 150;
      return `<rect x="${el.x}" y="${el.y}" width="${w}" height="${h}" fill="none" stroke="#666" stroke-width="2" stroke-dasharray="6 4"/>`;
    }
    case 'Chart':
      return renderChartElementSvg(el, 25);
    case 'Pool': {
      const r = (size / 40) * 18;
      const val = el.currentPoints ?? el.number ?? 0;
      shape = `<circle cx="${el.x}" cy="${el.y}" r="${r}" fill="#ffffff" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      shape += `<text x="${el.x}" y="${el.y + size / 10}" text-anchor="middle" font-size="11" fill="#000000">${escapeSvgText(String(val))}</text>`;
      break;
    }
    case 'Source':
      shape = `<polygon points="${el.x},${y0 + 5 * scale} ${x0 + 35 * scale},${y0 + 35 * scale} ${x0 + 5 * scale},${y0 + 35 * scale}" fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      break;
    case 'Drain':
      shape = `<polygon points="${x0 + 5 * scale},${y0 + 5 * scale} ${x0 + 35 * scale},${y0 + 5 * scale} ${el.x},${y0 + 35 * scale}" fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      break;
    case 'Gate':
      shape = `<polygon points="${el.x},${y0 + 5 * scale} ${x0 + 35 * scale},${el.y} ${el.x},${y0 + 35 * scale} ${x0 + 5 * scale},${el.y}" fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      break;
    case 'Convertor':
      shape = `<polygon points="${x0 + 5 * scale},${y0 + 5 * scale} ${x0 + 35 * scale},${el.y} ${x0 + 5 * scale},${y0 + 35 * scale}" fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      shape += `<line x1="${x0 + 5 * scale}" y1="${y0 + 5 * scale}" x2="${x0 + 5 * scale}" y2="${y0 + 35 * scale}" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      break;
    case 'Trader':
      shape = `<polygon points="${x0 + 8 * scale},${y0 + 5 * scale} ${x0 + 35 * scale},${y0 + 5 * scale} ${x0 + 32 * scale},${y0 + 35 * scale} ${x0 + 5 * scale},${y0 + 35 * scale}" fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      break;
    case 'Delay':
      shape = `<circle cx="${el.x}" cy="${el.y}" r="${15 * scale}" fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      shape += `<text x="${el.x}" y="${el.y + 2 * scale}" text-anchor="middle" font-size="${11 * scale}" font-weight="bold" fill="#000000">8</text>`;
      break;
    case 'Register': {
      const val = el.currentValue ?? 0;
      shape = `<rect x="${x0 + 5 * scale}" y="${y0 + 5 * scale}" width="${30 * scale}" height="${30 * scale}" fill="#ffffff" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      shape += `<text x="${el.x}" y="${el.y + size / 8}" text-anchor="middle" font-size="11" font-weight="bold" fill="#000000">${escapeSvgText(String(val))}</text>`;
      break;
    }
    case 'End Condition': {
      const outerFill = el.inhibited ? '#808080' : stroke;
      const innerFill = el.inhibited ? '#a0a0a0' : stroke;
      shape = `<rect x="${x0 + 5 * scale}" y="${y0 + 5 * scale}" width="${30 * scale}" height="${30 * scale}" fill="${escapeSvgText(outerFill)}" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      shape += `<rect x="${x0 + 12 * scale}" y="${y0 + 12 * scale}" width="${16 * scale}" height="${16 * scale}" fill="${escapeSvgText(innerFill)}"/>`;
      if (!el.inhibited) {
        shape += `<circle cx="${el.x}" cy="${el.y}" r="${4 * scale}" fill="#87CEEB"/>`;
      }
      break;
    }
    case 'Artifical Intelligence':
      shape = `<rect x="${x0 + 5 * scale}" y="${y0 + 5 * scale}" width="${30 * scale}" height="${30 * scale}" fill="#ffffff" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
      shape += `<text x="${el.x}" y="${el.y + 2 * scale}" text-anchor="middle" font-size="${12 * scale}" font-weight="bold" fill="${escapeSvgText(stroke)}">AP</text>`;
      shape += `<text x="${x0 + 33 * scale}" y="${y0 + 9 * scale}" text-anchor="middle" font-size="${10 * scale}" font-weight="bold" fill="${escapeSvgText(stroke)}">*</text>`;
      break;
    default:
      shape = `<circle cx="${el.x}" cy="${el.y}" r="${8}" fill="none" stroke="${escapeSvgText(stroke)}" stroke-width="${sw}"/>`;
  }

  const label = (el.text ?? '').trim();
  let extra = '';
  if (label && nodeType !== 'Text Label' && nodeType !== 'Chart') {
    const ly = el.y + center + 12;
    extra = `<text x="${el.x}" y="${ly}" text-anchor="middle" font-size="11" font-weight="600" fill="#111111">${escapeSvgText(label)}</text>`;
  }

  return shape + extra;
}

export function exportGraphToSvgString(
  elements: XmlSerializeElement[]
): string {
  const margin = 48;
  const connectionPaths = new Map<number, { x: number; y: number }[]>();

  for (const el of elements) {
    if (el.type === 'Resource Connection') {
      connectionPaths.set(el.id, getResourcePolylineWorldPoints(el, elements));
    } else if (el.type === 'State Connection') {
      connectionPaths.set(el.id, getStateConnectionWorldPath(el, elements));
    }
  }

  const bounds = computeBounds(elements, connectionPaths);
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  const w = Math.max(320, bw + margin * 2);
  const h = Math.max(240, bh + margin * 2);
  const ox = margin - bounds.minX;
  const oy = margin - bounds.minY;

  const parts: string[] = [];
  let markerSeq = 0;
  for (const el of sortForDrawing(elements)) {
    if (isConn(el)) {
      const mid = `m-export-${el.id}-${markerSeq++}`;
      const frag =
        el.type === 'Resource Connection'
          ? renderResourceConnectionSvg(el, elements, mid)
          : renderStateConnectionSvg(el, elements, mid);
      if (frag) {
        parts.push(`<g transform="translate(${ox},${oy})">${frag}</g>`);
      }
    } else {
      parts.push(
        `<g transform="translate(${ox},${oy})">${renderNodeSvg(el)}</g>`
      );
    }
  }

  const inner = parts.filter(Boolean).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${inner}
</svg>`;
}
