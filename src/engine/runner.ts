import type {
  GraphElement,
  FractionalDispatchState,
  TickResult,
  TickTraceEntry,
} from './types';
import { resetElements } from './reset';
import { simulateTick } from './tick';
import { setSeed } from './rng';
import { mean } from './stats';
import { createStarvationRecorder } from './diagnostics';
import type { StarvationOptions, StarvationResult } from './diagnostics';

/**
 * Default per-run tick cap.
 *
 * Shared by {@link runSimulation} and {@link runMultiple} so a batch can record
 * the cap its runs actually used. That number is the censoring threshold: a run
 * reporting `ticksElapsed === maxTicks` was cut off rather than finished.
 */
export const DEFAULT_MAX_TICKS = 1000;

export interface RunSimulationOptions {
  /** Maximum number of automatic ticks to run (default {@link DEFAULT_MAX_TICKS}). */
  maxTicks?: number;
  /** If true, each TickResult is stored in the returned tickLog (memory cost). */
  collectLog?: boolean;
  /**
   * Optional PRNG seed. When provided, all randomness in the run (converter
   * probabilities, dice gates, trigger chances, register `D` rolls, random AI
   * picks) is drawn from a deterministic stream, so the same model + seed +
   * tick count always produces the same outcome. When omitted, the run uses
   * non-deterministic `Math.random()`.
   */
  seed?: number;
  /**
   * Arm tick tracing for this run. When true, every tick records a
   * human-readable diary of its resource/value changes into `traceLog`.
   *
   * This is a verbose debug mode that produces a LOT of data, so it is off by
   * default and read exactly once at the start of the run — it cannot be toggled
   * mid-run. Pair with `maxTraceTicks` to bound memory on long runs.
   */
  trace?: boolean;
  /**
   * Optional safety cap: stop appending to `traceLog` after this many traced
   * ticks (the simulation itself keeps running). Ignored unless `trace` is true.
   */
  maxTraceTicks?: number;
  /**
   * Optional hook invoked with the element state after every tick, including
   * the onstart tick. Cheap way to observe values as the run progresses
   * without the memory cost of `trace`/`collectLog`. Must not mutate
   * `elements`.
   */
  onTick?: (elements: GraphElement[], tick: number) => void;
}

export interface RunSimulationResult {
  /** Element state after the final tick. */
  finalState: GraphElement[];
  /** Tick-by-tick results (only populated when collectLog is true). */
  tickLog: TickResult[];
  /** Tick-by-tick verbose diary (only populated when trace is true). */
  traceLog: TickTraceEntry[];
  /** Number of ticks actually executed. */
  ticksRun: number;
  /** True if a game-end event triggered early stop. */
  gameEnded: boolean;
  /**
   * Name of the End Condition that triggered the game end, or `null` if the run
   * ended without one (hit `maxTicks`). Derived the same way the Canvas does:
   * the triggered End Condition is the one left `isBlinking` in `finalState`.
   */
  endConditionName: string | null;
}

export interface RunOutcome {
  /** Triggered End Condition name, or `null` if none triggered. */
  endConditionName: string | null;
  /** Number of ticks this run executed before ending. */
  ticksElapsed: number;
  /**
   * True when the run ended because a `game_end` event fired; false when the
   * tick cap cut it off while it was still going.
   *
   * This flag is what separates a measurement from a **censored** observation.
   * For a censored run `ticksElapsed` equals the cap, which is a lower bound on
   * how long the run would have taken rather than how long it took. Estimators
   * that treat the two alike bias every duration statistic downward, so filter
   * on this rather than inferring it from `endConditionName`.
   */
  completed: boolean;
  /**
   * Seed this run executed with, or `null` when the batch ran unseeded.
   *
   * Recorded so a run worth a second look — an outlier, a surprising outcome —
   * can be replayed on its own via
   * `runSimulation(elements, { seed, trace: true })`. Without it a sample is a
   * dead end: you can see that something odd happened but never watch it
   * happen.
   */
  seed: number | null;
  /**
   * Numeric observables sampled from this run's final state, keyed by
   * {@link metricKey} (`"Pool#3"`, `"Register#7"`, …).
   *
   * A batch can only describe the distribution of quantities it actually
   * recorded, and retaining each run's whole `finalState` is far too expensive.
   * This is the fixed-width projection of it that survives the run.
   */
  metrics: Record<string, number>;
  /**
   * Failure-mode verdicts for this run, or `undefined` when the batch didn't
   * request diagnostics. One optional field per detector, so a reader can
   * tell "not checked" apart from "checked, didn't happen."
   */
  diagnostics?: RunDiagnostics;
}

