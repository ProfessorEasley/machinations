import { describe, it, expect } from 'vitest';
import {
  percentile,
  mean,
  summarize,
  lookupPercentile,
  meanInterval,
  wilsonInterval,
  outlierIndicesIQR,
  histogram,
} from '../stats';
import type { Histogram, HistogramOptions } from '../stats';

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

  describe('summarize — requested percentiles', () => {
    // Ten values, deliberately unsorted, so an unsorted read would be caught.
    const xs = [7, 1, 10, 3, 5, 9, 2, 8, 4, 6];
    const sorted = [...xs].sort((a, b) => a - b);

    it('computes none by default and leaves every existing field alone', () => {
      const plain = summarize(xs)!;
      const extended = summarize(xs, { percentiles: [0.05, 0.9, 0.99] })!;

      expect(plain.percentiles).toEqual([]);
      // Requesting percentiles adds to the summary; it never moves a number
      // an existing consumer already reads — not even in the last bit.
      for (const key of Object.keys(plain) as (keyof typeof plain)[]) {
        if (key === 'percentiles') continue;
        expect(extended[key]).toBe(plain[key]);
      }
    });

    it('interpolates arbitrary percentiles by the same type-7 rule', () => {
      // h = (n-1)*p = 0.9, so 1 + 0.9*(2-1). Nearest-rank would give 1.
      const s = summarize(xs, { percentiles: [0.1] })!;
      expect(s.percentiles[0].value).toBeCloseTo(1.9, 10);

      const ps = [0.05, 0.1, 0.33, 0.99];
      const values = summarize(xs, { percentiles: ps })!.percentiles;
      values.forEach(({ p, value }) => {
        expect(value).toBe(percentile(sorted, p));
      });
    });

    it('agrees bit for bit with the fixed fields it overlaps', () => {
      // Same function, same sorted copy — so the CLI's p90 and a report's
      // requested 0.9 can never print as two different roundings.
      const s = summarize(xs, {
        percentiles: [0.25, 0.5, 0.75, 0.9, 0.95],
      })!;
      expect(lookupPercentile(s, 0.25)).toBe(s.p25);
      expect(lookupPercentile(s, 0.5)).toBe(s.p50);
      expect(lookupPercentile(s, 0.75)).toBe(s.p75);
      expect(lookupPercentile(s, 0.9)).toBe(s.p90);
      expect(lookupPercentile(s, 0.95)).toBe(s.p95);
    });

    it('returns the requested list ascending and without duplicates', () => {
      const s = summarize(xs, { percentiles: [0.9, 0.1, 0.5, 0.9, 0.1] })!;
      expect(s.percentiles.map(point => point.p)).toEqual([0.1, 0.5, 0.9]);
    });

    it('accepts the endpoints 0 and 1', () => {
      const s = summarize(xs, { percentiles: [0, 1] })!;
      expect(lookupPercentile(s, 0)).toBe(s.min);
      expect(lookupPercentile(s, 1)).toBe(s.max);
    });

    it('rejects a percentile written on the 0–100 scale', () => {
      // percentile() would clamp 90 to the maximum and report it as "p90".
      expect(() => summarize(xs, { percentiles: [90] })).toThrow(RangeError);
    });

    it('rejects negative and non-finite percentiles', () => {
      expect(() => summarize(xs, { percentiles: [-0.1] })).toThrow(RangeError);
      expect(() => summarize(xs, { percentiles: [NaN] })).toThrow(RangeError);
      expect(() => summarize(xs, { percentiles: [Infinity] })).toThrow(
        RangeError
      );
    });

    it('rejects a bad list even when the sample is empty', () => {
      // A configuration mistake should fail on the first call, not wait for
      // the first batch that happens to have data.
      expect(() => summarize([], { percentiles: [90] })).toThrow(RangeError);
      expect(summarize([], { percentiles: [0.9] })).toBeNull();
    });

    it('does not mutate the caller sample or the requested list', () => {
      const sample = [3, 1, 2];
      const ps = [0.9, 0.1];
      summarize(sample, { percentiles: ps });
      expect(sample).toEqual([3, 1, 2]);
      expect(ps).toEqual([0.9, 0.1]);
    });
  });

  describe('lookupPercentile', () => {
    it('returns a requested percentile', () => {
      const s = summarize([1, 2, 3, 4], { percentiles: [0.25] })!;
      expect(lookupPercentile(s, 0.25)).toBeCloseTo(1.75, 10);
    });

    it('returns undefined for a percentile that was not requested', () => {
      // Even one that exists as a fixed field: this is a lookup, and it does
      // not quietly fall back to computing or substituting a value.
      const s = summarize([1, 2, 3, 4], { percentiles: [0.25] })!;
      expect(lookupPercentile(s, 0.9)).toBeUndefined();
      expect(lookupPercentile(s, 0.5)).toBeUndefined();
      expect(lookupPercentile(summarize([1, 2, 3])!, 0.5)).toBeUndefined();
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

  describe('histogram', () => {
    // Eight run lengths, used by most of the worked examples below.
    const runs = [3, 7, 8, 12, 15, 15, 21, 29];

    const counts = (h: Histogram) => h.bins.map(b => b.count);
    const edges = (h: Histogram) => h.bins.map(b => [b.lo, b.hi]);
    const accounted = (h: Histogram) =>
      counts(h).reduce((sum, c) => sum + c, 0) + h.below + h.above;

    it("defaults to Sturges' bin count over the sample's own range", () => {
      // ceil(log2 8) + 1 = 4 bins across [3, 29], each 26 / 4 = 6.5 wide.
      const h = histogram(runs)!;
      expect(edges(h)).toEqual([
        [3, 9.5],
        [9.5, 16],
        [16, 22.5],
        [22.5, 29],
      ]);
      expect(counts(h)).toEqual([3, 3, 1, 1]);
      expect(h.below).toBe(0);
      expect(h.above).toBe(0);

      const thousand = Array.from({ length: 1000 }, (_, i) => i);
      expect(histogram(thousand)!.bins).toHaveLength(11);
    });

    it('splits the range into the requested number of bins', () => {
      // [3, 29] in two bins of 13: everything up to 15 falls in the first.
      const h = histogram(runs, { binCount: 2 })!;
      expect(edges(h)).toEqual([
        [3, 16],
        [16, 29],
      ]);
      expect(counts(h)).toEqual([6, 2]);
    });

    it('lays out bins of a fixed width', () => {
      const h = histogram(runs, { binWidth: 10, range: [0, 30] })!;
      expect(edges(h)).toEqual([
        [0, 10],
        [10, 20],
        [20, 30],
      ]);
      expect(counts(h)).toEqual([3, 3, 2]);
    });

    it('accounts for every value exactly once, whatever the options', () => {
      const cases: HistogramOptions[] = [
        {},
        { binCount: 3 },
        { binWidth: 10, range: [0, 30] },
        { binWidth: 10, range: [0, 20] },
        { binCount: 2, range: [10, 20] },
        { binWidth: 10, range: [0, 25] },
      ];
      for (const options of cases) {
        const h = histogram(runs, options)!;
        expect(h.n).toBe(runs.length);
        expect(accounted(h)).toBe(h.n);
      }
    });

    it('makes bins half-open, so a value on an inner edge goes up', () => {
      const h = histogram([0, 10, 20], { binWidth: 10, range: [0, 30] })!;
      expect(counts(h)).toEqual([1, 1, 1]);
    });

    it('closes the last bin, so the maximum is always counted', () => {
      // Edges [0, 5) and [5, 10]: the 10 belongs to the last bin, not above.
      const h = histogram([0, 5, 10], { binCount: 2 })!;
      expect(counts(h)).toEqual([1, 2]);
      expect(h.above).toBe(0);
    });

    it('counts out-of-range values instead of dropping them', () => {
      const upper = histogram(runs, { binWidth: 10, range: [0, 20] })!;
      expect(counts(upper)).toEqual([3, 3]);
      expect(upper.below).toBe(0);
      expect(upper.above).toBe(2); // 21 and 29

      // Edges [10, 15) and [15, 20]: 3, 7, 8 are below; 21, 29 above.
      const both = histogram(runs, { binCount: 2, range: [10, 20] })!;
      expect(counts(both)).toEqual([1, 2]);
      expect(both.below).toBe(3);
      expect(both.above).toBe(2);
    });

    it('keeps equal-width bins when binWidth does not divide the range', () => {
      // A narrower [20, 25] bin would draw as a shorter bar for the same
      // density, so the last bin keeps the full width: [20, 30]. The range
      // still decides membership — 26 and 30 sit inside that bin's bounds but
      // outside [0, 25], so they are counted above, not binned.
      const xs = [-1, 0, 9, 10, 20, 25, 26, 30];
      const h = histogram(xs, { binWidth: 10, range: [0, 25] })!;
      expect(edges(h)).toEqual([
        [0, 10],
        [10, 20],
        [20, 30],
      ]);
      for (const bin of h.bins) expect(bin.hi - bin.lo).toBe(10);
      expect(counts(h)).toEqual([2, 1, 2]); // 0, 9 | 10 | 20, 25
      expect(h.below).toBe(1); // -1
      expect(h.above).toBe(2); // 26, 30
      expect(accounted(h)).toBe(xs.length);
    });

    it('puts integer data on integer edges given a whole-number width', () => {
      // The run-length case: no fractional edges like the Sturges default's.
      const h = histogram(runs, { binWidth: 10, range: [0, 29] })!;
      expect(edges(h)).toEqual([
        [0, 10],
        [10, 20],
        [20, 30],
      ]);
      for (const bin of h.bins) {
        expect(Number.isInteger(bin.lo)).toBe(true);
        expect(Number.isInteger(bin.hi)).toBe(true);
      }
      expect(counts(h)).toEqual([3, 3, 2]);
    });

    it('computes edges by multiplication, so they do not drift', () => {
      // Ten additions of 0.1 give 0.9999999999999999: an accumulated last
      // edge would stop short of 1 and push the maximum out of every bin.
      const h = histogram([0, 1], { binWidth: 0.1, range: [0, 1] })!;
      expect(h.bins).toHaveLength(10);
      h.bins.forEach((bin, i) => expect(bin.lo).toBe(i * 0.1));
      expect(h.bins[9].hi).toBe(1);
      expect(counts(h)[0]).toBe(1);
      expect(counts(h)[9]).toBe(1);
      expect(h.above).toBe(0);
    });

    it('adds no empty bin when a decimal width divides the range', () => {
      // 2.1 / 0.3 evaluates to 7.000000000000001; a plain ceil would make an
      // eighth bin, [2.1, 2.4], that nothing in range can ever land in.
      const h = histogram([0, 2.1], { binWidth: 0.3, range: [0, 2.1] })!;
      expect(h.bins).toHaveLength(7);
      expect(h.bins[6].hi).toBe(2.1);
      expect(counts(h)[6]).toBe(1);
    });

    it('never places a value in a bin whose bounds exclude it', () => {
      // A hundredths grid against 0.1-wide bins: many values sit a rounding
      // error from an edge (3 * 0.1 is 0.30000000000000004, not 0.3). Recount
      // each bin straight from its reported bounds; the two must agree.
      const xs = Array.from({ length: 101 }, (_, i) => i / 100);
      const h = histogram(xs, { binWidth: 0.1, range: [0, 1] })!;
      h.bins.forEach((bin, i) => {
        const last = i === h.bins.length - 1;
        const inBounds = xs.filter(
          x => x >= bin.lo && (last ? x <= bin.hi : x < bin.hi)
        );
        expect(bin.count).toBe(inBounds.length);
      });
      expect(accounted(h)).toBe(xs.length);
    });

    it('gives a zero-spread sample a single bin, whatever the options', () => {
      const expected = [{ lo: 5, hi: 5, count: 3 }];
      expect(histogram([5, 5, 5])!.bins).toEqual(expected);
      expect(histogram([5, 5, 5], { binCount: 4 })!.bins).toEqual(expected);
      expect(histogram([5, 5, 5], { binWidth: 2 })!.bins).toEqual(expected);
    });

    it('treats a zero-width range as one bin, the rest outside', () => {
      const h = histogram([4, 5, 6], { range: [5, 5] })!;
      expect(h.bins).toEqual([{ lo: 5, hi: 5, count: 1 }]);
      expect(h.below).toBe(1);
      expect(h.above).toBe(1);
    });

    it('returns null for an empty sample', () => {
      expect(histogram([])).toBeNull();
      expect(histogram([], { binWidth: 10, range: [0, 30] })).toBeNull();
    });

    it('rejects invalid options, even on an empty sample', () => {
      const invalid: HistogramOptions[] = [
        { binCount: 2, binWidth: 10 },
        { binCount: 0 },
        { binCount: 2.5 },
        { binCount: NaN },
        { binWidth: 0 },
        { binWidth: -1 },
        { binWidth: NaN },
        { binWidth: Infinity },
        { range: [10, 0] },
        { range: [NaN, 1] },
        { range: [0, Infinity] },
      ];
      for (const options of invalid) {
        expect(() => histogram(runs, options)).toThrow(RangeError);
        expect(() => histogram([], options)).toThrow(RangeError);
      }
    });

    it('rejects non-finite values rather than losing them', () => {
      // A NaN falls in no bin and would silently break the n invariant.
      expect(() => histogram([1, NaN, 3])).toThrow(RangeError);
      expect(() => histogram([1, Infinity])).toThrow(RangeError);
    });

    it('refuses a configuration that would build too many bins', () => {
      expect(histogram(runs, { binCount: 10_000 })!.bins).toHaveLength(10_000);
      expect(() => histogram(runs, { binCount: 10_001 })).toThrow(RangeError);
      expect(() => histogram([0, 1], { binWidth: 1e-9 })).toThrow(RangeError);
    });

    it('does not mutate the caller sample', () => {
      const xs = [29, 3, 15];
      histogram(xs, { binWidth: 10 });
      expect(xs).toEqual([29, 3, 15]);
    });
  });
});
