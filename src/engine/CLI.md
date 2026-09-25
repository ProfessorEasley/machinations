# Headless CLI

Run Machinations simulations from the command line without the UI. Entry point: [`cli.ts`](./cli.ts).

```bash
# from repo root
npm run sim -- path/to/graph.xml [options]
# or
npx tsx src/engine/cli.ts path/to/graph.xml [options]
```

## Options

| Flag                          | Description                                                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--max-ticks N`               | Max automatic ticks per run (default 1000). Stops early on game end.                                                                                                                                           |
| `--runs N`                    | Run count (default 1). `N=1` reports the triggered end condition; `N>1` prints a statistical batch report (see [Reading the report](#reading-the-report)). `--collect-log` / `--trace` are ignored when `N>1`. |
| `--seed N`                    | Deterministic PRNG seed. For `--runs N>1`, run _i_ uses `seed+i`.                                                                                                                                              |
| `--format json\|summary\|csv` | Output format (default: summary). `csv` writes the batch report as CSV and needs `--runs N>1` (see [CSV output](#csv-output)).                                                                                 |
| `--collect-log`               | Include per-tick `tickLog` in JSON (single run only).                                                                                                                                                          |
| `--trace`                     | Verbose per-tick diary in output (single run only).                                                                                                                                                            |
| `--max-trace-ticks N`         | Cap trace length.                                                                                                                                                                                              |
| `-h, --help`                  | Show help.                                                                                                                                                                                                     |

**Exit codes:** `0` success · `1` load/parse error · `2` invalid arguments

## Examples

### Single run

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --max-ticks 10
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --max-ticks 10 --format json
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --format json --collect-log
```

Summary output includes `ticksRun`, `gameEnded`, `Outcome: <name>`, and final Pool/Register values.

### Quick run (end condition)

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/demo-win-condition.xml --format json
# JSON includes "endConditionName": "Victory"
```

### Multiple runs (Monte Carlo batch)

```bash
# 50/50 gate races "Heads Win" vs "Tails Win" — shows a real outcome distribution
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/probabilistic-race.xml --runs 100 --seed 42
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/probabilistic-race.xml --runs 100 --seed 42 --format json

# two outcomes that finish at very different speeds — per-outcome statistics
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/bimodal-outcomes.xml --runs 200 --seed 42
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/bimodal-outcomes.xml --runs 200 --seed 42 --format csv > report.csv
```

Same `--seed` always yields the same batch; change the seed to explore a different distribution.

#### Reading the report

**Average steps** is the mean of every run's length, censored runs included. It is
the batch's long-standing headline number and is left exactly as it was.

**Run length** is the same statistic computed over completed runs only, with a 95%
confidence interval on the mean plus the spread (sd, min, p50, p90, p95, max). On a
batch where nothing was censored the two agree. Where they differ, `Average steps`
is biased low and this is the honest figure.

The confidence interval is what tells you whether `--runs` was large enough. It
shrinks as `1/sqrt(n)`, so halving it costs four times the runs. Widen `--runs`
until it is tight enough for the decision you are making.

**The censoring note** appears when runs hit `--max-ticks` without ending. Such a run
reports `ticksElapsed == maxTicks`, which is a floor on its duration rather than a
measurement, so it is excluded from the run-length statistics. A model with no End
Condition censors _every_ run — `Average steps` then just restates the cap:

```
Average steps: 1000.00
Run length: no completed runs to measure.

Note: 120/120 run(s) hit the 1000-tick cap without ending.
```

**Outcomes** carries a 95% Wilson interval per row. Overlapping intervals mean the
batch cannot separate those outcomes: at `--runs 20` a 60/40 split is
indistinguishable from a coin flip, while at `--runs 4000` a 50.2/49.8 split
resolves. The interval says which case you are in.

Under each outcome row are that outcome's own run-length statistics:

```
Run length (200 completed runs): mean 20.71 ±2.64 steps (95% CI)
  sd 19.02  min 7  p50 13  p90 58.10  p95 66  max 77

Outcomes:
  Outcome                          #        %        95% CI
  Fast Finish                        166     83.0      77.2–87.6
    run length: n 166  mean 12.35 ±0.49 steps (95% CI)
      sd 3.22  var 10.37  p50 12  p90 16  p95 18
  Slow Finish                         34     17.0      12.4–22.8
    run length: n 34  mean 61.50 ±2.67 steps (95% CI)
      sd 7.94  var 63.05  p50 59  p90 71.70  p95 74.70
