# Engine Separation Plan

Extract simulation logic from `Canvas.tsx` (~8k lines) into standalone headless modules under `src/engine/`.

## Status

| Step | File                                       | Status  |
| ---- | ------------------------------------------ | ------- |
| 1    | `types.ts`                                 | Done    |
| 2    | `helpers.ts`                               | Done    |
| 3    | `reset.ts`                                 | Done    |
| 4    | `tick.ts`                                  | Done    |
| 5    | `simulationLoop.ts`                        | Done    |
| 6    | `runner.ts`                                | Done    |
| 7    | `index.ts` + rewire Canvas                 | Pending |
| 8    | `__tests__/tick.test.ts`, `runner.test.ts` | Pending |
| 9    | Seeded RNG (future)                        | Pending |

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

## Step 9: Seeded RNG (Future)

Add optional `rng?: () => number` to `TickOptions`. Update `shouldActivateTrigger`, `randInt`, `chooseGateOutputs`. Enables deterministic replay and reproducible multi-run stats.

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
Step 1-> Step 2 -> Step 3 \
                         -> Step 4 -> Step 5 -> Step 7 -> Step 8 -> Step 9
                                   -> Step 6 /
```