/** Failure-mode verdicts collected for one run. */
export interface RunDiagnostics {
  starvation?: StarvationResult;
}

export interface MultipleRunResult {
  /** Number of runs executed. */
  totalRuns: number;
  /** Per-run outcomes, in run order. */
  outcomes: RunOutcome[];
  /**
   * Base seed the batch ran with, or `null` when unseeded. Run `i` used
   * `seed + i`.
   */
  seed: number | null;
  /** Per-run tick cap the batch ran with — the censoring threshold. */
  maxTicks: number;
  /**
   * Display names for the keys in {@link RunOutcome.metrics}, e.g.
   * `{ "Pool#3": "Gold" }`. Held once per batch rather than once per run.
   */
  metricLabels: Record<string, string>;
}

/**
 * Derive the triggered End Condition name from a finished run's final state.
 *
 * When an End Condition triggers it is left `isBlinking`, and its display name
 * is `text || 'Victory!'`. Returns `null` when no End Condition triggered.
 *
 * Shared by both the headless runner and the Canvas so single/quick/multiple
 * runs all name outcomes identically.
 */
export function getTriggeredEndConditionName(
  elements: GraphElement[]
): string | null {
  const triggered = elements.find(
    e => e.type === 'End Condition' && e.isBlinking
  );
  if (!triggered) return null;
  return triggered.text || 'Victory!';
}

/**
 * Synchronous, headless multi-tick runner.
 *
 * Calls `resetElements` then loops `simulateTick` up to `maxTicks` times.
 * Stops immediately when a `game_end` event is emitted by the tick.
 *
 * This runs entirely in memory — no React, no DOM, no setInterval.
 */
export function runSimulation(
  elements: GraphElement[],
  options: RunSimulationOptions = {}
): RunSimulationResult {
  const {
    maxTicks = DEFAULT_MAX_TICKS,
    collectLog = false,
    seed,
    trace = false,
    onTick,
  } = options;
  const maxTraceTicks = options.maxTraceTicks ?? Infinity;

  const traceLog: TickTraceEntry[] = [];
  // Record a tick's diary entry, respecting the optional safety cap.
  const recordTrace = (result: TickResult): void => {
    if (result.trace && traceLog.length < maxTraceTicks) {
      traceLog.push(result.trace);
    }
  };

  // Seed (or clear) the PRNG before resetting so the run starts from a clean,
  // reproducible random stream. Passing `undefined` restores Math.random().
  setSeed(seed);

  let currentElements = resetElements(elements);

  // Run onstart tick first (mirrors what Canvas does on play)
  const fractionalDispatch = new Map<number, FractionalDispatchState>();
  let currentTick = 0;

  const onStartResult = simulateTick(currentElements, 'onstart', {
    mode: 'onstart',
    currentTick,
    fractionalDispatch,
    trace,
  });
  currentTick += 1;
  currentElements = onStartResult.nextElements;

  const tickLog: TickResult[] = [];
  let ticksRun = 0;
  let gameEnded = false;

  if (collectLog) tickLog.push(onStartResult);
  recordTrace(onStartResult);
  onTick?.(currentElements, currentTick);

  if (onStartResult.events.some(e => e.type === 'game_end')) {
    gameEnded = true;
    return {
      finalState: currentElements,
      tickLog,
      traceLog,
      ticksRun,
      gameEnded,
      endConditionName: getTriggeredEndConditionName(currentElements),
    };
  }

  for (let i = 0; i < maxTicks; i++) {
    const result = simulateTick(currentElements, 'automatic', {
      mode: 'automatic',
      currentTick,
      fractionalDispatch,
      trace,
    });
    currentTick += 1;
    ticksRun += 1;
    currentElements = result.nextElements;
    if (collectLog) tickLog.push(result);
    recordTrace(result);
    onTick?.(currentElements, currentTick);

    if (result.events.some(e => e.type === 'game_end')) {
      gameEnded = true;
      break;
    }
  }

  return {
    finalState: currentElements,
    tickLog,
    traceLog,
    ticksRun,
    gameEnded,
    endConditionName: getTriggeredEndConditionName(currentElements),
  };
}