```

**Pooled and per-outcome figures.** The `Run length` block pools every completed
run; the lines under each outcome use that outcome's runs only. When outcomes
finish at different speeds the pooled figures describe neither: above, no run
took anywhere near the pooled mean of 20.71 steps, and the pooled sd of 19.02
measures the gap between the two outcomes rather than the spread within either.
Read the per-outcome lines in that case. On a batch with a single outcome the
two agree.

**Measured runs.** Run-length statistics — pooled and per outcome — count only
_measured_ runs: runs that completed by firing a named End Condition. Runs cut
off by `--max-ticks` are floors on their duration, not measurements, so they are
excluded; they appear as the `Stopped before end` outcome, whose line reads
`run length: not measured (hit the tick cap)`. `n` is the number of measured runs.

**Percentiles.** Every run-length and Final values summary in the report is built
with the same percentile set: p5, p10, p25, p50, p75, p90, p95 and p99, computed
by linear interpolation between order statistics (the R type-7 / numpy default).
Variance is the sample variance (`n - 1` denominator). The summary shows a subset;
`--format json` and `--format csv` carry the full set.

**Final values** gives mean/sd/p50/p95 for every Pool and Register, sampled from each
run's final state — the distribution of end-state resources across the batch.

**Unusual runs** lists runs identified as unusual by the report's rule — a flag
to look at a run, not proof that anything went wrong in it. The rule:

1. **Each outcome is judged on its own.** A run is compared with the other runs
   of the same outcome, never with a pooled batch. Pooled, a minority outcome
   that is simply slower than the rest would be flagged in its entirety.
2. **An outcome needs at least 20 measured runs** before it is judged. Tukey's
   fences come from the quartiles, and quartiles of a handful of runs are too
   noisy to trust.
3. **Tukey's rule proposes candidates:** measured run lengths below
   `p25 - 1.5 × IQR` or above `p75 + 1.5 × IQR` of that outcome.
4. **Common run lengths are dropped.** Run lengths are whole ticks, so an outcome
   that only ever takes a few distinct lengths can have its quartiles one step
   apart, and then every run at the next length out falls beyond a fence
   together. A candidate is kept only if its exact run length accounts for at
   most 5% of that outcome's measured runs — exactly 5% is still kept, so a
   single run in a 20-run outcome remains reportable.

Each line names the outcome the run was judged against, with the seed that
produced it:

```
Unusual runs (4):
  run #60 (Fast Finish, seed 102) — 21 steps
  run #73 (Fast Finish, seed 115) — 22 steps
  ...
  replay with: --seed 102 --trace
```

No `Unusual runs` block means no run was flagged in any outcome that was
checked. An outcome with 1–19 measured runs is **not checked**, which is not the
same as checked and clean, so the summary says so under its lines:

```
      outlier check skipped: too few measured runs
```

In JSON and CSV this is each outcome's `outliersChecked` / `outliers_checked`:
`true` means the check ran (whether or not it flagged anything); `false` means
the outcome had fewer than 20 measured runs, or none.

#### Investigating a single run

Every run records the seed it used (`seed + i`), so an interesting sample can be
replayed on its own. The report prints the command for the first unusual run
(`replay with: --seed 102 --trace` above).

```bash
# reproduces exactly that run, with a per-tick diary
npx tsx src/engine/cli.ts model.xml --seed 102 --trace
```

Or pick one out of the JSON yourself:

```bash
# the slowest completed run in the batch
npx tsx src/engine/cli.ts model.xml --runs 500 --seed 42 --format json \
  | jq '.outcomes | map(select(.completed)) | max_by(.ticksElapsed)'
