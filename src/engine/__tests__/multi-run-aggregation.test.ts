import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import type { GraphElement } from '../types';
import {
  runMultiple,
  aggregateRuns,
  UNFINISHED_RUN_LABEL,
  type MultipleRunResult,
  type RunOutcome,
} from '../runner';
import { loadGraphFromFile } from '../io';

/**
 * Regression tests for multi-run outcome aggregation.
 *
 * Two things are pinned here:
 *
 *  1. `runMultiple` reports a batch whose `totalRuns` genuinely matches the
 *     number of outcomes collected — the report must never echo the requested
 *     count back without having run it.
 *  2. `aggregateRuns` tallies those outcomes into the distribution shown by
 *     both the CLI report and the UI's Multiple Runs panel. Its bucket label,
 *     sort order and empty-batch behaviour are contract, not incidental: the
 *     two reports have to agree about the same batch.
 */

/** Source -> Pool with no End Condition: every run exhausts `maxTicks`. */
const buildNeverEndingModel = (): GraphElement[] => [
  {
    id: 1,
    type: 'Source',
    x: 0,
    y: 0,
    activation: 'automatic',
    color: '#FF0000',
  } as GraphElement,
  {
    id: 2,
    type: 'Pool',
    x: 100,
    y: 0,
    max: Infinity,
    currentPoints: 0,
    resourcesByColor: {},
    pullMode: 'pull any',
  } as GraphElement,
  {
    id: 3,
    type: 'Resource Connection',
    connectedToStart: 1,
    connectedToEnd: 2,
    text: '1',
    color: '#FF0000',
    inhibited: false,
  } as GraphElement,
];

/** Register wired to an always-satisfied End Condition: ends on every run. */
const buildAlwaysEndingModel = (): GraphElement[] => [
  {
    id: 1,
    type: 'Register',
    x: 0,
    y: 0,
    currentValue: 0,
    startingValue: 0,
  } as GraphElement,
  {
    id: 2,
    type: 'End Condition',
    x: 100,
    y: 0,
    inhibited: true,
    text: 'Always Wins',
  } as GraphElement,
  {
    id: 3,
    type: 'State Connection',
    connectedToStart: 1,
    connectedToEnd: 2,
    text: '> -1',
  } as GraphElement,
];

/** Build a batch literal, so the tally can be tested without running a model. */
const batchOf = (outcomes: RunOutcome[]): MultipleRunResult => ({
  totalRuns: outcomes.length,
  outcomes,
});

const rowFor = (
  result: ReturnType<typeof aggregateRuns>,
  name: string
): { name: string; count: number; pct: number } => {
  const row = result.aggregate.find(r => r.name === name);
  if (!row) throw new Error(`no aggregate row named "${name}"`);
  return row;
};

describe('engine/runner — runMultiple batch shape', () => {
  it('runs exactly the requested number of simulations', () => {
    const batch = runMultiple(buildNeverEndingModel(), {
      runs: 7,
      maxTicks: 5,
    });

    expect(batch.totalRuns).toBe(7);
    expect(batch.outcomes).toHaveLength(7);
  });

  it('reports a totalRuns that matches the outcomes actually collected', () => {
    // The invariant the percentage maths depends on: a batch may never claim
    // more runs than it produced outcomes for.
    for (const runs of [1, 2, 5, 20]) {
      const batch = runMultiple(buildNeverEndingModel(), { runs, maxTicks: 3 });
      expect(batch.totalRuns).toBe(batch.outcomes.length);
      expect(batch.totalRuns).toBe(runs);
    }
  });

  it('returns an empty batch for zero runs rather than throwing', () => {
    const batch = runMultiple(buildNeverEndingModel(), {
      runs: 0,
      maxTicks: 5,
    });

    expect(batch.totalRuns).toBe(0);
    expect(batch.outcomes).toEqual([]);
  });

  it('records ticksElapsed and a null end condition for unfinished runs', () => {
    const batch = runMultiple(buildNeverEndingModel(), {
      runs: 3,
      maxTicks: 8,
    });

    for (const outcome of batch.outcomes) {
      expect(outcome.endConditionName).toBeNull();
      expect(outcome.ticksElapsed).toBe(8);
    }
  });

  it('records the triggered End Condition name when a run ends', () => {
    const batch = runMultiple(buildAlwaysEndingModel(), {
      runs: 4,
      maxTicks: 50,
    });

    expect(batch.outcomes).toHaveLength(4);
    for (const outcome of batch.outcomes) {
      expect(outcome.endConditionName).toBe('Always Wins');
      expect(outcome.ticksElapsed).toBeLessThan(50);
    }
  });

  it('produces an identical batch for the same seed', () => {
    const a = runMultiple(buildNeverEndingModel(), {
      runs: 5,
      maxTicks: 20,
      seed: 42,
    });
    const b = runMultiple(buildNeverEndingModel(), {
      runs: 5,
      maxTicks: 20,
      seed: 42,
    });

    expect(b).toEqual(a);
  });
});

