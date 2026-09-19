import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadGraphFromFile } from '../io';
import { runSimulation } from '../runner';
import type { GraphElement } from '../types';

const modelPath = resolve('public/examples/marvel-snap-looplab.xml');

function poolValue(elements: GraphElement[], name: string): number {
  const pool = elements.find(el => el.type === 'Pool' && el.text === name);
  if (!pool) throw new Error(`Missing pool: ${name}`);
  return pool.currentPoints ?? 0;
}

describe('Marvel Snap Looplab model', () => {
  it('imports without warnings and reaches the 150-session end condition', () => {
    const { elements, warnings } = loadGraphFromFile(modelPath);
    const result = runSimulation(elements, { maxTicks: 200, seed: 1 });
    const wins = poolValue(result.finalState, 'Wins');
    const losses = poolValue(result.finalState, 'Losses');

    expect(warnings).toEqual([]);
    expect(result.gameEnded).toBe(true);
    expect(result.endConditionName).toBe('End of Run');
    expect(result.ticksRun).toBe(150);
    expect(poolValue(result.finalState, 'Sessions Played')).toBe(150);
    expect(wins + losses).toBe(745);
    expect(poolValue(result.finalState, 'Match Attempts')).toBe(5);
  });

  it('keeps the economy and card-progression totals balanced', () => {
    const { elements } = loadGraphFromFile(modelPath);
    const result = runSimulation(elements, { maxTicks: 200, seed: 1 });
    const state = result.finalState;
    const cardPoolNames = [
      'Common Card',
      'Uncommon Card',
      'Rare Card',
      'Epic Card',
      'Legendary Card',
      'Ultra Card',
      'Infinity Card',
      'Cards Completed',
    ];
    const cardsInProgression = cardPoolNames.reduce(
      (total, name) => total + poolValue(state, name),
      0
    );

    expect(poolValue(state, 'Credits')).toBe(75);
    expect(poolValue(state, 'Collection Level')).toBe(359);
    expect(poolValue(state, 'CL Reward Progress')).toBe(119);
    expect(poolValue(state, 'Card Unlock Progress')).toBe(9);
    expect(poolValue(state, 'Cards Owned')).toBe(21);
    expect(cardsInProgression).toBe(21);
    expect(poolValue(state, 'Tokens')).toBe(0);
    expect(poolValue(state, 'CL Rewards Claimed')).toBe(2);
  });

  it('produces the expected probabilities across deterministic runs', () => {
    const { elements } = loadGraphFromFile(modelPath);
    let wins = 0;
    let matches = 0;
    let wildWins = 0;
    let wildAttempts = 0;

    for (let seed = 1; seed <= 10; seed += 1) {
      const result = runSimulation(elements, { maxTicks: 200, seed });
      const runWins = poolValue(result.finalState, 'Wins');
      const runLosses = poolValue(result.finalState, 'Losses');
      const runWildWins = poolValue(result.finalState, 'Wild Bonus Won');
      const noWild = poolValue(result.finalState, 'No Wild Bonus');

      wins += runWins;
      matches += runWins + runLosses;
      wildWins += runWildWins;
      wildAttempts += runWildWins + noWild;
    }

    const winRate = (wins / matches) * 100;
    const wildRate = (wildWins / wildAttempts) * 100;

    expect(winRate).toBeGreaterThanOrEqual(52);
    expect(winRate).toBeLessThanOrEqual(58);
    expect(wildRate).toBeGreaterThanOrEqual(8);
    expect(wildRate).toBeLessThanOrEqual(12);
  });
});
