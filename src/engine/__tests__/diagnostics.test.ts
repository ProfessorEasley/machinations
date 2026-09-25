import { describe, it, expect } from 'vitest';
import type { GraphElement } from '../types';
import { createStarvationRecorder } from '../diagnostics';
import { runSimulation } from '../runner';

/**
 * Contract tests for the starvation / dead-economy detector. Driven two
 * ways: hand-fed tick snapshots for exact control over streak shape, and a
 * real `runSimulation` run to prove the `onTick` wiring works too.
 */

const pool = (id: number, currentPoints: number, text?: string): GraphElement =>
  ({
    id,
    type: 'Pool',
    x: 0,
    y: 0,
    currentPoints,
    resourcesByColor: {},
    text,
  }) as GraphElement;

describe('engine/diagnostics — starvation recorder', () => {
  it('does not flag a pool that never runs dry', () => {
    const rec = createStarvationRecorder([pool(1, 10)]);
    for (let i = 0; i < 20; i++) rec.observe([pool(1, 10)]);

    const result = rec.finish();
    expect(result.starved).toBe(false);
    expect(result.pools).toEqual([
      expect.objectContaining({
        key: 'Pool#1',
        ticksObserved: 20,
        ticksEmpty: 0,
        longestEmptyStreak: 0,
        starved: false,
      }),
    ]);
  });

  it('flags a pool empty for at least minConsecutiveTicks (default 5)', () => {
    const rec = createStarvationRecorder([pool(1, 0)]);
    for (let i = 0; i < 5; i++) rec.observe([pool(1, 0)]);

    const result = rec.finish();
    expect(result.starved).toBe(true);
    expect(result.pools[0]).toMatchObject({
      ticksObserved: 5,
      ticksEmpty: 5,
      longestEmptyStreak: 5,
      starved: true,
    });
  });

  it('does not flag a short empty stretch below the threshold', () => {
    const rec = createStarvationRecorder([pool(1, 0)]);
    // Empty for 4 ticks, then recovers — one short of the default minimum.
    rec.observe([pool(1, 0)]);
    rec.observe([pool(1, 0)]);
    rec.observe([pool(1, 0)]);
    rec.observe([pool(1, 0)]);
    rec.observe([pool(1, 5)]);

    const result = rec.finish();
    expect(result.starved).toBe(false);
    expect(result.pools[0].longestEmptyStreak).toBe(4);
  });

  it('resets the streak on recovery, so two short dips do not combine into one long one', () => {
    const rec = createStarvationRecorder([pool(1, 0)]);
    // 3 empty, 1 tick recovered, 3 empty again — no single streak reaches 5,
    // even though 6 of 7 ticks were empty overall.
    for (let i = 0; i < 3; i++) rec.observe([pool(1, 0)]);
    rec.observe([pool(1, 1)]);
    for (let i = 0; i < 3; i++) rec.observe([pool(1, 0)]);

    const result = rec.finish();
    expect(result.pools[0]).toMatchObject({
      ticksObserved: 7,
      ticksEmpty: 6,
      longestEmptyStreak: 3,
      starved: false,
    });
  });

  it('tracks the longest streak, not just the most recent one', () => {
    const rec = createStarvationRecorder([pool(1, 0)]);
    for (let i = 0; i < 8; i++) rec.observe([pool(1, 0)]); // long dead stretch
    rec.observe([pool(1, 1)]); // recovers
    for (let i = 0; i < 2; i++) rec.observe([pool(1, 0)]); // short dip after

    const result = rec.finish();
    expect(result.pools[0].longestEmptyStreak).toBe(8);
    expect(result.starved).toBe(true);
  });

  it('respects a custom threshold and minConsecutiveTicks', () => {
    // "Empty" means <= 10 here, and 2 consecutive ticks is enough to flag.
    const rec = createStarvationRecorder([pool(1, 10)], {
      threshold: 10,
      minConsecutiveTicks: 2,
    });
    rec.observe([pool(1, 10)]);
    rec.observe([pool(1, 10)]);

    const result = rec.finish();
    expect(result.pools[0]).toMatchObject({
      ticksEmpty: 2,
      longestEmptyStreak: 2,
      starved: true,
    });
  });

  it('tracks multiple pools independently in one run', () => {
    const rec = createStarvationRecorder([pool(1, 0), pool(2, 10, 'Gold')]);
    for (let i = 0; i < 5; i++) {
      rec.observe([pool(1, 0), pool(2, 10, 'Gold')]);
    }

    const result = rec.finish();
    expect(result.starved).toBe(true);
    const byKey = Object.fromEntries(result.pools.map(p => [p.key, p]));
    expect(byKey['Pool#1'].starved).toBe(true);
    expect(byKey['Pool#2'].starved).toBe(false);
    expect(byKey['Pool#2'].label).toBe('Gold');
  });

  it('lists a pool that was never observed, seeded from the template, as unstarved', () => {
    const rec = createStarvationRecorder([pool(1, 5)]);
    const result = rec.finish();

    expect(result.starved).toBe(false);
    expect(result.pools).toEqual([
      expect.objectContaining({
        key: 'Pool#1',
        ticksObserved: 0,
        longestEmptyStreak: 0,
        starved: false,
      }),
    ]);
  });

  it('falls back to the key when the pool has no text label', () => {
    const rec = createStarvationRecorder([pool(1, 5)]);
    expect(rec.finish().pools[0].label).toBe('Pool#1');
  });

  describe('wired through runSimulation via onTick', () => {
    it('flags a pool with no incoming Source as starved for a full run', () => {
      // A lone Pool that starts at 0 with nothing feeding it stays empty for
      // every observed tick — the simplest possible dead economy.
      const elements: GraphElement[] = [
        {
          id: 1,
          type: 'Pool',
          x: 0,
          y: 0,
          max: Infinity,
          currentPoints: 0,
          resourcesByColor: {},
          pullMode: 'pull any',
        } as GraphElement,
      ];

      const rec = createStarvationRecorder(elements);
      runSimulation(elements, {
        maxTicks: 10,
        onTick: els => rec.observe(els),
      });

      const result = rec.finish();
      expect(result.starved).toBe(true);
      expect(result.pools[0]).toMatchObject({
        // onstart tick + 10 automatic ticks
        ticksObserved: 11,
        ticksEmpty: 11,
        longestEmptyStreak: 11,
      });
    });

    it('does not flag a pool fed on every automatic tick by an automatic Source', () => {
      const source: GraphElement = {
        id: 1,
        type: 'Source',
        x: 0,
        y: 0,
        activation: 'automatic',
      } as GraphElement;
      const poolEl: GraphElement = {
        id: 2,
        type: 'Pool',
        x: 100,
        y: 0,
        max: Infinity,
        currentPoints: 0,
        resourcesByColor: {},
        pullMode: 'pull any',
      } as GraphElement;
      const conn: GraphElement = {
        id: 3,
        type: 'Resource Connection',
        connectedToStart: 1,
        connectedToEnd: 2,
        text: '5',
        color: '#FF0000',
        inhibited: false,
      } as GraphElement;

      const elements = [source, poolEl, conn];
      const rec = createStarvationRecorder(elements);
      runSimulation(elements, {
        maxTicks: 10,
        onTick: els => rec.observe(els),
      });

      const result = rec.finish();
      expect(result.starved).toBe(false);
      // An 'automatic' Source doesn't fire on the onstart tick (only on
      // 'automatic' ticks), so the Pool reads empty for that one tick and
      // full for the other 10 — one short of the default 5-tick minimum.
      expect(result.pools[0]).toMatchObject({
        ticksObserved: 11,
        ticksEmpty: 1,
        longestEmptyStreak: 1,
      });
    });
  });
});