/** Element types carrying a numeric value worth sampling as an observable. */
const METRIC_TYPES: ReadonlySet<string> = new Set(['Pool', 'Register']);

/**
 * Stable key for one element's metric series, e.g. `"Pool#3"`.
 *
 * Keyed by id rather than by name: names are optional, user-editable and free
 * to collide, while a series has to stay addressable across a whole batch.
 * Matches the `Pool#3` spelling the CLI already uses for final state.
 */
export function metricKey(element: GraphElement): string {
  return `${element.type}#${element.id}`;
}

/**
 * Project a finished run's final state down to its numeric observables.
 *
 * Pools contribute their total `currentPoints` and Registers their
 * `currentValue`, matching how the CLI's single-run summary reports final
 * state, so the same number means the same thing in both views.
 *
 * Shared with the Canvas so a batch driven by the UI records the same series as
 * a headless one.
 */
export function sampleMetrics(
  elements: GraphElement[]
): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const el of elements) {
    if (!METRIC_TYPES.has(el.type)) continue;
    metrics[metricKey(el)] =
      el.type === 'Pool' ? (el.currentPoints ?? 0) : (el.currentValue ?? 0);
  }
  return metrics;
}

/**
 * Display names for every metric series a model can produce, keyed by
 * {@link metricKey}. Falls back to the key itself for unnamed elements.
 *
 * Derived from the input model rather than a run's final state, since the set
 * of elements is fixed for the batch.
 */
export function buildMetricLabels(
  elements: GraphElement[]
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const el of elements) {
    if (!METRIC_TYPES.has(el.type)) continue;
    const key = metricKey(el);
    labels[key] = el.text?.trim() ? el.text.trim() : key;
  }
  return labels;
}

/**
 * Monte Carlo sampler: run the same model `runs` times back-to-back and record
 * one {@link RunOutcome} per replication.
 *
 * This is the headless equivalent of the Canvas "Multiple Runs" feature and
 * reuses {@link runSimulation} so the tick/reset/end-condition logic stays in
 * one place. Each run is fully independent — `runSimulation` resets from
 * `elements` and builds fresh dispatch state — so nothing leaks between
 * iterations and `elements` is only ever read as a template.
 *
 * Seeding: when a `seed` is supplied each run uses `seed + i`, so the whole
 * batch is reproducible while individual runs still vary. When omitted, every
 * run draws from `Math.random()` and the batch cannot be replayed. Two batches
 * sharing a base seed also share their random streams run-for-run, which makes
 * A/B comparisons between model variants far less noisy.
 *
 * This function samples but deliberately does not estimate: it returns raw
 * observations. Note that `ticksElapsed` is a duration only when `completed` is
 * true — see {@link RunOutcome.completed} before averaging it.
 *
 * Cost: synchronous and blocking, with no progress reporting or cancellation,
 * and it retains every outcome in memory. Callers needing a responsive UI drive
 * their own chunked loop instead (as the Canvas does).
 */
