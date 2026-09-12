import type { MultipleRunResult, AggregateRow } from './runner';
import { aggregateRuns } from './runner';
import {
  summarize,
  meanInterval,
  wilsonInterval,
  outlierIndicesIQR,
} from './stats';
import type { NumericSummary } from './stats';

/**
 * Turns a Monte Carlo batch into estimates.
 *
 * `runMultiple` samples; this module estimates. It is the only place that knows
 * both what a run is (`./runner`) and how to summarize numbers (`./stats`), so
 * it is where the domain judgement lives:
 *
 *   - **Censored runs are excluded from duration statistics.** A run stopped by
 *     the tick cap reports `ticksElapsed === maxTicks`, which is a floor on how
 *     long it would have taken rather than a measurement of how long it took.
 *     Averaging those in drags every duration estimate downward while making it
 *     look more precise.
 *   - **Every point estimate carries its uncertainty.** Outcome shares get a
 *     Wilson interval and the mean run length a normal-approximation CI, so a
 *     reader can tell a real 60/40 split from twenty runs of noise instead of
 *     guessing whether the batch was large enough.
 *   - **The existing tally is reused, not replaced.** `aggregateRuns` stays the
 *     single source of truth for counts and percentages — this module decorates
 *     its rows rather than counting again.
 *
 * Shared by the CLI report and the UI's Multiple Runs panel so the two can
 * never disagree about the same batch, and available to a future parameter
 * sweep, which needs exactly this to compare one point against another.
 */

/** One outcome's share of the batch, with the uncertainty on that share. */
export interface OutcomeShare extends AggregateRow {
  /** Low end of the 95% Wilson interval for {@link AggregateRow.pct}, as a percentage. */
  ciLow: number;
  /** High end of the 95% Wilson interval for {@link AggregateRow.pct}, as a percentage. */
  ciHigh: number;
}

/** Distribution of one Pool/Register series across the batch. */
export interface MetricSummary {
  /** Series key, e.g. `"Pool#3"`. */
  key: string;
  /** Display name, e.g. `"Gold"`; falls back to {@link key}. */
  label: string;
  summary: NumericSummary;
}

/** A run flagged as a run-length outlier, with the handle needed to replay it. */
export interface OutlierRun {
  /** Index of this run within the batch's `outcomes`. */
  run: number;
  /** The run's measured duration. */
  ticksElapsed: number;
  /**
   * Seed to replay this run with, or `null` when the batch ran unseeded.
   * Replay via `runSimulation(elements, { seed, trace: true })`.
   */
  seed: number | null;
}

export interface BatchReport {
  /** Runs the batch reports having executed. */
  totalRuns: number;
  /** Runs that ended on a real end condition — the measured ones. */
  completedRuns: number;
  /** Runs cut off by the tick cap — censored, not measured. */
  censoredRuns: number;
  /** The tick cap these runs were censored at. */
  maxTicks: number;
  /** Base seed of the batch, or `null` when unseeded (nothing is replayable). */
  seed: number | null;
  /** Outcome distribution, most frequent first, each with its Wilson interval. */
  outcomes: OutcomeShare[];
  /**
   * The naive mean of `ticksElapsed` over **every** run, censored ones
   * included, exactly as `aggregateRuns` computes it.
   *
   * Carried through unchanged so existing readers keep their number, and so the
   * gap between this and `runLength.mean` is visible rather than hidden. On a
   * batch with no censored runs the two agree; where they diverge, this one is
   * biased low and {@link runLength} is the honest figure.
   */
  averageSteps: number;
  /**
   * Run-length statistics over **completed runs only**, or `null` when no run
   * finished — the honest answer in that case rather than a fabricated mean.
   */
  runLength: NumericSummary | null;
  /** 95% CI for the mean run length; `null` alongside {@link runLength}. */
  runLengthCI: [low: number, high: number] | null;
  /** Completed runs whose duration is an outlier by Tukey's rule. */
  runLengthOutliers: OutlierRun[];
  /**
   * Final-state distributions, one per Pool/Register, sorted by key.
   *
   * Sampled across **every** run, censored included. Two common batches are
   * unambiguous: one where every run completed (these are end-of-game values)
   * and one where none did (these are all values at the same fixed horizon,
   * `maxTicks`, which is exactly the right comparison for an open-ended
   * economy model with no end condition). A batch mixing both mixes those two
   * meanings — check {@link censoredRuns} against {@link totalRuns} before
   * reading these too closely.
   */
  metrics: MetricSummary[];
}

/**
 * Build the full report for a finished batch.
 *
 * Pure and synchronous: no engine calls, no randomness. Runs in one pass over
 * the outcomes plus one pass per metric series.
 */
export function buildBatchReport(result: MultipleRunResult): BatchReport {
  const { aggregate, averageSteps } = aggregateRuns(result);

  // Denominator matches the one `aggregateRuns` uses for `pct`, so a row's
  // percentage and its interval can never be computed against different totals.
  const total = result.outcomes.length;

  const outcomes: OutcomeShare[] = aggregate.map(row => {
    const [low, high] = wilsonInterval(row.count, total);
    return { ...row, ciLow: low * 100, ciHigh: high * 100 };
  });

  const completedDurations: number[] = [];
  // Parallel to completedDurations: maps each sample back to its batch index,
  // so an outlier can be traced to the run — and the seed — that produced it.
  const completedRunIndex: number[] = [];

  result.outcomes.forEach((outcome, index) => {
    if (!outcome.completed) return;
    completedDurations.push(outcome.ticksElapsed);
    completedRunIndex.push(index);
  });

  const runLength = summarize(completedDurations);

  const runLengthOutliers: OutlierRun[] = outlierIndicesIQR(
    completedDurations
  ).map(i => {
    const run = completedRunIndex[i];
    return {
      run,
      ticksElapsed: completedDurations[i],
      seed: result.outcomes[run].seed,
    };
  });

  return {
    totalRuns: result.totalRuns,
    completedRuns: completedDurations.length,
    censoredRuns: total - completedDurations.length,
    maxTicks: result.maxTicks,
    seed: result.seed,
    outcomes,
    averageSteps,
    runLength,
    runLengthCI: runLength ? meanInterval(runLength) : null,
    runLengthOutliers,
    metrics: summarizeMetrics(result),
  };
}

/**
 * Pivot per-run metric records into one summary per series.
 *
 * `RunOutcome.metrics` is row-wise — one record per run — while the estimator
 * needs column-wise arrays. Keys are unioned across the batch rather than read
 * from the first run: `runMultiple` emits the same keys every time, but a
 * hand-built or partially-populated batch need not, and a missing key should
 * shrink that series' `n` rather than poison it with `undefined`.
 */
function summarizeMetrics(result: MultipleRunResult): MetricSummary[] {
  const keys = new Set<string>();
  for (const outcome of result.outcomes) {
    for (const key of Object.keys(outcome.metrics)) keys.add(key);
  }

  const summaries: MetricSummary[] = [];
  for (const key of [...keys].sort()) {
    const values: number[] = [];
    for (const outcome of result.outcomes) {
      const value = outcome.metrics[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        values.push(value);
      }
    }

    const summary = summarize(values);
    if (!summary) continue;

    summaries.push({
      key,
      label: result.metricLabels[key] ?? key,
      summary,
    });
  }

  return summaries;
}
