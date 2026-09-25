import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
  buildBatchReport,
  groupRunsByOutcome,
  REPORT_PERCENTILES,
} from '../batchReport';
import type { BatchReport, OutcomeShare } from '../batchReport';
import {
  runMultiple,
  aggregateRuns,
  outcomeKey,
  UNFINISHED_RUN_LABEL,
} from '../runner';
import type { MultipleRunResult, RunOutcome } from '../runner';
import { summarize, lookupPercentile, outlierIndicesIQR } from '../stats';
import type { NumericSummary } from '../stats';
import { loadGraphFromFile } from '../io';

/**
 * Contract tests for the shared estimator behind both the CLI report and the
 * Run panel.
 *
 * The rule with the most riding on it is the censoring split: a run stopped by
 * the tick cap reports `ticksElapsed === maxTicks`, which is a floor on its
 * duration rather than a measurement. Averaging those in with real durations
 * biases every timing figure downward while making it look more precise, so
 * they are counted separately and excluded. Most cases below use small
 * hand-built batches so the expected numbers are obvious by inspection.
 */

type OutcomeFixture = Pick<RunOutcome, 'endConditionName' | 'ticksElapsed'> &
  Partial<RunOutcome>;

/** Build a batch without running a model; `completed` defaults from the outcome. */
const batchOf = (
  outcomes: OutcomeFixture[],
  batch: Partial<MultipleRunResult> = {}
): MultipleRunResult => ({
  totalRuns: outcomes.length,
  outcomes: outcomes.map((o, i) => ({
    completed: o.endConditionName !== null,
    seed: 100 + i,
    metrics: {},
    ...o,
  })),
  seed: 100,
  maxTicks: 1000,
  metricLabels: {},
  ...batch,
});

describe('engine/batchReport — censoring', () => {
  it('excludes censored runs from the run-length statistics', () => {
    // A 2-step run and a run cut off at 100. Including the second would report
    // a mean of 51, which describes neither run.
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 2 },
        { endConditionName: null, ticksElapsed: 100 },
      ])
    );

    expect(report.completedRuns).toBe(1);
    expect(report.censoredRuns).toBe(1);
    expect(report.runLength!.n).toBe(1);
    expect(report.runLength!.mean).toBe(2);
  });

  it('still reports averageSteps over every run, censored included', () => {
    // The legacy headline figure is deliberately left alone; the run-length
    // block is the censoring-aware one. Both appear in the report.
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 2 },
        { endConditionName: null, ticksElapsed: 100 },
      ])
    );

    expect(report.averageSteps).toBe(51);
    expect(report.runLength!.mean).toBe(2);
  });

  it('reports no run-length estimate when every run was censored', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: null, ticksElapsed: 50 },
        { endConditionName: null, ticksElapsed: 50 },
        { endConditionName: null, ticksElapsed: 50 },
      ])
    );

    // Declines to invent a mean rather than reporting the cap as a duration.
    expect(report.runLength).toBeNull();
    expect(report.runLengthCI).toBeNull();
    expect(report.runLengthOutliers).toEqual([]);
    expect(report.completedRuns).toBe(0);
    expect(report.censoredRuns).toBe(3);
  });

  it('counts completed and censored runs correctly in a mixed batch', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 10 },
        { endConditionName: null, ticksElapsed: 99 },
        { endConditionName: 'Lose', ticksElapsed: 12 },
        { endConditionName: null, ticksElapsed: 99 },
        { endConditionName: 'Win', ticksElapsed: 14 },
      ])
    );

    expect(report.totalRuns).toBe(5);
    expect(report.completedRuns).toBe(3);
    expect(report.censoredRuns).toBe(2);
    expect(report.completedRuns + report.censoredRuns).toBe(report.totalRuns);
    expect(report.runLength!.mean).toBe(12);
  });

  it('carries the batch cap and seed through for the censoring note', () => {
    const report = buildBatchReport(
      batchOf([{ endConditionName: null, ticksElapsed: 7 }], {
        maxTicks: 7,
        seed: 42,
      })
    );

    expect(report.maxTicks).toBe(7);
    expect(report.seed).toBe(42);
  });

  it('handles an empty batch without inventing anything', () => {
    const report = buildBatchReport(batchOf([]));

    expect(report.totalRuns).toBe(0);
    expect(report.completedRuns).toBe(0);
    expect(report.censoredRuns).toBe(0);
    expect(report.runLength).toBeNull();
    expect(report.outcomes).toEqual([]);
    expect(report.metrics).toEqual([]);
    expect(report.averageSteps).toBe(0);
  });
});

