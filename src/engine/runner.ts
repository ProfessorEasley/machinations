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
  };
}
