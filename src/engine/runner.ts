import type {
  GraphElement,
  FractionalDispatchState,
  TickResult,
} from './types';
import { resetElements } from './reset';
import { simulateTick } from './tick';

export interface RunSimulationOptions {
  /** Maximum number of automatic ticks to run (default 1000). */
  maxTicks?: number;
  /** If true, each TickResult is stored in the returned tickLog (memory cost). */
  collectLog?: boolean;
}

export interface RunSimulationResult {
  /** Element state after the final tick. */
  finalState: GraphElement[];
  /** Tick-by-tick results (only populated when collectLog is true). */
  tickLog: TickResult[];
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
  const { maxTicks = 1000, collectLog = false } = options;

  let currentElements = resetElements(elements);

  // Run onstart tick first (mirrors what Canvas does on play)
  const fractionalDispatch = new Map<number, FractionalDispatchState>();
  let currentTick = 0;

  const onStartResult = simulateTick(currentElements, 'onstart', {
    currentTick,
    fractionalDispatch,
  });
  currentTick += 1;
  currentElements = onStartResult.nextElements;

  const tickLog: TickResult[] = [];
  let ticksRun = 0;
  let gameEnded = false;

  if (onStartResult.events.some(e => e.type === 'game_end')) {
    gameEnded = true;
    if (collectLog) tickLog.push(onStartResult);
    return { finalState: currentElements, tickLog, ticksRun, gameEnded };
  }

  for (let i = 0; i < maxTicks; i++) {
    const result = simulateTick(currentElements, 'automatic', {
      currentTick,
      fractionalDispatch,
    });
    currentTick += 1;
    ticksRun += 1;
    currentElements = result.nextElements;
    if (collectLog) tickLog.push(result);

    if (result.events.some(e => e.type === 'game_end')) {
      gameEnded = true;
      break;
    }
  }

  return { finalState: currentElements, tickLog, ticksRun, gameEnded };
}
