import { resolve } from 'node:path';
import { loadGraphFromFile } from '../src/engine/io';
import { runSimulation } from '../src/engine/runner';
import type { GraphElement } from '../src/engine/types';

const MODEL_PATH = resolve('public/examples/marvel-snap-looplab.xml');

interface RunRow {
  run: number;
  seed: number;
  ticks: number;
  sessions: number;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  credits: number;
  boosters: number;
  collectionLevel: number;
  clRewardProgress: number;
  cardUnlockProgress: number;
  cubes: number;
  wildWins: number;
  wildRate: number;
  cardsOwned: number;
  cachesClaimed: number;
  tokens: number;
  ended: boolean;
}

function readNumberFlag(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} requires a number`);
  }
  return Math.floor(value);
}

function poolValue(elements: GraphElement[], name: string): number {
  const pool = elements.find(el => el.type === 'Pool' && el.text === name);
  if (!pool) throw new Error(`Missing pool: ${name}`);
  return pool.currentPoints ?? 0;
}

function mean(rows: RunRow[], key: keyof RunRow): number {
  return rows.reduce((sum, row) => sum + Number(row[key]), 0) / rows.length;
}

function range(rows: RunRow[], key: keyof RunRow): string {
  const values = rows.map(row => Number(row[key]));
  return `${Math.min(...values).toFixed(0)}–${Math.max(...values).toFixed(0)}`;
}

const runCount = Math.max(1, readNumberFlag('--runs', 10));
const baseSeed = readNumberFlag('--seed', 42);
const asJson = process.argv.includes('--json');
const { elements, warnings } = loadGraphFromFile(MODEL_PATH);

if (warnings.length > 0) {
  throw new Error(`Import warnings:\n${warnings.join('\n')}`);
}

const rows: RunRow[] = [];

for (let index = 0; index < runCount; index += 1) {
  const seed = baseSeed + index;
  const result = runSimulation(elements, { maxTicks: 200, seed });
  const wins = poolValue(result.finalState, 'Wins');
  const losses = poolValue(result.finalState, 'Losses');
  const matches = wins + losses;
  const wildWins = poolValue(result.finalState, 'Wild Bonus Won');
  const noWild = poolValue(result.finalState, 'No Wild Bonus');

  rows.push({
    run: index + 1,
    seed,
    ticks: result.ticksRun,
    sessions: poolValue(result.finalState, 'Sessions Played'),
    matches,
    wins,
    losses,
    winRate: matches === 0 ? 0 : (wins / matches) * 100,
    credits: poolValue(result.finalState, 'Credits'),
    boosters: poolValue(result.finalState, 'Boosters'),
    collectionLevel: poolValue(result.finalState, 'Collection Level'),
    clRewardProgress: poolValue(result.finalState, 'CL Reward Progress'),
    cardUnlockProgress: poolValue(result.finalState, 'Card Unlock Progress'),
    cubes: poolValue(result.finalState, 'Cubes'),
    wildWins,
    wildRate:
      wildWins + noWild === 0 ? 0 : (wildWins / (wildWins + noWild)) * 100,
    cardsOwned: poolValue(result.finalState, 'Cards Owned'),
    cachesClaimed: poolValue(result.finalState, 'CL Rewards Claimed'),
    tokens: poolValue(result.finalState, 'Tokens'),
    ended: result.gameEnded && result.endConditionName === 'End of Run',
  });
}

const validationErrors: string[] = [];
for (const row of rows) {
  if (!row.ended)
    validationErrors.push(`Run ${row.run} did not reach End of Run`);
  if (row.sessions !== 150)
    validationErrors.push(`Run ${row.run} ended at ${row.sessions} sessions`);
  if (row.matches !== 745)
    validationErrors.push(
      `Run ${row.run} resolved ${row.matches} matches, expected 745`
    );
  if (row.credits !== 75)
    validationErrors.push(`Run ${row.run} ended with ${row.credits} Credits`);
  if (row.collectionLevel !== 359)
    validationErrors.push(
      `Run ${row.run} ended at Collection Level ${row.collectionLevel}`
    );
  if (row.clRewardProgress !== 119)
    validationErrors.push(
      `Run ${row.run} ended with ${row.clRewardProgress} CL reward progress`
    );
  if (row.cardUnlockProgress !== 9)
    validationErrors.push(
      `Run ${row.run} ended with ${row.cardUnlockProgress} card unlock progress`
    );
  if (row.cardsOwned !== 21)
    validationErrors.push(`Run ${row.run} ended with ${row.cardsOwned} cards`);
  if (row.cachesClaimed !== 2)
    validationErrors.push(
      `Run ${row.run} claimed ${row.cachesClaimed} CL rewards`
    );
  if (row.tokens !== 0)
    validationErrors.push(`Run ${row.run} ended with ${row.tokens} Tokens`);
}

if (asJson) {
  console.log(
    JSON.stringify(
      {
        model: MODEL_PATH,
        runs: rows,
        summary: {
          averageWinRate: mean(rows, 'winRate'),
          averageWildRate: mean(rows, 'wildRate'),
          averageCredits: mean(rows, 'credits'),
          averageBoosters: mean(rows, 'boosters'),
          averageCollectionLevel: mean(rows, 'collectionLevel'),
          averageCubes: mean(rows, 'cubes'),
          creditsRange: range(rows, 'credits'),
          boostersRange: range(rows, 'boosters'),
          collectionLevelRange: range(rows, 'collectionLevel'),
          cubesRange: range(rows, 'cubes'),
        },
        validationErrors,
      },
      null,
      2
    )
  );
} else {
  console.log('# Marvel Snap Looplab results\n');
  console.log(
    '| Run | Seed | Matches | W-L | Win % | Credits | Boosters | CL | Cubes | Wild % | Cards | Caches |'
  );
  console.log('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of rows) {
    console.log(
      `| ${row.run} | ${row.seed} | ${row.matches} | ${row.wins}-${row.losses} | ${row.winRate.toFixed(1)} | ${row.credits} | ${row.boosters} | ${row.collectionLevel} | ${row.cubes} | ${row.wildRate.toFixed(1)} | ${row.cardsOwned} | ${row.cachesClaimed} |`
    );
  }

  console.log('\n## Summary\n');
  console.log(
    `- Runs completed: ${rows.filter(row => row.ended).length}/${rows.length}`
  );
  console.log(`- Sessions per run: ${mean(rows, 'sessions').toFixed(0)}`);
  console.log(`- Matches per run: ${mean(rows, 'matches').toFixed(0)}`);
  console.log(`- Average win rate: ${mean(rows, 'winRate').toFixed(1)}%`);
  console.log(
    `- Average wild-booster rate: ${mean(rows, 'wildRate').toFixed(1)}%`
  );
  console.log(
    `- Final Credits: ${mean(rows, 'credits').toFixed(0)} average (${range(rows, 'credits')})`
  );
  console.log(
    `- Final Boosters: ${mean(rows, 'boosters').toFixed(0)} average (${range(rows, 'boosters')})`
  );
  console.log(
    `- Collection Level: ${mean(rows, 'collectionLevel').toFixed(0)} average (${range(rows, 'collectionLevel')})`
  );
  console.log(
    `- Final Cubes: ${mean(rows, 'cubes').toFixed(0)} average (${range(rows, 'cubes')})`
  );
  console.log(`- Cards owned: ${mean(rows, 'cardsOwned').toFixed(0)} average`);
  console.log(
    `- CL caches claimed: ${mean(rows, 'cachesClaimed').toFixed(0)} average`
  );
  console.log(
    `- CL reward progress: ${mean(rows, 'clRewardProgress').toFixed(0)} average`
  );
  console.log(
    `- Card unlock progress: ${mean(rows, 'cardUnlockProgress').toFixed(0)} average`
  );
  console.log(`- Final Tokens: ${mean(rows, 'tokens').toFixed(0)} average`);

  console.log('\n## Validation\n');
  if (validationErrors.length === 0) {
    console.log(
      '- PASS: all runs reached the End of Run condition at 150 sessions.'
    );
    console.log(
      '- PASS: all runs resolved 745 matches (149 completed sessions × 5 matches).'
    );
    console.log(
      '- PASS: Credits, Collection Level, card ownership, rewards, progress, and Tokens balanced in every run.'
    );
  } else {
    for (const error of validationErrors) console.log(`- FAIL: ${error}`);
    process.exitCode = 1;
  }
}
