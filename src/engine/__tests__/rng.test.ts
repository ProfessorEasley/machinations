import { describe, it, expect, afterEach, vi } from 'vitest';
import { setSeed, reseed, getSeed, isSeeded, random, randomInt } from '../rng';

describe('engine/rng — seeded PRNG', () => {
  afterEach(() => {
    // Always restore unseeded mode so other test files are unaffected.
    setSeed(undefined);
    vi.restoreAllMocks();
  });

  it('delegates to Math.random when no seed is configured', () => {
    setSeed(undefined);
    expect(isSeeded()).toBe(false);
    expect(getSeed()).toBeNull();

    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.4242);
    expect(random()).toBe(0.4242);
    expect(spy).toHaveBeenCalled();
  });

  it('produces a deterministic sequence for a given seed', () => {
    setSeed(12345);
    const first = [random(), random(), random(), random()];

    setSeed(12345);
    const second = [random(), random(), random(), random()];

    expect(second).toEqual(first);
    expect(isSeeded()).toBe(true);
    expect(getSeed()).toBe(12345);
  });

  it('produces different sequences for different seeds', () => {
    setSeed(1);
    const a = [random(), random(), random()];
    setSeed(2);
    const b = [random(), random(), random()];
    expect(b).not.toEqual(a);
  });

  it('reseed() restarts the stream from the configured seed', () => {
    setSeed(777);
    const a = random();
    random();
    random();
    reseed();
    const b = random();
    expect(b).toBe(a);
  });

  it('always returns values in [0, 1)', () => {
    setSeed(999);
    for (let i = 0; i < 1000; i++) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randomInt is deterministic and within bounds', () => {
    setSeed(2024);
    const a = Array.from({ length: 20 }, () => randomInt(1, 6));
    setSeed(2024);
    const b = Array.from({ length: 20 }, () => randomInt(1, 6));
    expect(b).toEqual(a);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});
