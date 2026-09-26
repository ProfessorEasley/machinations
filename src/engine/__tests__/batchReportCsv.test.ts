import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { buildBatchReport } from '../batchReport';
import type { BatchReport } from '../batchReport';
import { batchReportToCsv, BATCH_REPORT_CSV_COLUMNS } from '../batchReportCsv';
import { runMultiple } from '../runner';
import type { MultipleRunResult, RunOutcome } from '../runner';
import { lookupPercentile } from '../stats';
import { loadGraphFromFile } from '../io';

/**
 * Contract tests for the batch report's CSV form — what the CLI's
 * `--format csv` prints and the Run panel exports.
 *
 * The schema is pinned here on purpose: a spreadsheet or script reading these
 * files depends on the column names and order, so changing either should
 * break a test first. Values are checked against the report they came from,
 * because the serializer must copy the report, never recompute it.
 */

/** RFC 4180 reader: quoted cells, doubled quotes, CRLF row ends. */
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell]);
  return rows;
};

/** Rows as objects keyed by column name. */
const recordsOf = (csv: string): Record<string, string>[] => {
  const [header, ...rows] = parseCsv(csv);
  return rows.map(cells =>
    Object.fromEntries(header.map((name, i) => [name, cells[i]]))
  );
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

const bimodalReport = (): BatchReport =>
  buildBatchReport(
    runMultiple(
      loadGraphFromFile(resolve(__dirname, 'fixtures', 'bimodal-outcomes.xml'))
        .elements,
      { runs: 200, seed: 42 }
    )
  );

describe('engine/batchReportCsv — schema', () => {
  it('writes this header, in this order', () => {
    const [header] = batchReportToCsv(bimodalReport()).split('\r\n');
    expect(header).toBe(
      'section,name,key,total_runs,completed_runs,censored_runs,max_ticks,' +
        'seed,average_steps,count,share_pct,share_ci_low,share_ci_high,' +
        'n,mean,variance,std_dev,std_error,min,max,' +
        'p5,p10,p25,p50,p75,p90,p95,p99,' +
        'mean_ci_low,mean_ci_high,outliers,outliers_checked,run,ticks'
    );
    expect(header.split(',')).toEqual([...BATCH_REPORT_CSV_COLUMNS]);
  });

  it('orders rows: batch, pooled, outcomes, outliers, final values', () => {
    const report = bimodalReport();
    const sections = recordsOf(batchReportToCsv(report)).map(r => r.section);

    expect(sections).toEqual([
      'batch',
      'pooled_run_length',
      ...report.outcomes.map(() => 'outcome'),
      ...report.runLengthOutliers.map(() => 'outlier'),
      ...report.metrics.map(() => 'final_value'),
    ]);
  });

  it('gives every row the same number of cells', () => {
    const rows = parseCsv(batchReportToCsv(bimodalReport()));
    for (const row of rows) {
      expect(row).toHaveLength(BATCH_REPORT_CSV_COLUMNS.length);
    }
  });
});

describe('engine/batchReportCsv — values', () => {
  it('copies the batch and pooled figures from the report', () => {
    const report = bimodalReport();
    const [batch, pooled] = recordsOf(batchReportToCsv(report));

    expect(batch).toMatchObject({
      total_runs: '200',
      completed_runs: String(report.completedRuns),
      censored_runs: '0',
      max_ticks: '1000',
      seed: '42',
      average_steps: String(report.averageSteps),
      n: '',
      mean: '',
    });
    expect(pooled).toMatchObject({
      completed_runs: String(report.completedRuns),
      n: String(report.runLength!.n),
      mean: String(report.runLength!.mean),
      mean_ci_low: String(report.runLengthCI![0]),
      outliers: String(report.runLengthOutliers.length),
      outliers_checked: '',
    });
  });

  it("writes each outcome's own statistics at full precision", () => {
    const report = bimodalReport();
    const outcomes = recordsOf(batchReportToCsv(report)).filter(
      r => r.section === 'outcome'
    );

    expect(outcomes.map(r => r.name)).toEqual(['Fast Finish', 'Slow Finish']);
    report.outcomes.forEach((row, i) => {
      const s = row.runLength!;
      expect(outcomes[i]).toMatchObject({
        count: String(row.count),
        share_pct: String(row.pct),
        share_ci_low: String(row.ciLow),
        share_ci_high: String(row.ciHigh),
        completed_runs: String(row.completedRuns),
        n: String(s.n),
        mean: String(s.mean),
        variance: String(s.variance),
        std_dev: String(s.stdDev),
        std_error: String(s.stdError),
        min: String(s.min),
        max: String(s.max),
        mean_ci_low: String(row.runLengthCI![0]),
        mean_ci_high: String(row.runLengthCI![1]),
        outliers_checked: 'true',
      });
      // Not rounded for display: this is the analysis copy.
      expect(outcomes[i].mean).toBe(String(s.mean));
    });
  });

  it('fills every percentile column from the report', () => {
    const report = bimodalReport();
    const outcomes = recordsOf(batchReportToCsv(report)).filter(
      r => r.section === 'outcome'
    );
    report.outcomes.forEach((row, i) => {
      const expected = {
        p5: 0.05,
        p10: 0.1,
        p25: 0.25,
        p50: 0.5,
        p75: 0.75,
        p90: 0.9,
        p95: 0.95,
        p99: 0.99,
      };
      for (const [column, p] of Object.entries(expected)) {
        expect(outcomes[i][column]).toBe(
          String(lookupPercentile(row.runLength!, p))
        );
      }
    });
  });

  it('lists each flagged run with its outcome, in batch order', () => {
    const report = bimodalReport();
    const outliers = recordsOf(batchReportToCsv(report)).filter(
      r => r.section === 'outlier'
    );

    expect(outliers.map(r => [r.name, r.run, r.seed, r.ticks])).toEqual(
      report.runLengthOutliers.map(o => [
        o.outcome,
        String(o.run),
        String(o.seed),
        String(o.ticksElapsed),
      ])
    );
    expect(outliers[0].mean).toBe('');
  });

  it('counts each outcome’s flagged runs', () => {
    // 180 Fast and 20 Slow runs, one extreme run planted in each outcome.
    const report = buildBatchReport(
      batchOf(
        Array.from({ length: 200 }, (_, i) => {
          const slow = i % 10 === 9;
          const base = slow ? 198 + (Math.floor(i / 10) % 5) : 18 + (i % 5);
          const planted = i === 9 ? 400 : i === 150 ? 90 : base;
          return {
            endConditionName: slow ? 'Slow' : 'Fast',
            ticksElapsed: planted,
          };
        })
      )
    );
    const records = recordsOf(batchReportToCsv(report));
    const outcome = (name: string) =>
      records.find(r => r.section === 'outcome' && r.name === name)!;

    expect(outcome('Fast').outliers).toBe('1');
    expect(outcome('Slow').outliers).toBe('1');
    expect(records.find(r => r.section === 'pooled_run_length')!.outliers).toBe(
      '2'
    );
    expect(
      records.filter(r => r.section === 'outlier').map(r => r.name)
    ).toEqual(['Slow', 'Fast']);
  });

  it('writes one row per final-value series, with its key', () => {
    const report = bimodalReport();
    const values = recordsOf(batchReportToCsv(report)).filter(
      r => r.section === 'final_value'
    );

    expect(values.map(r => r.key)).toEqual(report.metrics.map(m => m.key));
    expect(values.map(r => r.name)).toEqual(report.metrics.map(m => m.label));
    expect(values[0].mean).toBe(String(report.metrics[0].summary.mean));
  });
});

describe('engine/batchReportCsv — missing values', () => {
  it('leaves an unmeasured outcome’s statistics empty', () => {
    const report = buildBatchReport(
      batchOf([
        { endConditionName: 'Win', ticksElapsed: 5 },
        { endConditionName: null, ticksElapsed: 1000 },
        { endConditionName: 'Win', ticksElapsed: 7 },
      ])
    );
    const stopped = recordsOf(batchReportToCsv(report)).find(
      r => r.section === 'outcome' && r.name === 'Stopped before end'
    )!;

    expect(stopped.count).toBe('1');
    expect(stopped.completed_runs).toBe('0');
    for (const column of [
      'n',
      'mean',
      'variance',
      'p50',
      'p99',
      'mean_ci_low',
      'mean_ci_high',
    ]) {
      expect(stopped[column]).toBe('');
    }
    expect(stopped.outliers).toBe('0');
    expect(stopped.outliers_checked).toBe('false');
  });

  it('leaves the pooled row empty when nothing completed', () => {
    const report = buildBatchReport(
      batchOf([{ endConditionName: null, ticksElapsed: 1000 }])
    );
    const pooled = recordsOf(batchReportToCsv(report)).find(
      r => r.section === 'pooled_run_length'
    )!;
    expect(pooled.completed_runs).toBe('0');
    expect(pooled.n).toBe('');
    expect(pooled.mean).toBe('');
  });

  it('leaves the seed empty for an unseeded batch', () => {
    const report = buildBatchReport(
      batchOf(
        [
          { endConditionName: 'Win', ticksElapsed: 5, seed: null },
          { endConditionName: 'Win', ticksElapsed: 6, seed: null },
        ],
        { seed: null }
      )
    );
    const [batch] = recordsOf(batchReportToCsv(report));
    expect(batch.seed).toBe('');
  });
});

describe('engine/batchReportCsv — text escaping', () => {
  const names = [
    'Win, fast',
    'Say "hi"',
    'line\nbreak',
    '=SUM(A1)',
    '+1 gold',
    '-1 lives',
    '@home',
  ];
  const escapedCsv = () =>
    batchReportToCsv(
      buildBatchReport(
        batchOf(
          names.map(name => ({ endConditionName: name, ticksElapsed: 5 }))
        )
      )
    );

  it('quotes commas, quotes and line breaks so names read back intact', () => {
    const read = recordsOf(escapedCsv())
      .filter(r => r.section === 'outcome')
      .map(r => r.name);

    expect(read).toContain('Win, fast');
    expect(read).toContain('Say "hi"');
    expect(read).toContain('line\nbreak');
    expect(escapedCsv()).toContain('"Say ""hi"""');
  });

  it('stops a spreadsheet evaluating names as formulas', () => {
    const read = recordsOf(escapedCsv())
      .filter(r => r.section === 'outcome')
      .map(r => r.name);

    expect(read).toContain("'=SUM(A1)");
    expect(read).toContain("'+1 gold");
    expect(read).toContain("'-1 lives");
    expect(read).toContain("'@home");
  });

  it('leaves negative numbers alone', () => {
    // Only text is guarded; a number is never mistaken for a formula.
    const report = buildBatchReport(
      batchOf(
        [
          { endConditionName: 'Win', ticksElapsed: 5, metrics: { 'R#1': -3 } },
          { endConditionName: 'Win', ticksElapsed: 6, metrics: { 'R#1': -3 } },
        ],
        { metricLabels: { 'R#1': 'Debt' } }
      )
    );
    const debt = recordsOf(batchReportToCsv(report)).find(
      r => r.section === 'final_value'
    )!;
    expect(debt.mean).toBe('-3');
  });
});

describe('engine/batchReportCsv — output', () => {
  it('ends every row in CRLF, with bare line feeds only inside quotes', () => {
    const csv = batchReportToCsv(
      buildBatchReport(
        batchOf([
          { endConditionName: 'line\nbreak', ticksElapsed: 5 },
          { endConditionName: 'Win', ticksElapsed: 6 },
        ])
      )
    );
    expect(csv.endsWith('\r\n')).toBe(true);
    const outsideQuotes = csv.replace(/"(?:[^"]|"")*"/g, '');
    expect(outsideQuotes).not.toMatch(/[^\r]\n/);
  });

  it('is deterministic for the same report and the same seed', () => {
    const report = bimodalReport();
    expect(batchReportToCsv(report)).toBe(batchReportToCsv(report));
    expect(batchReportToCsv(bimodalReport())).toBe(batchReportToCsv(report));
  });
});
