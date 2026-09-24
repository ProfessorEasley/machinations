import type { MultipleRunResult, AggregateRow, RunOutcome } from './runner';
import { aggregateRuns, outcomeKey } from './runner';
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

/**
 * The percentiles every summary in a report carries — run length, pooled and
 * per outcome, and every metric series.
 *
 * Chosen here, once, rather than by each consumer: the CLI, the Run panel and
 * an export all read from the same list, so none of them can ask for a
 * percentile the report never computed. Presentation picks from this set; it
 * does not define it.
 */
export const REPORT_PERCENTILES = [
  0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99,
] as const;

/**
 * Smallest sample `outlierIndicesIQR` will judge; below it the function
 * declines and returns no outliers. Mirrored here only to report, per
 * outcome, whether the pooled check actually ran — see
 * {@link OutcomeShare.outliersChecked}.
 */
const IQR_MIN_SAMPLE = 4;

/**
 * One outcome's share of the batch, with the uncertainty on that share, plus
 * the run-length statistics of that outcome alone.
 */
export interface OutcomeShare extends AggregateRow {
  /** Low end of the 95% Wilson interval for {@link AggregateRow.pct}, as a percentage. */
  ciLow: number;
  /** High end of the 95% Wilson interval for {@link AggregateRow.pct}, as a percentage. */
  ciHigh: number;
  /**
   * Runs of this outcome whose duration is a measurement: completed, and
   * ended by a named End Condition. The measurable subset of
   * {@link AggregateRow.count}; 0 for the `Stopped before end` outcome, whose
   * runs were all cut off.
   */
  completedRuns: number;
  /**
   * Run length over this outcome's {@link completedRuns} only, or `null` when
   * it has none. Unlike the pooled {@link BatchReport.runLength}, this never
   * mixes outcomes that finish at different speeds.
   */
  runLength: NumericSummary | null;
  /**
   * 95% CI for this outcome's mean run length; `null` alongside
   * {@link runLength}.
   */
  runLengthCI: [low: number, high: number] | null;
  /**
   * Whether this outcome's completed runs went through outlier detection.
   *
   * Detection currently runs once over the pooled completed runs, so this is
   * true when the outcome has completed runs and the pooled sample was large
   * enough for Tukey's rule to judge. False means "not checked", which is not
   * the same as "checked and found nothing".
   */
  outliersChecked: boolean;
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
 * Pure and synchronous: no engine calls, no randomness, and `result` is only
 * read. A few linear passes over the outcomes (tally, pooled durations,
 * outcome grouping) plus one pass per metric series.
 */
export function buildBatchReport(result: MultipleRunResult): BatchReport {
  const { aggregate, averageSteps } = aggregateRuns(result);

  // Denominator matches the one `aggregateRuns` uses for `pct`, so a row's
  // percentage and its interval can never be computed against different totals.
  const total = result.outcomes.length;

  const completedDurations: number[] = [];
  // Parallel to completedDurations: maps each sample back to its batch index,
  // so an outlier can be traced to the run — and the seed — that produced it.
  const completedRunIndex: number[] = [];

  result.outcomes.forEach((outcome, index) => {
    if (!outcome.completed) return;
    completedDurations.push(outcome.ticksElapsed);
    completedRunIndex.push(index);
  });

  // Outlier detection below runs once over every completed run, so an
  // outcome's runs were examined exactly when that pooled sample was judged.
  const pooledOutlierCheckRan = completedDurations.length >= IQR_MIN_SAMPLE;

  const groups = groupRunsByOutcome(result);
  const outcomes: OutcomeShare[] = aggregate.map(row => {
    const [low, high] = wilsonInterval(row.count, total);
    // Every row has a group: both come from the same outcomeKey tally.
    const durations = groups
      .get(row.name)!
      .filter(index => isMeasuredDuration(result.outcomes[index]))
      .map(index => result.outcomes[index].ticksElapsed);
    const runLength = summarizeForReport(durations);
    return {
      ...row,
      ciLow: low * 100,
      ciHigh: high * 100,
      completedRuns: durations.length,
      runLength,
      runLengthCI: runLength ? meanInterval(runLength) : null,
      outliersChecked: durations.length > 0 && pooledOutlierCheckRan,
    };
  });

  const runLength = summarizeForReport(completedDurations);

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
 * Batch run indices grouped by outcome, in `aggregateRuns` row order: most
 * frequent first, ties in order of first appearance.
 *
 * Indices rather than values, for the same reason `outlierIndicesIQR` returns
 * them: an index leads back to the run, and so to the seed that replays it.
 * Every run lands in exactly one group, keyed by the same {@link outcomeKey}
 * the tally uses. The order is taken from `aggregateRuns` itself rather than
 * sorted again here, so the two cannot drift apart.
 *
 * This is outcome grouping — which population a run belongs to. It is
 * unrelated to `histogram` in `./stats`, which buckets numbers by value.
 */
export function groupRunsByOutcome(
  result: MultipleRunResult
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const row of aggregateRuns(result).aggregate) groups.set(row.name, []);
  result.outcomes.forEach((outcome, index) => {
    groups.get(outcomeKey(outcome))!.push(index);
  });
  return groups;
}

/**
 * Whether a run's `ticksElapsed` is a duration worth measuring under its
 * outcome: it completed, and a named End Condition says what it completed as.
 *
 * `runMultiple` never produces a completed run without a name — the engine
 * only ends a game by firing an End Condition. A hand-built batch can, and
 * such a run lands in the `Stopped before end` group, whose durations must all
 * stay floors; counting it there would invent a measured duration for runs
 * that, by that label, never finished.
 */
function isMeasuredDuration(outcome: RunOutcome): boolean {
  return outcome.completed && outcome.endConditionName !== null;
}

/** Every report summary goes through here, with {@link REPORT_PERCENTILES}. */
function summarizeForReport(xs: number[]): NumericSummary | null {
  return summarize(xs, { percentiles: REPORT_PERCENTILES });
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

    const summary = summarizeForReport(values);
    if (!summary) continue;

    summaries.push({
      key,
      label: result.metricLabels[key] ?? key,
      summary,
    });
  }

  return summaries;
}
