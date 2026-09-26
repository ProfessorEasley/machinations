import type { MultipleRunResult } from './runner';
import { wilsonInterval } from './stats';

/**
 * Turns per-run failure-mode verdicts into batch-level incidence — how often
 * a failure mode occurred, with a Wilson interval on that rate.
 *
 * Kept separate from the outcome report: a run can complete on a real end
 * condition and still have starved a Pool along the way, or get censored by
 * the tick cap while staying healthy throughout. One says what happened;
 * this says whether the economy stayed healthy while it did.
 */

/** One Pool's starvation incidence across a batch. */
export interface PoolStarvationFrequency {
  /** Stable key, e.g. `"Pool#3"`. */
  key: string;
  label: string;
  /** Runs (of those diagnosed) in which this Pool starved. */
  starvedRuns: number;
  /** `starvedRuns / runsObserved`, as a percentage. */
  pct: number;
  /** Low end of the 95% Wilson interval for {@link pct}. */
  ciLow: number;
  /** High end of the 95% Wilson interval for {@link pct}. */
  ciHigh: number;
}

/** Batch-level starvation incidence. */
export interface StarvationBatchReport {
  /** Runs the batch actually ran the starvation detector on. */
  runsObserved: number;
  /** Of those, runs where at least one tracked Pool starved. */
  starvedRuns: number;
  /** `starvedRuns / runsObserved`, as a percentage. */
  pct: number;
  /** Low end of the 95% Wilson interval for {@link pct}. */
  ciLow: number;
  /** High end of the 95% Wilson interval for {@link pct}. */
  ciHigh: number;
  /** Per-pool breakdown, most-frequently-starved first. */
  byPool: PoolStarvationFrequency[];
}

export interface DiagnosticReport {
  /** `null` when no run in the batch carried starvation diagnostics. */
  starvation: StarvationBatchReport | null;
}

/**
 * Build the failure-mode incidence report for a finished batch. Pure and
 * synchronous. Only runs carrying a starvation verdict count toward
 * {@link StarvationBatchReport.runsObserved}, so a partially-diagnosed batch
 * doesn't mix denominators.
 */
export function buildDiagnosticReport(
  result: MultipleRunResult
): DiagnosticReport {
  return {
    starvation: buildStarvationReport(result),
  };
}

function buildStarvationReport(
  result: MultipleRunResult
): StarvationBatchReport | null {
  const diagnosed = result.outcomes.filter(o => o.diagnostics?.starvation);
  const runsObserved = diagnosed.length;
  if (runsObserved === 0) return null;

  const starvedRuns = diagnosed.filter(
    o => o.diagnostics!.starvation!.starved
  ).length;
  const [ciLow, ciHigh] = wilsonInterval(starvedRuns, runsObserved);

  const poolTally = new Map<string, { label: string; starvedRuns: number }>();
  for (const o of diagnosed) {
    for (const pool of o.diagnostics!.starvation!.pools) {
      const entry = poolTally.get(pool.key) ?? {
        label: pool.label,
        starvedRuns: 0,
      };
      if (pool.starved) entry.starvedRuns += 1;
      poolTally.set(pool.key, entry);
    }
  }

  const byPool: PoolStarvationFrequency[] = [...poolTally.entries()]
    .map(([key, entry]) => {
      const [low, high] = wilsonInterval(entry.starvedRuns, runsObserved);
      return {
        key,
        label: entry.label,
        starvedRuns: entry.starvedRuns,
        pct: (entry.starvedRuns / runsObserved) * 100,
        ciLow: low * 100,
        ciHigh: high * 100,
      };
    })
    // Most-frequently-starved first; ties keep the stable key order above so
    // output doesn't jitter between otherwise-identical batches.
    .sort((a, b) => b.starvedRuns - a.starvedRuns);

  return {
    runsObserved,
    starvedRuns,
    pct: (starvedRuns / runsObserved) * 100,
    ciLow: ciLow * 100,
    ciHigh: ciHigh * 100,
    byPool,
  };
}
