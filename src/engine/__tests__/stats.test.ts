import { describe, it, expect } from 'vitest';
import {
  percentile,
  mean,
  summarize,
  meanInterval,
  wilsonInterval,
  outlierIndicesIQR,
} from '../stats';

/**
 * Contract tests for the batch estimator's numeric layer.
 *
 * Two conventions here are invisible until someone changes them, and both move
 * every number the CLI and the Run panel display: percentiles interpolate by
 * the R type-7 rule, and variance uses the `n - 1` sample denominator. Those
 * are pinned first, with samples chosen so a switch to the other convention
 * produces a different value rather than the same one by luck.
 */
describe('engine/stats', () => {
  describe('percentile — R type-7 interpolation', () => {
    it('takes the middle element of an odd-sized sample', () => {
      expect(percentile([1, 2, 3], 0.5)).toBe(2);
      expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
    });

    it('averages the middle pair of an even-sized sample', () => {
      expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    });

    it('interpolates between order statistics off the exact rank', () => {
      // h = (n-1)*p = 0.75, so 1 + 0.75*(2-1). Nearest-rank would give 2.
      expect(percentile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
      // h = 2.25, so 3 + 0.25*(4-3). Nearest-rank would give 3.
      expect(percentile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25, 10);
    });

    it('returns the endpoints at p=0 and p=1', () => {
      expect(percentile([5, 6, 7], 0)).toBe(5);
      expect(percentile([5, 6, 7], 1)).toBe(7);
    });

    it('returns the only value of a single-element sample', () => {
      expect(percentile([42], 0.9)).toBe(42);
      expect(percentile([42], 0)).toBe(42);
    });

    it('returns NaN for an empty sample', () => {
      expect(percentile([], 0.5)).toBeNaN();
    });

    it('clamps percentiles outside [0, 1] to the endpoints', () => {
      expect(percentile([1, 2, 3], -0.5)).toBe(1);
      expect(percentile([1, 2, 3], 1.5)).toBe(3);
    });
  });

  describe('mean', () => {
    it('averages a sample', () => {
      expect(mean([10, 20, 30])).toBe(20);
      expect(mean([2, 100])).toBe(51);
    });

    it('returns 0 — not NaN — for an empty sample', () => {
      expect(mean([])).toBe(0);
      expect(Number.isNaN(mean([]))).toBe(false);
    });

    it('agrees exactly with the mean summarize reports', () => {
      // Both go through the same Welford accumulation. If they ever diverge,
      // a batch report can print two different roundings of one number.
      const xs = [6, 7, 8, 9, 9, 10, 10, 8, 9, 9, 7, 10, 9, 8, 9, 10];
      expect(mean(xs)).toBe(summarize(xs)!.mean);
    });
  });

  describe('summarize — sample variance', () => {
    it('uses the n-1 denominator, not the population n', () => {
      // Sum of squared deviations is 32 about a mean of 5.
      // Sample: 32/7 = 4.571…   Population: 32/8 = 4 exactly.
      const s = summarize([2, 4, 4, 4, 5, 5, 7, 9])!;
      expect(s.mean).toBe(5);
      expect(s.variance).toBeCloseTo(32 / 7, 12);
      expect(s.variance).not.toBeCloseTo(4, 6);
      expect(s.stdDev).toBeCloseTo(Math.sqrt(32 / 7), 12);
    });

    it('reports zero variance for a single observation', () => {
      const s = summarize([7])!;
      expect(s.n).toBe(1);
      expect(s.variance).toBe(0);
      expect(s.stdDev).toBe(0);
      expect(s.stdError).toBe(0);
      expect(s.min).toBe(7);
      expect(s.max).toBe(7);
      expect(s.p50).toBe(7);
    });

    it('reports zero spread when every value is identical', () => {
      const s = summarize([3, 3, 3, 3])!;
      expect(s.variance).toBe(0);
      expect(s.iqr).toBe(0);
      expect(s.p95).toBe(3);
    });

    it('derives stdError as stdDev / sqrt(n)', () => {
      const s = summarize([1, 2, 3, 4, 5])!;
      expect(s.stdError).toBeCloseTo(s.stdDev / Math.sqrt(5), 12);
    });

    it('returns null for an empty sample rather than a record of NaN', () => {
      expect(summarize([])).toBeNull();
    });

    it('reports min, max and the quartiles', () => {
      const s = summarize([1, 2, 3, 4, 5, 6, 7, 8])!;
      expect(s.n).toBe(8);
      expect(s.min).toBe(1);
      expect(s.max).toBe(8);
      expect(s.p25).toBeCloseTo(2.75, 10);
      expect(s.p50).toBe(4.5);
      expect(s.p75).toBeCloseTo(6.25, 10);
      expect(s.iqr).toBeCloseTo(3.5, 10);
    });

    it('does not mutate or reorder the caller sample', () => {
      const xs = [3, 1, 2];
      summarize(xs);
      expect(xs).toEqual([3, 1, 2]);
    });
  });

  describe('summarize — Welford numerical stability', () => {
    it('survives a large mean with a small spread', () => {
      // Deviations of 4,7,13,16 about 1e9. A naive E[x²]-E[x]² loses almost
      // every significant digit here and can even return a negative variance.
      const xs = [1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16];
      const s = summarize(xs)!;
      expect(s.variance).toBeCloseTo(30, 6);
      expect(s.variance).toBeGreaterThan(0);
      expect(s.mean).toBeCloseTo(1e9 + 10, 6);
    });

    it('matches the small-magnitude equivalent of the same spread', () => {
      // Shifting a sample by a constant must not change its variance.
      const small = summarize([4, 7, 13, 16])!;
      const shifted = summarize([1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16])!;
      expect(shifted.variance).toBeCloseTo(small.variance, 6);
    });
  });

  describe('meanInterval', () => {
    it('centres on the mean and scales with the standard error', () => {
      const s = summarize([10, 12, 14, 16, 18])!;
      const [low, high] = meanInterval(s);
      expect((low + high) / 2).toBeCloseTo(s.mean, 12);
      expect(high - low).toBeCloseTo(2 * 1.96 * s.stdError, 12);
    });

    it('collapses to a point when every observation agrees', () => {
      expect(meanInterval(summarize([5, 5, 5])!)).toEqual([5, 5]);
    });

    it('honours a custom z', () => {
      const s = summarize([1, 2, 3, 4])!;
      const [lo95, hi95] = meanInterval(s, 1.96);
      const [lo99, hi99] = meanInterval(s, 2.576);
      expect(hi99 - lo99).toBeGreaterThan(hi95 - lo95);
    });
  });

  describe('wilsonInterval', () => {
    it('does not collapse to [0, 0] for a zero-count outcome', () => {
      // The whole reason Wilson is used instead of the normal approximation:
      // 0 of 20 must not be reported as "impossible".
      const [low, high] = wilsonInterval(0, 20);
      expect(low).toBe(0);
      expect(high).toBeGreaterThan(0.1);
      expect(high).toBeLessThan(0.25);
    });

    it('does not collapse to [1, 1] for an all-count outcome', () => {
      const [low, high] = wilsonInterval(20, 20);
      expect(high).toBe(1);
      expect(low).toBeGreaterThan(0.75);
      expect(low).toBeLessThan(1);
    });

    it('brackets the observed proportion', () => {
      const [low, high] = wilsonInterval(61, 100);
      expect(low).toBeLessThan(0.61);
      expect(high).toBeGreaterThan(0.61);
    });

    it('stays inside [0, 1] across the range', () => {
      for (const count of [0, 1, 5, 19, 20]) {
        const [low, high] = wilsonInterval(count, 20);
        expect(low).toBeGreaterThanOrEqual(0);
        expect(high).toBeLessThanOrEqual(1);
        expect(low).toBeLessThanOrEqual(high);
      }
    });

    it('narrows as the sample grows at a fixed proportion', () => {
      const width = (c: number, n: number) => {
        const [low, high] = wilsonInterval(c, n);
        return high - low;
      };
      expect(width(1200, 2000)).toBeLessThan(width(120, 200));
      expect(width(120, 200)).toBeLessThan(width(12, 20));
    });

    it('returns the unconstrained interval when there is no data', () => {
      expect(wilsonInterval(0, 0)).toEqual([0, 1]);
    });
  });

  describe('outlierIndicesIQR', () => {
    it('returns indices into the original sample, not values', () => {
      // p25 = 2, p75 = 4, iqr = 2, upper fence = 7. The 100 sits at index 4.
      expect(outlierIndicesIQR([1, 2, 3, 4, 100])).toEqual([4]);
    });

    it('reports indices in the caller order, not sorted order', () => {
      // The outlier is first here; a sorted-order index would report 4.
      expect(outlierIndicesIQR([100, 1, 2, 3, 4])).toEqual([0]);
    });

    it('flags low outliers as well as high ones', () => {
      expect(outlierIndicesIQR([-500, 10, 11, 12, 13])).toEqual([0]);
    });

    it('finds several outliers at once', () => {
      expect(outlierIndicesIQR([-400, 10, 11, 12, 13, 900])).toEqual([0, 5]);
    });

    it('returns nothing for a tightly grouped sample', () => {
      expect(outlierIndicesIQR([10, 11, 12, 13, 14])).toEqual([]);
    });

    it('declines to judge a sample smaller than four', () => {
      // Too few points for meaningful quartiles.
      expect(outlierIndicesIQR([1, 1000, 1])).toEqual([]);
      expect(outlierIndicesIQR([1, 1000])).toEqual([]);
      expect(outlierIndicesIQR([])).toEqual([]);
    });

    it('returns nothing when the IQR is zero', () => {
      // No scale against which "far away" means anything, so a deterministic
      // model does not report every run as an outlier.
      expect(outlierIndicesIQR([5, 5, 5, 5, 5])).toEqual([]);
      expect(outlierIndicesIQR([5, 5, 5, 5, 5, 99])).toEqual([]);
    });

    it('widens the fences as k grows', () => {
      const xs = [1, 2, 3, 4, 8];
      expect(outlierIndicesIQR(xs, 1.5)).toEqual([4]);
      expect(outlierIndicesIQR(xs, 3)).toEqual([]);
    });

    it('does not mutate or reorder the caller sample', () => {
      const xs = [100, 1, 2, 3, 4];
      outlierIndicesIQR(xs);
      expect(xs).toEqual([100, 1, 2, 3, 4]);
    });
  });
});