describe('engine/batchReport — run-length interval', () => {
  it('produces an interval centred on the mean', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 10 },
        { endConditionName: 'Win', ticksElapsed: 12 },
        { endConditionName: 'Win', ticksElapsed: 14 },
        { endConditionName: 'Win', ticksElapsed: 16 },
      ])
    );

    const [low, high] = report.runLengthCI!;
    expect((low + high) / 2).toBeCloseTo(report.runLength!.mean, 12);
    expect(low).toBeLessThan(report.runLength!.mean);
    expect(high).toBeGreaterThan(report.runLength!.mean);
  });

  it('collapses to a point when every completed run agreed', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 9 },
        { endConditionName: 'Win', ticksElapsed: 9 },
        { endConditionName: 'Win', ticksElapsed: 9 },
      ])
    );

    expect(report.runLengthCI).toEqual([9, 9]);
    expect(report.runLength!.stdDev).toBe(0);
  });

  it('narrows roughly as 1/sqrt(n) as the batch grows', () => {
    // Same distribution, four times the runs: the interval should halve. This
    // is the property that tells a reader whether --runs was large enough.
    const pattern = [10, 12, 14, 16];
    const make = (repeats: number) =>
      batchOf(
        Array.from({ length: repeats * pattern.length }, (_, i) => ({
          endConditionName: 'Win',
          ticksElapsed: pattern[i % pattern.length],
        }))
      );

    const widthOf = (r: MultipleRunResult) => {
      const [low, high] = buildBatchReport(r).runLengthCI!;
      return high - low;
    };

    const small = widthOf(make(4)); // n = 16
    const large = widthOf(make(64)); // n = 256, 16x the runs

    expect(large).toBeLessThan(small);
    // 16x the sample should shrink the interval by about 4x.
    expect(small / large).toBeGreaterThan(3.5);
    expect(small / large).toBeLessThan(4.5);
  });
});

describe('engine/batchReport — outcome aggregation', () => {
  it('reports counts and shares per outcome, most frequent first', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 5 },
        { endConditionName: 'Lose', ticksElapsed: 5 },
        { endConditionName: 'Win', ticksElapsed: 5 },
        { endConditionName: 'Win', ticksElapsed: 5 },
      ])
    );

    expect(report.outcomes.map(o => o.name)).toEqual(['Win', 'Lose']);
    expect(report.outcomes[0].count).toBe(3);
    expect(report.outcomes[0].pct).toBe(75);
    expect(report.outcomes[1].count).toBe(1);
    expect(report.outcomes[1].pct).toBe(25);
  });

  it('buckets censored runs under the shared unfinished label', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: null, ticksElapsed: 99 },
        { endConditionName: 'Win', ticksElapsed: 5 },
      ])
    );

    const unfinished = report.outcomes.find(
      o => o.name === UNFINISHED_RUN_LABEL
    );
    expect(unfinished?.count).toBe(1);
  });

  it('attaches a Wilson interval that brackets each share', () => {
    const report = buildBatchReport(
      batchOf(
        Array.from({ length: 100 }, (_, i) => ({
          endConditionName: i < 61 ? 'Win' : 'Lose',
          ticksElapsed: 5,
        }))
      )
    );

    const win = report.outcomes.find(o => o.name === 'Win')!;
    expect(win.pct).toBe(61);
    expect(win.ciLow).toBeLessThan(61);
    expect(win.ciHigh).toBeGreaterThan(61);
    // Reported as percentages, matching `pct`, not as 0..1 proportions.
    expect(win.ciLow).toBeGreaterThan(1);
    expect(win.ciHigh).toBeLessThan(100);
  });

  it('gives a zero-count outcome an honest upper bound', () => {
    // A share of 0% must not be reported as a certainty.
    const report = buildBatchReport(
      batchOf(
        Array.from({ length: 20 }, () => ({
          endConditionName: 'Only',
          ticksElapsed: 5,
        }))
      )
    );

    const only = report.outcomes[0];
    expect(only.pct).toBe(100);
    expect(only.ciLow).toBeLessThan(100);
    expect(only.ciHigh).toBe(100);
  });
});

