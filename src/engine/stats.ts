/**
 * Descriptive statistics for Monte Carlo batches.
 *
 * Pure numeric helpers with no engine, React or DOM dependencies: numbers in,
 * statistics out. Keeping this module ignorant of simulations is deliberate —
 * it can be unit-tested without constructing a single `GraphElement`, and a
 * future parameter sweep or chart component can reuse it unchanged. The layer
 * that knows what a run is lives in `./batchReport`.
 *
 * Two conventions are pinned here because they change the numbers on small
 * samples and every consumer must agree on them:
 *
 *   - **Variance is the sample variance (`n - 1` denominator).** A batch is a
 *     sample drawn from a stochastic model, not an enumerated population.
 *   - **Percentiles interpolate linearly between order statistics** — the R
 *     type-7 rule, which is also `numpy.percentile`'s default.
 */

/** One requested percentile of a sample: `p` in [0, 1] and its value. */
export interface PercentilePoint {
  p: number;
  value: number;
}

export interface SummarizeOptions {
  /**
   * Extra percentiles to compute, each in [0, 1] — `0.9` for the 90th, not
   * `90`. Order and duplicates do not matter. Default: none.
   *
   * Which percentiles are worth reporting is the caller's decision, so this
   * module fixes no set of its own beyond the `p25`…`p95` fields below.
   */
  percentiles?: readonly number[];
}

/** Summary of one numeric sample. All fields are finite when `n >= 1`. */
export interface NumericSummary {
  /** Number of observations. */
  n: number;
  mean: number;
  /** Sample variance (`n - 1` denominator); 0 when `n === 1`. */
  variance: number;
  /** Square root of {@link variance}. */
  stdDev: number;
  /**
   * Standard error of the mean, `stdDev / sqrt(n)` — the spread of the
   * *estimate*, not of the data.
   *
   * This is the number that answers "was the batch big enough?". It shrinks as
   * `1 / sqrt(n)`, so halving it costs four times the runs.
   */
  stdError: number;
  min: number;
  max: number;
  p25: number;
  /** Median. */
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  /** Interquartile range, `p75 - p25`. */
  iqr: number;
  /**
   * The percentiles requested through {@link SummarizeOptions.percentiles}, in
   * ascending `p` order; empty when none were requested.
   *
   * Computed from the same sorted copy as the fixed fields above, so a
   * requested `0.9` is bit-identical to {@link p90}. Read one back with
   * {@link lookupPercentile}.
   */
  percentiles: PercentilePoint[];
}

/**
 * Value at percentile `p` (0..1) of an **already ascending-sorted** sample.
 *
 * Interpolates linearly between the two nearest order statistics, so
 * `percentile(xs, 0.5)` averages the middle pair on an even-length sample.
 * Returns `NaN` for an empty sample — callers should go through
 * {@link summarize}, which rejects empty input up front.
 */
export function percentile(sortedAsc: number[], p: number): number {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0];

  const clamped = Math.min(1, Math.max(0, p));
  const h = (n - 1) * clamped;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (h - lo) * (sortedAsc[hi] - sortedAsc[lo]);
}

/**
 * Mean and sample variance in one pass, via Welford's online algorithm.
 *
 * Numerically stable where the naive sum-of-squares formula is not: once the
 * mean is large relative to the spread, `E[x²] - E[x]²` cancels away most of
 * its significant digits. Welford also generalises to streaming accumulation
 * if batches ever outgrow memory.
 */
function meanAndVariance(xs: number[]): { mean: number; variance: number } {
  let n = 0;
  let mean = 0;
  let m2 = 0;
  for (const x of xs) {
    n += 1;
    const delta = x - mean;
    mean += delta / n;
    m2 += delta * (x - mean);
  }
  return { mean, variance: n > 1 ? m2 / (n - 1) : 0 };
}

/**
 * Arithmetic mean of a sample; `0` for an empty one.
 *
 * Shares {@link meanAndVariance}'s Welford accumulation with {@link summarize},
 * so a mean computed here and one read off a `NumericSummary` agree bit for
 * bit. That matters where both appear in the same report: a naive running sum
 * and Welford can land either side of a rounding boundary and print as, say,
 * `8.68` beside `8.67` for what is arithmetically the same number.
 */
