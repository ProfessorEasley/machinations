# Headless CLI Quick Commands

Run these commands from the repo root to test the new simulation fixtures:

## Basic Examples

```bash
# Run a simple source→pool simulation (summary format)
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --max-ticks 10

# Run with JSON output for programmatic processing
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --max-ticks 10 --format json

# Run and include tick-by-tick log (for debugging)
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --max-ticks 5 --format json --collect-log
```

## Test Different Scenarios

```bash
# Pool with drain (shows accumulation logic)
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/pool-with-drain.xml --max-ticks 10

# Convertor demo (multi-source merging)
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/convertor-demo.xml --max-ticks 8

# Gate logic (control flow)
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/gate-logic.xml --max-ticks 6 --format json

# Delay circuit (buffering demonstration)
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/delay-circuit.xml --max-ticks 10

# Multi-branch distribution
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/multi-branch.xml --max-ticks 10 --format json --collect-log
```

## Run All Tests

```bash
# Run the full test suite for CLI functionality
npm test -- src/engine/__tests__/cli.test.ts

# Run with verbose output
npm test -- src/engine/__tests__/cli.test.ts --reporter=verbose

# Run and watch for changes
npm test -- src/engine/__tests__/cli.test.ts --watch
```

## Error Cases (Testing Error Handling)

```bash
# Test file not found (should exit with code 1)
npx tsx src/engine/cli.ts nonexistent.xml
echo "Exit code: $?"

# Test invalid max-ticks value (should exit with code 2)
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/source-pool.xml --max-ticks abc
echo "Exit code: $?"

# Show help
npx tsx src/engine/cli.ts --help
```

## Capture Output to Files

```bash
# Save simulation results to JSON file
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/pool-with-drain.xml --max-ticks 50 --format json > results.json

# Save summary with logs
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/multi-branch.xml --max-ticks 20 --format json --collect-log > debug-output.json
```

## Batch Processing

```bash
# Run all fixtures and capture results
for fixture in src/engine/__tests__/fixtures/*.xml; do
  echo "Running: $fixture"
  npx tsx src/engine/cli.ts "$fixture" --max-ticks 10 --format json | jq '.ticksRun, (.finalState | length)'
done
```

## Real-Time Analysis

```bash
# Parse JSON and extract specific metrics
npx tsx src/engine/cli.ts src/engine/__tests__/fixtures/multi-branch.xml --max-ticks 10 --format json | \
  jq '.finalState[] | select(.type=="Pool") | {id, currentPoints}'
```

---

For detailed documentation, see [CLI-DEMO.md](./CLI-DEMO.md)