describe('engine/batchReport — metric pivot', () => {
  it('pivots per-run metric records into one summary per series', () => {
    // Metrics arrive row-wise (one record per run); the estimator needs them
    // column-wise (one array per series).
    const report = buildBatchReport(
      batchOf(
        [
          {
            endConditionName: 'Win',
            ticksElapsed: 5,
            metrics: { 'Pool#1': 10, 'Pool#2': 1 },
          },
          {
            endConditionName: 'Win',
            ticksElapsed: 5,
            metrics: { 'Pool#1': 20, 'Pool#2': 3 },
          },
          {
            endConditionName: 'Win',
            ticksElapsed: 5,
            metrics: { 'Pool#1': 30, 'Pool#2': 5 },
          },
        ],
        { metricLabels: { 'Pool#1': 'Gold', 'Pool#2': 'Lives' } }
      )
    );

    expect(report.metrics.map(m => m.key)).toEqual(['Pool#1', 'Pool#2']);

    const gold = report.metrics.find(m => m.key === 'Pool#1')!;
    expect(gold.label).toBe('Gold');
    expect(gold.summary.n).toBe(3);
    expect(gold.summary.mean).toBe(20);
    expect(gold.summary.min).toBe(10);
    expect(gold.summary.max).toBe(30);

    const lives = report.metrics.find(m => m.key === 'Pool#2')!;
    expect(lives.summary.mean).toBe(3);
  });

  it('falls back to the key when no label was recorded', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 5, metrics: { 'Pool#9': 1 } },
      ])
    );

    expect(report.metrics[0].label).toBe('Pool#9');
  });

  it('samples metrics across every run, censored included', () => {
    // Unlike durations, a censored run's final value is a real reading at a
    // fixed horizon — and a model with no End Condition censors every run, so
    // restricting to completed ones would leave it with no metrics at all.
    const report = buildBatchReport(
      batchOf([
        { endConditionName: null, ticksElapsed: 50, metrics: { 'Pool#1': 4 } },
        { endConditionName: null, ticksElapsed: 50, metrics: { 'Pool#1': 6 } },
      ])
    );

    expect(report.runLength).toBeNull();
    expect(report.metrics[0].summary.n).toBe(2);
    expect(report.metrics[0].summary.mean).toBe(5);
  });

  it('shrinks a series n rather than poisoning it when a key is absent', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 5, metrics: { 'Pool#1': 10 } },
        { endConditionName: 'Win', ticksElapsed: 5, metrics: {} },
        { endConditionName: 'Win', ticksElapsed: 5, metrics: { 'Pool#1': 20 } },
      ])
    );

    expect(report.metrics[0].summary.n).toBe(2);
    expect(report.metrics[0].summary.mean).toBe(15);
  });

  it('reports no metric rows when nothing was sampled', () => {
    const report = buildBatchReport(
      batchOf([{ endConditionName: 'Win', ticksElapsed: 5 }])
    );

    expect(report.metrics).toEqual([]);
  });
});

describe('engine/batchReport — outliers', () => {
  // Outliers are only judged for outcomes with at least 20 completed runs, so
  // every sample here is at least that big. `tight(n)` is n run lengths drawn
  // from a narrow 10–13 band, which Tukey's fences comfortably contain.
  const band = [10, 11, 12, 13, 12, 11, 10, 12];
  const tight = (n: number) =>
    Array.from({ length: n }, (_, i) => band[i % band.length]);
  const wins = (lengths: number[]) =>
    lengths.map(t => ({ endConditionName: 'Win', ticksElapsed: t }));

  it('reports no outliers when every run took the same time', () => {
    // Zero IQR: a deterministic model must not flag all of its runs. Twenty
    // runs, so this outcome was checked and found nothing — not skipped.
    const report = buildBatchReport(batchOf(wins(Array(20).fill(20))));

    expect(report.runLength!.stdDev).toBe(0);
    expect(report.outcomes[0].outliersChecked).toBe(true);
    expect(report.runLengthOutliers).toEqual([]);
  });

  it('reports no outliers for a tightly grouped batch', () => {
    const report = buildBatchReport(batchOf(wins(tight(24))));

    expect(report.outcomes[0].outliersChecked).toBe(true);
    expect(report.runLengthOutliers).toEqual([]);
  });

  it('reports a run-length outlier with its batch index, seed and length', () => {
    const report = buildBatchReport(batchOf(wins([...tight(23), 999])));

    expect(report.runLengthOutliers).toHaveLength(1);
    const [outlier] = report.runLengthOutliers;
    expect(outlier.run).toBe(23); // batch index, not sorted position
    expect(outlier.ticksElapsed).toBe(999);
    expect(outlier.seed).toBe(123); // batchOf seeds runs as 100 + index
    expect(outlier.outcome).toBe('Win');
  });

  it('indexes outliers against the batch, not against completed runs only', () => {
    // Censored runs sit between the completed ones here, so an index into the
    // completed subset — or into the outcome's own runs — would point at the
    // wrong run, and hand back the wrong seed to replay.
    const [first, ...rest] = tight(23);
    const report = buildBatchReport(
      batchOf([
        { endConditionName: null, ticksElapsed: 500 },
        { endConditionName: 'Win', ticksElapsed: first },
        { endConditionName: null, ticksElapsed: 500 },
        ...wins(rest),
        { endConditionName: 'Win', ticksElapsed: 999 },
      ])
    );

    expect(report.runLengthOutliers).toHaveLength(1);
    const [outlier] = report.runLengthOutliers;
    expect(outlier.run).toBe(25); // 23rd among the Win runs, 25th in the batch
    expect(outlier.ticksElapsed).toBe(999);
    expect(outlier.seed).toBe(125);
  });

  it('carries a null seed through from an unseeded batch', () => {
    const report = buildBatchReport(
      batchOf(
        wins([...tight(23), 999]).map(o => ({ ...o, seed: null })),
        { seed: null }
      )
    );

    expect(report.runLengthOutliers).toHaveLength(1);
    expect(report.runLengthOutliers[0].seed).toBeNull();
  });

  it('judges an outcome only once it has 20 completed runs', () => {
    // Both groups hold one obvious outlier. With 19 runs, quartiles are too
    // noisy to trust, so the outcome is reported as not checked rather than as
    // clean; at 20 the same outlier is flagged.
    const nineteen = [...tight(18), 999];
    expect(outlierIndicesIQR(nineteen)).toEqual([18]); // flaggable in principle
    const under = buildBatchReport(batchOf(wins(nineteen)));
    expect(under.outcomes[0].completedRuns).toBe(19);
    expect(under.outcomes[0].outliersChecked).toBe(false);
    expect(under.runLengthOutliers).toEqual([]);

    // At 20 the lone 999 is exactly 5% of the outcome — the most a run length
    // may hold and still be reported — so a single run is always reportable.
    const at = buildBatchReport(batchOf(wins([...tight(19), 999])));
    expect(at.outcomes[0].completedRuns).toBe(20);
    expect(at.outcomes[0].outliersChecked).toBe(true);
    expect(at.runLengthOutliers.map(o => o.run)).toEqual([19]);
  });
});

