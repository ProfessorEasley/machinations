# Engine Separation Plan

Extract simulation logic from `Canvas.tsx` (~8k lines) into standalone headless modules under `src/engine/`.

## Status

| Step   | File                                       | Status  |
| ------ | ------------------------------------------ | ------- |
| 1      | `types.ts`                                 | Done    |
| 2      | `helpers.ts`                               | Done    |
| 3      | `reset.ts`                                 | Done    |
| 4      | `tick.ts`                                  | Done    |
| 5      | `simulationLoop.ts`                        | Done    |
| 6      | `runner.ts`                                | Done    |
| 7      | `index.ts` + rewire Canvas                 | Pending |
| 8      | `__tests__/tick.test.ts`, `runner.test.ts` | Done    |
| 9      | Headless CLI (`io.ts`, `cli.ts`)           | Done    |
| 9a-bis | Legacy `<graph>` XML import in CLI         | Done    |

## Step 1: Types

`types.ts` -- `GraphElement`, `GraphElementType`, `ResourceTransfer`, `FractionalDispatchState`, `LabelKind`, `TickOptions`, `TickResult`, `SimulationEvent`. Canvas.tsx imports from here.

## Step 2: Helpers

`helpers.ts` -- Move ~25 pure functions + 3 constants from Canvas.tsx (L1188-2018, ~830 lines).

Functions: `normalizeColor`, `isResourceLikeConnection`, `getElementValue`, `sanitizeResourceLabelValue`, `parseTriggerChance`, `shouldActivateTrigger`, `parseMultiplicandDelta`, `parseMultiplyExpression`, `getBaseInputAmountFromMultiplyLabel`, `evaluateDynamicResourceLabel`, `applyDynamicResourceLabelsMutable`, `applyDynamicResourceLabels`, `recordTransfer`, `handleDecimalResourceDispatch`, `randInt`, `evaluateArithmeticExpression`, `parseConnectionLabel`, `isTriggerOutput`, `classifyLabel`, `parseInterval`, `parseCond`, `getIntervalWrapMax`, `getDiceSides`, `generateGateValue`, `chooseGateOutputs`.

Constants: `RESOURCE_LABEL_EPSILON`, `MULTIPLICAND_LABEL_REGEX`, `MULTIPLY_EXPRESSION_REGEX`.

Geometry helpers (`getClosestPointOnPolyline`, `getPointOnPolylineAtT`, etc.) stay in Canvas -- they are rendering-only.

## Step 3: Reset

`reset.ts` -- Single `resetElements(elements): GraphElement[]` replacing the **duplicated** reset blocks in Canvas.tsx (start L4706-4757, stop L4830-4881).

Per-type reset: Pool (currentPoints, resourcesByColor), Register (currentValue), End Condition (inhibited, isBlinking), Convertor (inputResources, outputResources), Trader (traderInputs, traderOutputs), Resource Connection with dynamic labels (recompute text).

## Step 4: Tick

`tick.ts` -- Move `runSimulationTick` (Canvas.tsx L2566-3991, ~1425 lines) into:

```
simulateTick(elements, options: TickOptions): TickResult
```

Key changes:

- Tick counter + fractional dispatch via `TickOptions` (not React refs)
- Replace `window.__GAME_ENDED__` / `document.dispatchEvent` with `TickResult.events`
- Inline `evaluateStateCondition` + `updateStateConnectionVisualState` (pure logic, not DOM)
- Gate `console.log` behind `options.debug`
- Imports: `RegisterExpression`, `parseAiScript`/`selectAiCommand`, `ChartUtils`, all from `helpers.ts`

Canvas keeps a thin wrapper that calls `simulateTick` and handles UI-only side effects (DOM events, token animation).

Status: Done.

## Step 5: Simulation Loop

`simulationLoop.ts` -- Headless `setInterval` wrapper (~40 lines):

```
startSimulationLoop({ intervalMs, shouldSkipTick?, onTick, onError? }): { stop() }
```

Canvas replaces inline `setInterval` with this.

Status: Done.

## Step 6: Runner

`runner.ts` -- Synchronous multi-tick runner for headless/backend use (~50 lines):

```
runSimulation(elements, { maxTicks }): { finalState, tickLog: TickResult[] }
```

Calls `resetElements` then loops `simulateTick`. Stops early on game-end event.

Status: Done.

## Step 7: Barrel + Rewire Canvas

`index.ts` -- Re-exports from all engine modules. Consolidate Canvas imports. Net ~2300 line reduction in Canvas.tsx.

Status: In progress (Canvas was rewired to `simulateTick` and `startSimulationLoop`; barrel `index.ts` still pending).

## Step 8: Tests

`__tests__/tick.test.ts` -- Fixture-based, no React/DOM:

- Source -> Pool (resource flow over N ticks)
- Gate routing (deterministic conditions)
- Register formula evaluation
- End Condition fires game-end event
- resetElements returns to initial state

`__tests__/runner.test.ts`:

- runSimulation completes maxTicks
- runSimulation stops early on game-end

Status: Done.

Latest validation snapshot:

- Build status: zero TypeScript errors.
- Tests: 117 passing across 11 files.
- Coverage includes focused tests for `tick.ts`, `runner.ts`, `simulationLoop.ts`, and the new `io.ts` + `cli.ts`.

## Step 9: Headless CLI

