import type {
  GraphElement,
  FractionalDispatchState,
  TickResult,
  TickTraceEntry,
} from './types';
import { resetElements } from './reset';
import { simulateTick } from './tick';
import { setSeed } from './rng';

export interface RunSimulationOptions {
  /** Maximum number of automatic ticks to run (default 1000). */
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
}

export interface MultipleRunResult {
  /** Number of runs executed. */
  totalRuns: number;
  /** Per-run outcomes, in run order. */
  outcomes: RunOutcome[];
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
  const { maxTicks = 1000, collectLog = false, seed, trace = false } = options;
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

/**
 * Run the same model `runs` times back-to-back and collect the per-run
 * outcome (which End Condition triggered, and how many ticks it took).
 *
 * This is the headless equivalent of the Canvas "Multiple Runs" feature and
 * reuses {@link runSimulation} so the tick/reset/end-condition logic stays in
 * one place.
 *
 * Seeding: when a `seed` is supplied each run uses `seed + i`, so the whole
 * batch is reproducible while individual runs still vary. When omitted, every
 * run draws from `Math.random()`.
 */
export function runMultiple(
  elements: GraphElement[],
  options: { runs: number; maxTicks?: number; seed?: number }
): MultipleRunResult {
  const { runs, maxTicks, seed } = options;
  const outcomes: RunOutcome[] = [];

  for (let i = 0; i < runs; i++) {
    const result = runSimulation(elements, {
      maxTicks,
      seed: seed === undefined ? undefined : seed + i,
    });
    outcomes.push({
      endConditionName: result.endConditionName,
      ticksElapsed: result.ticksRun,
    });
  }

  return { totalRuns: runs, outcomes };
}