describe('engine/batchReport — outliers judged per outcome', () => {
  // 180 Fast runs of 18–22 steps and 20 Slow runs of 198–202: every tenth run
  // is Slow. Each outcome is tight on its own; only the mix is spread out.
  const mixed = (overrides: Record<number, number> = {}) =>
    batchOf(
      Array.from({ length: 200 }, (_, i) => {
        const slow = i % 10 === 9;
        const ticks = slow ? 198 + (Math.floor(i / 10) % 5) : 18 + (i % 5);
        return {
          endConditionName: slow ? 'Slow' : 'Fast',
          ticksElapsed: overrides[i] ?? ticks,
        };
      })
    );

  it('does not flag a whole outcome for being slower than the rest', () => {
    const batch = mixed();

    // Pooled — the behaviour this replaces — both quartiles fall among the
    // Fast runs, so the upper fence sits near 24 steps and every Slow run is
    // "unusual", though each is an ordinary Slow run.
    const pooled = outlierIndicesIQR(batch.outcomes.map(o => o.ticksElapsed));
    expect(pooled).toHaveLength(20);
    for (const i of pooled) {
      expect(batch.outcomes[i].endConditionName).toBe('Slow');
    }

    // Judged within each outcome, nothing stands out.
    const report = buildBatchReport(batch);
    expect(report.outcomes.every(o => o.outliersChecked)).toBe(true);
    expect(report.runLengthOutliers).toEqual([]);
  });

  it('still flags a run that is unusual for its own outcome', () => {
    // Run 150 is Fast but took 90 steps: ordinary next to the Slow runs,
    // extreme for a Fast one.
    const report = buildBatchReport(mixed({ 150: 90 }));

    expect(report.runLengthOutliers).toEqual([
      { run: 150, ticksElapsed: 90, seed: 250, outcome: 'Fast' },
    ]);
  });

  it('lists flags from every outcome in batch order', () => {
    // Fast is judged first (it is the larger outcome), so without the final
    // sort run 150 would be listed ahead of run 9.
    const report = buildBatchReport(mixed({ 9: 400, 150: 90 }));

    expect(report.runLengthOutliers).toEqual([
      { run: 9, ticksElapsed: 400, seed: 109, outcome: 'Slow' },
      { run: 150, ticksElapsed: 90, seed: 250, outcome: 'Fast' },
    ]);
  });
});

