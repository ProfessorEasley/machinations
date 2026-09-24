import { describe, it, expect } from 'vitest';
import { formatStat, formatMeanWithMargin } from '../reportFormat';
import { summarize, meanInterval } from '../stats';

/**
 * Contract tests for the formatting shared by the CLI report and the Run panel.
 *
 * This module replaced two private helpers — `num` in the CLI and `stat` in the
 * sidebar — and the half-width arithmetic each of them did inline. The
 * replacement had to be invisible: same characters for the same numbers. So
 * the old rule is kept below, verbatim, as the reference every case is checked
 * against, alongside literal expectations that pin the reference itself.
 */

/** The removed `num` / `stat` helpers, verbatim. They were identical. */
const legacyStat = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(2);

/** The removed inline run-length rendering: `mean ±half-width`. */
const legacyMeanWithMargin = (mean: number, ci: [number, number]): string =>
  `${legacyStat(mean)} ±${legacyStat((ci[1] - ci[0]) / 2)}`;

describe('engine/reportFormat', () => {
  describe('formatStat', () => {
    it('prints integers bare', () => {
      expect(formatStat(0)).toBe('0');
      expect(formatStat(15)).toBe('15');
      expect(formatStat(-3)).toBe('-3');
      expect(formatStat(120)).toBe('120');
    });

    it('prints everything else to exactly two decimal places', () => {
      expect(formatStat(114.13333)).toBe('114.13');
      expect(formatStat(2.5)).toBe('2.50'); // padded, not trimmed
      expect(formatStat(-1.5)).toBe('-1.50');
      expect(formatStat(1 / 3)).toBe('0.33');
    });

    it('matches the removed CLI and sidebar helpers on every input', () => {
      // Includes the awkward corners the old rule already had, so a "cleaner"
      // rewrite cannot slip through: -0, integers too large for plain
      // notation, float noise, toFixed's binary rounding, and non-finite.
      const inputs = [
        0,
        -0,
        1,
        -7,
        4.97,
        114.13333333333334,
        0.1 + 0.2,
        2.675, // toFixed gives 2.67: 2.675 is stored as 2.67499999…
        1e-7,
        123456789.987,
        1e21,
        Number.MAX_SAFE_INTEGER,
        NaN,
        Infinity,
        -Infinity,
      ];
      for (const n of inputs) expect(formatStat(n)).toBe(legacyStat(n));
    });
  });

  describe('formatMeanWithMargin', () => {
    it('prints mean ±half-width, with no space after ±', () => {
      // [10, 12, 14, 16, 18]: mean 14, stdError √2, 95% margin 1.96·√2.
      const s = summarize([10, 12, 14, 16, 18])!;
      expect(formatMeanWithMargin(s, meanInterval(s))).toBe('14 ±2.77');
    });

    it('matches the removed inline rendering for real summaries', () => {
      const samples = [
        [10, 12, 14, 16, 18],
        [3, 7, 8, 12, 15, 15, 21, 29],
        [100, 102, 114, 115, 115, 118, 119, 120, 120],
        [8.5, 9, 7.25, 10],
        [5, 5, 5], // zero-width interval
        [42], // single observation
      ];
      for (const xs of samples) {
        const s = summarize(xs)!;
        const ci = meanInterval(s);
        expect(formatMeanWithMargin(s, ci)).toBe(
          legacyMeanWithMargin(s.mean, ci)
        );
      }
    });

    it('prints a zero-width interval as ±0', () => {
      const s = summarize([5, 5, 5])!;
      expect(formatMeanWithMargin(s, meanInterval(s))).toBe('5 ±0');
    });

    it('formats the interval it is given rather than recomputing one', () => {
      // A deliberately unrelated interval: had the half-width come from the
      // summary's stdError, this would not print ±5. Presentation formats the
      // report's estimates; it does not make its own.
      const s = summarize([10, 12, 14, 16, 18])!;
      expect(formatMeanWithMargin(s, [0, 10])).toBe('14 ±5');
    });
  });
});