Status: Done.

Goal: run a saved `.xml` graph end-to-end from the terminal with no browser, no React, no DOM. Same engine the UI uses, just driven by a Node entry point.

### 9a. `io.ts` -- headless XML loader (Done)

`src/engine/io.ts` is a thin wrapper over `src/utils/graphXmlImport.ts`, which is the **single shared XML parser** used by both the CLI and the UI. It uses `fast-xml-parser` (no browser `DOMParser`), so it works in Node, Vitest, and the browser.

- Public surface:
  - `loadGraphFromXml(xmlText): { elements: GraphElement[]; warnings: string[] }`
  - `loadGraphFromFile(path): { elements, warnings }` (wraps `fs.readFileSync`)
- Replicates the per-type initialization logic the UI uses (Pool `currentPoints`/`resourcesByColor`, Register `currentValue`, End Condition `inhibited`, etc.).
- Handles `<walletData>` JSON for Convertor/Trader and `<script>` CDATA for Artifical Intelligence.

### 9a-bis. Legacy `<graph>` import (Done)

The same `parseGraphFromXmlText` in `src/utils/graphXmlImport.ts` now accepts **both** schemas, so the CLI can run the official Machinations examples (`machinations_examples/official examples/games/*.xml`) directly:

- **Native** — `<diagram>` root, one tag per element type (`<source>`, `<pool>`, `<resourceConnection>` …), explicit `id` attributes, `from` / `to` endpoints. Produced by `serializeGraphElementsToXml`.
- **Legacy Machinations** — `<graph version="v4.04">` root, `<node symbol="…">` and `<connection type="…">`, no explicit ids on most elements, endpoints reference siblings by **document-order ordinal** (`start="38"` ≙ the element at document position 38).

Attribute aliases the legacy importer translates to native names: `caption` → `text`, `activationMode` → `activation`, `startingResources` → `number`, `capacity` → `max` (`-1` ⇒ unlimited), `displayCapacity` → `displayLimit`, `position`/`captionPos` → `labelPosition`, `start`/`end` → `from`/`to`, plus the `GroupBox` → `Group` and `Converter` → `Convertor` symbol aliases.

`Canvas.tsx`'s prior inline `parseGraphFromXml` (DOM-based) has been removed; it now imports `parseGraphFromXmlText` from the shared module like the CLI does.

### 9b. `cli.ts` -- Node entry point (Done)

`src/engine/cli.ts`:

```
machinations-sim <graph.xml> [--max-ticks N] [--collect-log] [--format json|summary]
```

- Hand-rolled argv parser, no new dep.
- `runCli(argv): { exitCode, stdout, stderr }` is exported for in-process testing; a `if (isMain())` guard wires it up to `process.exit` when invoked directly.
- `--format summary` (default): final Pool/Register state + `ticksRun` + `gameEnded`.
- `--format json`: full result as JSON; `tickLog` only included with `--collect-log`.
- Exit codes: `0` success, `1` load/parse error, `2` invalid arguments.

### 9c. `package.json` wiring (Done)

- `"sim": "tsx src/engine/cli.ts"` under `scripts`.
- `tsx` added to `devDependencies`.
- Recommended invocation: `npx tsx src/engine/cli.ts <graph.xml> --max-ticks N`. (Note: `npm run sim` strips `--*` flags before forwarding due to a long-standing npm argv quirk; `npx tsx` is the clean path until we ship a real `bin`.)

### 9d. Tests (Done)

`src/engine/__tests__/cli.test.ts` (7 tests, all passing):

- `loadGraphFromFile` parses the fixture into 3 elements with correct types.
- `runSimulation` accumulates resources from a Source(automatic) -> Pool over N ticks.
- `runCli --format summary` reports pool state and exits 0.
- `runCli --format json` emits a parseable result.
- `runCli` reports load failure with exit code 1.
- `runCli` reports invalid args with exit code 2.
- `loadGraphFromXml` round-trips an inline document (Pool init, Register defaults).

Fixture: `src/engine/__tests__/fixtures/source-pool.xml`.

### Validation (Done)

```
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --max-ticks 10  --format json
=>
Simulation finished: ticksRun=10 gameEnded=false

Final state:
  Pool#2 = 50 (#FF0000:50)
```

Build, lint, and 117/117 tests pass.

## Validation

After every step: `npm run build && npm run test -- --run && npm run lint` must pass. No user-visible behavior change.

## Validation Tasks

### **1. Logic Testing (`tick.test.ts`)**

- **Resource Flow**: Check that Sources fill Pools at the correct rate per tick.
- **Gates**: Ensure resources route correctly through deterministic gates.
- **Formulas**: Verify Register labels (e.g., `a + b`) calculate correctly.
- **Events**: Confirm `GAME_ENDED` triggers when conditions are met.

### **2. Execution Testing (`runner.test.ts`)**

- **Multi-Tick**: Run 100 ticks and verify the final resource counts.
- **Early Stop**: Ensure the simulation stops immediately if the game ends.

## Dependency Order

```
Step 1 -> Step 2 -> Step 3 \
                          -> Step 4 -> Step 5 -> Step 7 -> Step 8
                                    -> Step 6 -----------------> Step 9
```

Step 9 only needs `runner.ts` (Step 6) and the new `io.ts`; it does not block on the Canvas rewire.