describe('engine/batchReport — coarse run lengths', () => {
  // Run lengths are whole ticks. In a coarse outcome the quartiles can sit one
  // step apart, and Tukey's fences then flag every run at the next length out.
  // Those are candidates only: a length many runs share is not unusual.
  const runsOf = (name: string, lengths: number[]) =>
    lengths.map(t => ({ endConditionName: name, ticksElapsed: t }));
  const repeat = (value: number, times: number) => Array(times).fill(value);

  // Heads Win from probabilistic-race, 200 runs, seed 777: 97 runs that only
  // ever took 6–10 steps, with the quartiles at 8 and 9.
  const coarse = [
    ...repeat(6, 12),
    ...repeat(7, 11),
    ...repeat(8, 26),
    ...repeat(9, 29),
    ...repeat(10, 19),
  ];

  // A narrow 10–13 band, as in the outlier tests above.
  const band = [10, 11, 12, 13, 12, 11, 10, 12];
  const tight = (n: number) =>
    Array.from({ length: n }, (_, i) => band[i % band.length]);

  it('does not report a common run length as a set of outliers', () => {
    // Tukey's fences land at 6.5 and 10.5, so all twelve 6-step runs are
    // candidates — though 6 is 12% of this outcome's runs.
    expect(outlierIndicesIQR(coarse)).toHaveLength(12);

    const report = buildBatchReport(batchOf(runsOf('Heads Win', coarse)));
    expect(report.outcomes[0].outliersChecked).toBe(true);
    expect(report.runLengthOutliers).toEqual([]);
  });

  it('reports nothing for the probabilistic-race case it came from', () => {
    const path = resolve(__dirname, 'fixtures', 'probabilistic-race.xml');
    const { elements } = loadGraphFromFile(path);
    const report = buildBatchReport(
      runMultiple(elements, { runs: 200, seed: 777 })
    );

    // Both outcomes are big enough to be judged, and were.
    expect(report.outcomes.every(o => o.outliersChecked)).toBe(true);
    expect(report.runLengthOutliers).toEqual([]);
  });

  it('still reports a rare extreme run beside a common one', () => {
    const report = buildBatchReport(
      batchOf(runsOf('Heads Win', [...coarse, 40]))
    );

    // The twelve 6-step runs are dropped; the single 40-step run is kept.
    expect(report.runLengthOutliers).toEqual([
      { run: 97, ticksElapsed: 40, seed: 197, outcome: 'Heads Win' },
    ]);
  });

  it('reports several distinct rare extremes', () => {
    const report = buildBatchReport(
      batchOf(runsOf('Win', [...tight(40), 90, 150]))
    );

    expect(report.runLengthOutliers.map(o => o.ticksElapsed)).toEqual([
      90, 150,
    ]);
  });

  it('judges how common a length is by its share of the outcome', () => {
    // Two identical 999-step runs: rare among 62 runs (3.2%), exactly at the
    // limit among 40 (5%), and too common among 39 (5.1%).
    const flagged = (lengths: number[]) =>
      buildBatchReport(batchOf(runsOf('Win', lengths))).runLengthOutliers;

    expect(flagged([...tight(60), 999, 999])).toHaveLength(2);
    expect(flagged([...tight(38), 999, 999])).toHaveLength(2);
    expect(flagged([...tight(37), 999, 999])).toHaveLength(0);
  });

  it('counts how common a length is within its own outcome only', () => {
    // 90 is common across the batch — 7 of 71 runs, since Slow takes 88–92 —
    // but Fast has it once in 41. Counted per outcome, it stays reportable.
    const slow = Array.from({ length: 30 }, (_, i) => 88 + (i % 5));
    const report = buildBatchReport(
      batchOf([...runsOf('Fast', [...tight(40), 90]), ...runsOf('Slow', slow)])
    );

    expect(report.runLengthOutliers).toEqual([
      { run: 40, ticksElapsed: 90, seed: 140, outcome: 'Fast' },
    ]);
  });
});

