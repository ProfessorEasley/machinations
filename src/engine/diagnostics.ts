import type { GraphElement } from './types';

/**
 * Economic failure-mode detectors.
 *
 * Watches the tick-by-tick trajectory of a run (values at the end alone can't
 * tell a Pool that sat at 0 for 400 ticks from one that never went dry) and
 * classifies runs against specific failure modes.
 *
 * Starvation / dead economy is the first detector. Every mode follows the
 * same recorder shape: observe per tick, finish once.
 */

/** Element types a starvation recorder tracks — resource-holding Pools. */
const TRACKED_TYPE = 'Pool';

export interface StarvationOptions {
  /** A Pool at or below this value counts as "empty" this tick. Default 0. */
  threshold?: number;
  /**
   * Minimum consecutive empty ticks before a Pool counts as starved. Guards
   * against a normal one-tick drain being misread as a dead economy.
   * Default 5.
   */
  minConsecutiveTicks?: number;
}

/** One Pool's empty-tick trajectory over a run. */
export interface PoolStarvation {
  /** Stable key, e.g. `"Pool#3"`. */
  key: string;
  /** Display name; falls back to {@link key}. */
  label: string;
  /** Ticks this Pool was observed (onstart tick plus every automatic tick). */
  ticksObserved: number;
  /** Of those, how many had the Pool at or below the empty threshold. */
  ticksEmpty: number;
  /** Longest unbroken run of empty ticks anywhere in the run. */
  longestEmptyStreak: number;
  /** `longestEmptyStreak >= minConsecutiveTicks`. */
  starved: boolean;
}

/** Starvation verdict for one run. */
export interface StarvationResult {
  /** True if any tracked Pool starved. */
  starved: boolean;
  /** Every tracked Pool, sorted by key, starved or not. */
  pools: PoolStarvation[];
}

interface PoolAccumulator {
  label: string;
  ticksObserved: number;
  ticksEmpty: number;
  currentStreak: number;
  longestStreak: number;
}

/** Live per-run accumulator; feed it ticks, then read the verdict once. */
export interface StarvationRecorder {
  /** Call with the element state after every tick, in tick order. */
  observe(elements: readonly GraphElement[]): void;
  /** Settle the accumulated ticks into a {@link StarvationResult}. Idempotent. */
  finish(): StarvationResult;
}

/**
 * Start a fresh starvation recorder for one run.
 *
 * Seeded from the template `elements` so a Pool empty for the whole run still
 * appears in the result, rather than being silently missing because it never
 * changed. O(1) memory per tracked Pool — running counters, not a history.
 */
export function createStarvationRecorder(
  elements: readonly GraphElement[],
  options: StarvationOptions = {}
): StarvationRecorder {
  const threshold = options.threshold ?? 0;
  const minConsecutiveTicks = options.minConsecutiveTicks ?? 5;

  const pools = new Map<string, PoolAccumulator>();
  const seed = (el: GraphElement): PoolAccumulator => {
    const key = `${TRACKED_TYPE}#${el.id}`;
    let entry = pools.get(key);
    if (!entry) {
      entry = {
        label: el.text?.trim() ? el.text.trim() : key,
        ticksObserved: 0,
        ticksEmpty: 0,
        currentStreak: 0,
        longestStreak: 0,
      };
      pools.set(key, entry);
    }
    return entry;
  };

  for (const el of elements) {
    if (el.type === TRACKED_TYPE) seed(el);
  }

  function observe(tickElements: readonly GraphElement[]): void {
    for (const el of tickElements) {
      if (el.type !== TRACKED_TYPE) continue;
      const entry = seed(el);
      entry.ticksObserved += 1;
      if ((el.currentPoints ?? 0) <= threshold) {
        entry.ticksEmpty += 1;
        entry.currentStreak += 1;
        if (entry.currentStreak > entry.longestStreak) {
          entry.longestStreak = entry.currentStreak;
        }
      } else {
        entry.currentStreak = 0;
      }
    }
  }

  function finish(): StarvationResult {
    const result: PoolStarvation[] = [...pools.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, e]) => ({
        key,
        label: e.label,
        ticksObserved: e.ticksObserved,
        ticksEmpty: e.ticksEmpty,
        longestEmptyStreak: e.longestStreak,
        starved: e.longestStreak >= minConsecutiveTicks,
      }));

    return {
      starved: result.some(p => p.starved),
      pools: result,
    };
  }

  return { observe, finish };
}
