import { lookupPercentile } from './stats';
import type { NumericSummary } from './stats';

/**
 * Shared number formatting for batch-report presentation.
 *
 * The CLI report and the UI's Run panel print the same numbers from the same
 * `BatchReport`; this module decides how those numbers *look*, so the two
 * cannot drift into printing one value two ways. It deliberately decides
 * nothing about what a number *is* — every statistic is computed upstream in
 * `./batchReport` and only ever formatted here.
 */

/**
 * Trim a number for display: integers bare, everything else to 2dp.
 *
 * Fits both a fixed-width CLI column and the narrow sidebar, which previously
 * each kept a private copy of this rule.
 */
export function formatStat(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * A mean with the half-width of its confidence interval, e.g. `"114.13 ±1.26"`.
 *
 * Takes the interval the report already computed rather than rebuilding it
 * from `summary.stdError`: presentation formats estimates, it does not make
 * them. The half-width is `(high - low) / 2` — the same arithmetic the CLI and
 * sidebar each used inline before, so the printed digits are unchanged.
 *
 * Writing an interval as `±` assumes it is symmetric about the mean, which the
 * normal-approximation interval is. Should an asymmetric one ever be reported,
 * this is the one place that has to change to print `[low, high]` instead.
 */
export function formatMeanWithMargin(
  summary: NumericSummary,
  ci: [low: number, high: number]
): string {
  return `${formatStat(summary.mean)} ±${formatStat((ci[1] - ci[0]) / 2)}`;
}

/**
 * The upper percentile a compact view shows beside the variance — the Run
 * panel's per-outcome line. One of the report's percentiles; changing which
 * one is shown is a change to this constant alone.
 */
export const HEADLINE_UPPER_PERCENTILE = 0.9;

/**
 * Display name of a percentile: `0.05` → `"p5"`, `0.9` → `"p90"`,
 * `0.999` → `"p99.9"`.
 *
 * Rounded before printing because the scaling is inexact in binary —
 * `0.07 * 100` is `7.000000000000001` — and a label must not show that.
 */
export function percentileLabel(p: number): string {
  return `p${Number((p * 100).toFixed(6))}`;
}

/**
 * A labelled percentile read off a summary, e.g. `"p90 17"`.
 *
 * Reads the value the report already computed; it never computes one. Asking
 * for a percentile the summary was not built with is a programming error —
 * every report summary carries the same set — so it throws rather than print
 * a placeholder that would hide the mistake.
 */
export function formatPercentile(summary: NumericSummary, p: number): string {
  const value = lookupPercentile(summary, p);
  if (value === undefined) {
    throw new Error(`summary does not carry percentile ${p}`);
  }
  return `${percentileLabel(p)} ${formatStat(value)}`;
}