describe('engine/batchReport — per-outcome statistics', () => {
  // Two outcomes finishing at very different speeds, interleaved so grouping
  // has to follow each run's outcome rather than its position in the batch.
  const fast = [18, 19, 20, 21, 22, 18, 19, 20, 21, 22];
  const slow = [198, 199, 200, 201, 202, 198, 199, 200, 201, 202];
  const bimodal = () =>
    batchOf(
      fast.flatMap((t, i) => [
        { endConditionName: 'Win', ticksElapsed: t },
        { endConditionName: 'Loss', ticksElapsed: slow[i] },
      ])
    );

  const row = (report: BatchReport, name: string): OutcomeShare =>
    report.outcomes.find(o => o.name === name)!;

  it('measures each outcome against its own runs only', () => {
    const report = buildBatchReport(bimodal());
    const win = row(report, 'Win');
    const loss = row(report, 'Loss');

    expect(win.completedRuns).toBe(10);
    expect(loss.completedRuns).toBe(10);
    expect(win.runLength!.mean).toBeCloseTo(20, 10);
    expect(loss.runLength!.mean).toBeCloseTo(200, 10);

    // The pooled mean lands in the empty gap between the two groups: no run
    // took anywhere near 110 steps. It is kept, but it describes neither.
    expect(report.runLength!.mean).toBeCloseTo(110, 10);
    expect(report.runLength!.mean).not.toBeCloseTo(win.runLength!.mean, 0);
    expect(report.runLength!.mean).not.toBeCloseTo(loss.runLength!.mean, 0);
  });

  it('reports the spread within an outcome, not the gap between outcomes', () => {
    const report = buildBatchReport(bimodal());
    const win = row(report, 'Win').runLength!;
    const loss = row(report, 'Loss').runLength!;

    // Squared deviations 4, 1, 0, 1, 4 twice: 20 over n - 1 = 9.
    expect(win.variance).toBeCloseTo(20 / 9, 10);
    expect(loss.variance).toBeCloseTo(20 / 9, 10);
    // Pooled, the variance mostly measures the 180-step gap between groups.
    expect(win.variance * 1000).toBeLessThan(report.runLength!.variance);
    expect(loss.variance * 1000).toBeLessThan(report.runLength!.variance);
  });

  it('attaches a mean interval to each measured outcome', () => {
    const report = buildBatchReport(bimodal());
    const win = row(report, 'Win');
    const [low, high] = win.runLengthCI!;
    expect(low).toBeLessThan(win.runLength!.mean);
    expect(high).toBeGreaterThan(win.runLength!.mean);
    expect(high).toBeLessThan(row(report, 'Loss').runLengthCI![0]);
  });

  it('reports no run length for runs stopped before the end', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: null, ticksElapsed: 50 },
        { endConditionName: 'Win', ticksElapsed: 5 },
        { endConditionName: null, ticksElapsed: 50 },
        { endConditionName: 'Win', ticksElapsed: 6 },
      ])
    );

    // The cap is a floor on those runs' duration, never a measurement of it.
    const stopped = row(report, UNFINISHED_RUN_LABEL);
    expect(stopped.count).toBe(2);
    expect(stopped.completedRuns).toBe(0);
    expect(stopped.runLength).toBeNull();
    expect(stopped.runLengthCI).toBeNull();
    expect(stopped.outliersChecked).toBe(false);
  });

  it('does not invent a duration for a completed run with no outcome', () => {
    // Contradictory, hand-built only: the engine never ends a game without an
    // End Condition. The run is tallied under the unfinished label, whose
    // durations must stay floors, so it contributes no measured run length.
    const report = buildBatchReport(
      batchOf([
        { endConditionName: null, ticksElapsed: 7, completed: true },
        { endConditionName: 'Win', ticksElapsed: 5 },
        { endConditionName: 'Win', ticksElapsed: 6 },
      ])
    );

    const stopped = row(report, UNFINISHED_RUN_LABEL);
    expect(stopped.count).toBe(1);
    expect(stopped.completedRuns).toBe(0);
    expect(stopped.runLength).toBeNull();
    expect(row(report, 'Win').completedRuns).toBe(2);

    // The pooled fields keep their existing meaning and still count it — the
    // one input where outcome completedRuns do not sum to the pooled total.
    expect(report.completedRuns).toBe(3);
    expect(report.runLength!.n).toBe(3);
  });

  it('splits every measured run across outcomes, losing none', () => {
    const fixture = resolve(__dirname, 'fixtures', 'skewed-run-length.xml');
    const { elements } = loadGraphFromFile(fixture);
    const batches: MultipleRunResult[] = [
      bimodal(),
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 5 },
        { endConditionName: null, ticksElapsed: 99 },
        { endConditionName: 'Loss', ticksElapsed: 8 },
      ]),
      batchOf([{ endConditionName: null, ticksElapsed: 99 }]),
      // Real engine output, with a cap tight enough to censor some runs.
      runMultiple(elements, { runs: 30, seed: 3, maxTicks: 110 }),
    ];

    for (const batch of batches) {
      const report = buildBatchReport(batch);
      const measured = report.outcomes.reduce(
        (sum, o) => sum + o.completedRuns,
        0
      );
      expect(measured).toBe(report.completedRuns);
    }
  });

  it('keeps the aggregateRuns row order', () => {
    // Counts A:3, B:2, C:1, D:1 — C before D by first appearance.
    const batch = batchOf(
      ['B', 'A', 'A', 'C', 'B', 'A', 'D'].map(name => ({
        endConditionName: name,
        ticksElapsed: 5,
      }))
    );
    const expected = aggregateRuns(batch).aggregate.map(r => r.name);

    expect(expected).toEqual(['A', 'B', 'C', 'D']);
    expect(buildBatchReport(batch).outcomes.map(o => o.name)).toEqual(expected);
    expect([...groupRunsByOutcome(batch).keys()]).toEqual(expected);
  });

  it('gives a single-outcome batch the pooled run length', () => {
    const report = buildBatchReport(
      batchOf(
        [10, 11, 12, 13, 14].map(t => ({
          endConditionName: 'Win',
          ticksElapsed: t,
        }))
      )
    );

    expect(report.outcomes).toHaveLength(1);
    expect(report.outcomes[0].runLength).toEqual(report.runLength);
    expect(report.outcomes[0].runLengthCI).toEqual(report.runLengthCI);
  });

  it('leaves outcomes with fewer than 20 completed runs unchecked', () => {
    // Twenty completed runs in the batch, but only ten per outcome — and each
    // outcome is judged on its own, so neither has enough to be checked.
    const report = buildBatchReport(bimodal());
    expect(report.completedRuns).toBe(20);
    expect(row(report, 'Win').outliersChecked).toBe(false);
    expect(row(report, 'Loss').outliersChecked).toBe(false);
  });
});

