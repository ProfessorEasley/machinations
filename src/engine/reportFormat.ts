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
