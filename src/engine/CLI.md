# Headless CLI

Run Machinations simulations from the command line without the UI. Entry point: [`cli.ts`](./cli.ts).

```bash
# from repo root
npm run sim -- path/to/graph.xml [options]
# or
npx tsx src/engine/cli.ts path/to/graph.xml [options]
```

## Options

| Flag                     | Description                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--max-ticks N`          | Max automatic ticks per run (default 1000). Stops early on game end.                                                                                             |
| `--runs N`               | Run count (default 1). `N=1` reports the triggered end condition; `N>1` prints an aggregated outcome report. `--collect-log` / `--trace` are ignored when `N>1`. |
| `--seed N`               | Deterministic PRNG seed. For `--runs N>1`, run _i_ uses `seed+i`.                                                                                                |
| `--format json\|summary` | Output format (default: summary).                                                                                                                                |
| `--collect-log`          | Include per-tick `tickLog` in JSON (single run only).                                                                                                            |
| `--trace`                | Verbose per-tick diary in output (single run only).                                                                                                              |
| `--max-trace-ticks N`    | Cap trace length.                                                                                                                                                |
| `-h, --help`             | Show help.                                                                                                                                                       |

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

### Multiple runs (probabilistic batch)

```bash
# 50/50 gate races "Heads Win" vs "Tails Win" — shows a real outcome distribution
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/probabilistic-race.xml --runs 100 --seed 42
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/probabilistic-race.xml --runs 100 --seed 42 --format json
```

Same `--seed` always yields the same batch; change the seed to explore a different distribution.

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