```

An unseeded batch records `seed: null` on every run and cannot be replayed.

### CSV output

`--format csv` writes the full batch report as CSV — every statistic, including
the full percentile set, where the summary shows a subset. It needs `--runs N>1`
(a single run has no batch report; the CLI exits with code 2). stdout carries the
CSV only, so it can be redirected to a file; load warnings go to stderr.

```bash
npx tsx src/engine/cli.ts model.xml --runs 500 --seed 42 --format csv > report.csv
```

The Multiple Runs panel in the UI exports the same file: expand **Show
statistics** after a batch finishes and choose **Export CSV**. It is written by
the same serializer ([`batchReportCsv.ts`](./batchReportCsv.ts)), so a UI export
and `--format csv` for the same batch and seed are identical.

The file is one table. The `section` column says what each row describes, and
columns that do not apply to a section are empty. Rows come in this order:

| `section`           | Rows                                 | Columns filled                                                                                                                       |
| ------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `batch`             | one                                  | `total_runs`, `completed_runs`, `censored_runs`, `max_ticks`, `seed`, `average_steps`                                                |
| `pooled_run_length` | one                                  | `completed_runs`, the summary columns, `outliers` (total flagged)                                                                    |
| `outcome`           | one per outcome, most frequent first | `name`, `count`, `share_pct`, `share_ci_low`, `share_ci_high`, `completed_runs`, the summary columns, `outliers`, `outliers_checked` |
| `outlier`           | one per unusual run, in batch order  | `name` (the outcome), `run` (index in the batch), `seed`, `ticks`                                                                    |
| `final_value`       | one per Pool/Register, sorted by key | `name` (label), `key` (e.g. `Pool#3`), the summary columns                                                                           |

The summary columns are `n`, `mean`, `variance`, `std_dev`, `std_error`, `min`,
`max`, `p5` … `p99`, `mean_ci_low` and `mean_ci_high` (the 95% CI on the mean; empty
for `final_value`). An outcome with no measured runs leaves them empty.

Full column order:

```
section,name,key,total_runs,completed_runs,censored_runs,max_ticks,seed,average_steps,count,share_pct,share_ci_low,share_ci_high,n,mean,variance,std_dev,std_error,min,max,p5,p10,p25,p50,p75,p90,p95,p99,mean_ci_low,mean_ci_high,outliers,outliers_checked,run,ticks
```

Format details:

- Numbers are written at full precision (`20.70500000000001`, not `20.71`) with a
  `.` decimal separator, whatever the locale. Shares and their intervals are
  percentages (`83`, not `0.83`).
- Empty cells mean "not applicable" or "not measured"; `outliers_checked` is
  `true` or `false`.
- Rows end in CRLF. Text containing a comma, quote or line break is quoted, with
  inner quotes doubled (RFC 4180).
- Text starting with `=`, `+`, `-` or `@` is prefixed with `'` so a spreadsheet
  shows it instead of evaluating it as a formula — outcome and series names are
  user-written. Numbers are never prefixed.

### Fixtures

| Fixture                  | What it exercises                       |
| ------------------------ | --------------------------------------- |
| `source-pool.xml`        | Source → Pool                           |
| `pool-with-drain.xml`    | Accumulation (source faster than drain) |
| `convertor-demo.xml`     | Multi-source merging                    |
| `gate-logic.xml`         | Gate control flow                       |
| `delay-circuit.xml`      | Delay buffering                         |
| `multi-branch.xml`       | Parallel distribution                   |
| `demo-win-condition.xml` | End condition trigger                   |
| `probabilistic-race.xml` | Probabilistic outcomes (multiple runs)  |
| `skewed-run-length.xml`  | Skewed run lengths; unusual runs        |
| `bimodal-outcomes.xml`   | Outcomes with different run lengths     |

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/pool-with-drain.xml --max-ticks 10
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/gate-logic.xml --max-ticks 6 --format json
```

### Capture & analyze

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/pool-with-drain.xml --max-ticks 50 --format json > results.json

npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/multi-branch.xml --max-ticks 10 --format json | \
  jq '.finalState[] | select(.type=="Pool") | {id, currentPoints}'
```

## Tests

```bash
npm test -- src/engine/__tests__/cli.test.ts
```

## Programmatic usage

```typescript
import { runCli } from './cli';

const { exitCode, stdout, stderr } = runCli([
  'path/to/graph.xml',
  '--max-ticks',
  '100',
  '--format',
  'json',
]);
if (exitCode === 0) console.log(JSON.parse(stdout));
```

Engine functions (`runSimulation`, `runMultiple`) are also available directly from [`runner.ts`](./runner.ts) for in-process use without the CLI layer.

## Troubleshooting

- **Exit 1** — check file path and XML validity.
- **Exit 2** — verify flag names and values (`--help`).
- **Unexpected results** — use `--format json --collect-log` or `--trace` to inspect tick-by-tick behavior.