export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : meanAndVariance(xs).mean;
}

/**
 * Validate a requested percentile list and put it in canonical form: ascending,
 * without duplicates.
 *
 * Stricter than {@link percentile}, which clamps. A list is configuration, and
 * the likely mistake in it is `90` written for the 90th percentile — clamping
 * would quietly report the maximum under that name, so this throws instead.
 */
function normalizePercentiles(ps: readonly number[]): number[] {
  for (const p of ps) {
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new RangeError(
        `percentile must be a finite number in [0, 1], got ${p}`
      );
    }
  }
  return [...new Set(ps)].sort((a, b) => a - b);
}

/**
 * Summarize a numeric sample.
 *
 * Returns `null` for an empty sample rather than a record full of `NaN`, so
 * callers are forced to handle "no data" instead of rendering it. Does not
 * mutate `xs` — it sorts a copy.
 *
 * Any `options.percentiles` are read off that same sorted copy, so asking for
 * more of them costs no extra sort. The list is validated before the sample is
 * looked at: a bad configuration throws even when a batch happens to be empty,
 * rather than hiding until the first batch with data.
 */
export function summarize(
  xs: number[],
  options: SummarizeOptions = {}
): NumericSummary | null {
  const requested = normalizePercentiles(options.percentiles ?? []);
  if (xs.length === 0) return null;

  const sorted = [...xs].sort((a, b) => a - b);
  const { mean, variance } = meanAndVariance(xs);
  const stdDev = Math.sqrt(variance);
  const p25 = percentile(sorted, 0.25);
  const p75 = percentile(sorted, 0.75);

  return {
    n: xs.length,
    mean,
    variance,
    stdDev,
    stdError: stdDev / Math.sqrt(xs.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p25,
    p50: percentile(sorted, 0.5),
    p75,
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    iqr: p75 - p25,
    percentiles: requested.map(p => ({ p, value: percentile(sorted, p) })),
  };
}

/**
 * Read a percentile that {@link summarize} was asked to compute; `undefined`
 * when `p` was not requested.
 *
 * A lookup, not a calculation — a summary no longer holds the sample, so there
 * is nothing to compute from. Matches `p` exactly, which is safe because
 * callers pass the same constant they requested it with.
 */
export function lookupPercentile(
  summary: NumericSummary,
  p: number
): number | undefined {
  return summary.percentiles.find(point => point.p === p)?.value;
}

/**
 * Normal-approximation confidence interval for the mean; `z` defaults to 1.96
 * (95%).
 *
 * Leans on the central limit theorem, which holds comfortably for the mean of a
 * few hundred runs even when the underlying distribution is skewed — but not
 * for `n` in the single digits. Collapses to a point for a zero-variance
 * sample, which is the correct answer: every run agreed.
 */
export function meanInterval(
  summary: NumericSummary,
  z = 1.96
): [low: number, high: number] {
  const margin = z * summary.stdError;
  return [summary.mean - margin, summary.mean + margin];
}

/**
 * Wilson score interval for a proportion — an outcome's share of a batch.
 *
 * Preferred over the textbook normal approximation because it stays inside
 * [0, 1] and behaves sensibly at the extremes: a 0-of-200 outcome gets an
 * honest upper bound instead of the degenerate interval `[0, 0]` that would
 * claim the outcome is impossible.
 *
 * Returns `[0, 1]` when `total` is 0 — no data constrains nothing.
 */
export function wilsonInterval(
  count: number,
  total: number,
  z = 1.96
): [low: number, high: number] {
  if (total <= 0) return [0, 1];

  const phat = count / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (phat + z2 / (2 * total)) / denom;
  const margin =
    (z / denom) *
    Math.sqrt((phat * (1 - phat)) / total + z2 / (4 * total * total));

  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/**
 * Indices of observations outside `[p25 - k*iqr, p75 + k*iqr]` — Tukey's rule,
 * with `k` defaulting to 1.5.
 *
 * Returns **indices, not values**, so a caller can map an outlier back to the
 * run that produced it and replay that run from its seed. A value alone is a
 * dead end.
 *
 * Chosen over a z-score rule because run-length distributions here are usually
 * right-skewed and often multi-modal — different end conditions winning at
 * different speeds — which inflates the standard deviation until `mean ± 3σ`
 * flags either nothing at all or an entire outcome class. For that same reason,
 * bucketing runs by outcome and detecting within each bucket beats running this
 * across a mixed batch.
 *
 * Declines to judge samples smaller than four (no meaningful quartiles) or with
 * a zero IQR (no scale against which "far" means anything).
 */
export function outlierIndicesIQR(xs: number[], k = 1.5): number[] {
  if (xs.length < 4) return [];

  const sorted = [...xs].sort((a, b) => a - b);
  const p25 = percentile(sorted, 0.25);
  const p75 = percentile(sorted, 0.75);
  const iqr = p75 - p25;
  if (iqr === 0) return [];

  const low = p25 - k * iqr;
  const high = p75 + k * iqr;

  const out: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] < low || xs[i] > high) out.push(i);
  }
  return out;
}