describe('engine/batchReport — report percentiles', () => {
  // Measured Win and Loss runs, a censored run, and two metric series.
  const batch = () =>
    batchOf(
      [
        [5, 'Win'],
        [9, 'Loss'],
        [6, 'Win'],
        [50, null],
        [7, 'Win'],
        [12, 'Loss'],
      ].map(([t, name], i) => ({
        endConditionName: name as string | null,
        ticksElapsed: t as number,
        metrics: { 'Pool#1': (t as number) * 2, 'Register#2': i - 3 },
      }))
    );

  /** Every NumericSummary a report exposes, pooled and per outcome. */
  const summariesOf = (report: BatchReport): NumericSummary[] =>
    [
      report.runLength,
      ...report.outcomes.map(o => o.runLength),
      ...report.metrics.map(m => m.summary),
    ].filter((s): s is NumericSummary => s !== null);

  it('carries exactly REPORT_PERCENTILES on every summary', () => {
    const summaries = summariesOf(buildBatchReport(batch()));
    // Pooled run length, Win, Loss (the censored outcome has none), and the
    // two metric series — so the loop below cannot pass vacuously.
    expect(summaries).toHaveLength(5);
    for (const s of summaries) {
      expect(s.percentiles.map(point => point.p)).toEqual([
        ...REPORT_PERCENTILES,
      ]);
    }
  });

  it('agrees with the fixed percentile fields it overlaps', () => {
    for (const s of summariesOf(buildBatchReport(batch()))) {
      expect(lookupPercentile(s, 0.25)).toBe(s.p25);
      expect(lookupPercentile(s, 0.5)).toBe(s.p50);
      expect(lookupPercentile(s, 0.75)).toBe(s.p75);
      expect(lookupPercentile(s, 0.9)).toBe(s.p90);
      expect(lookupPercentile(s, 0.95)).toBe(s.p95);
    }
  });

  it('leaves every pooled run-length and metric value unchanged', () => {
    // Adding the percentile set must not move a number existing readers use.
    const report = buildBatchReport(batch());
    const pairs: [NumericSummary, NumericSummary][] = [
      [report.runLength!, summarize([5, 9, 6, 7, 12])!],
      [report.metrics[0].summary, summarize([10, 18, 12, 100, 14, 24])!],
      [report.metrics[1].summary, summarize([-3, -2, -1, 0, 1, 2])!],
    ];
    for (const [actual, plain] of pairs) {
      for (const key of Object.keys(plain) as (keyof NumericSummary)[]) {
        if (key === 'percentiles') continue;
        expect(actual[key]).toBe(plain[key]);
      }
    }
  });
});

describe('engine/batchReport — groupRunsByOutcome', () => {
  it('groups batch indices, not values, under the tally keys', () => {
    const batch = batchOf([
      { endConditionName: 'Win', ticksElapsed: 5 },
      { endConditionName: null, ticksElapsed: 50 },
      { endConditionName: 'Win', ticksElapsed: 7 },
      { endConditionName: 'Loss', ticksElapsed: 9 },
    ]);

    // Win first (two runs); the one-run ties keep first-appearance order.
    expect([...groupRunsByOutcome(batch).entries()]).toEqual([
      ['Win', [0, 2]],
      [UNFINISHED_RUN_LABEL, [1]],
      ['Loss', [3]],
    ]);
  });

  it('places every run in exactly one group', () => {
    const batch = batchOf(
      Array.from({ length: 12 }, (_, i) => ({
        endConditionName: i % 3 === 0 ? null : `Outcome ${i % 2}`,
        ticksElapsed: i + 1,
      }))
    );
    const indices = [...groupRunsByOutcome(batch).values()].flat();

    expect(indices).toHaveLength(12);
    expect([...indices].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i)
    );
  });

  it('does not mutate the batch it reads', () => {
    const batch = batchOf([
      { endConditionName: 'Win', ticksElapsed: 5 },
      { endConditionName: null, ticksElapsed: 50 },
      { endConditionName: 'Loss', ticksElapsed: 9, metrics: { 'Pool#1': 3 } },
    ]);
    const before = JSON.parse(JSON.stringify(batch));

    groupRunsByOutcome(batch);
    buildBatchReport(batch);

    expect(batch).toEqual(before);
  });
});

describe('engine/batchReport — over a real diagram', () => {
  // The only fixture whose completed run lengths are both varied and bounded
  // enough for Tukey's rule to flag anything; see its header comment.
  const skewedPath = resolve(__dirname, 'fixtures', 'skewed-run-length.xml');

  it('flags outliers whose seed matches their position in the batch', () => {
    const { elements } = loadGraphFromFile(skewedPath);
    const baseSeed = 42;
    const batch = runMultiple(elements, { runs: 60, seed: baseSeed });
    const report = buildBatchReport(batch);

    expect(report.completedRuns).toBe(60);
    expect(report.censoredRuns).toBe(0);
    expect(report.runLength!.stdDev).toBeGreaterThan(0);
    expect(report.runLengthOutliers.length).toBeGreaterThan(0);

    for (const outlier of report.runLengthOutliers) {
      // The seed is the handle used to replay a run, so it has to belong to
      // the run actually being pointed at.
      expect(outlier.seed).toBe(baseSeed + outlier.run);
      expect(outlier.ticksElapsed).toBe(
        batch.outcomes[outlier.run].ticksElapsed
      );
      expect(batch.outcomes[outlier.run].completed).toBe(true);
      // And it was judged against the outcome that run actually had.
      expect(outlier.outcome).toBe(outcomeKey(batch.outcomes[outlier.run]));
    }
  });

  it('produces an identical report for the same seed', () => {
    const load = () => loadGraphFromFile(skewedPath).elements;
    const a = buildBatchReport(runMultiple(load(), { runs: 30, seed: 7 }));
    const b = buildBatchReport(runMultiple(load(), { runs: 30, seed: 7 }));

    expect(b).toEqual(a);
  });
});

