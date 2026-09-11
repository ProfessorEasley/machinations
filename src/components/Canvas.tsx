import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
import './Canvas.css';
import ChartElement from './ChartElement';
import { createInitialChartState } from '../utils/ChartUtils';
import './Chart.css';
import type {
  GraphElement,
  GraphElementType,
  ResourceTransfer,
  FractionalDispatchState,
} from '../engine/types';
import {
  getElementValue,
  delayGlyphStrokeForFill,
  applyDynamicResourceLabels,
  classifyLabel,
  parseInterval,
  parseCond,
} from '../engine/helpers';
import { resetElements } from '../engine/reset';
import { getTriggeredEndConditionName } from '../engine/runner';
import { simulateTick } from '../engine/tick';
import { startSimulationLoop } from '../engine/simulationLoop';
import { setSeed } from '../engine/rng';
import {
  serializeGraphElementsToXml,
  downloadTextFile,
  type XmlSerializeElement,
} from '../utils/graphXmlSerialize';
import { parseGraphFromXmlText } from '../utils/graphXmlImport';
import { exportGraphToSvgString } from '../utils/graphSvgExport';
import {
  getElementSize,
  getResourcePolylineWorldPoints,
  getLabelPointForConnection,
  getStateConnectionWorldPath,
} from '../utils/canvasElementGeometry';

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
  runType?: 'quick' | 'multiple' | null;
  numRuns?: number;
  visibleRuns?: number;
  seed?: number;
  onSimulationComplete?: (result?: QuickRunCompletePayload) => void;
  onMultipleRunsComplete?: (result: MultipleRunsCompletePayload) => void;
  /** Increment to reset frozen sim state after Quick Run (Playground Reset). */
  boardResetKey?: number;
  /** When true, pause between runs in a multiple-runs batch. */
  isPaused?: boolean;
}

export interface QuickRunCompletePayload {
  durationSeconds: number;
  endConditionMessage: string;
}

export interface RunOutcome {
  endConditionName: string | null;
  ticksElapsed: number;
}

export interface MultipleRunsCompletePayload {
  totalRuns: number;
  outcomes: RunOutcome[];
}

/** Max automatic ticks when quick run has no end condition. */
const QUICK_RUN_TICK_CAP_WITHOUT_END = 5000;

/** Internal simulation steps per visible frame during Quick Run. */
const QUICK_RUN_BATCH_SIZE = 100;

/** Simulated time step per internal tick (seconds). */
const QUICK_RUN_TIME_INCREMENT = 0.1;

const QUICK_RUN_MAX_TICKS = 1000;

interface CustomWindow extends Window {
  __GAME_ENDED__?: boolean;
}

// ------------------------------
// XML Import helpers
// (parser lives in src/utils/graphXmlImport.ts and is shared with the CLI)
// ------------------------------

const isProbablyXmlFile = (f: File) => {
  const nameOk = f.name.toLowerCase().endsWith('.xml');
  const typeOk = (f.type || '').toLowerCase().includes('xml');
  return nameOk || typeOk;
};

interface MovingToken {
  id: number;
  connectionId: number;
  color: string;
  path: { x: number; y: number }[];
  startTime: number;
  currentX: number;
  currentY: number;
}

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