describe('engine/runner — aggregateRuns tally', () => {
  it('counts each distinct outcome and sums back to the batch size', () => {
    const result = aggregateRuns(
      batchOf([
        { endConditionName: 'Heads Win', ticksElapsed: 10 },
        { endConditionName: 'Tails Win', ticksElapsed: 20 },
        { endConditionName: 'Heads Win', ticksElapsed: 30 },
        { endConditionName: 'Heads Win', ticksElapsed: 40 },
      ])
    );

    expect(rowFor(result, 'Heads Win').count).toBe(3);
    expect(rowFor(result, 'Tails Win').count).toBe(1);
    expect(result.aggregate.reduce((n, r) => n + r.count, 0)).toBe(4);
  });

  it('buckets runs that never ended under the shared unfinished label', () => {
    // This literal is contract: the CLI report and the UI panel must bucket
    // unfinished runs under the same name or the two reports disagree.
    expect(UNFINISHED_RUN_LABEL).toBe('Stopped before end');

    const result = aggregateRuns(
      batchOf([
        { endConditionName: null, ticksElapsed: 100 },
        { endConditionName: 'Victory!', ticksElapsed: 12 },
        { endConditionName: null, ticksElapsed: 100 },
      ])
    );

    expect(rowFor(result, UNFINISHED_RUN_LABEL).count).toBe(2);
    expect(rowFor(result, 'Victory!').count).toBe(1);
  });

  it('sorts rows by descending count', () => {
    const result = aggregateRuns(
      batchOf([
        { endConditionName: 'Rare', ticksElapsed: 1 },
        { endConditionName: 'Common', ticksElapsed: 1 },
        { endConditionName: 'Common', ticksElapsed: 1 },
        { endConditionName: 'Middling', ticksElapsed: 1 },
        { endConditionName: 'Common', ticksElapsed: 1 },
        { endConditionName: 'Middling', ticksElapsed: 1 },
      ])
    );

    expect(result.aggregate.map(r => r.name)).toEqual([
      'Common',
      'Middling',
      'Rare',
    ]);
  });

  it('breaks count ties by first occurrence', () => {
    const result = aggregateRuns(
      batchOf([
        { endConditionName: 'Second', ticksElapsed: 1 },
        { endConditionName: 'First', ticksElapsed: 1 },
        { endConditionName: 'First', ticksElapsed: 1 },
        { endConditionName: 'Second', ticksElapsed: 1 },
      ])
    );

    // Both have a count of 2; the row seen first in run order stays first, so
    // the report does not reshuffle between otherwise identical batches.
    expect(result.aggregate.map(r => r.name)).toEqual(['Second', 'First']);
  });

  it('expresses each row as a percentage that sums to 100', () => {
    const result = aggregateRuns(
      batchOf([
        { endConditionName: 'A', ticksElapsed: 1 },
        { endConditionName: 'A', ticksElapsed: 1 },
        { endConditionName: 'A', ticksElapsed: 1 },
        { endConditionName: 'B', ticksElapsed: 1 },
      ])
    );

    expect(rowFor(result, 'A').pct).toBe(75);
    expect(rowFor(result, 'B').pct).toBe(25);
    expect(result.aggregate.reduce((n, r) => n + r.pct, 0)).toBeCloseTo(
      100,
      10
    );
  });

  it('averages ticksElapsed across the batch', () => {
    const result = aggregateRuns(
      batchOf([
        { endConditionName: 'A', ticksElapsed: 10 },
        { endConditionName: 'B', ticksElapsed: 20 },
        { endConditionName: 'A', ticksElapsed: 30 },
      ])
    );

    expect(result.averageSteps).toBe(20);
  });

  it('averages over every run, including unfinished ones', () => {
    const result = aggregateRuns(
      batchOf([
        { endConditionName: 'A', ticksElapsed: 2 },
        { endConditionName: null, ticksElapsed: 100 },
      ])
    );

    expect(result.averageSteps).toBe(51);
  });

  it('returns zero — not NaN — for an empty batch', () => {
    // Guards the `total ? … : 0` divide; a NaN here renders as "NaN" in both
    // the CLI summary and the UI panel.
    const result = aggregateRuns(batchOf([]));

    expect(result.aggregate).toEqual([]);
    expect(result.averageSteps).toBe(0);
    expect(Number.isNaN(result.averageSteps)).toBe(false);
  });

  it('reports a single-outcome batch as 100%', () => {
    const result = aggregateRuns(
      batchOf([{ endConditionName: 'Only', ticksElapsed: 5 }])
    );

    expect(result.aggregate).toEqual([{ name: 'Only', count: 1, pct: 100 }]);
    expect(result.averageSteps).toBe(5);
  });
});

describe('engine/runner — multi-run aggregation over a real diagram', () => {
  const racePath = resolve(__dirname, 'fixtures', 'probabilistic-race.xml');

  it('aggregates a seeded probabilistic batch into a stable distribution', () => {
    const { elements } = loadGraphFromFile(racePath);
    const batch = runMultiple(elements, { runs: 40, maxTicks: 200, seed: 42 });
    const { aggregate, averageSteps } = aggregateRuns(batch);

    expect(batch.outcomes).toHaveLength(40);
    expect(aggregate.reduce((n, r) => n + r.count, 0)).toBe(40);

    // A 50/50 race must actually produce both outcomes, otherwise the
    // aggregate report is only ever exercised with a single row.
    expect(aggregate.map(r => r.name).sort()).toEqual([
      'Heads Win',
      'Tails Win',
    ]);
    expect(averageSteps).toBeGreaterThan(0);

    // Same seed, same report — the distribution is reproducible, not just the
    // individual runs.
    const repeat = aggregateRuns(
      runMultiple(loadGraphFromFile(racePath).elements, {
        runs: 40,
        maxTicks: 200,
        seed: 42,
      })
    );
    expect(repeat.aggregate).toEqual(aggregate);
    expect(repeat.averageSteps).toBe(averageSteps);
  });
});
