import type {
  GraphElement,
  ResourceTransfer,
  SimulationEvent,
  TickTraceChange,
  TickTraceEntry,
  TickTraceFlow,
} from './types';

/**
 * Tick tracing — a verbose, opt-in "diary" the engine keeps while it runs.
 *
 * The simulation makes thousands of tiny decisions per run; when the numbers go
 * insane (money explodes, XP stops growing) there is otherwise no way to see
 * *why*. With tracing armed, every tick records which elements changed and by
 * how much, so the run can be read back like a log:
 *
 *   Tick 2  coins: 100 → 50 (-50)
 *   Tick 3  XP: 0 → 20 (+20)
 *   Tick 4  XP: 20 → 40 (+20)
 *   Tick 5  XP: 40 → 999999 (+999959)   <-- the bug is right here
 *
 * Tracing is diff-based: it compares the element state before and after a tick
 * rather than instrumenting every mutation site, so it stays correct as the
 * engine evolves. It is deliberately off by default because it produces a LOT
 * of data on long runs.
 */

/** Per-element numeric state captured before/after a tick, for diffing. */
interface ElementValueSnapshot {
  type: GraphElement['type'];
  label: string;
  /** Register value, when the element has one. */
  value?: number;
  /** Resource counts keyed by colour. */
  resources?: Record<string, number>;
}

/** Human label for an element: its `text`, else `Type#id`. */
function labelFor(el: GraphElement): string {
  const text = el.text?.trim();
  return text ? text : `${el.type}#${el.id}`;
}

/**
 * Capture the numeric state of every element keyed by id. Cheap enough to run
 * each tick because we only copy the fields tracing actually compares.
 */
export function snapshotValues(
  elements: GraphElement[]
): Map<number, ElementValueSnapshot> {
  const snapshot = new Map<number, ElementValueSnapshot>();
  for (const el of elements) {
    const entry: ElementValueSnapshot = {
      type: el.type,
      label: labelFor(el),
    };
    if (typeof el.currentValue === 'number') entry.value = el.currentValue;
    if (el.resourcesByColor) entry.resources = { ...el.resourcesByColor };
    snapshot.set(el.id, entry);
  }
  return snapshot;
}

/**
 * Resolve raw transfers into node-attributed flows so the diary can name the
 * nodes a resource moved between (e.g. `Multiplier → XP`) rather than a bare
 * connection id. Endpoints are looked up from the post-tick element list.
 */
function attributeFlows(
  transfers: ResourceTransfer[],
  afterElements: GraphElement[]
): TickTraceFlow[] {
  const byId = new Map<number, GraphElement>(
    afterElements.map(el => [el.id, el])
  );
  const labelById = (id: number | undefined): string => {
    if (id == null) return '?';
    const el = byId.get(id);
    return el ? labelFor(el) : `#${id}`;
  };

  return transfers.map(t => {
    const conn = byId.get(t.connectionId);
    return {
      connectionId: t.connectionId,
      from: labelById(conn?.connectedToStart),
      to: labelById(conn?.connectedToEnd),
      units: t.units,
      color: t.color,
    };
  });
}

/**
 * Build the diary entry for one tick by diffing the before/after snapshots and
 * folding in the (node-attributed) transfers and events the tick produced.
 */
export function buildTraceEntry(
  tick: number,
  activation: TickTraceEntry['activation'],
  before: Map<number, ElementValueSnapshot>,
  afterElements: GraphElement[],
  transfers: ResourceTransfer[],
  events: SimulationEvent[]
): TickTraceEntry {
  const after = snapshotValues(afterElements);
  const changes: TickTraceChange[] = [];

  for (const [id, post] of after) {
    const pre = before.get(id);

    // Register-style value change.
    const beforeValue = pre?.value;
    if (post.value !== undefined && post.value !== beforeValue) {
      const from = beforeValue ?? 0;
      changes.push({
        elementId: id,
        label: post.label,
        type: post.type,
        field: 'value',
        before: from,
        after: post.value,
        delta: post.value - from,
      });
    }

    // Resource (per-colour) changes.
    const colors = new Set<string>([
      ...Object.keys(pre?.resources ?? {}),
      ...Object.keys(post.resources ?? {}),
    ]);
    for (const color of colors) {
      const from = pre?.resources?.[color] ?? 0;
      const to = post.resources?.[color] ?? 0;
      if (from === to) continue;
      changes.push({
        elementId: id,
        label: post.label,
        type: post.type,
        field: 'resource',
        color,
        before: from,
        after: to,
        delta: to - from,
      });
    }
  }

  return {
    tick,
    activation,
    changes,
    flows: attributeFlows(transfers, afterElements),
    events,
  };
}

function signed(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

/** Render one diary entry as human-readable lines (one per change/event). */
export function renderTraceEntry(entry: TickTraceEntry): string[] {
  const prefix = `Tick ${entry.tick}`;
  const lines: string[] = [];

  for (const c of entry.changes) {
    const colorSuffix =
      c.field === 'resource' && c.color ? ` [${c.color}]` : '';
    lines.push(
      `${prefix}  ${c.label}${colorSuffix}: ${c.before} → ${c.after} (${signed(c.delta)})`
    );
  }

  // Attribution: which node moved resources where. Repeated identical flows are
  // shown individually on purpose — that is how "the multiplier fired twice"
  // becomes visible in the diary.
  for (const f of entry.flows) {
    const colorSuffix = f.color ? ` [${f.color}]` : '';
    lines.push(
      `${prefix}    ↳ ${f.from} → ${f.to}: ${signed(f.units)}${colorSuffix}`
    );
  }

  for (const ev of entry.events) {
    if (ev.type === 'game_end') {
      const detail = ev.payload as { message?: string } | undefined;
      lines.push(`${prefix}  GAME END: ${detail?.message ?? 'game over'}`);
    }
  }

  // A tick where nothing observable changed is still worth a line so gaps in
  // the trace are explained rather than mysterious.
  if (lines.length === 0) {
    lines.push(`${prefix}  (no resource or value changes)`);
  }

  return lines;
}

/** Render a whole trace as a single newline-joined block. */
export function renderTrace(entries: TickTraceEntry[]): string {
  return entries.flatMap(renderTraceEntry).join('\n');
}
