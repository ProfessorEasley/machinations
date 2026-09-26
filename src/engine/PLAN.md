# Engine Architecture

Simulation logic lives in `src/engine/`. The React UI (`Canvas.tsx`, `Playground.tsx`) drives the same engine the CLI uses. XML is parsed once via `src/utils/graphXmlImport.ts`.

## Layout

```
src/utils/graphXmlImport.ts   ← shared XML parser (native + legacy Machinations)
src/engine/
├── types.ts                  ← GraphElement, tick/run options & results
├── helpers.ts                ← label parsing, gates, registers, transfers
├── reset.ts                  ← resetElements() between runs
├── tick.ts                   ← simulateTick() — one simulation step
├── simulationLoop.ts         ← startSimulationLoop() — timed tick wrapper
├── runner.ts                 ← runSimulation(), runMultiple(), aggregateRuns()
├── stats.ts                  ← generic statistics: summarize, percentiles, CIs, IQR, histogram
├── batchReport.ts            ← buildBatchReport(): pooled + per-outcome stats, outliers
├── reportFormat.ts           ← shared number/percentile formatting for CLI + UI
├── batchReportCsv.ts         ← batchReportToCsv(): the report as CSV
├── rng.ts                    ← seeded PRNG (mulberry32)
├── io.ts                     ← loadGraphFromFile / loadGraphFromXml
├── cli.ts                    ← headless CLI entry point
├── trace.ts                  ← optional per-tick trace output
└── __tests__/                ← engine + CLI tests
```

## UI integration

| UI run mode   | Engine path                                                             |
| ------------- | ----------------------------------------------------------------------- |
| Normal Run    | `resetElements` → `simulateTick` via `startSimulationLoop` (1 tick/sec) |
| Quick Run     | `resetElements` → batched `simulateTick` in RAF loop                    |
| Multiple Runs | `runMultiple` (or equivalent batch loop in Canvas) with seed            |

Canvas still owns rendering, token animation, and undo history. All tick math is in `tick.ts`.

Canvas runs its own chunked batch loop rather than calling `runMultiple`, so it can
animate, pause and cancel between runs. The two stay interchangeable where it counts:
both reseed per run with `seed + i`, both record the same `RunOutcome` fields, and a
finished canvas batch is a `MultipleRunResult` — so either can be handed to
`buildBatchReport` and produce the same statistics.

## Batch reports

A batch (`MultipleRunResult`) becomes a `BatchReport` in `buildBatchReport`, the one
place that computes statistics. The layers, from generic to presentation:

| Layer               | Owns                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- |
| `stats.ts`          | Generic numerics: `summarize` (n−1 variance, type-7 percentiles), CIs, Tukey, histogram |
| `batchReport.ts`    | Domain rules: censoring, outcome grouping, `REPORT_PERCENTILES`, outlier checks         |
| `reportFormat.ts`   | Display formatting shared by CLI and UI                                                 |
| `batchReportCsv.ts` | CSV serialization                                                                       |
| CLI, Run panel      | Presentation only — they read the report and never compute                              |

The report carries pooled run length plus a run-length summary per outcome. Outliers
are judged per outcome, only for outcomes with at least 20 measured runs, and Tukey
candidates whose exact run length holds more than 5% of the outcome are dropped. See
[`CLI.md`](./CLI.md#reading-the-report) for what the figures mean and the CSV schema.

## CLI

```bash
npx tsx src/engine/cli.ts <graph.xml> [--max-ticks N] [--runs N] [--seed N] [--format json|summary|csv]
```

See [`CLI.md`](./CLI.md) for full options. Prefer `npx tsx` over `npm run sim --` on Windows when passing flags.

## XML schemas

Both the UI and CLI accept:

- **Native** — `<diagram>` with typed tags (`<source>`, `<pool>`, `<resourceConnection>`, …) and explicit `id` / `from` / `to`
- **Legacy Machinations** — `<graph version="v4.04">` with `<node symbol="…">` and ordinal connection refs

Official-scale examples ship in `public/examples/`. Test fixtures are in `src/engine/__tests__/fixtures/`.

## Status

| Component                    | Status                                       |
| ---------------------------- | -------------------------------------------- |
| Types, helpers, reset, tick  | Done                                         |
| Simulation loop, runner, RNG | Done                                         |
| Canvas wired to engine       | Done                                         |
| Headless CLI + io            | Done                                         |
| Legacy XML import            | Done                                         |
| Engine test suite            | Done                                         |
| Batch report + CSV export    | Done — CLI (`--format csv`) and Run panel    |
| `index.ts` barrel export     | Optional — imports use module paths directly |

## Remaining optional work

- Add `src/engine/index.ts` to re-export public API (cosmetic; no behavior change)
- Further slim `Canvas.tsx` by moving any leftover simulation wrappers

## Validation

```bash
npm run build && npm test -- --run && npm run lint
```
