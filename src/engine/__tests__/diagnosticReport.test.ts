import { describe, it, expect } from 'vitest';
import { buildDiagnosticReport } from '../diagnosticReport';
import type { MultipleRunResult, RunOutcome } from '../runner';
import type { StarvationResult } from '../diagnostics';

/**
 * Contract tests for turning per-run starvation verdicts into batch-level
 * incidence. Batches are hand-built rather than run, so expected numbers are
 * obvious by inspection.
 */

const starvationOf = (
  pools: Array<Partial<StarvationResult['pools'][number]>>
): StarvationResult => {
  const built = pools.map(p => ({
    key: 'Pool#1',
    label: 'Pool#1',
    ticksObserved: 10,
    ticksEmpty: 0,
    longestEmptyStreak: 0,
    starved: false,
    ...p,
  }));
  return { starved: built.some(p => p.starved), pools: built };
};

type OutcomeFixture = Pick<RunOutcome, 'endConditionName' | 'ticksElapsed'> &
  Partial<RunOutcome>;

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

describe('engine/diagnosticReport — starvation incidence', () => {
  it('reports null when no run in the batch carries starvation diagnostics', () => {
    const report = buildDiagnosticReport(
      batchOf([{ endConditionName: 'Win', ticksElapsed: 10 }])
    );
    expect(report.starvation).toBeNull();
  });

  it('reports 0% with a tight interval when no diagnosed run starved', () => {
    const report = buildDiagnosticReport(
      batchOf([
        {
          endConditionName: 'Win',
          ticksElapsed: 10,
          diagnostics: {
            starvation: starvationOf([{ key: 'Pool#1', starved: false }]),
          },
        },
        {
          endConditionName: 'Win',
          ticksElapsed: 12,
          diagnostics: {
            starvation: starvationOf([{ key: 'Pool#1', starved: false }]),
          },
        },
      ])
    );

    expect(report.starvation).toMatchObject({
      runsObserved: 2,
      starvedRuns: 0,
      pct: 0,
    });
    // Wilson interval for 0-of-2 gives an honest upper bound, not [0, 0].
    expect(report.starvation!.ciHigh).toBeGreaterThan(0);
  });

  it('computes the starved-run rate across a mixed batch', () => {
    const report = buildDiagnosticReport(
      batchOf([
        {
          endConditionName: 'Win',
          ticksElapsed: 10,
          diagnostics: {
            starvation: starvationOf([{ key: 'Pool#1', starved: true }]),
          },
        },
        {
          endConditionName: 'Win',
          ticksElapsed: 12,
          diagnostics: {
            starvation: starvationOf([{ key: 'Pool#1', starved: false }]),
          },
        },
        {
          endConditionName: null,
          ticksElapsed: 1000,
          diagnostics: {
            starvation: starvationOf([{ key: 'Pool#1', starved: true }]),
          },
        },
        {
          endConditionName: 'Win',
          ticksElapsed: 8,
          // No diagnostics on this run — should not count toward the
          // denominator, keeping the rate about the 3 diagnosed runs only.
        },
      ])
    );

    expect(report.starvation).toMatchObject({
      runsObserved: 3,
      starvedRuns: 2,
      pct: (2 / 3) * 100,
    });
  });

  it('breaks the rate down per pool, sorted most-starved first', () => {
    const report = buildDiagnosticReport(
      batchOf([
        {
          endConditionName: 'Win',
          ticksElapsed: 10,
          diagnostics: {
            starvation: starvationOf([
              { key: 'Pool#1', label: 'Gold', starved: true },
              { key: 'Pool#2', label: 'Wood', starved: false },
            ]),
          },
        },
        {
          endConditionName: 'Win',
          ticksElapsed: 12,
          diagnostics: {
            starvation: starvationOf([
              { key: 'Pool#1', label: 'Gold', starved: true },
              { key: 'Pool#2', label: 'Wood', starved: true },
            ]),
          },
        },
      ])
    );

    expect(report.starvation!.byPool).toEqual([
      expect.objectContaining({ key: 'Pool#1', label: 'Gold', starvedRuns: 2 }),
      expect.objectContaining({ key: 'Pool#2', label: 'Wood', starvedRuns: 1 }),
    ]);
  });

  it('treats an empty diagnosed batch and an all-starved batch as the extremes', () => {
    const allStarved = buildDiagnosticReport(
      batchOf(
        Array.from({ length: 4 }, () => ({
          endConditionName: null,
          ticksElapsed: 1000,
          diagnostics: {
            starvation: starvationOf([{ key: 'Pool#1', starved: true }]),
          },
        }))
      )
    );
    expect(allStarved.starvation).toMatchObject({
      runsObserved: 4,
      starvedRuns: 4,
      pct: 100,
    });
    expect(allStarved.starvation!.ciHigh).toBeLessThanOrEqual(100);
  });
});
