import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGraphFromFile } from './io';
import { runSimulation } from './runner';

/**
 * Engine throughput benchmark.
 *
 * Runs seeded simulations over the tracked example models and reports
 * ticks/second, so performance changes are measurable instead of anecdotal.
 * Seeded runs keep the work deterministic across invocations.
 *
 *   npx tsx src/engine/benchmark.ts [--ticks N] [--repeat N]
 */

interface BenchResult {
  model: string;
  elements: number;
  ticksRun: number;
  msPerRun: number;
  ticksPerSec: number;
}

const MODELS = ['RPG.xml', 'Diablo3.xml', 'Soccer.xml', 'monopoly.xml'];

const HERE = resolvePath(fileURLToPath(import.meta.url), '..');

function bench(
  file: string,
  maxTicks: number,
  repeat: number
): BenchResult | { model: string; error: string } {
  const model = file.replace(/\.xml$/, '');
  let elements;
  try {
    elements = loadGraphFromFile(
      resolvePath(HERE, '..', '..', 'public', 'examples', file)
    ).elements;
  } catch (err) {
    return { model, error: err instanceof Error ? err.message : String(err) };
  }

  // Warm-up run so JIT compilation does not pollute the measurement.
  runSimulation(elements, { maxTicks, seed: 42 });

  let ticksRun = 0;
  const start = performance.now();
  for (let i = 0; i < repeat; i++) {
    ticksRun += runSimulation(elements, { maxTicks, seed: 42 }).ticksRun;
  }
  const elapsed = performance.now() - start;

  return {
    model,
    elements: elements.length,
    ticksRun: ticksRun / repeat,
    msPerRun: elapsed / repeat,
    ticksPerSec: ticksRun / (elapsed / 1000),
  };
}

function main(argv: string[]): void {
  const ticksIdx = argv.indexOf('--ticks');
  const repeatIdx = argv.indexOf('--repeat');
  const maxTicks = ticksIdx >= 0 ? Number(argv[ticksIdx + 1]) : 1000;
  const repeat = repeatIdx >= 0 ? Number(argv[repeatIdx + 1]) : 5;

  console.log(`Engine benchmark — ${maxTicks} ticks × ${repeat} runs (seeded)`);
  console.log('');
  console.log('model      elements  ticks/run  ms/run    ticks/sec');
  console.log('---------  --------  ---------  --------  ---------');
  for (const file of MODELS) {
    const r = bench(file, maxTicks, repeat);
    if ('error' in r) {
      console.log(`${r.model.padEnd(9)}  SKIPPED: ${r.error}`);
      continue;
    }
    console.log(
      `${r.model.padEnd(9)}  ${String(r.elements).padStart(8)}  ` +
        `${String(r.ticksRun).padStart(9)}  ${r.msPerRun.toFixed(1).padStart(8)}  ` +
        `${Math.round(r.ticksPerSec).toString().padStart(9)}`
    );
  }
}

function isMain(): boolean {
  if (typeof process === 'undefined' || !process.argv?.[1]) return false;
  try {
    return resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) {
  main(process.argv.slice(2));
}
