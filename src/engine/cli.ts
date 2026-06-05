import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import { loadGraphFromFile } from './io';
import { runSimulation } from './runner';
import type { GraphElement } from './types';

/**
 * Headless command-line entry point for the simulation engine.
 *
 * Usage:
 *   machinations-sim <graph.xml> [--max-ticks N] [--collect-log] [--format json|summary]
 *
 * Designed to be both invocable from the shell (via tsx / a compiled bin)
 * AND testable in-process via {@link runCli}.
 */

export interface CliOutcome {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ParsedArgs {
  filePath?: string;
  maxTicks: number;
  collectLog: boolean;
  format: 'json' | 'summary';
  seed?: number;
  showHelp: boolean;
  unknownFlag?: string;
}

const HELP_TEXT = `machinations-sim — headless Machinations simulation runner

Usage:
  machinations-sim <graph.xml> [options]

Options:
  --max-ticks N        Maximum number of ticks to run (default 1000).
  --seed N             Seed the PRNG for a deterministic, reproducible run.
  --collect-log        Include per-tick TickResult entries in JSON output.
  --format json        Print full RunSimulationResult as JSON to stdout.
  --format summary     Print a human-readable summary (default).
  -h, --help           Show this help text.

Exit codes:
  0  simulation completed (game ended OR maxTicks reached cleanly)
  1  load / parse error
  2  invalid arguments
`;

/**
 * `npm run sim -- <file> --seed 42` does not always forward `--flags` to the
 * script: npm parses them into its own config and exposes them as
 * `npm_config_*` environment variables instead. To keep `npm run sim` usable,
 * we reconstruct any missing flag tokens from those env vars and prepend them
 * to argv (explicit argv still wins, since it is parsed afterwards).
 */
function npmConfigArgv(): string[] {
  if (typeof process === 'undefined' || !process.env) return [];
  const env = process.env;
  const read = (name: string): string | undefined =>
    env[`npm_config_${name}`] ?? env[`npm_config_${name.replace(/-/g, '_')}`];

  const extra: string[] = [];
  const seed = read('seed');
  if (seed !== undefined && Number.isFinite(Number(seed)))
    extra.push('--seed', seed);
  const maxTicks = read('max-ticks');
  if (maxTicks !== undefined && Number.isFinite(Number(maxTicks)))
    extra.push('--max-ticks', maxTicks);
  const format = read('format');
  if (format === 'json' || format === 'summary') extra.push('--format', format);
  const collectLog = read('collect-log');
  if (collectLog === 'true' || collectLog === '') extra.push('--collect-log');
  return extra;
}

function parseArgs(rawArgv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    maxTicks: 1000,
    collectLog: false,
    format: 'summary',
    showHelp: false,
  };

  const argv = [...npmConfigArgv(), ...rawArgv];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      out.showHelp = true;
      continue;
    }
    if (a === '--collect-log') {
      out.collectLog = true;
      continue;
    }
    if (a === '--max-ticks') {
      const v = argv[++i];
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        out.unknownFlag = `--max-ticks expects a positive number, got "${v}"`;
        return out;
      }
      out.maxTicks = Math.floor(n);
      continue;
    }
    if (a === '--seed') {
      const v = argv[++i];
      const n = Number(v);
      if (!Number.isFinite(n)) {
        out.unknownFlag = `--seed expects a number, got "${v}"`;
        return out;
      }
      out.seed = Math.floor(n);
      continue;
    }
    if (a === '--format') {
      const v = argv[++i];
      if (v !== 'json' && v !== 'summary') {
        out.unknownFlag = `--format expects "json" or "summary", got "${v}"`;
        return out;
      }
      out.format = v;
      continue;
    }
    if (a.startsWith('--')) {
      out.unknownFlag = `Unknown flag: ${a}`;
      return out;
    }
    if (out.filePath == null) {
      out.filePath = a;
      continue;
    }
    out.unknownFlag = `Unexpected positional argument: ${a}`;
    return out;
  }

  return out;
}

function summarize(
  elements: GraphElement[],
  ticksRun: number,
  gameEnded: boolean,
  warnings: string[],
  seed?: number
): string {
  const lines: string[] = [];
  lines.push(
    `Simulation finished: ticksRun=${ticksRun} gameEnded=${gameEnded}` +
      (seed !== undefined ? ` seed=${seed}` : '')
  );

  if (warnings.length) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of warnings) lines.push(`  - ${w}`);
  }

  const interesting = elements.filter(
    e => e.type === 'Pool' || e.type === 'Register'
  );

  if (interesting.length) {
    lines.push('');
    lines.push('Final state:');
    for (const el of interesting) {
      if (el.type === 'Pool') {
        const total = el.currentPoints ?? 0;
        const breakdown = el.resourcesByColor
          ? Object.entries(el.resourcesByColor)
              .filter(([, n]) => n > 0)
              .map(([c, n]) => `${c}:${n}`)
              .join(', ')
          : '';
        lines.push(
          `  Pool#${el.id} ${el.text ? `"${el.text}" ` : ''}= ${total}` +
            (breakdown ? ` (${breakdown})` : '')
        );
      } else {
        lines.push(
          `  Register#${el.id} ${el.text ? `"${el.text}" ` : ''}= ${
            el.currentValue ?? 0
          }`
        );
      }
    }
  }

  return lines.join('\n') + '\n';
}

export function runCli(argv: string[]): CliOutcome {
  const args = parseArgs(argv);

  if (args.showHelp) {
    return { exitCode: 0, stdout: HELP_TEXT, stderr: '' };
  }

  if (args.unknownFlag) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `${args.unknownFlag}\n\n${HELP_TEXT}`,
    };
  }

  if (!args.filePath) {
    return {
      exitCode: 2,
      stdout: '',
      stderr: `Missing required <graph.xml> argument.\n\n${HELP_TEXT}`,
    };
  }

  let loaded;
  try {
    loaded = loadGraphFromFile(resolvePath(args.filePath));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      exitCode: 1,
      stdout: '',
      stderr: `Failed to load "${args.filePath}": ${msg}\n`,
    };
  }

  const result = runSimulation(loaded.elements, {
    maxTicks: args.maxTicks,
    collectLog: args.collectLog,
    seed: args.seed,
  });

  if (args.format === 'json') {
    const payload = {
      ticksRun: result.ticksRun,
      gameEnded: result.gameEnded,
      seed: args.seed,
      warnings: loaded.warnings,
      finalState: result.finalState,
      ...(args.collectLog ? { tickLog: result.tickLog } : {}),
    };
    return {
      exitCode: 0,
      stdout: JSON.stringify(payload, null, 2) + '\n',
      stderr: '',
    };
  }

  return {
    exitCode: 0,
    stdout: summarize(
      result.finalState,
      result.ticksRun,
      result.gameEnded,
      loaded.warnings,
      args.seed
    ),
    stderr: '',
  };
}

function isMain(): boolean {
  if (typeof process === 'undefined' || !process.argv?.[1]) return false;
  try {
    const entry = resolvePath(process.argv[1]);
    const here = fileURLToPath(import.meta.url);
    return entry === here;
  } catch {
    return false;
  }
}

if (isMain()) {
  const outcome = runCli(process.argv.slice(2));
  if (outcome.stdout) process.stdout.write(outcome.stdout);
  if (outcome.stderr) process.stderr.write(outcome.stderr);
  process.exit(outcome.exitCode);
}