/** One histogram bin: values with `lo <= v < hi` (the last bin: `<= hi`). */
export interface HistogramBin {
  lo: number;
  hi: number;
  count: number;
}

export interface HistogramOptions {
  /**
   * Number of equal-width bins spanning the range. Mutually exclusive with
   * {@link binWidth}. Default, when neither is given: Sturges' rule,
   * `ceil(log2 n) + 1`.
   */
  binCount?: number;
  /**
   * Width of every bin. Bins start at the range's low end and are added until
   * they cover its high end; the last bin keeps the full width even when that
   * carries it past the range (see {@link Histogram.above}).
   */
  binWidth?: number;
  /** Values considered in range, `[min, max]`. Default: the sample's own. */
  range?: [min: number, max: number];
}

export interface Histogram {
  bins: HistogramBin[];
  /** Values below the range's low end — counted, never dropped. */
  below: number;
  /**
   * Values above the range's high end — counted, never dropped.
   *
   * Decided by the range alone, not by the bin edges: with `range: [0, 25]`
   * and `binWidth: 10` the last bin is `[20, 30]`, yet a 27 lands here, since
   * 27 is outside the range that was asked for.
   */
  above: number;
  /** Sample size. Always `sum of bins[].count + below + above`. */
  n: number;
}

/**
 * Most bins a histogram will build. A guard against a bin width that is tiny
 * relative to its range, which would otherwise allocate billions of bins.
 */
const MAX_HISTOGRAM_BINS = 10_000;

/**
 * Relative tolerance when dividing a span into bins of a given width. Decimal
 * widths are inexact in binary: `2.1 / 0.3` evaluates to `7.000000000000001`,
 * and a plain `ceil` would add an eighth bin that nothing can ever land in.
 */
const BIN_COUNT_TOLERANCE = 1e-9;

/**
 * Count a sample into equal-width bins.
 *
 * Generic numeric bucketing — bins by *value*. It is deliberately unrelated to
 * grouping runs by outcome, which is domain knowledge and lives in
 * `./batchReport`; the two compose (group first, then histogram one group).
 *
 * Rules:
 *
 *   - Bins are half-open, `[lo, hi)`, except the last, which is closed, so the
 *     range's maximum is always counted.
 *   - Every bin has the same width. A `binWidth` that does not divide the range
 *     evenly extends the last bin rather than narrowing it: unequal bars would
 *     misrepresent the counts once drawn.
 *   - The range alone decides what is in range. Values outside it go to
 *     `below` / `above`, so nothing is ever silently dropped.
 *   - Edges are computed as `lo + i * width`, not by repeated addition, which
 *     drifts (ten additions of 0.1 give 0.9999999999999999).
 *   - The reported edges are the truth: a value is placed by comparing it with
 *     them, so it can never appear in a bin whose bounds exclude it.
 *   - A zero-width range cannot be divided, so it is one bin `[x, x]` whatever
 *     `binCount` or `binWidth` asks for.
 *
 * Returns `null` for an empty sample, like {@link summarize}. Options are
 * validated first, so a bad configuration throws even on an empty sample.
 * Does not mutate `xs`.
 *
 * @throws RangeError for invalid options, a non-finite value in `xs`, or a
 *   configuration needing more than 10,000 bins.
 */
