import { REPORT_PERCENTILES } from './batchReport';
import type { BatchReport, OutcomeShare } from './batchReport';
import { percentileLabel } from './reportFormat';
import { lookupPercentile } from './stats';
import type { NumericSummary } from './stats';

/**
 * Serializes a `BatchReport` as CSV — the full report, for analysis outside
 * the tool. The CLI (`--format csv`) and the Run panel's export both call
 * {@link batchReportToCsv}, so the two produce identical files.
 *
 * One rectangular table, so it opens as a single sheet anywhere. The first
 * column, `section`, says what a row describes; columns that do not apply to
 * a section are left empty:
 *
 *   - `batch` — one row: run counts, tick cap, base seed, average steps.
 *   - `pooled_run_length` — one row: run length over every completed run.
 *   - `outcome` — one row per outcome, most frequent first: its share and
 *     Wilson interval, its own run-length summary, and its outlier status.
 *   - `outlier` — one row per unusual run, in batch order, named by outcome.
 *   - `final_value` — one row per Pool/Register series, sorted by key.
 *
 * Every value is copied from the report; nothing is computed here. Numbers are
 * written with `String(n)` — full precision, independent of locale — and
 * `null` becomes an empty cell. Rows end in CRLF, as RFC 4180 specifies.
 */

/** Column order of every row. The percentile columns follow `REPORT_PERCENTILES`. */
export const BATCH_REPORT_CSV_COLUMNS: readonly string[] = [
  'section',
  'name',
  'key',
  'total_runs',
  'completed_runs',
  'censored_runs',
  'max_ticks',
  'seed',
  'average_steps',
  'count',
  'share_pct',
  'share_ci_low',
  'share_ci_high',
  'n',
  'mean',
  'variance',
  'std_dev',
  'std_error',
  'min',
  'max',
  ...REPORT_PERCENTILES.map(percentileLabel),
  'mean_ci_low',
  'mean_ci_high',
  'outliers',
  'outliers_checked',
  'run',
  'ticks',
];

type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;

/** Convert a batch report to CSV text, header first, every row CRLF-terminated. */
export function batchReportToCsv(report: BatchReport): string {
  const rows: Row[] = [
    {
      section: 'batch',
      total_runs: report.totalRuns,
      completed_runs: report.completedRuns,
      censored_runs: report.censoredRuns,
      max_ticks: report.maxTicks,
      seed: report.seed,
      average_steps: report.averageSteps,
    },
    {
      section: 'pooled_run_length',
      completed_runs: report.completedRuns,
      ...summaryCells(report.runLength, report.runLengthCI),
      outliers: report.runLengthOutliers.length,
    },
    ...report.outcomes.map(row => outcomeRow(report, row)),
    ...report.runLengthOutliers.map(o => ({
      section: 'outlier',
      name: o.outcome,
      seed: o.seed,
      run: o.run,
      ticks: o.ticksElapsed,
    })),
    ...report.metrics.map(m => ({
      section: 'final_value',
      name: m.label,
      key: m.key,
      ...summaryCells(m.summary, null),
    })),
  ];

  const lines = [
    BATCH_REPORT_CSV_COLUMNS.map(csvText).join(','),
    ...rows.map(row =>
      BATCH_REPORT_CSV_COLUMNS.map(column => csvCell(row[column])).join(',')
    ),
  ];
  return lines.map(line => line + '\r\n').join('');
}

function outcomeRow(report: BatchReport, row: OutcomeShare): Row {
  return {
    section: 'outcome',
    name: row.name,
    count: row.count,
    share_pct: row.pct,
    share_ci_low: row.ciLow,
    share_ci_high: row.ciHigh,
    completed_runs: row.completedRuns,
    ...summaryCells(row.runLength, row.runLengthCI),
    // How many of the `outlier` rows below belong to this outcome.
    outliers: report.runLengthOutliers.filter(o => o.outcome === row.name)
      .length,
    outliers_checked: row.outliersChecked,
  };
}

/** A summary's cells, or none at all when there is nothing measured. */
function summaryCells(
  summary: NumericSummary | null,
  ci: [low: number, high: number] | null
): Row {
  if (!summary) return {};
  const cells: Row = {
    n: summary.n,
    mean: summary.mean,
    variance: summary.variance,
    std_dev: summary.stdDev,
    std_error: summary.stdError,
    min: summary.min,
    max: summary.max,
    mean_ci_low: ci?.[0],
    mean_ci_high: ci?.[1],
  };
  for (const p of REPORT_PERCENTILES) {
    cells[percentileLabel(p)] = lookupPercentile(summary, p);
  }
  return cells;
}

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return csvText(value);
}

/**
 * Escape one text cell.
 *
 * Text starting with `=`, `+`, `-` or `@` (or a tab or carriage return) is
 * prefixed with `'`, so a spreadsheet shows it rather than evaluating it as a
 * formula — outcome and series names are user-written, and a diagram can come
 * from someone else. Numbers are never text here, so a negative number is not
 * affected. Then, per RFC 4180, a cell holding a comma, quote or line break is
 * quoted, with inner quotes doubled.
 */
function csvText(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
