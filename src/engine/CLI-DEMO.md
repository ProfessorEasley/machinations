# Machinations Headless CLI Demo

This guide demonstrates the headless CLI for running simulations without the UI.

## Overview

The CLI (`src/engine/cli.ts`) provides a command-line interface to run Machinations simulations from XML files, suitable for:

- Batch processing simulations
- Integration with CI/CD pipelines
- Automated testing and validation
- Programmatic analysis via the `runCli()` function

## Basic Usage

### Format: Summary (Default)

Runs a simulation and prints a human-readable summary:

```bash
npx tsx src/engine/cli.ts path/to/simulation.xml
```

Example output:

```
=== Simulation Complete ===
ticksRun=10, gameEnded=false

Final State:
  Source#1 (Source) — activation: automatic
  Pool#2 (Pool) — currentPoints: 120, max: 500
  Drain#3 (Drain) — activation: automatic
  Resource Connection#4: 1 → 2 (10 per tick)
  Resource Connection#5: 2 → 3 (3 per tick)
```

### Format: JSON

Emits the full `RunSimulationResult` as JSON for programmatic processing:

```bash
npx tsx src/engine/cli.ts path/to/simulation.xml --format json
```

Output is a JSON object with structure:

```json
{
  "ticksRun": 10,
  "gameEnded": false,
  "finalState": [
    {
      "id": 1,
      "type": "Source",
      "activation": "automatic",
      ...
    },
    ...
  ],
  "tickLog": null
}
```

## Options

### `--max-ticks N`

Maximum number of ticks to run (default: 1000).

```bash
npx tsx src/engine/cli.ts path/to/simulation.xml --max-ticks 50
```

The simulation stops early if:

- The game ends condition is met, OR
- `maxTicks` is reached

### `--collect-log`

Include per-tick `TickResult` entries in JSON output (for debugging/analysis).

```bash
npx tsx src/engine/cli.ts path/to/simulation.xml --format json --collect-log
```

Output includes a `tickLog` array with detailed information about each tick.

### `--format json | summary`

Output format (default: summary).

### `-h, --help`

Show help text and exit.

## Example Simulations

### 1. Source → Pool (Basic)

**File:** `src/engine/__tests__/fixtures/source-pool.xml`

A single Source producing 5 resources per tick into a Pool.

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --max-ticks 10
```

**Expected:** Pool accumulates 50 resources (5/tick × 10 ticks).

### 2. Source → Pool → Drain (Accumulation)

**File:** `src/engine/__tests__/fixtures/pool-with-drain.xml`

Source produces 10/tick, Drain consumes 3/tick → Pool accumulates net 7/tick.

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/pool-with-drain.xml --max-ticks 10 --format json
```

**Expected:** Pool grows from 50 to ~120 resources over 10 ticks.

### 3. Multiple Sources → Convertor (Merging)

**File:** `src/engine/__tests__/fixtures/convertor-demo.xml`

Two Sources (colors: red, green) feed into a Convertor that transforms resources.

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/convertor-demo.xml --max-ticks 8
```

**Expected:** Convertor processes and combines multi-colored resources.

### 4. Gate Logic (Control Flow)

**File:** `src/engine/__tests__/fixtures/gate-logic.xml`

Source → Pool → Gate → Drain. Gate controls whether resources flow through.

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/gate-logic.xml --max-ticks 6
```

**Expected:** Resources blocked/released based on gate state.

### 5. Delay Circuit (Buffering)

**File:** `src/engine/__tests__/fixtures/delay-circuit.xml`

Source → Delay (holds for 3 ticks) → Pool. Demonstrates resource buffering.

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/delay-circuit.xml --max-ticks 10
```

**Expected:** Pool output lags behind source by ~3 ticks.

### 6. Multi-Branch Distribution

**File:** `src/engine/__tests__/fixtures/multi-branch.xml`

Single Source distributes resources across three parallel paths (3/tick, 4/tick, 2/tick).

```bash
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/multi-branch.xml --max-ticks 10 --format json --collect-log
```

**Expected:** Resources distributed proportionally across three pools.

## Exit Codes

- **0**: Simulation completed successfully (game ended or maxTicks reached cleanly)
- **1**: Load/parse error (file not found, invalid XML, etc.)
- **2**: Invalid arguments (missing file, bad flag value, etc.)

## Testing

All CLI functionality is tested in `src/engine/__tests__/cli.test.ts`:

```bash
npm test -- src/engine/__tests__/cli.test.ts
```

**Test coverage includes:**

- ✓ XML parsing and round-trip serialization
- ✓ Simulation with various element types (Source, Pool, Drain, Convertor, Gate, Delay, Register)
- ✓ JSON and summary output formats
- ✓ Tick collection and logging
- ✓ Error handling (file not found, invalid args, etc.)
- ✓ Multi-branch resource distribution
- ✓ Gate and delay mechanics

## Programmatic Usage (In-Process)

You can also use the CLI programmatically in tests or other Node.js code:

```typescript
import { runCli } from 'src/engine/cli';

const outcome = runCli([
  'path/to/simulation.xml',
  '--max-ticks',
  '100',
  '--format',
  'json',
  '--collect-log',
]);

if (outcome.exitCode === 0) {
  const result = JSON.parse(outcome.stdout);
  console.log(`Simulation ran for ${result.ticksRun} ticks`);
} else {
  console.error(outcome.stderr);
}
```

## Extending the CLI

To add a new simulation fixture:

1. Create an XML file in `src/engine/__tests__/fixtures/`
2. Add test cases in `src/engine/__tests__/cli.test.ts`:
   ```typescript
   describe('my-simulation', () => {
     const fixturePath = resolve(__dirname, 'fixtures', 'my-simulation.xml');

     it('loads and runs correctly', () => {
       const { elements } = loadGraphFromFile(fixturePath);
       const result = runSimulation(elements, { maxTicks: 10 });
       expect(result.ticksRun).toBe(10);
     });
   });
   ```
3. Run tests to validate:
   ```bash
   npm test -- src/engine/__tests__/cli.test.ts
   ```

## Troubleshooting

### "Failed to load" error (exit code 1)

- Check file path is correct and file exists
- Verify XML is well-formed (use an XML validator if unsure)
- Check file permissions

### "Unknown flag" error (exit code 2)

- Verify flag name (e.g., `--format`, not `--fmt`)
- Ensure flag values are correct (e.g., `--format json`, not `--format jason`)

### Unexpected simulation results

- Use `--format json --collect-log` to inspect tick-by-tick behavior
- Compare against equivalent browser simulation
- Check element configurations (e.g., activation types, resource amounts)
