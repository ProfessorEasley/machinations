/**
 * Shared geometry for canvas rendering and SVG export (polylines, snaps, labels).
 */

export type GeometryElement = {
  id: number;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  thickness?: number;
  connectedToStart?: number;
  connectedToEnd?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  points?: { x: number; y: number }[];
  labelPosition?: number;
  position?: unknown;
  color?: string;
  hasUnsatisfiedCondition?: boolean;
  conditionSatisfied?: boolean;
};

export function getElementSize(thickness?: number): number {
  const defaultThickness = 2;
  const defaultSize = 40;
  const maxSize = 50;
  const thicknessValue = thickness || defaultThickness;
  const calculatedSize =
    defaultSize + (thicknessValue - defaultThickness) * 1.25;
  return Math.min(calculatedSize, maxSize);
}

export function isConnectionElement(
  element: GeometryElement | undefined
): boolean {
  return (
    element != null &&
    (element.type === 'Resource Connection' ||
      element.type === 'State Connection')
  );
}

export function snapNodeToEdgeInDirection(
  node: GeometryElement,
  targetPoint: { x: number; y: number }
): { x: number; y: number } {
  const nodeCenter = { x: node.x, y: node.y };

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

  const dx = targetPoint.x - nodeCenter.x;
  const dy = targetPoint.y - nodeCenter.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return nodeCenter;
  }

  const dirX = dx / distance;
  const dirY = dy / distance;

  const tLeft =
    offsetX > 0 ? (left - nodeCenter.x) / (dirX || 1e-10) : Infinity;
  const tRight =
    offsetX > 0 ? (right - nodeCenter.x) / (dirX || 1e-10) : Infinity;
  const tTop = offsetY > 0 ? (top - nodeCenter.y) / (dirY || 1e-10) : Infinity;
  const tBottom =
    offsetY > 0 ? (bottom - nodeCenter.y) / (dirY || 1e-10) : Infinity;

  const validTs = [dirX > 0 ? tRight : tLeft, dirY > 0 ? tBottom : tTop].filter(
    t => t > 0
  );

  const t = Math.min(...validTs);

  if (!isFinite(t)) {
    return nodeCenter;
  }

  return {
    x: nodeCenter.x + dirX * t,
    y: nodeCenter.y + dirY * t,
  };
}

export function getResourcePolylineWorldPoints(
  resource: GeometryElement,
  elementsSnapshot: GeometryElement[]
): { x: number; y: number }[] {
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
}

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

export function getLabelPointForConnection(
  polyline: { x: number; y: number }[],
  labelPosition?: number,
  offsetPx = 16
): { x: number; y: number } {
  const pos =
    labelPosition == null ? 0.5 : Math.max(-1, Math.min(1, labelPosition));
  const side = pos < 0 ? -1 : 1;
  const t = clamp01(Math.abs(pos));

  const { point, normal } = getPointAndNormalOnPolylineAtT(polyline, t);

  return {
    x: point.x + normal.x * offsetPx * side,
    y: point.y + normal.y * offsetPx * side,
  };
}

export function getResourceConnectionLabelAnchor(
  conn: GeometryElement,
  elements: GeometryElement[]
): { x: number; y: number } | null {
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

  const legacyPosRaw = (conn as { position?: unknown }).position;
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
}

export function getStateConnectionWorldPath(
  el: GeometryElement,
  elements: GeometryElement[]
): { x: number; y: number }[] {
  const startTarget = elements.find(n => n.id === el.connectedToStart);
  const endTarget = elements.find(n => n.id === el.connectedToEnd);

  let startPoint = {
    x: el.startX ?? el.x,
    y: el.startY ?? el.y,
  };
  let endPoint = {
    x: el.endX ?? el.x,
    y: el.endY ?? el.y,
  };

  const startIsConn = isConnectionElement(startTarget);
  const endIsConn = isConnectionElement(endTarget);

  if (startTarget && endTarget && !startIsConn && !endIsConn) {
    const startTargetPoint =
      el.points && el.points.length > 0
        ? el.points[0]
        : { x: endTarget.x, y: endTarget.y };
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
    const labelAnchor = getResourceConnectionLabelAnchor(endTarget, elements);
    if (labelAnchor) {
      endPoint = labelAnchor;
    }
  }

  return [startPoint, ...(el.points ?? []), endPoint];
}