const Canvas: React.FC<CanvasProps> = ({
  isRunning,
  runType,
  numRuns,
  visibleRuns,
  seed,
  isPaused = false,
  onSimulationComplete,
  onMultipleRunsComplete,
  boardResetKey = 0,
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
  /** Live board state during Quick Run animation (avoids corrupting undo history). */
  const [quickRunLiveElements, setQuickRunLiveElements] = useState<
    GraphElement[] | null
  >(null);

  const elements = quickRunLiveElements ?? externalElements ?? internalElements;
  const selectedId = externalSelectedIds ?? internalSelectedIds;

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

  // Keep the latest elements in a ref so we can use them in stable callbacks
  const elementsRef = useRef<GraphElement[]>(elements);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Track previous elements to auto-select newly added element
  const prevElementsForSelectionRef = useRef<GraphElement[]>(elements);

  useEffect(() => {
    const prev = prevElementsForSelectionRef.current;

    // Only react when elements have been added (not removed/modified)
    if (!isRunning && elements.length > prev.length) {
      const prevIds = new Set(prev.map(e => e.id));
      const newlyAdded = elements.filter(el => !prevIds.has(el.id));

      if (newlyAdded.length > 0) {
        // Heuristic: pick the element with the highest id among the new ones
        const latest = newlyAdded.reduce(
          (acc, el) => (el.id > acc.id ? el : acc),
          newlyAdded[0]
        );
        setSelectedId([latest.id]);
      }
    }

    prevElementsForSelectionRef.current = elements;
  }, [elements, isRunning, setSelectedId]);

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

  const applyGameEnded = useCallback((ended: boolean) => {
    setGameEnded(ended);
    gameEndedRef.current = ended;
  }, []);

  useEffect(() => {
    // Whenever the tool changes (e.g., from 'Select' to 'Pool'), clears selection.
    if (selectedTool !== 'Select') {
      setSelectedIdRef.current([]);
    }
  }, [selectedTool]);

  const canvasRef = useRef<HTMLDivElement>(null);
  // The scrollable viewport wrapping the (possibly larger-than-screen) canvas.
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ---------- Panning (middle-mouse drag) ----------
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // ---------- Moving Tokens (for Resource Connections) ----------
  const TOKEN_TRAVEL_TIME = 600; // ms
  /** Delay between consecutive resources on the same connection (queue spacing). */
  const TOKEN_STAGGER_MS = 160;

  const [movingTokens, setMovingTokens] = useState<MovingToken[]>([]);
  const nextTokenIdRef = useRef(1);
  /** Next available departure time per connection (keeps batches in a single file). */
  const connectionTokenQueueRef = useRef<Map<number, number>>(new Map());
  /** Bumped to invalidate in-flight token timeouts when animations are cleared. */
  const tokenAnimationSessionRef = useRef(0);

  const clearMovingTokens = useCallback(() => {
    tokenAnimationSessionRef.current += 1;
    connectionTokenQueueRef.current.clear();
    setMovingTokens([]);
  }, []);

  // Track fractional dispatch progress for decimal-labeled connections
  const fractionalDispatchRef = useRef<Map<number, FractionalDispatchState>>(
    new Map()
  );
  const currentTickRef = useRef(0);

  const spawnMovingTokens = useCallback(
    (transfers: ResourceTransfer[], elementsSnapshot: GraphElement[]) => {
      const tokensToAdd: MovingToken[] = [];
      const session = tokenAnimationSessionRef.current;
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now();

      for (const tr of transfers) {
        const conn = elementsSnapshot.find(el => el.id === tr.connectionId);
        if (!conn) continue;

        const basePolyline = getResourcePolylineWorldPoints(
          conn,
          elementsSnapshot
        );
        if (basePolyline.length < 2) continue;

        const unitsToShow = Math.min(tr.units, 5);
        let queueTime =
          connectionTokenQueueRef.current.get(tr.connectionId) ?? now;
        if (queueTime < now) queueTime = now;

        for (let i = 0; i < unitsToShow; i++) {
          const id = nextTokenIdRef.current++;
          const startTime = queueTime + i * TOKEN_STAGGER_MS;
          const delayUntilRemove = startTime - now + TOKEN_TRAVEL_TIME + 50;

          tokensToAdd.push({
            id,
            connectionId: tr.connectionId,
            color: tr.color,
            path: basePolyline,
            startTime,
            currentX: basePolyline[0].x,
            currentY: basePolyline[0].y,
          });
          setTimeout(() => {
            if (tokenAnimationSessionRef.current !== session) return;
            setMovingTokens(prev => prev.filter(t => t.id !== id));
          }, delayUntilRemove);
        }

        connectionTokenQueueRef.current.set(
          tr.connectionId,
          queueTime + unitsToShow * TOKEN_STAGGER_MS
        );
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
          const t = elapsed < 0 ? 0 : Math.min(1, elapsed / TOKEN_TRAVEL_TIME);
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

      const { elements: imported, warnings } = parseGraphFromXmlText(xmlText);
      if (warnings.length) {
        console.warn('XML import warnings:', warnings);
      }

      // stop any running visuals/state
      clearMovingTokens();
      applyGameEnded(false);

      // Reset fractional dispatch state
      fractionalDispatchRef.current.clear();
      currentTickRef.current = 0;

      const maxId = imported.reduce(
        (m: number, el: GraphElement) => Math.max(m, el.id),
        -1
      );
      nextIdRef.current = maxId + 1;
      // load the imported diagram
      setElements(imported);
      setSelectedId([]);
    },
    [setElements, setSelectedId, clearMovingTokens]
  );

  const resetCanvasForNewDocument = useCallback(() => {
    clearMovingTokens();
    applyGameEnded(false);
    fractionalDispatchRef.current.clear();
    currentTickRef.current = 0;
    nextIdRef.current = 0;
    setPasteCount(0);
    setIsCreatingConnection(false);
    setConnectionType(null);
    setConnectionPoints([]);
    setConnectionPreviewPoint(null);
    setDraggingWaypoint(null);
    setDraggedElements(null);
    setIsSelectingBox(false);
    setBoxStart(null);
    setBoxEnd(null);
    setMouseDownOnCanvas(false);
    setDraggingId(null);
    setDragOffset(null);
    setDraggingLabelElementId(null);
    setIsResizing(false);
    setResizingId(null);
    setResizeHandle(null);
    setHoveredChartConnId(null);
    setHasSimulationStarted(false);
    setXmlImportError(null);
    setSelectedId([]);
  }, [setSelectedId, clearMovingTokens]);

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

  useEffect(() => {
    const onNew = () => {
      resetCanvasForNewDocument();
    };

    const onSaveXml = () => {
      const els = elementsRef.current as XmlSerializeElement[];
      const xml = serializeGraphElementsToXml(els);
      downloadTextFile('diagram.xml', xml, 'application/xml;charset=utf-8');
    };

    const onExportSelectionXml = (ev: Event) => {
      const ce = ev as CustomEvent<{ elements?: XmlSerializeElement[] }>;
      const sel = ce.detail?.elements ?? [];
      const xml = sel.length ? serializeGraphElementsToXml(sel) : '';
      downloadTextFile('selection.txt', xml, 'text/plain;charset=utf-8');
    };

    const onExportSvg = () => {
      const els = elementsRef.current as XmlSerializeElement[];
      const svg = exportGraphToSvgString(els);
      downloadTextFile('diagram.svg', svg, 'image/svg+xml;charset=utf-8');
    };

    document.addEventListener('canvas-new-document', onNew);
    document.addEventListener('canvas-save-xml', onSaveXml);
    document.addEventListener(
      'canvas-export-selection-xml',
      onExportSelectionXml as EventListener
    );
    document.addEventListener('canvas-export-svg', onExportSvg);

    return () => {
      document.removeEventListener('canvas-new-document', onNew);
      document.removeEventListener('canvas-save-xml', onSaveXml);
      document.removeEventListener(
        'canvas-export-selection-xml',
        onExportSelectionXml as EventListener
      );
      document.removeEventListener('canvas-export-svg', onExportSvg);
    };
  }, [resetCanvasForNewDocument]);

  const runSimulationTick = useCallback(
    (
      elementsToUpdate: GraphElement[],
      activationType: 'automatic' | 'onstart' | 'interactive',
      interactiveElementId?: number,
      tickTransfers?: ResourceTransfer[]
    ): GraphElement[] => {
      currentTickRef.current += 1;
      const result = simulateTick(
        elementsToUpdate,
        activationType,
        {
          mode: activationType,
          currentTick: currentTickRef.current - 1,
          fractionalDispatch: fractionalDispatchRef.current,
        },
        interactiveElementId
      );

      // Forward transfers to caller array
      if (tickTransfers) tickTransfers.push(...result.transfers);

      // Handle game-end events: set window flag + dispatch DOM event for UI
      for (const ev of result.events) {
        if (ev.type === 'game_end') {
          const detail = ev.payload as { message?: string } | undefined;
          if (typeof window !== 'undefined') {
            (window as unknown as CustomWindow).__GAME_ENDED__ = true;
          }
          document.dispatchEvent(
            new CustomEvent('game-end', {
              detail: { message: detail?.message ?? 'Victory!' },
            })
          );
        }
      }

      return result.nextElements;
    },
    []
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
  const clearMovingTokensRef = useRef(clearMovingTokens);
  const runSimulationRef = useRef(runSimulationAndCollectTransfers);
  const setSelectedIdRef = useRef(setSelectedId);
  const runTypeRef = useRef(runType);
  const numRunsRef = useRef(numRuns);
  const seedRef = useRef(seed);
  const onSimulationCompleteRef = useRef(onSimulationComplete);
  const onMultipleRunsCompleteRef = useRef(onMultipleRunsComplete);
  const currentRunRef = useRef(0);
  const multipleRunsAbortRef = useRef(false);
  const multipleRunsPausedRef = useRef(false);
  const pausedRunNextRef = useRef<(() => void) | null>(null);
  const quickRunAbortRef = useRef(false);
  const quickRunElsRef = useRef<GraphElement[]>([]);
  const quickRunStartedAtRef = useRef(0);
  const quickRunAutomaticTicksRef = useRef(0);
  const quickRunEndMessageRef = useRef<string | undefined>(undefined);
  const quickRunFinishedRef = useRef(false);
  const quickRunRafActiveRef = useRef(false);

  useEffect(() => {
    setElementsRef.current = setElements;
  }, [setElements]);

  useEffect(() => {
    spawnMovingTokensRef.current = spawnMovingTokens;
  }, [spawnMovingTokens]);

  useEffect(() => {
    clearMovingTokensRef.current = clearMovingTokens;
  }, [clearMovingTokens]);

  useEffect(() => {
    runSimulationRef.current = runSimulationAndCollectTransfers;
  }, [runSimulationAndCollectTransfers]);

  useEffect(() => {
    setSelectedIdRef.current = setSelectedId;
  }, [setSelectedId]);

  useEffect(() => {
    runTypeRef.current = runType;
  }, [runType]);

  useEffect(() => {
    numRunsRef.current = numRuns;
  }, [numRuns]);

  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    onSimulationCompleteRef.current = onSimulationComplete;
  }, [onSimulationComplete]);

  useEffect(() => {
    onMultipleRunsCompleteRef.current = onMultipleRunsComplete;
  }, [onMultipleRunsComplete]);

  useEffect(() => {
    if (boardResetKey === 0) return;
    quickRunAbortRef.current = true;
    multipleRunsAbortRef.current = true;
    multipleRunsPausedRef.current = false;
    pausedRunNextRef.current = null;
    quickRunRafActiveRef.current = false;
    setQuickRunLiveElements(null);
    applyGameEnded(false);
    setHasSimulationStarted(false);
    clearMovingTokens();
    fractionalDispatchRef.current.clear();
    currentTickRef.current = 0;
    quickRunFinishedRef.current = false;
  }, [boardResetKey, applyGameEnded, clearMovingTokens]);

  useEffect(() => {
    if (isPaused) {
      multipleRunsPausedRef.current = true;
    } else {
      multipleRunsPausedRef.current = false;
      if (pausedRunNextRef.current) {
        const fn = pausedRunNextRef.current;
        pausedRunNextRef.current = null;
        setTimeout(fn, 0);
      }
    }
  }, [isPaused]);

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

  // Helper function for complete trader (ensures resource conservation - no creation/destruction)

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
    let simulationLoopHandle:
      | ReturnType<typeof startSimulationLoop>
      | undefined;
    let quickRunRafId: number | undefined;

    const isGameEndedFlag = () =>
      Boolean(
        gameEndedRef.current ||
          (typeof window !== 'undefined' &&
            (window as unknown as CustomWindow).__GAME_ENDED__)
      );

    const finishQuickRun = (endedByCondition: boolean) => {
      if (quickRunFinishedRef.current || quickRunAbortRef.current) return;
      quickRunFinishedRef.current = true;
      quickRunRafActiveRef.current = false;

      const durationSeconds =
        (performance.now() - quickRunStartedAtRef.current) / 1000;
      const endConditionMessage = endedByCondition
        ? (quickRunEndMessageRef.current ?? 'Victory!')
        : `Stopped after ${QUICK_RUN_TICK_CAP_WITHOUT_END} ticks`;

      setQuickRunLiveElements(null);
      clearMovingTokensRef.current();
      setElementsRef.current(quickRunElsRef.current);
      applyGameEnded(true);
      onSimulationCompleteRef.current?.({
        durationSeconds,
        endConditionMessage,
      });
    };

    if (typeof window !== 'undefined') {
      (window as unknown as CustomWindow).__GAME_ENDED__ = false;
    }

    // =======================================================================
    // A. START: When "Run" is clicked
    // =======================================================================
    if (isRunning && !hasSimulationStarted) {
      console.log('--- Starting Simulation ---');
      setHasSimulationStarted(true);
      applyGameEnded(false);

      // Seed the PRNG so this simulation is reproducible. A defined seed makes
      // every probabilistic decision deterministic for the whole run (or batch
      // of runs); passing undefined falls back to Math.random().
      setSeed(seedRef.current);

      // Reset fractional dispatch state for new simulation
      fractionalDispatchRef.current.clear();
      currentTickRef.current = 0;

      if (runTypeRef.current === 'multiple') {
        // =======================================================================
        // Multiple Runs: execute N full simulations back-to-back, accumulating
        // chart data across runs. Chart elements preserve their chartState between
        // runs; all other elements reset to their configured initial values.
        // All runs operate on an in-memory local variable to avoid calling
        // useHistory.setState on every run — rapid calls corrupt the history array
        // via stale currentIndex when setTimeout fires before React commits.
        // setElementsRef is called only once at the end with the final state.
        // =======================================================================
        currentRunRef.current = 0;
        multipleRunsAbortRef.current = false;

        // elementsRef.current is always fresh (synced via useEffect at line 2184)
        let runEls = elementsRef.current.map(el => ({ ...el }));
        const runOutcomes: RunOutcome[] = [];

        const runNext = () => {
          if (multipleRunsAbortRef.current) return;
          if (currentRunRef.current >= (numRunsRef.current ?? 100)) {
            setElementsRef.current(runEls); // commit all accumulated chart data once
            setQuickRunLiveElements(null);
            applyGameEnded(true);
            onMultipleRunsCompleteRef.current?.({
              totalRuns: currentRunRef.current,
              outcomes: runOutcomes,
            });
            onSimulationCompleteRef.current?.();
            return;
          }

          fractionalDispatchRef.current.clear();
          currentTickRef.current = 0;
          gameEndedRef.current = false;
          if (typeof window !== 'undefined') {
            (window as unknown as CustomWindow).__GAME_ENDED__ = false;
          }

          // Soft reset: restore element initial values while preserving each
          // Chart's chartState so lines accumulate across runs. Uses the shared
          // engine resetElements (which also clears Delay state, unlike the old
          // inline reset) so single/quick/multiple runs stay consistent.
          runEls = resetElements(runEls);

          const { nextElements: afterOnstart } = runSimulationRef.current(
            runEls,
            'onstart'
          );
          runEls = afterOnstart;

          let ticksElapsed = 0;
          for (let tick = 0; tick < QUICK_RUN_MAX_TICKS; tick++) {
            if (
              multipleRunsAbortRef.current ||
              gameEndedRef.current ||
              (window as unknown as CustomWindow).__GAME_ENDED__
            )
              break;
            const { nextElements } = runSimulationRef.current(
              runEls,
              'automatic'
            );
            runEls = nextElements;
            ticksElapsed++;
          }

          runOutcomes.push({
            endConditionName: getTriggeredEndConditionName(runEls),
            ticksElapsed,
          });

          currentRunRef.current += 1;
          // Refresh the canvas so chart lines accumulate visibly between runs,
          // mirroring the original tool's per-run view refresh.
          setQuickRunLiveElements(runEls);
          document.dispatchEvent(
            new CustomEvent('multiple-runs-progress', {
              detail: {
                current: currentRunRef.current,
                total: numRunsRef.current ?? 100,
                outcomes: [...runOutcomes],
              },
            })
          );

          if (multipleRunsPausedRef.current) {
            pausedRunNextRef.current = runNext;
            return;
          }
          setTimeout(runNext, 0);
        };

        runNext();
      } else {
        // 1. FORCE RESET ELEMENTS (Clean slate before starting)
        if (runTypeRef.current === 'quick') {
          quickRunAbortRef.current = false;
          quickRunFinishedRef.current = false;
          quickRunEndMessageRef.current = undefined;
          quickRunAutomaticTicksRef.current = 0;
          quickRunStartedAtRef.current = performance.now();

          const cleanElements = resetElements(elementsRef.current);
          const { nextElements: afterOnstart, transfers: onstartTransfers } =
            runSimulationRef.current(cleanElements, 'onstart');

          quickRunElsRef.current = afterOnstart;
          setQuickRunLiveElements(afterOnstart);
          if (onstartTransfers.length) {
            spawnMovingTokensRef.current(onstartTransfers, afterOnstart);
          }

          if (isGameEndedFlag()) {
            finishQuickRun(true);
          }
        } else {
          setElementsRef.current(prev => {
            const cleanElements = resetElements(prev);

            // 2. Run the "OnStart" tick immediately on the clean elements
            const { nextElements: afterOnstart, transfers: onstartTransfers } =
              runSimulationRef.current(cleanElements, 'onstart');

            if (onstartTransfers.length)
              spawnMovingTokensRef.current(onstartTransfers, afterOnstart);

            return afterOnstart;
          });
        }
      }
    }

    // B. While the simulation is running
    if (isRunning && hasSimulationStarted && runTypeRef.current === 'quick') {
      // Quick Run: batch up to 100 automatic ticks per animation frame, then redraw.
      // Each internal tick advances simulated time by QUICK_RUN_TIME_INCREMENT (0.1s).
      // Updates use quickRunLiveElements only — history is committed once at finish.
      void QUICK_RUN_TIME_INCREMENT;
      if (
        !quickRunFinishedRef.current &&
        !isGameEndedFlag() &&
        !quickRunRafActiveRef.current
      ) {
        quickRunRafActiveRef.current = true;

        const runQuickRunBatch = () => {
          if (quickRunAbortRef.current || quickRunFinishedRef.current) {
            quickRunRafActiveRef.current = false;
            return;
          }

          let els = quickRunElsRef.current;
          let lastTickTransfers: ResourceTransfer[] = [];

          for (let i = 0; i < QUICK_RUN_BATCH_SIZE; i++) {
            if (quickRunAbortRef.current) {
              quickRunRafActiveRef.current = false;
              return;
            }
            if (isGameEndedFlag()) break;
            if (
              quickRunAutomaticTicksRef.current >=
              QUICK_RUN_TICK_CAP_WITHOUT_END
            ) {
              break;
            }

            const { nextElements, transfers } = runSimulationRef.current(
              els,
              'automatic'
            );
            els = nextElements;
            lastTickTransfers = transfers;
            quickRunAutomaticTicksRef.current += 1;
          }

          quickRunElsRef.current = els;
          setQuickRunLiveElements(els);
          if (lastTickTransfers.length) {
            spawnMovingTokensRef.current(lastTickTransfers, els);
          }

          const endedByCondition = isGameEndedFlag();
          const hitTickCap =
            quickRunAutomaticTicksRef.current >= QUICK_RUN_TICK_CAP_WITHOUT_END;

          if (endedByCondition) {
            finishQuickRun(true);
            return;
          }
          if (hitTickCap) {
            finishQuickRun(false);
            return;
          }
          if (quickRunAbortRef.current) {
            quickRunRafActiveRef.current = false;
            return;
          }

          quickRunRafId = requestAnimationFrame(runQuickRunBatch);
        };

        quickRunRafId = requestAnimationFrame(runQuickRunBatch);
      }
    } else if (
      isRunning &&
      runTypeRef.current !== 'quick' &&
      runTypeRef.current !== 'multiple'
    ) {
      simulationLoopHandle = startSimulationLoop({
        intervalMs: 1000,
        shouldSkipTick: () =>
          Boolean(
            gameEndedRef.current ||
              (typeof window !== 'undefined' &&
                (window as unknown as CustomWindow).__GAME_ENDED__)
          ),
        onTick: () => {
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
        },
        onError: error => {
          console.error('⛔️ Error during Automatic tick:', error);
        },
      });
    }

    // =======================================================================
    // C. STOP: When "Stop" is clicked OR Parent stops it
    // =======================================================================
    if (!isRunning && hasSimulationStarted) {
      console.log('--- Stopped ---');
      setHasSimulationStarted(false);
      multipleRunsAbortRef.current = true;
      multipleRunsPausedRef.current = false;
      pausedRunNextRef.current = null;
      quickRunAbortRef.current = true;
      quickRunRafActiveRef.current = false;
      setQuickRunLiveElements(null);

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
      clearMovingTokensRef.current();
      applyGameEnded(false);

      // Reset fractional dispatch state
      fractionalDispatchRef.current.clear();
      currentTickRef.current = 0;

      setElementsRef.current(prev => resetElements(prev));
    }

    // D. Cleanup:
    return () => {
      simulationLoopHandle?.stop();
      if (quickRunRafId != null) {
        cancelAnimationFrame(quickRunRafId);
      }
      quickRunRafActiveRef.current = false;
    };
    // Ensure ALL dependencies used inside are listed.
    // If setIsRunning comes from props/context, add it too.
  }, [isRunning, hasSimulationStarted, applyGameEnded]);

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
      const viewport = scrollContainerRef.current ?? canvasRef.current;
      const canvasWidth = viewport?.clientWidth || 800;
      const canvasHeight = viewport?.clientHeight || 600;
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
    const handleGameEnd = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (runTypeRef.current === 'quick') {
        quickRunEndMessageRef.current = detail?.message ?? 'Victory!';
      }
      applyGameEnded(true);
    };

    document.addEventListener('game-end', handleGameEnd as EventListener);

    return () => {
      document.removeEventListener('game-end', handleGameEnd as EventListener);
    };
  }, [applyGameEnded]);

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
        const polyline = getResourcePolylineWorldPoints(element, elements);
        if (polyline.length < 2) return;
        const { distance } = getClosestPointOnPolyline({ x, y }, polyline);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestElement = element;
        }
        return;
      }

      // Treat Charts using their full rectangular area so clicks
      // anywhere on the chart body are considered "on" the chart.
      if (element.type === 'Chart') {
        const chartWidth = element.chartWidth || 200;
        const chartHeight = element.chartHeight || 150;
        const left = element.x;
        const top = element.y;
        const right = left + chartWidth;
        const bottom = top + chartHeight;

        // Distance from point to rectangle (0 if inside).
        const dx = x < left ? left - x : x > right ? x - right : 0;
        const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
        const distance = Math.sqrt(dx * dx + dy * dy);

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

      const newChart: GraphElement = {
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
      };

      setElements(prev => [...prev, newChart]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newChart);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
      return;
    }

    if (type === 'Text Label') {
      const newLabel: GraphElement = {
        id,
        type,
        x,
        y,
        text: toolProperties?.textLabel?.text || '',
        color: toolProperties?.textLabel?.color || '#000000',
      };

      setElements(prev => [...prev, newLabel]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newLabel);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Group') {
      const newGroup: GraphElement = {
        id,
        type,
        x,
        y,
        width: 200,
        height: 150,
        text: toolProperties?.group?.text || '',
        color: toolProperties?.group?.color || '#000000',
      };

      setElements(prev => [...prev, newGroup]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newGroup);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Pool') {
      const poolProps = toolProperties?.pool;
      const startingPoints =
        typeof poolProps?.number === 'string'
          ? parseInt(poolProps.number, 10) || 0
          : poolProps?.number || 0;
      const maxPoints = poolProps?.max;

      const newPool: GraphElement = {
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
      };

      setElements(prev => [...prev, newPool]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newPool);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Resource Connection' || type === 'State Connection') {
      setIsCreatingConnection(true);
      const startPoint = { x, y };
      setConnectionType(type);
      setConnectionPoints([startPoint]);
      setConnectionPreviewPoint(startPoint);
    } else if (type === 'Source') {
      const newSource: GraphElement = {
        id,
        type,
        x,
        y,
        ...toolProperties?.source,
        // Use the 'text' (Label) field for starting points
        currentPoints: parseInt(toolProperties?.source?.text || '0', 10),
      };

      setElements(prev => [...prev, newSource]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newSource);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Gate') {
      const newGate: GraphElement = {
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
      };

      setElements(prev => [...prev, newGate]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newGate);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Drain') {
      const newDrain: GraphElement = {
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
      };

      setElements(prev => [...prev, newDrain]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newDrain);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Convertor') {
      const newConvertor: GraphElement = {
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
      };

      setElements(prev => [...prev, newConvertor]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newConvertor);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Trader') {
      const newTrader: GraphElement = {
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
      };

      setElements(prev => [...prev, newTrader]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newTrader);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Delay') {
      const newDelay: GraphElement = {
        id,
        type,
        x,
        y,
        color: toolProperties?.delay?.color ?? '#ffffff',
        thickness: toolProperties?.delay?.thickness,
        text: toolProperties?.delay?.text,
        labelPosition: 0,
        activation: toolProperties?.delay?.activation,
        actions: toolProperties?.delay?.actions,
        queue: toolProperties?.delay?.queue,
      };

      setElements(prev => [...prev, newDelay]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newDelay);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Register') {
      const interactive = toolProperties?.register?.interactive ?? false;
      const startingValue = toolProperties?.register?.startingValue ?? 0;

      const newRegister: GraphElement = {
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
      };

      setElements(prev => [...prev, newRegister]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newRegister);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'End Condition') {
      const newEndCondition: GraphElement = {
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
      };

      setElements(prev => [...prev, newEndCondition]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newEndCondition);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
    } else if (type === 'Artifical Intelligence') {
      const newAi: GraphElement = {
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
      };

      setElements(prev => [...prev, newAi]);
      setSelectedId([id]);
      if (onElementSelection) {
        onElementSelection(newAi);
      }
      if (onToolChange) {
        onToolChange('Select');
      }
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
          const polyline = getResourcePolylineWorldPoints(endElement, elements);
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
    if (onElementSelection) {
      onElementSelection(newConnection);
    }

    setIsCreatingConnection(false);
    setConnectionType(null);
    setConnectionPoints([]);
    setConnectionPreviewPoint(null);

    if (onToolChange) {
      onToolChange('Select');
    }
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
    // Ignore clicks generated by a middle-mouse pan gesture.
    if (isPanningRef.current) {
      return;
    }
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
        const held = getElementValue(el);
        const fill = el.color || '#ffffff';
        const glyphStroke = delayGlyphStrokeForFill(fill);
        const ringStroke = isSelected ? '#0078d4' : glyphStroke;
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
                fill={fill}
                stroke={ringStroke}
                strokeWidth={el.thickness || 2}
                className={`delay-circle ${isSelected ? 'selected' : ''}`}
              />
              <g
                className="delay-hourglass-glyph"
                transform={`translate(${center},${center}) scale(${scale})`}
                style={{ pointerEvents: 'none' }}
              >
                <path
                  d="M -11 -11 L 11 -11 L 0 -3 Z M -11 11 L 11 11 L 0 3 Z"
                  fill="none"
                  stroke={glyphStroke}
                  strokeWidth={1.35}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </g>
              {held > 0 ? (
                <text
                  x={center}
                  y={center + 13 * scale}
                  className="delay-held-count"
                  fill={glyphStroke}
                  fontSize={Math.max(6, 7 * scale)}
                  textAnchor="middle"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {held}
                </text>
              ) : null}
            </svg>
            {renderNodeLabel(el, size)}
          </>
        );
      }
      case 'Resource Connection': {
        const pathPoints = getResourcePolylineWorldPoints(el, elements);

        if (pathPoints.length < 2) {
          return null;
        }

        const startPoint = pathPoints[0];
        const endPoint = pathPoints[pathPoints.length - 1];

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
        const endTarget = elements.find(node => node.id === el.connectedToEnd);
        const isChartConnection = endTarget?.type === 'Chart';

        const pathPoints = getStateConnectionWorldPath(el, elements);
        if (pathPoints.length < 2) {
          return null;
        }

        const startPoint = pathPoints[0];
        const endPoint = pathPoints[pathPoints.length - 1];

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
              visibleRuns={visibleRuns ?? 25}
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

  const handlePanMouseMove = useCallback((e: MouseEvent) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    container.scrollLeft = panStartRef.current.scrollLeft - dx;
    container.scrollTop = panStartRef.current.scrollTop - dy;
  }, []);

  const handlePanMouseUp = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
    window.removeEventListener('mousemove', handlePanMouseMove);
    window.removeEventListener('mouseup', handlePanMouseUp);
  }, [handlePanMouseMove]);

  // Starts a pan on middle-mouse drag. Runs in the capture phase so it
  // pre-empts box-select / element dragging on the canvas.
  const handlePanMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 1) return;
      const container = scrollContainerRef.current;
      if (!container) return;
      e.preventDefault();
      e.stopPropagation();
      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      window.addEventListener('mousemove', handlePanMouseMove);
      window.addEventListener('mouseup', handlePanMouseUp);
    },
    [handlePanMouseMove, handlePanMouseUp]
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handlePanMouseMove);
      window.removeEventListener('mouseup', handlePanMouseUp);
    };
  }, [handlePanMouseMove, handlePanMouseUp]);

  // Size the canvas so it always extends far enough to reveal every element
  // (e.g. after importing a large XML file or building a big simulation).
  // CSS keeps it at least as big as the viewport via min-width/min-height.
  const contentSize = React.useMemo(() => {
    const PADDING = 400; // breathing room past the furthest element
    let maxX = 0;
    let maxY = 0;

    for (const el of displayElements) {
      const xs: number[] = [el.x ?? 0];
      const ys: number[] = [el.y ?? 0];
      if (typeof el.startX === 'number') xs.push(el.startX);
      if (typeof el.endX === 'number') xs.push(el.endX);
      if (typeof el.startY === 'number') ys.push(el.startY);
      if (typeof el.endY === 'number') ys.push(el.endY);

      let w = 80;
      let h = 80;
      if (el.type === 'Group') {
        w = el.width || 200;
        h = el.height || 150;
      } else if (el.type === 'Chart') {
        w = el.chartWidth || 200;
        h = el.chartHeight || 150;
      }

      maxX = Math.max(maxX, ...xs.map(v => v + w));
      maxY = Math.max(maxY, ...ys.map(v => v + h));
    }

    return {
      width: Math.ceil(maxX + PADDING),
      height: Math.ceil(maxY + PADDING),
    };
  }, [displayElements]);

  return (
    <div
      ref={scrollContainerRef}
      className={`canvas-viewport ${isPanning ? 'panning' : ''}`}
      onMouseDownCapture={handlePanMouseDown}
    >
      <div
        ref={canvasRef}
        className={`canvas ${isRunning ? 'is-running' : ''} ${gameEnded ? 'game-ended' : ''}`}
        style={{ width: contentSize.width, height: contentSize.height }}
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
      </div>

      <input
        ref={xmlFileInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        style={{ display: 'none' }}
        onChange={handleXmlFileChosen}
      />

      {isRunning && (
        <div className="canvas-running-notice" role="status">
          Simulation running. Stop it to move or edit elements.
        </div>
      )}

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