describe('engine/batchReport — bimodal outcomes on a real diagram', () => {
  // A real model whose two outcomes finish at very different speeds: about
  // 80% Fast (~12 steps) and 20% Slow (~61). See the fixture's header comment
  // for why it has the spread it has. Everything below goes through the same
  // path the CLI and Run panel use: runMultiple, then buildBatchReport.
  const bimodalPath = resolve(__dirname, 'fixtures', 'bimodal-outcomes.xml');
  const seed = 42;
  const runs = 200;

  let cached: MultipleRunResult | undefined;
  const batch = () =>
    (cached ??= runMultiple(loadGraphFromFile(bimodalPath).elements, {
      runs,
      seed,
    }));

  /** Measured run lengths of one outcome, in batch order. */
  const lengthsOf = (name: string) =>
    batch()
      .outcomes.filter(o => o.completed && o.endConditionName === name)
      .map(o => o.ticksElapsed);

  it('produces two outcomes with clearly different run lengths', () => {
    const report = buildBatchReport(batch());
    const fast = report.outcomes.find(o => o.name === 'Fast Finish')!;
    const slow = report.outcomes.find(o => o.name === 'Slow Finish')!;

    expect(report.outcomes.map(o => o.name)).toEqual([
      'Fast Finish',
      'Slow Finish',
    ]);
    expect(report.censoredRuns).toBe(0);
    // Both outcomes clear the 20-run minimum for outlier checking.
    expect(slow.completedRuns).toBeGreaterThanOrEqual(20);
    expect(fast.completedRuns).toBeGreaterThan(slow.completedRuns);

    expect(fast.runLength!.mean).toBeGreaterThan(10);
    expect(fast.runLength!.mean).toBeLessThan(15);
    // No overlap between the bulk of each outcome: Slow's lower quartile is
    // beyond Fast's longest run.
    expect(slow.runLength!.p25).toBeGreaterThan(fast.runLength!.max);
  });

  it('spreads each outcome widely enough not to be coarse', () => {
    // The point of the spread: this fixture exercises per-outcome detection,
    // not the safeguard for outcomes that only take a few distinct lengths.
    for (const name of ['Fast Finish', 'Slow Finish']) {
      const lengths = lengthsOf(name);
      expect(new Set(lengths).size).toBeGreaterThanOrEqual(15);
      expect(summarize(lengths)!.iqr).toBeGreaterThanOrEqual(4);
    }
  });

  it('would flag the entire Slow outcome if runs were pooled', () => {
    // The behaviour per-outcome detection replaces: Tukey's rule over every
    // completed run at once, as the report did before.
    const completed = batch().outcomes.filter(o => o.completed);
    const pooled = outlierIndicesIQR(completed.map(o => o.ticksElapsed));
    const flaggedSlow = pooled.filter(
      i => completed[i].endConditionName === 'Slow Finish'
    );

    expect(flaggedSlow).toHaveLength(lengthsOf('Slow Finish').length);
  });

  it('checks both outcomes and does not flag the Slow one wholesale', () => {
    const report = buildBatchReport(batch());

    expect(report.outcomes.every(o => o.outliersChecked)).toBe(true);
    expect(
      report.runLengthOutliers.filter(o => o.outcome === 'Slow Finish')
    ).toEqual([]);
  });

  it('attributes each flag to its own run and outcome, in batch order', () => {
    const b = batch();
    const report = buildBatchReport(b);
    const fast = report.outcomes.find(o => o.name === 'Fast Finish')!;

    // What remains are Fast runs in that outcome's own upper tail.
    expect(report.runLengthOutliers.length).toBeGreaterThan(0);
    for (const outlier of report.runLengthOutliers) {
      expect(outlier.outcome).toBe(outcomeKey(b.outcomes[outlier.run]));
      expect(outlier.outcome).toBe('Fast Finish');
      expect(outlier.seed).toBe(seed + outlier.run);
      expect(outlier.ticksElapsed).toBe(b.outcomes[outlier.run].ticksElapsed);
      expect(outlier.ticksElapsed).toBeGreaterThan(fast.runLength!.p75);
    }

    // Sorted by batch run index. This fixture only yields flags within one
    // outcome; interleaving across outcomes is pinned by "lists flags from
    // every outcome in batch order" above.
    const order = report.runLengthOutliers.map(o => o.run);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('reports every Tukey candidate here, with no coarse-data filtering', () => {
    const report = buildBatchReport(batch());
    for (const name of ['Fast Finish', 'Slow Finish']) {
      const flagged = report.runLengthOutliers.filter(o => o.outcome === name);
      expect(flagged).toHaveLength(outlierIndicesIQR(lengthsOf(name)).length);
    }
  });

  it('produces an identical report for the same seed', () => {
    const again = runMultiple(loadGraphFromFile(bimodalPath).elements, {
      runs,
      seed,
    });
    expect(buildBatchReport(again)).toEqual(buildBatchReport(batch()));
  });
});