export function histogram(
  xs: number[],
  options: HistogramOptions = {}
): Histogram | null {
  const { binCount, binWidth, range } = options;
  if (binCount !== undefined && binWidth !== undefined) {
    throw new RangeError('pass binCount or binWidth, not both');
  }
  if (
    binCount !== undefined &&
    !(Number.isInteger(binCount) && binCount >= 1)
  ) {
    throw new RangeError(`binCount must be an integer >= 1, got ${binCount}`);
  }
  if (binWidth !== undefined && !(Number.isFinite(binWidth) && binWidth > 0)) {
    throw new RangeError(
      `binWidth must be a finite number > 0, got ${binWidth}`
    );
  }
  if (
    range !== undefined &&
    !(
      Number.isFinite(range[0]) &&
      Number.isFinite(range[1]) &&
      range[0] <= range[1]
    )
  ) {
    throw new RangeError(
      `range must be finite with min <= max, got [${range[0]}, ${range[1]}]`
    );
  }

  if (xs.length === 0) return null;

  // One pass validates every value and finds the sample's own extent. A loop
  // rather than Math.min(...xs), which overflows the call stack on large input.
  let dataMin = Infinity;
  let dataMax = -Infinity;
  for (const x of xs) {
    if (!Number.isFinite(x)) {
      throw new RangeError(`histogram values must be finite, got ${x}`);
    }
    if (x < dataMin) dataMin = x;
    if (x > dataMax) dataMax = x;
  }

  const lo = range ? range[0] : dataMin;
  const max = range ? range[1] : dataMax;
  const span = max - lo;
  let below = 0;
  let above = 0;

  if (span === 0) {
    let count = 0;
    for (const x of xs) {
      if (x < lo) below += 1;
      else if (x > max) above += 1;
      else count += 1;
    }
    return { bins: [{ lo, hi: lo, count }], below, above, n: xs.length };
  }

  let count: number;
  let width: number;
  if (binWidth !== undefined) {
    const quotient = span / binWidth;
    const nearest = Math.round(quotient);
    count =
      Math.abs(quotient - nearest) <= BIN_COUNT_TOLERANCE * nearest
        ? nearest
        : Math.ceil(quotient);
    count = Math.max(1, count);
    width = binWidth;
  } else {
    count = binCount ?? Math.ceil(Math.log2(xs.length)) + 1;
    width = span / count;
  }
  if (count > MAX_HISTOGRAM_BINS) {
    throw new RangeError(
      `histogram would need ${count} bins; the limit is ${MAX_HISTOGRAM_BINS}`
    );
  }

  // The last edge must reach the range's max even if `lo + count * width`
  // rounds a hair short of it, or the maximum would fall outside every bin.
  const lastEdge = Math.max(lo + count * width, max);
  const edge = (i: number): number => (i === count ? lastEdge : lo + i * width);

  const counts = new Array<number>(count).fill(0);
  for (const x of xs) {
    if (x < lo) {
      below += 1;
      continue;
    }
    if (x > max) {
      above += 1;
      continue;
    }
    // The quotient is a fast first guess; near an edge it can be one bin off,
    // so settle against the edges actually reported.
    let i = Math.min(count - 1, Math.floor((x - lo) / width));
    while (i > 0 && x < edge(i)) i -= 1;
    while (i < count - 1 && x >= edge(i + 1)) i += 1;
    counts[i] += 1;
  }

  const bins = counts.map((c, i) => ({
    lo: edge(i),
    hi: edge(i + 1),
    count: c,
  }));
  return { bins, below, above, n: xs.length };
}
