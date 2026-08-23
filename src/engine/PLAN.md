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
├── runner.ts                 ← runSimulation(), runMultiple()
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

## CLI

```bash
npx tsx src/engine/cli.ts <graph.xml> [--max-ticks N] [--runs N] [--seed N] [--format json|summary]
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
| `index.ts` barrel export     | Optional — imports use module paths directly |

## Remaining optional work

- Add `src/engine/index.ts` to re-export public API (cosmetic; no behavior change)
- Further slim `Canvas.tsx` by moving any leftover simulation wrappers

## Validation

```bash
npm run build && npm test -- --run && npm run lint
```