export function runMultiple(
  elements: GraphElement[],
  options: {
    runs: number;
    maxTicks?: number;
    seed?: number;
    /**
     * Enable failure-mode detectors for every run in the batch. `true` runs a
     * detector with defaults, an options object tunes it. Off by default.
     */
    diagnostics?: { starvation?: boolean | StarvationOptions };
  }
): MultipleRunResult {
  const { runs, seed, diagnostics } = options;
  // Resolved here rather than left to runSimulation's default so the batch can
  // report the exact cap its runs were censored at.
  const maxTicks = options.maxTicks ?? DEFAULT_MAX_TICKS;
  const outcomes: RunOutcome[] = [];

  const starvationConfig = diagnostics?.starvation;
  const wantsStarvation =
    starvationConfig !== undefined && starvationConfig !== false;
  const starvationOptions: StarvationOptions =
    starvationConfig && starvationConfig !== true ? starvationConfig : {};

  for (let i = 0; i < runs; i++) {
    const runSeed = seed === undefined ? null : seed + i;

    const starvationRecorder = wantsStarvation
      ? createStarvationRecorder(elements, starvationOptions)
      : undefined;

    const result = runSimulation(elements, {
      maxTicks,
      seed: runSeed ?? undefined,
      onTick: starvationRecorder
        ? els => starvationRecorder.observe(els)
        : undefined,
    });

    const runDiagnostics: RunDiagnostics | undefined = starvationRecorder
      ? { starvation: starvationRecorder.finish() }
      : undefined;

    outcomes.push({
      endConditionName: result.endConditionName,
      ticksElapsed: result.ticksRun,
      completed: result.gameEnded,
      seed: runSeed,
      metrics: sampleMetrics(result.finalState),
      diagnostics: runDiagnostics,
    });
  }

  return {
    totalRuns: runs,
    outcomes,
    seed: seed ?? null,
    maxTicks,
    metricLabels: buildMetricLabels(elements),
  };
}

/** One row of the multi-run outcome distribution. */
export interface AggregateRow {
  /** End Condition name, or `UNFINISHED_RUN_LABEL` for runs that never ended. */
  name: string;
  /** How many runs in the batch produced this outcome. */
  count: number;
  /** `count` as a percentage of the batch, 0 when the batch is empty. */
  pct: number;
}

/**
 * Label used for runs that hit `maxTicks` without triggering an End Condition.
 *
 * Exported because the CLI report and the UI's Multiple Runs panel must bucket
 * unfinished runs under the identical name — otherwise the two reports
 * disagree about the same batch.
 */
export const UNFINISHED_RUN_LABEL = 'Stopped before end';

/**
 * Tally a batch of run outcomes into a sorted outcome distribution plus the
 * average number of steps.
 *
 * Rows are sorted by descending count; ties keep first-occurrence order, since
 * `Array.prototype.sort` is stable. An empty batch yields no rows and an
 * average of 0 rather than `NaN`.
 */
export function aggregateRuns(result: MultipleRunResult): {
  aggregate: AggregateRow[];
  averageSteps: number;
} {
  const counts = new Map<string, number>();
  for (const o of result.outcomes) {
    const key = o.endConditionName ?? UNFINISHED_RUN_LABEL;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = result.outcomes.length;
  const aggregate: AggregateRow[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      pct: total ? (count / total) * 100 : 0,
    }));
  // Averaged through the shared Welford helper rather than a local running sum
  // so this figure and the run-length mean in a batch report are the same
  // arithmetic. Two summation orders over the same data can differ in the last
  // bits and print as `8.68` beside `8.67`, which reads as a disagreement
  // between two statistics that are in fact identical. `mean` returns 0 for an
  // empty batch, so there is no divide left to guard.
  const averageSteps = mean(result.outcomes.map(o => o.ticksElapsed));
  return { aggregate, averageSteps };
}
