/**
 * Seeded pseudo-random number generator for the simulation engine.
 *
 * The whole engine draws randomness from this single module-level generator so
 * that a run can be made fully reproducible: given the same model, the same
 * seed, and the same tick count, every probabilistic decision (converter output
 * probabilities, dice gates, trigger chances, register `D` rolls, random AI
 * picks) resolves identically.
 *
 * Behaviour:
 *   - When no seed is configured, {@link random} transparently delegates to
 *     `Math.random()`. This keeps non-deterministic interactive use unchanged
 *     and lets existing tests that spy on `Math.random` keep working.
 *   - When a seed is configured via {@link setSeed}, a deterministic
 *     `mulberry32` PRNG is used instead. Calling {@link reseed} (or
 *     {@link setSeed} again) restarts the sequence from the configured seed,
 *     which is how a run gets a clean, repeatable random stream.
 */

let configuredSeed: number | null = null;
let state = 0;

/**
 * Configure the generator's seed.
 *
 * Pass a finite number to enable deterministic mode (and immediately restart
 * the stream from that seed). Pass `null`/`undefined`/non-finite to disable
 * seeding and fall back to `Math.random()`.
 */
export function setSeed(seed: number | null | undefined): void {
  if (seed == null || !Number.isFinite(seed)) {
    configuredSeed = null;
    return;
  }
  configuredSeed = Math.floor(seed) >>> 0;
  state = configuredSeed;
}

/**
 * Restart the random stream from the currently configured seed. No-op when no
 * seed is configured. Call this at the start of each run to guarantee that
 * repeated runs of the same model produce the same outcome.
 */
export function reseed(): void {
  if (configuredSeed !== null) state = configuredSeed;
}

/** The currently configured seed, or `null` when running unseeded. */
export function getSeed(): number | null {
  return configuredSeed;
}

/** True when the generator is in deterministic (seeded) mode. */
export function isSeeded(): boolean {
  return configuredSeed !== null;
}

/**
 * Return the next pseudo-random float in the half-open interval [0, 1).
 *
 * Drop-in replacement for `Math.random()`. Uses the seeded mulberry32 stream
 * when a seed is configured; otherwise delegates to `Math.random()`.
 */
export function random(): number {
  if (configuredSeed === null) return Math.random();

  // mulberry32
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive, drawn from {@link random}. */
export function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}
