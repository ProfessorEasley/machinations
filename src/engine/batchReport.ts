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
 *   - **Outcomes are measured and judged separately.** Different End
 *     Conditions often finish at different speeds, so each outcome gets its
 *     own run-length summary, and outliers are judged within an outcome — and
 *     only once it has enough runs to judge — never across a mixed batch.
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
 * Fewest completed runs an outcome needs before its run lengths are judged
 * for outliers.
 *
 * Tukey's fences come from the quartiles, and quartiles of a handful of runs
 * are noisy: resampling single-outcome groups from the fixtures, where no run
 * is genuinely anomalous, flagged 2.4–8.5% of runs at 5–10 per group against
 * 1.4–2.6% at 20, close to the large-sample rate. Smaller groups are reported
 * as not checked rather than as clean. `outlierIndicesIQR`'s own floor of four
 * is a mathematical minimum; this is the evidential one, so it lives here.
 */
const MIN_OUTLIER_GROUP_SIZE = 20;

/**
 * Largest share of an outcome's measured runs that one exact run length may
 * hold and still be reported as an outlier.
 *
 * Run lengths are whole ticks, and a coarse outcome can have its quartiles a
 * single step apart; Tukey's fences then fall between two common values and
 * flag every run at the next length out — twelve identical 6-step runs out of
 * 97, say, in a race whose shortest possible length is 6. A length that many
 * runs share is part of the outcome's normal shape, not an anomaly, so such
 * candidates are dropped.
 *
 * Must stay at least `1 / MIN_OUTLIER_GROUP_SIZE`: in the smallest outcome
 * that is judged, one run is exactly that share, and a single extreme run has
 * to remain reportable. Set to that floor, which is the most conservative
 * value — it suppresses the fewest candidates.
 */
const MAX_OUTLIER_VALUE_SHARE = 0.05;

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
   * Whether this outcome's run lengths were judged for outliers: true exactly
   * when it has at least 20 {@link completedRuns}.
   *
   * False means "not checked" — too few runs to judge fairly, or none — which
   * is not the same as "checked and found nothing". A checked outcome whose
   * runs all took the same time is checked, with no outliers.
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
  /**
   * The outcome this run was judged against — the same name as its
   * {@link OutcomeShare.name}. A run is unusual *for that outcome*, not for
   * the batch as a whole.
   */
  outcome: string;
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
  /**
   * Completed runs whose duration is an outlier by Tukey's rule, judged
   * within their own outcome and listed in batch order.
   *
   * Only outcomes with at least 20 completed runs are judged — see
   * {@link OutcomeShare.outliersChecked} — so an empty list does not by itself
   * mean every run looked ordinary.
   */
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
  for (const outcome of result.outcomes) {
    if (outcome.completed) completedDurations.push(outcome.ticksElapsed);
  }

  const groups = groupRunsByOutcome(result);
  const perOutcome = aggregate.map(row => {
    // Every row has a group: both come from the same outcomeKey tally.
    // `measured` holds batch indices parallel to `durations`, so a position
    // flagged within this outcome leads back to its run — and its seed.
    const measured = groups
      .get(row.name)!
      .filter(index => isMeasuredDuration(result.outcomes[index]));
    const durations = measured.map(
      index => result.outcomes[index].ticksElapsed
    );
    const checked = durations.length >= MIN_OUTLIER_GROUP_SIZE;
    return { row, measured, durations, checked };
  });

  const outcomes: OutcomeShare[] = perOutcome.map(
    ({ row, durations, checked }) => {
      const [low, high] = wilsonInterval(row.count, total);
      const runLength = summarizeForReport(durations);
      return {
        ...row,
        ciLow: low * 100,
        ciHigh: high * 100,
        completedRuns: durations.length,
        runLength,
        runLengthCI: runLength ? meanInterval(runLength) : null,
        outliersChecked: checked,
      };
    }
  );

  const runLength = summarizeForReport(completedDurations);

  // Each outcome is judged against its own runs only: pooled, a minority
  // outcome that is merely slower than the rest gets flagged wholesale.
  const runLengthOutliers: OutlierRun[] = perOutcome
    .flatMap(({ row, measured, durations, checked }) =>
      checked
        ? outlierPositions(durations).map(i => ({
            run: measured[i],
            ticksElapsed: durations[i],
            seed: result.outcomes[measured[i]].seed,
            outcome: row.name,
          }))
        : []
    )
    // Outcomes are visited most frequent first; list flags in batch order so
    // the result does not depend on how the outcomes happen to rank.
    .sort((a, b) => a.run - b.run);

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

/**
 * Positions of the outliers within one outcome's run lengths.
 *
 * Tukey's rule proposes the candidates; any candidate whose exact run length
 * is common within this outcome — more than {@link MAX_OUTLIER_VALUE_SHARE}
 * of its runs — is then dropped. Frequency is counted within the outcome, as
 * the fences were, never across the batch.
 */
function outlierPositions(durations: number[]): number[] {
  const candidates = outlierIndicesIQR(durations);
  if (candidates.length === 0) return candidates;

  const frequency = new Map<number, number>();
  for (const d of durations) frequency.set(d, (frequency.get(d) ?? 0) + 1);
  return candidates.filter(
    i =>
      frequency.get(durations[i])! / durations.length <= MAX_OUTLIER_VALUE_SHARE
  );
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
